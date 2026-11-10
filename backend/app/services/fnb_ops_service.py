"""F&B operations ported from TapMenu: settlement, discounts/coupons, rush, KOT, counter codes, cash shifts,
menu categories, menu JSON import/export, sections, table admin + QR, room-link rotation and table reservations.

Builds on pos_service.py (pricing, folio posting, table sync) instead of duplicating it.
"""
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.errors import ConflictException, ForbiddenException, NotFoundException, ValidationException
from backend.app.models.pos import (
    DiningSession, MenuCategory, MenuItem, POSCoupon, POSOrder, POSSection, POSShift, POSTable, TableReservation,
)
from backend.app.models.reservation import Stay
from backend.app.models.room import Room
from backend.app.schemas.pos import (
    CategoryOut, CouponIn, CouponOut, POSOrderResponse, ReservationIn, ReservationOut, ReservationUpdate, SectionOut,
    SettleRequest, ShiftOut, TableIn, TableUpdate,
)
from backend.app.services import fnb_config, receipt_service
from backend.app.models.folio import FolioLineItem, MasterFolio
from backend.app.services.pos_service import (
    ACTIVE, OPEN_AT_TABLE, PENDING, _items_equivalent, _price_line, assert_available, round_total,
    _aware, _invalidate_menu_cache, _categories_cache, _CATEGORIES_CACHE_TTL_SECONDS, _post_to_folio, _sync_table, _with_id, resolve_in_house, tax_for_items, to_order_response,
)

STATION_ALIASES = {
    "kitchen": "MAIN_KITCHEN", "main": "MAIN_KITCHEN", "food": "MAIN_KITCHEN", "grill": "TANDOOR_GRILL", "tandoor": "TANDOOR_GRILL",
    "bar": "BAR", "drinks": "DRINKS", "beverage": "DRINKS", "beverages": "DRINKS", "bakery": "BAKERY", "dessert": "DESSERT", "desserts": "DESSERT",
}
STATION_TO_TAPMENU = {"MAIN_KITCHEN": "kitchen", "TANDOOR_GRILL": "grill", "BAR": "bar", "DRINKS": "drinks", "BAKERY": "bakery", "DESSERT": "dessert"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return _aware(dt).isoformat() if dt else None


async def _order(db: AsyncSession, property_id: str, order_id: str) -> POSOrder:
    o = await db.get(POSOrder, order_id)
    if not o or o.property_id != property_id:
        raise NotFoundException("Order not found.")
    return o


# ── coupons ──────────────────────────────────────────────────────────────────
def coupon_out(c: POSCoupon) -> CouponOut:
    return CouponOut(
        id=c.coupon_id, code=c.code, kind=c.kind, value=c.value, minOrderPaise=c.min_order_minor, maxDiscountPaise=c.max_discount_minor,
        description=c.description or "", categories=c.categories or [], singleUse=c.single_use, usedAt=_iso(c.used_at),
        expiresAt=_iso(c.expires_at), isActive=c.is_active, source=c.source,
    )


async def find_coupon(db: AsyncSession, property_id: str, code: str) -> POSCoupon:
    c = (await db.execute(select(POSCoupon).where(
        POSCoupon.property_id == property_id, POSCoupon.code == code.strip().upper(), POSCoupon.is_active.is_(True),
    ))).scalars().first()
    if not c or (c.single_use and c.used_at) or (c.expires_at and _aware(c.expires_at) < _now()):
        raise ValidationException("That coupon is invalid, expired or already used.")
    return c


def coupon_discount(c: POSCoupon, items: List[dict], subtotal: int) -> int:
    if subtotal < (c.min_order_minor or 0):
        raise ValidationException(f"This coupon needs a minimum order of ₹{(c.min_order_minor or 0) // 100}.")
    cats = {x.upper() for x in (c.categories or [])}
    base = sum(it["pricePaise"] * it["quantity"] for it in items if not cats or (it.get("category") or "").upper() in cats) if cats else subtotal
    off = base * c.value // 100 if c.kind == "PERCENT" else c.value
    if c.max_discount_minor:
        off = min(off, c.max_discount_minor)
    return max(0, min(off, subtotal))


# Orders that can still change: not paid, not closed. AWAITING_PAYMENT is excluded because the guest is paying a fixed amount.
EDITABLE = (PENDING,) + ACTIVE + ("DELIVERED",)


def _lines(o: POSOrder) -> List[dict]:
    """The order's lines, each with a stable lineId (older orders get index-based ids)."""
    return [{**it, "lineId": it.get("lineId") or f"L{n}", "seq": it.get("seq") or 1} for n, it in enumerate(o.items or [])]


async def _reprice(db: AsyncSession, o: POSOrder) -> None:
    """Recompute subtotal, coupon discount, tax and round-off after lines change; keep a room-service folio in step."""
    cfg = await fnb_config.get_config(db, o.property_id)
    items = o.items or []
    old_sub, old_tax, old_total = o.subtotal_minor, o.tax_minor, o.total_minor
    subtotal = sum(it["pricePaise"] * it["quantity"] for it in items)
    discount = min(o.discount_minor or 0, subtotal)
    if o.coupon_code:
        c = (await db.execute(select(POSCoupon).where(POSCoupon.property_id == o.property_id, POSCoupon.code == o.coupon_code))).scalars().first()
        if c:
            try:
                discount = coupon_discount(c, items, subtotal)
            except ValidationException:
                discount, o.coupon_code = 0, None  # the bill fell below the coupon's minimum
    tax = tax_for_items(items, discount, o.tax_percent if o.tax_percent is not None else cfg.gstPercent)
    total, round_off = round_total(subtotal - discount + tax, cfg.roundOffTotal and o.order_type != "ROOM_SERVICE")
    o.subtotal_minor, o.discount_minor, o.tax_minor, o.total_minor, o.round_off_minor = subtotal, discount, tax, total, round_off
    if o.order_type == "ROOM_SERVICE" and o.stay_id and total != old_total:
        folio = (await db.execute(select(MasterFolio).where(MasterFolio.stay_id == o.stay_id, MasterFolio.status == "OPEN"))).scalars().first()
        if folio:
            d_sub, d_tax, d_total = subtotal - old_sub, tax - old_tax, total - old_total
            if d_total > 0 and folio.outstanding_balance_minor + d_total > folio.credit_limit_minor:
                raise ConflictException("This would go over the room's credit limit. Please contact the front desk.")
            db.add(FolioLineItem(
                folio_id=folio.folio_id, business_date=_now().strftime("%Y-%m-%d"), transaction_type="FNB_CHARGE", service_category="ROOM_SERVICE",
                sac_hsn_code="996331", description=f"Room Service {o.order_number} ({'items added' if d_total > 0 else 'items cancelled'})",
                debit_minor=max(d_sub, 0), credit_minor=max(-d_sub, 0), net_minor=d_sub, tax_minor=d_tax,
                posted_by="POS_SYSTEM", reference_number=o.order_number,
            ))
            folio.total_charges_minor += d_total
            folio.total_taxes_minor += d_tax
            folio.outstanding_balance_minor += d_total


def _import_image_url(it: Dict[str, Any]) -> Optional[str]:
    """Image link from an import row: `imageUrl` (or the older `image`). Supports http(s) URLs and root-relative paths like `/images/...`."""
    for key in ("imageUrl", "image", "localImageUrl"):
        v = it.get(key)
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.lower().startswith(("https://", "http://", "/")):
                return v_clean[:2000]
    return None


class FnbOps:
    # ── running orders: add items, cancel one item, move table ───────────────
    @staticmethod
    async def add_items(db: AsyncSession, pid: str, order_id: str, lines, notes: Optional[str]) -> POSOrderResponse:
        """Add dishes to an order already sent. They form a new KOT round, so the kitchen prints only the new dishes."""
        o = await _order(db, pid, order_id)
        if o.paid_at or o.status not in EDITABLE:
            raise ConflictException("This order is paid or closed. Start a new order instead.")
        ids = {l.menuItemId for l in lines}
        menu = {m.item_id: m for m in (await db.execute(
            select(MenuItem).where(MenuItem.property_id == pid, MenuItem.item_id.in_(ids), MenuItem.is_active.is_(True))
        )).scalars().all()}
        await assert_available(db, pid, menu, ids)
        cfg = await fnb_config.get_config(db, pid)
        seq = (o.kot_seq or 1) + 1
        new = [{**_price_line(menu[l.menuItemId], l, cfg.gstPercent), "seq": seq} for l in lines]
        existing = _lines(o)
        for nl in new:
            match = next((el for el in existing if _items_equivalent(el, nl)), None)
            if match is not None:
                if not match.get("rounds"):
                    prev_seq = match.get("seq") or 1
                    match["rounds"] = [{"seq": prev_seq, "quantity": match["quantity"]}]
                match["quantity"] += nl["quantity"]
                match["rounds"].append({"seq": seq, "quantity": nl["quantity"]})
            else:
                nl["rounds"] = [{"seq": seq, "quantity": nl["quantity"]}]
                existing.append(nl)
        o.items = existing
        o.kot_seq = seq
        if notes:
            o.notes = f"{o.notes}\n{notes}".strip()[:1000] if o.notes else notes
        o.estimated_prep_minutes = max(o.estimated_prep_minutes or 15, *[it.get("prepMinutes") or 15 for it in new])
        if o.status in ("READY", "DELIVERED"):
            o.status = "QUEUED"  # back on the kitchen board for the new dishes
        await _reprice(db, o)
        o.updated_at = _now()
        await db.flush()
        await _sync_table(db, pid, o.table_id)
        await db.commit()
        fnb_config.bump(pid)
        return to_order_response(o)

    @staticmethod
    async def void_item(db: AsyncSession, pid: str, order_id: str, line_id: str, quantity: int, reason: str, by: str) -> POSOrderResponse:
        """Cancel some or all of one line. Cancelling the last dish cancels the whole order."""
        o = await _order(db, pid, order_id)
        if o.paid_at or o.status not in EDITABLE:
            raise ConflictException("This order is paid or closed, so its dishes cannot be cancelled here.")
        lines = _lines(o)
        line = next((l for l in lines if l["lineId"] == line_id), None)
        if not line:
            raise NotFoundException("That dish is not on this order.")
        if quantity > line["quantity"]:
            raise ValidationException(f"Only {line['quantity']} on the order.")
        if quantity == line["quantity"] and len(lines) == 1:
            from backend.app.services.pos_service import apply_status
            o.void_reason = reason.strip()[:200]
            await apply_status(db, o, "CANCELLED")
            await db.commit()
            return to_order_response(o)
        printed = (o.kot_printed_seq or 0) >= (line.get("seq") or 1)
        seq = (o.kot_seq or 1) + 1
        line["quantity"] -= quantity
        o.items = [l for l in lines if l["quantity"] > 0]
        o.voided_items = list(o.voided_items or []) + [{
            "lineId": line_id, "name": line["name"], "variantName": line.get("variantName"), "quantity": quantity,
            "pricePaise": line["pricePaise"], "reason": reason.strip()[:200], "by": by[:50], "at": _now().isoformat(),
            # A cancellation slip is only useful if the kitchen already has that dish on paper.
            "seq": seq, "noSlip": not printed,
        }]
        o.kot_seq = seq
        await _reprice(db, o)
        o.updated_at = _now()
        await db.flush()
        await _sync_table(db, pid, o.table_id)
        await db.commit()
        fnb_config.bump(pid)
        return to_order_response(o)

    @staticmethod
    async def move_table(db: AsyncSession, pid: str, order_id: str, table_id: str, all_on_table: bool) -> List[POSOrderResponse]:
        """Move a dine-in order, or every open order on its table, to another table."""
        o = await _order(db, pid, order_id)
        if o.order_type != "DINE_IN" or not o.table_id:
            raise ValidationException("Only dine-in orders sit at a table.")
        if o.status not in (PENDING,) + OPEN_AT_TABLE + ("AWAITING_PAYMENT",):
            raise ConflictException("This order is closed.")
        target = await db.get(POSTable, table_id)
        if not target or target.property_id != pid or not getattr(target, "is_active", True):
            raise NotFoundException("Table not found.")
        if target.status == "MAINTENANCE":
            raise ConflictException(f"Table {target.table_number} is blocked.")
        source = o.table_id
        if source == target.table_id:
            raise ValidationException("The order is already at that table.")
        moving = [o]
        if all_on_table:
            moving = (await db.execute(select(POSOrder).where(
                POSOrder.property_id == pid, POSOrder.table_id == source,
                POSOrder.status.in_((PENDING,) + OPEN_AT_TABLE + ("AWAITING_PAYMENT",)),
            ))).scalars().all()
        for m in moving:
            m.table_id, m.table_number, m.updated_at = target.table_id, target.table_number, _now()
        await db.flush()
        await _sync_table(db, pid, source)
        await _sync_table(db, pid, target.table_id)
        await db.commit()
        fnb_config.bump(pid)
        return [to_order_response(m) for m in moving]


    # ── coupons (super admin) ────────────────────────────────────────────────
    @staticmethod
    async def list_coupons(db: AsyncSession, pid: str) -> List[CouponOut]:
        res = await db.execute(select(POSCoupon).where(POSCoupon.property_id == pid).order_by(POSCoupon.created_at.desc()).limit(500))
        return [coupon_out(c) for c in res.scalars().all()]

    @staticmethod
    async def save_coupon(db: AsyncSession, pid: str, data: CouponIn, coupon_id: Optional[str] = None) -> CouponOut:
        code = data.code.strip().upper()
        clash = await db.scalar(select(POSCoupon.coupon_id).where(POSCoupon.property_id == pid, POSCoupon.code == code, POSCoupon.coupon_id != (coupon_id or "")))
        if clash:
            raise ConflictException("A coupon with that code already exists.")
        c = await db.get(POSCoupon, coupon_id) if coupon_id else POSCoupon(property_id=pid)
        if not c or c.property_id != pid:
            raise NotFoundException("Coupon not found.")
        c.code, c.kind, c.value, c.min_order_minor = code, data.kind, data.value, data.minOrderPaise
        c.max_discount_minor, c.description, c.categories = data.maxDiscountPaise, data.description, [x.upper() for x in data.categories]
        c.single_use, c.is_active = data.singleUse, data.isActive
        c.expires_at = datetime.fromisoformat(data.expiresAt) if data.expiresAt else None
        if c.kind == "PERCENT" and c.value > 100:
            raise ValidationException("A percent coupon cannot exceed 100%.")
        db.add(c)
        await db.commit()
        return coupon_out(c)

    @staticmethod
    async def delete_coupon(db: AsyncSession, pid: str, coupon_id: str) -> None:
        c = await db.get(POSCoupon, coupon_id)
        if not c or c.property_id != pid:
            raise NotFoundException("Coupon not found.")
        await db.delete(c)
        await db.commit()

    # ── settlement ───────────────────────────────────────────────────────────
    @staticmethod
    async def settle(db: AsyncSession, pid: str, order_id: str, req: SettleRequest, can_skip_pin: bool, can_discount: bool = True) -> POSOrderResponse:
        o = await _order(db, pid, order_id)
        if o.status in ("CANCELLED", "BILLED") or o.paid_at:
            raise ConflictException("This order is already closed.")
        if o.order_type == "ROOM_SERVICE":
            raise ConflictException("Room-service orders are billed on the guest folio.")
        cfg = await fnb_config.get_config(db, pid)
        subtotal = o.subtotal_minor
        discount, coupon = o.discount_minor or 0, None  # a coupon the guest applied when ordering stays unless replaced
        keep_code = o.coupon_code
        if req.couponCode:
            coupon = await find_coupon(db, pid, req.couponCode)
            discount = coupon_discount(coupon, o.items or [], subtotal)
        elif req.discountPaise:
            discount = min(subtotal, req.discountPaise)
            over_limit = discount * 100 > subtotal * cfg.maxDiscountPercentWithoutPin
            if not can_skip_pin and (over_limit or not can_discount):
                if not await fnb_config.check_pin(db, pid, req.managerPin):
                    raise ForbiddenException(
                        f"Discounts above {cfg.maxDiscountPercentWithoutPin}% need the manager PIN." if can_discount
                        else "Only a captain or admin can give a discount. Ask them, or enter the manager PIN.")
        taxable = subtotal - discount
        tax = tax_for_items(o.items or [], discount, o.tax_percent if o.tax_percent is not None else cfg.gstPercent)
        # Charge-to-room goes on the folio, and the room invoice does its own rounding.
        total, round_off = round_total(taxable + tax, cfg.roundOffTotal and req.method != "ROOM")

        if req.method == "CASH" and req.tenderedPaise is not None and req.tenderedPaise < total:
            raise ValidationException("Cash tendered is less than the bill.")
        if req.method == "SPLIT":
            parts = {k: int(v) for k, v in (req.split or {}).items() if k in ("cash", "digital")}
            if sum(parts.values()) != total:
                raise ValidationException("Split amounts must add up to the bill.")
        o.discount_minor, o.tax_minor, o.total_minor, o.round_off_minor = discount, tax, total, round_off
        if req.method == "ROOM":
            if not req.roomNumber:
                raise ValidationException("Choose the room to charge.")
            stay, room, folio = await resolve_in_house(db, pid, room_number=req.roomNumber)
            if folio.outstanding_balance_minor + total > folio.credit_limit_minor:
                raise ConflictException("This would go over the room's credit limit. Please contact the front desk.")
            o.room_number, o.stay_id = room.room_number, stay.stay_id
            _post_to_folio(db, folio, o, _now())
        shift = (await db.execute(select(POSShift).where(POSShift.property_id == pid, POSShift.status == "OPEN"))).scalars().first()
        o.payment_method = req.method
        o.split_amounts = {k: int(v) for k, v in (req.split or {}).items()} if req.method == "SPLIT" else None
        o.tendered_minor = req.tenderedPaise if req.method == "CASH" else None
        o.coupon_code = coupon.code if coupon else (keep_code if not req.discountPaise else None)
        o.paid_at = _now()
        o.shift_id = shift.shift_id if shift else None
        if req.customerName:
            o.guest_name = req.customerName.strip()
        if req.customerPhone:
            o.customer_phone = req.customerPhone.strip()
        if coupon and coupon.single_use:
            coupon.used_at = _now()
        if o.status == "DELIVERED":
            o.status = "BILLED"
        elif o.status == "AWAITING_PAYMENT":  # guest chose online but paid at the counter instead
            o.status = "QUEUED"  # paid at the counter in front of staff, so it is accepted already
            o.accepted_at = _now()
        o.updated_at = _now()
        await db.flush()
        await _sync_table(db, pid, o.table_id, settled=o.status == "BILLED")
        await db.commit()
        receipt_service.queue_receipt(o.order_id)
        return to_order_response(o)

    @staticmethod
    async def set_priority(db: AsyncSession, pid: str, order_id: str, rush: bool) -> POSOrderResponse:
        o = await _order(db, pid, order_id)
        o.is_rush = rush
        await db.commit()
        fnb_config.bump(pid)
        return to_order_response(o)

    @staticmethod
    async def mark_kot(db: AsyncSession, pid: str, order_id: str) -> POSOrderResponse:
        o = await _order(db, pid, order_id)
        o.kot_printed_at = o.kot_printed_at or _now()
        o.kot_printed_seq = o.kot_seq or 1  # printed by hand: every round so far is on paper
        await db.commit()
        fnb_config.bump(pid)
        return to_order_response(o)

    @staticmethod
    async def by_counter_code(db: AsyncSession, pid: str, code: str) -> POSOrderResponse:
        o = (await db.execute(select(POSOrder).where(
            POSOrder.property_id == pid, POSOrder.counter_code == code, POSOrder.paid_at.is_(None), POSOrder.status != "CANCELLED",
        ).order_by(POSOrder.created_at.desc()))).scalars().first()
        if not o:
            raise NotFoundException(f"No unpaid order found with counter code #{code}.")
        return to_order_response(o)

    # ── cash shifts ──────────────────────────────────────────────────────────
    @staticmethod
    async def _cash_sales(db: AsyncSession, pid: str, shift: POSShift) -> int:
        rows = (await db.execute(select(POSOrder).where(
            POSOrder.property_id == pid, POSOrder.shift_id == shift.shift_id, POSOrder.status != "CANCELLED",
        ))).scalars().all()
        total = 0
        for o in rows:
            if o.payment_method == "CASH":
                total += o.total_minor
            elif o.payment_method == "SPLIT":
                total += int((o.split_amounts or {}).get("cash", 0))
        return total

    @staticmethod
    async def _shift_out(db: AsyncSession, pid: str, s: POSShift) -> ShiftOut:
        cash = await FnbOps._cash_sales(db, pid, s)
        return ShiftOut(
            id=s.shift_id, status=s.status, openedAt=_iso(s.opened_at), closedAt=_iso(s.closed_at), openingFloatPaise=s.opening_float_minor,
            cashSalesPaise=cash, expectedCashPaise=s.expected_cash_minor if s.expected_cash_minor is not None else s.opening_float_minor + cash,
            closingCashPaise=s.closing_cash_minor, variancePaise=s.variance_minor,
        )

    @staticmethod
    async def active_shift(db: AsyncSession, pid: str) -> Optional[ShiftOut]:
        s = (await db.execute(select(POSShift).where(POSShift.property_id == pid, POSShift.status == "OPEN"))).scalars().first()
        return await FnbOps._shift_out(db, pid, s) if s else None

    @staticmethod
    async def open_shift(db: AsyncSession, pid: str, user_id: str, float_paise: int) -> ShiftOut:
        if await FnbOps.active_shift(db, pid):
            raise ConflictException("A shift is already open. Close it first.")
        s = POSShift(property_id=pid, opened_by=user_id, opening_float_minor=float_paise, status="OPEN", opened_at=_now())
        db.add(s)
        await db.commit()
        return await FnbOps._shift_out(db, pid, s)

    @staticmethod
    async def close_shift(db: AsyncSession, pid: str, user_id: str, counted: int) -> ShiftOut:
        s = (await db.execute(select(POSShift).where(POSShift.property_id == pid, POSShift.status == "OPEN"))).scalars().first()
        if not s:
            raise NotFoundException("No open shift to close.")
        expected = s.opening_float_minor + await FnbOps._cash_sales(db, pid, s)
        s.status, s.closed_by, s.closed_at = "CLOSED", user_id, _now()
        s.closing_cash_minor, s.expected_cash_minor, s.variance_minor = counted, expected, counted - expected
        await db.commit()
        return await FnbOps._shift_out(db, pid, s)

    @staticmethod
    async def shift_history(db: AsyncSession, pid: str) -> List[ShiftOut]:
        res = await db.execute(select(POSShift).where(POSShift.property_id == pid).order_by(POSShift.opened_at.desc()).limit(30))
        return [await FnbOps._shift_out(db, pid, s) for s in res.scalars().all()]

    # ── categories ───────────────────────────────────────────────────────────
    @staticmethod
    async def categories(db: AsyncSession, pid: str) -> List[CategoryOut]:
        hit = _categories_cache.get(pid)
        if hit and time.monotonic() - hit[0] < _CATEGORIES_CACHE_TTL_SECONDS:
            return hit[1]
        out = await FnbOps._load_categories(db, pid)
        _categories_cache[pid] = (time.monotonic(), out)
        return out

    @staticmethod
    async def _load_categories(db: AsyncSession, pid: str) -> List[CategoryOut]:
        items = (await db.execute(select(MenuItem.category).where(MenuItem.property_id == pid, MenuItem.is_active.is_(True)))).scalars().all()
        cats = (await db.execute(select(MenuCategory).where(MenuCategory.property_id == pid).order_by(MenuCategory.sort_order))).scalars().all()
        known = {c.name for c in cats}
        for name in sorted(set(items) - known):  # items from before categories were records
            c = MenuCategory(property_id=pid, name=name, sort_order=len(cats))
            db.add(c)
            cats.append(c)
        if len(cats) != len(known):
            await db.commit()
        return [CategoryOut(id=c.category_id, name=c.name, sortOrder=c.sort_order, itemCount=items.count(c.name)) for c in cats]

    @staticmethod
    async def add_category(db: AsyncSession, pid: str, name: str) -> CategoryOut:
        name = name.strip().upper()
        if await db.scalar(select(MenuCategory.category_id).where(MenuCategory.property_id == pid, MenuCategory.name == name)):
            raise ConflictException("That category already exists.")
        count = len(await FnbOps._load_categories(db, pid))
        c = MenuCategory(property_id=pid, name=name, sort_order=count)
        db.add(c)
        await db.commit()
        _invalidate_menu_cache(pid)
        return CategoryOut(id=c.category_id, name=c.name, sortOrder=c.sort_order)

    @staticmethod
    async def rename_category(db: AsyncSession, pid: str, cid: str, name: str) -> CategoryOut:
        c = await db.get(MenuCategory, cid)
        if not c or c.property_id != pid:
            raise NotFoundException("Category not found.")
        new = name.strip().upper()
        for item in (await db.execute(select(MenuItem).where(MenuItem.property_id == pid, MenuItem.category == c.name))).scalars():
            item.category = new
        c.name = new
        await db.commit()
        _invalidate_menu_cache(pid)
        return CategoryOut(id=c.category_id, name=c.name, sortOrder=c.sort_order)

    @staticmethod
    async def delete_category(db: AsyncSession, pid: str, cid: str) -> None:
        c = await db.get(MenuCategory, cid)
        if not c or c.property_id != pid:
            raise NotFoundException("Category not found.")
        if await db.scalar(select(MenuItem.item_id).where(MenuItem.property_id == pid, MenuItem.category == c.name, MenuItem.is_active.is_(True))):
            raise ConflictException("Move or remove the dishes in this category first.")
        await db.delete(c)
        await db.commit()
        _invalidate_menu_cache(pid)

    @staticmethod
    async def reorder_categories(db: AsyncSession, pid: str, ids: List[str]) -> List[CategoryOut]:
        for n, cid in enumerate(ids):
            c = await db.get(MenuCategory, cid)
            if c and c.property_id == pid:
                c.sort_order = n
        await db.commit()
        _invalidate_menu_cache(pid)
        return await FnbOps.categories(db, pid)

    # ── menu JSON import / export (TapMenu format, prices in rupees) ─────────
    @staticmethod
    async def export_menu(db: AsyncSession, pid: str) -> Dict[str, Any]:
        cats = await FnbOps.categories(db, pid)
        items = (await db.execute(select(MenuItem).where(MenuItem.property_id == pid, MenuItem.is_active.is_(True)).order_by(MenuItem.sort_order))).scalars().all()
        out = []
        for c in cats:
            out.append({"name": c.name.title(), "items": [{
                "name": i.name, "price": i.price_minor / 100, "originalPrice": (i.original_price_minor / 100) if i.original_price_minor else None,
                "description": i.description or "", "dietaryType": i.dietary_type, "prepStation": STATION_TO_TAPMENU.get(i.station, "kitchen"),
                "prepMinutes": i.preparation_time_minutes, "kcal": i.kcal, "image": i.image_url or "", "tags": i.tags or [],
                "isAvailable": i.is_available,
                "variants": [{"label": v["name"], "price": v["pricePaise"] / 100, "isDefault": bool(v.get("isDefault"))} for v in (i.variants or [])],
                "addOns": [{"name": a["name"], "price": a["pricePaise"] / 100} for a in (i.add_ons or [])],
            } for i in items if i.category == c.name]})
        return {"categories": out}

    @staticmethod
    async def import_menu(db: AsyncSession, pid: str, payload: Dict[str, Any], replace: bool) -> Dict[str, int]:
        rows: List[tuple] = []
        for cat in payload.get("categories") or []:
            for it in cat.get("items") or []:
                rows.append((cat.get("name") or "General", it))
        for it in payload.get("items") or []:
            rows.append((it.get("category") or "General", it))
        if not rows:
            raise ValidationException("No dishes found in the file.")
        if len(rows) > 1000:
            raise ValidationException("At most 1000 dishes per import.")
        paise = lambda v: int(round(float(v) * 100)) if v not in (None, "") else None
        if replace:
            for i in (await db.execute(select(MenuItem).where(MenuItem.property_id == pid))).scalars():
                i.is_active = False
        existing = {i.name.lower(): i for i in (await db.execute(select(MenuItem).where(MenuItem.property_id == pid, MenuItem.is_active.is_(True)))).scalars()}
        created = updated = 0
        for n, (cat, it) in enumerate(rows):
            name = str(it.get("name") or "").strip()[:150]
            price = paise(it.get("price"))
            if not name or price is None or price < 0:
                raise ValidationException(f"Dish #{n + 1} needs a name and a price.")
            diet = str(it.get("dietaryType") or "veg").lower()
            diet = diet if diet in ("veg", "non-veg", "egg", "vegan") else "veg"
            fields = dict(
                category=str(cat).strip().upper()[:50], name=name, description=str(it.get("description") or "")[:500], price_minor=price,
                original_price_minor=paise(it.get("originalPrice")), dietary_type=diet, is_veg=diet in ("veg", "vegan"),
                station="MAIN_KITCHEN",  # one kitchen station
                preparation_time_minutes=int(it.get("prepMinutes") or 15), kcal=int(it["kcal"]) if it.get("kcal") else None,
                image_url=_import_image_url(it),
                tags=[str(t) for t in (it.get("tags") or [])][:10], is_available=it.get("isAvailable", True) is not False,
                variants=[_with_id({"name": v.get("label") or v.get("name"), "pricePaise": paise(v.get("price")) or 0, "isDefault": bool(v.get("isDefault"))})
                          for v in (it.get("variants") or []) if v.get("label") or v.get("name")],
                add_ons=[_with_id({"name": a.get("name"), "pricePaise": paise(a.get("price")) or 0}) for a in (it.get("addOns") or []) if a.get("name")],
                sort_order=n,
            )
            item = existing.get(name.lower())
            if item:
                for k, v in fields.items():
                    setattr(item, k, v)
                updated += 1
            else:
                db.add(MenuItem(property_id=pid, **fields))
                created += 1
        await db.flush()
        await FnbOps.categories(db, pid)
        await db.commit()
        _invalidate_menu_cache(pid)
        return {"created": created, "updated": updated}

    # ── sections & tables ────────────────────────────────────────────────────
    @staticmethod
    async def sections(db: AsyncSession, pid: str) -> List[SectionOut]:
        rows = (await db.execute(select(POSSection).where(POSSection.property_id == pid).order_by(POSSection.sort_order))).scalars().all()
        if not rows:  # first use: turn the old fixed section names into records
            names = sorted({t.section for t in (await db.execute(select(POSTable).where(POSTable.property_id == pid))).scalars()}) or ["MAIN_DINING"]
            for n, name in enumerate(names):
                s = POSSection(property_id=pid, name=name.replace("_", " ").title(), sort_order=n)
                db.add(s)
                await db.flush()
                for t in (await db.execute(select(POSTable).where(POSTable.property_id == pid, POSTable.section == name))).scalars():
                    t.section_id = s.section_id
                rows.append(s)
            await db.commit()
        return [SectionOut(id=s.section_id, name=s.name, sortOrder=s.sort_order) for s in rows]

    @staticmethod
    async def save_section(db: AsyncSession, pid: str, name: str, sid: Optional[str] = None) -> SectionOut:
        s = await db.get(POSSection, sid) if sid else POSSection(property_id=pid, sort_order=len(await FnbOps.sections(db, pid)))
        if not s or s.property_id != pid:
            raise NotFoundException("Section not found.")
        s.name = name.strip()
        db.add(s)
        for t in (await db.execute(select(POSTable).where(POSTable.section_id == s.section_id))).scalars() if sid else []:
            t.section = s.name.upper().replace(" ", "_")
        await db.commit()
        return SectionOut(id=s.section_id, name=s.name, sortOrder=s.sort_order)

    @staticmethod
    async def delete_section(db: AsyncSession, pid: str, sid: str) -> None:
        s = await db.get(POSSection, sid)
        if not s or s.property_id != pid:
            raise NotFoundException("Section not found.")
        for t in (await db.execute(select(POSTable).where(POSTable.section_id == sid))).scalars():
            t.section_id = None
        await db.delete(s)
        await db.commit()

    @staticmethod
    async def ensure_table_tokens(db: AsyncSession, pid: str) -> None:
        missing = (await db.execute(select(POSTable).where(POSTable.property_id == pid, POSTable.qr_token.is_(None)))).scalars().all()
        for t in missing:
            t.qr_token = secrets.token_urlsafe(18)
        if missing:
            await db.commit()

    @staticmethod
    async def _table(db: AsyncSession, pid: str, tid: str) -> POSTable:
        t = await db.get(POSTable, tid)
        if not t or t.property_id != pid or not t.is_active:
            raise NotFoundException("Table not found.")
        return t

    @staticmethod
    async def save_table(db: AsyncSession, pid: str, data: TableIn | TableUpdate, tid: Optional[str] = None) -> None:
        t = await FnbOps._table(db, pid, tid) if tid else POSTable(property_id=pid, qr_token=secrets.token_urlsafe(18), status="AVAILABLE")
        patch = data.model_dump(exclude_unset=True)
        if "tableNumber" in patch and patch["tableNumber"]:
            num = patch["tableNumber"].strip().upper()
            clash = await db.scalar(select(POSTable.table_id).where(
                POSTable.property_id == pid, POSTable.table_number == num, POSTable.is_active.is_(True), POSTable.table_id != (tid or "")))
            if clash:
                raise ConflictException("A table with that number already exists.")
            t.table_number = num
        if "capacity" in patch and patch["capacity"]:
            t.capacity = patch["capacity"]
        if "sectionId" in patch:
            s = await db.get(POSSection, patch["sectionId"]) if patch["sectionId"] else None
            t.section_id = s.section_id if s and s.property_id == pid else None
            t.section = s.name.upper().replace(" ", "_") if t.section_id else "MAIN_DINING"
        db.add(t)
        await db.commit()
        fnb_config.bump(pid)

    @staticmethod
    async def delete_table(db: AsyncSession, pid: str, tid: str) -> None:
        t = await FnbOps._table(db, pid, tid)
        if t.status in ("ORDERED", "SEATED") and t.active_order_id:
            raise ConflictException("This table still has open orders.")
        t.is_active, t.qr_token = False, None  # soft delete; old orders keep their table number
        await db.execute(delete(DiningSession).where(DiningSession.table_id == tid))
        await db.commit()
        fnb_config.bump(pid)

    @staticmethod
    async def reset_table_qr(db: AsyncSession, pid: str, tid: str) -> str:
        t = await FnbOps._table(db, pid, tid)
        t.qr_token = secrets.token_urlsafe(18)
        await db.execute(delete(DiningSession).where(DiningSession.table_id == tid))
        await db.commit()
        return t.qr_token

    @staticmethod
    async def set_table_status(db: AsyncSession, pid: str, tid: str, status: str) -> None:
        t = await FnbOps._table(db, pid, tid)
        if status == "AVAILABLE" and t.active_order_id:
            raise ConflictException("This table still has open orders.")
        t.status = status
        t.seated_at = _now() if status == "SEATED" else (t.seated_at if t.active_order_id else None)
        if status != "SEATED" and not t.active_order_id:
            t.active_order_total_minor = 0
        await db.commit()
        fnb_config.bump(pid)

    @staticmethod
    async def rotate_room_link(db: AsyncSession, pid: str, stay_id: str) -> str:
        row = (await db.execute(select(Stay, Room).join(Room, Room.room_id == Stay.room_id).where(Stay.stay_id == stay_id, Room.property_id == pid))).first()
        if not row or row[0].status != "CHECKED_IN":
            raise NotFoundException("No checked-in stay found.")
        row[0].qr_access_token = str(uuid.uuid4())
        await db.execute(delete(DiningSession).where(DiningSession.stay_id == stay_id))
        await db.commit()
        return row[0].qr_access_token

    # ── table reservations ───────────────────────────────────────────────────
    @staticmethod
    def _res_out(r: TableReservation, tables: Dict[str, str]) -> ReservationOut:
        return ReservationOut(
            id=r.reservation_id, guestName=r.guest_name, phone=r.phone, partySize=r.party_size, reservedFor=_iso(r.reserved_for),
            durationMinutes=r.duration_minutes, tableId=r.table_id, tableNumber=tables.get(r.table_id or ""), roomNumber=r.room_number,
            notes=r.notes, status=r.status,
        )

    @staticmethod
    async def _table_names(db: AsyncSession, pid: str) -> Dict[str, str]:
        return {t.table_id: t.table_number for t in (await db.execute(select(POSTable).where(POSTable.property_id == pid))).scalars()}

    @staticmethod
    async def _check_clash(db: AsyncSession, pid: str, r: TableReservation) -> None:
        if not r.table_id:
            return
        start, end = _aware(r.reserved_for), _aware(r.reserved_for) + timedelta(minutes=r.duration_minutes)
        others = (await db.execute(select(TableReservation).where(
            TableReservation.property_id == pid, TableReservation.table_id == r.table_id, TableReservation.status.in_(("BOOKED", "SEATED")),
            TableReservation.reservation_id != (r.reservation_id or ""),
        ))).scalars().all()
        for o in others:
            os, oe = _aware(o.reserved_for), _aware(o.reserved_for) + timedelta(minutes=o.duration_minutes)
            if start < oe and os < end:
                raise ConflictException(f"That table is already booked for {o.guest_name} at {os.strftime('%H:%M')}.")

    @staticmethod
    async def reservations(db: AsyncSession, pid: str, day: Optional[str]) -> List[ReservationOut]:
        stmt = select(TableReservation).where(TableReservation.property_id == pid)
        if day:
            start = datetime.fromisoformat(day).replace(tzinfo=timezone.utc) - timedelta(hours=6)
            stmt = stmt.where(TableReservation.reserved_for >= start, TableReservation.reserved_for < start + timedelta(hours=36))
        rows = (await db.execute(stmt.order_by(TableReservation.reserved_for).limit(300))).scalars().all()
        names = await FnbOps._table_names(db, pid)
        return [FnbOps._res_out(r, names) for r in rows]

    @staticmethod
    async def create_reservation(db: AsyncSession, pid: str, data: ReservationIn) -> ReservationOut:
        when = datetime.fromisoformat(data.reservedFor.replace("Z", "+00:00"))
        if data.tableId:
            await FnbOps._table(db, pid, data.tableId)
        r = TableReservation(
            property_id=pid, guest_name=data.guestName.strip(), phone=data.phone, party_size=data.partySize, reserved_for=_aware(when),
            duration_minutes=data.durationMinutes, table_id=data.tableId, room_number=data.roomNumber, notes=data.notes,
        )
        await FnbOps._check_clash(db, pid, r)
        db.add(r)
        await db.commit()
        return FnbOps._res_out(r, await FnbOps._table_names(db, pid))

    @staticmethod
    async def update_reservation(db: AsyncSession, pid: str, rid: str, data: ReservationUpdate) -> ReservationOut:
        r = await db.get(TableReservation, rid)
        if not r or r.property_id != pid:
            raise NotFoundException("Reservation not found.")
        patch = data.model_dump(exclude_unset=True)
        if "tableId" in patch:
            if patch["tableId"]:
                await FnbOps._table(db, pid, patch["tableId"])
            r.table_id = patch["tableId"]
        if patch.get("reservedFor"):
            r.reserved_for = _aware(datetime.fromisoformat(patch["reservedFor"].replace("Z", "+00:00")))
        if patch.get("partySize"):
            r.party_size = patch["partySize"]
        if "notes" in patch:
            r.notes = patch["notes"]
        if patch.get("status"):
            r.status = patch["status"]
        await FnbOps._check_clash(db, pid, r)
        if r.status == "SEATED" and r.table_id:
            t = await db.get(POSTable, r.table_id)
            if t and t.status in ("AVAILABLE", "BILLED", "CLEANING"):
                t.status, t.seated_at = "SEATED", _now()
                fnb_config.bump(pid)
        await db.commit()
        return FnbOps._res_out(r, await FnbOps._table_names(db, pid))
