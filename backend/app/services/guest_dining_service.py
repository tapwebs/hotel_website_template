"""Guest ordering API in TapMenu's shapes, so the copied TapMenu customer app runs unchanged against our order engine.

Two ways in:
- a restaurant table QR (`pos_tables.qr_token`): orders go to the kitchen and are paid at the counter with a 6-digit code;
- a room card (`stays.qr_access_token`): orders are charged to the guest's open folio (same rules as in-room dining).
The QR token is exchanged once for a random session id (only its hash is stored) that the browser sends as X-Dining-Session.
Every order also gets its own tracking token, so a walk-in guest can follow the order without any stay.
Money in this API is in rupees (TapMenu's convention); everything stored stays in paise.
"""
import base64
import hashlib
import hmac
import random
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.errors import ConflictException, ForbiddenException, NotFoundException, ValidationException
from backend.app.models.folio import MasterFolio
from backend.app.models.guest import GuestProfile
from backend.app.models.pos import DiningSession, MenuItem, POSCoupon, POSOrder, POSTable
from backend.app.models.reservation import Stay
from backend.app.models.room import Room
from backend.app.schemas.pos import OrderLineIn
from backend.app.services import fnb_config, receipt_service
from backend.app.services.payment_providers.base import PaymentRequest
from backend.app.services.payment_providers.factory import get_payment_provider
from backend.app.services.fnb_ops_service import STATION_TO_TAPMENU, FnbOps, coupon_discount, find_coupon
from backend.app.services.pos_service import (
    guest_entry_status, round_total,
    ACTIVE, POSService, _aware, _price_line, assert_available, hash_token, new_tracking_token, place_order, property_name,
    tax_breakdown, tax_for_items,
)

SESSION_HOURS = 3
MAX_ACTIVE_PER_SESSION = 3
GONE = "Please scan the QR code on your table again."
STATUS = {"AWAITING_PAYMENT": "awaiting_payment", "PENDING_ACCEPTANCE": "placed", "QUEUED": "placed", "PREPARING": "preparing", "READY": "ready", "DELIVERED": "served", "BILLED": "served", "CANCELLED": "cancelled"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _r(paise: Optional[int]) -> Optional[float]:
    return None if paise is None else round(paise / 100, 2)


class Ctx:
    def __init__(self, property_id: str, kind: str, table: Optional[POSTable] = None, stay: Optional[Stay] = None,
                 room: Optional[Room] = None, folio: Optional[MasterFolio] = None):
        self.property_id, self.kind, self.table, self.stay, self.room, self.folio = property_id, kind, table, stay, room, folio

    @property
    def label(self) -> str:
        return f"Room {self.room.room_number}" if self.kind == "ROOM" else f"Table {self.table.table_number}"


async def _room(db: AsyncSession, *, token: Optional[str] = None, stay_id: Optional[str] = None, room_id: Optional[str] = None):
    stmt = select(Stay, Room).join(Room, Room.room_id == Stay.room_id).where(Stay.status == "CHECKED_IN")
    if room_id:
        stmt = stmt.where(Stay.room_id == room_id)
    else:
        stmt = stmt.where(Stay.qr_access_token == token) if token else stmt.where(Stay.stay_id == stay_id)
    row = (await db.execute(stmt)).first()
    if not row:
        return None
    folio = (await db.execute(select(MasterFolio).where(MasterFolio.stay_id == row[0].stay_id, MasterFolio.status == "OPEN"))).scalars().first()
    return (row[0], row[1], folio) if folio else None


def gateway() -> Optional[str]:
    """'razorpay' when real online payment is configured, 'demo' for local testing, None when guests cannot pay online.
    The demo provider is never used for guest payments in production, so no order is marked paid without money.
    Guest online payment depends only on Razorpay keys, not on PAYMENT_PROVIDER (the front-desk folio gateway):
    switching the desk to the bank gateway must not switch off guest payments, and vice versa.
    Whether guests are offered online payment is the F&B setting `onlinePayment`."""
    if (settings.RAZORPAY_KEY_ID or "").strip() and (settings.RAZORPAY_KEY_SECRET or "").strip():
        return "razorpay"
    provider = (settings.PAYMENT_PROVIDER or "demo").strip().lower()
    if provider in ("demo", "local") and settings.APP_ENV != "production":
        return "demo"
    return None


async def _restaurant(db: AsyncSession, pid: str, kind: str = "TABLE") -> Dict[str, Any]:
    cfg = await fnb_config.get_config(db, pid)
    online = bool(cfg.onlinePayment and gateway()) and kind == "TABLE"  # room orders go on the folio
    return {
        "id": pid, "name": await property_name(db, pid), "logo": "", "accent": "#7a1f2b",
        "features": {
            "coupons": True, "discounts": True, "spinWheel": cfg.spinWheelEnabled, "reviews": cfg.reviewsEnabled,
            "onlinePayment": online, "specialInstructions": True, "aiAssistant": True, "qrOrdering": cfg.tableOrdering, "roomService": True,
            "priorityOrders": False, "loyalty": False,
        },
    }


def _menu_item(i) -> Dict[str, Any]:
    variants = [{"id": v["id"], "name": v["name"], "price": _r(v["pricePaise"]), "isDefault": bool(v.get("isDefault"))} for v in (i.variants or [])]
    return {
        "id": i.id, "name": i.name, "categoryId": i.category, "price": _r(i.pricePaise), "originalPrice": _r(i.originalPricePaise),
        "kcal": i.kcal, "image": i.imageUrl or "", "description": i.description or "", "ingredients": [],
        "isVeg": i.dietaryType in ("veg", "vegan"), "dietaryType": i.dietaryType,
        "tags": [t.lower().replace("chef's special", "chef").replace("chef special", "chef") for t in (i.tags or [])],
        "variants": variants or None, "addOns": [{"id": a["id"], "name": a["name"], "price": _r(a["pricePaise"])} for a in (i.addOns or [])] or None,
        "isAvailable": i.isAvailable, "prepStation": STATION_TO_TAPMENU.get(i.station, "kitchen"), "prepMinutes": i.preparationTimeMinutes,
    }


def _lines(lines: List[Dict[str, Any]]) -> List[OrderLineIn]:
    if not lines or len(lines) > 40:
        raise ValidationException("Your cart is empty or too large.")
    try:
        return [OrderLineIn(menuItemId=str(l.get("itemId")), quantity=int(l.get("qty") or 1), variantId=l.get("variantId") or None,
                            addOnIds=[str(a) for a in (l.get("addOnIds") or [])], notes=(l.get("note") or None)) for l in lines]
    except (PydanticValidationError, TypeError, ValueError, AttributeError):
        raise ValidationException("Something in your cart is not valid. Please check the quantities and try again.")


_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def _request_key(ctx: "Ctx", body: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """(stored key, tracking token) for a guest's per-basket clientRequestId. The key is scoped to this table or stay, and the
    tracking token is derived from it, so a retried submit can hand back the very same token the first reply carried."""
    raw = str(body.get("clientRequestId") or "").strip()
    if not raw:
        return None, None
    if not _KEY_RE.match(raw):
        raise ValidationException("That order request is not valid. Please refresh and try again.")
    scope = ctx.stay.stay_id if ctx.stay else ctx.room.room_id if ctx.kind == "ROOM" else ctx.table.table_id
    key = hashlib.sha256(f"{ctx.kind}:{scope}:{raw}".encode()).hexdigest()
    mac = hmac.new(settings.SECRET_KEY.encode(), f"fnb-track:{key}".encode(), hashlib.sha256).digest()
    return key, base64.urlsafe_b64encode(mac).decode().rstrip("=")[:32]


class GuestDining:
    # ── session ──────────────────────────────────────────────────────────────
    @staticmethod
    async def exchange(db: AsyncSession, token: str) -> Tuple[str, Dict[str, Any]]:
        table = (await db.execute(select(POSTable).where(POSTable.qr_token == token, POSTable.is_active.is_(True)))).scalars().first()
        if table:
            if not (await fnb_config.get_config(db, table.property_id)).tableOrdering:
                raise ForbiddenException("Table ordering is paused right now. Please order with your server.")
            ctx = Ctx(table.property_id, "TABLE", table=table)
        else:
            # The permanent QR placed in the room, or (older printed cards) a per-stay link.
            qr_room = (await db.execute(select(Room).where(Room.qr_token == token))).scalars().first()
            found = await _room(db, room_id=qr_room.room_id) if qr_room else await _room(db, token=token)
            if not found and not qr_room:
                raise NotFoundException(GONE)
            stay, room, folio = found or (None, qr_room, None)
            cfg = await fnb_config.get_config(db, room.property_id)
            if not cfg.roomOrdering:
                raise ForbiddenException("In-room ordering is paused right now. Please call the front desk.")
            if not found and not cfg.roomOrderingVacant:
                raise NotFoundException("Nobody is checked in to this room right now, so in-room ordering is not available. Please call the front desk.")
            ctx = Ctx(room.property_id, "ROOM", stay=stay, room=room, folio=folio)
        sid = secrets.token_urlsafe(24)
        db.add(DiningSession(id_hash=hash_token(sid), property_id=ctx.property_id, kind=ctx.kind,
                             table_id=ctx.table.table_id if ctx.table else None, stay_id=ctx.stay.stay_id if ctx.stay else None,
                             room_id=ctx.room.room_id if ctx.kind == "ROOM" and not ctx.stay else None,
                             expires_at=_now() + timedelta(hours=SESSION_HOURS)))
        await db.commit()
        info = await GuestDining.info(db, ctx)
        return sid, {**info, "cartKey": secrets.token_urlsafe(9), "sessionId": sid}

    @staticmethod
    async def resolve(db: AsyncSession, sid: Optional[str]) -> Ctx:
        if not sid:
            raise NotFoundException(GONE)
        s = await db.get(DiningSession, hash_token(sid))
        if not s or _aware(s.expires_at) < _now():
            raise NotFoundException(GONE)
        if s.kind == "TABLE":
            t = await db.get(POSTable, s.table_id)
            if not t or not t.is_active:
                raise NotFoundException(GONE)
            return Ctx(s.property_id, "TABLE", table=t)
        if s.room_id and not s.stay_id:  # opened while the room was vacant: stays a pay-at-counter session
            room = await db.get(Room, s.room_id)
            if not room:
                raise NotFoundException(GONE)
            return Ctx(s.property_id, "ROOM", room=room)
        found = await _room(db, stay_id=s.stay_id)
        if not found:
            raise NotFoundException("Your stay has ended, so in-room ordering is closed.")
        return Ctx(s.property_id, "ROOM", stay=found[0], room=found[1], folio=found[2])

    @staticmethod
    async def info(db: AsyncSession, ctx: Ctx) -> Dict[str, Any]:
        return {"restaurant": await _restaurant(db, ctx.property_id, ctx.kind), "tableLabel": ctx.label, "kind": ctx.kind,
                "roomNumber": ctx.room.room_number if ctx.room else None}

    # ── menu & quote ─────────────────────────────────────────────────────────
    @staticmethod
    async def menu(db: AsyncSession, ctx: Ctx) -> Dict[str, Any]:
        items = await POSService.get_menu(db, ctx.property_id)
        cats = await FnbOps.categories(db, ctx.property_id)
        used = {i.category for i in items}
        features = (await _restaurant(db, ctx.property_id, ctx.kind))["features"]
        return {
            "categories": [{"id": c.name, "name": c.name.title()} for c in cats if c.name in used],
            "items": [_menu_item(i) for i in items], "onlinePaymentEnabled": features["onlinePayment"], "features": features,
        }

    @staticmethod
    async def _price(db: AsyncSession, ctx: Ctx, raw_lines: List[Dict[str, Any]], coupon_code: Optional[str]):
        lines = _lines(raw_lines)
        ids = {l.menuItemId for l in lines}
        menu = {m.item_id: m for m in (await db.execute(select(MenuItem).where(
            MenuItem.property_id == ctx.property_id, MenuItem.item_id.in_(ids), MenuItem.is_active.is_(True)))).scalars()}
        await assert_available(db, ctx.property_id, menu, ids)
        pct = await fnb_config.gst_percent(db, ctx.property_id)
        priced = [_price_line(menu[l.menuItemId], l, pct) for l in lines]
        subtotal = sum(p["pricePaise"] * p["quantity"] for p in priced)
        discount, coupon, coupon_error = 0, None, None
        if coupon_code:
            if ctx.stay:
                coupon_error = "Coupons apply to restaurant bills, not room charges."
            else:
                try:
                    coupon = await find_coupon(db, ctx.property_id, coupon_code)
                    discount = coupon_discount(coupon, priced, subtotal)
                except ValidationException as e:
                    coupon, coupon_error = None, e.message if hasattr(e, "message") else str(e)
        tax = tax_for_items(priced, discount, pct)
        return lines, subtotal, discount, tax, coupon, coupon_error
    @staticmethod
    async def quote(db: AsyncSession, ctx: Ctx, body: Dict[str, Any]) -> Dict[str, Any]:
        _, subtotal, discount, tax, _, err = await GuestDining._price(db, ctx, body.get("lines") or [], body.get("couponCode"))
        out = {"subtotal": _r(subtotal), "discount": _r(discount), "tax": _r(tax), "total": _r(subtotal - discount + tax)}
        if err:
            out["couponError"] = err
        return out

    # ── orders ───────────────────────────────────────────────────────────────
    @staticmethod
    async def place(db: AsyncSession, ctx: Ctx, body: Dict[str, Any]) -> Dict[str, Any]:
        """Place an order. With a clientRequestId, submitting the same basket again (double tap, retry after a dropped
        reply) returns the original order instead of creating a second one."""
        key, derived_token = _request_key(ctx, body)
        if key:
            dup = await GuestDining._find_by_key(db, ctx.property_id, key)
            if dup:
                return await GuestDining._replay(db, dup, derived_token)
        try:
            return await GuestDining._place(db, ctx, body, key, derived_token)
        except IntegrityError:  # a concurrent twin of this request committed first
            await db.rollback()
            dup = await GuestDining._find_by_key(db, ctx.property_id, key) if key else None
            if not dup:
                raise
            return await GuestDining._replay(db, dup, derived_token)

    @staticmethod
    async def _find_by_key(db: AsyncSession, pid: str, key: str) -> Optional[POSOrder]:
        return (await db.execute(select(POSOrder).where(POSOrder.property_id == pid, POSOrder.client_request_id == key))).scalars().first()

    @staticmethod
    async def _replay(db: AsyncSession, o: POSOrder, token: Optional[str]) -> Dict[str, Any]:
        out = {"orderId": o.order_id, "trackingToken": token, "displayNumber": o.order_number, "status": STATUS[o.status],
               "counterToken": None if o.paid_at else o.counter_code, "customerName": o.guest_name, "customerPhone": o.customer_phone,
               "alreadyPlaced": True}
        if o.status == "AWAITING_PAYMENT" and not o.paid_at and gateway() == "razorpay":
            out["razorpay"] = await GuestDining._gateway_order(db, o)  # the guest can still finish paying
            await db.commit()
        return out

    @staticmethod
    async def _place(db: AsyncSession, ctx: Ctx, body: Dict[str, Any], key: Optional[str], derived_token: Optional[str]) -> Dict[str, Any]:
        lines, subtotal, discount, tax, coupon, err = await GuestDining._price(db, ctx, body.get("lines") or [], body.get("couponCode"))
        if err and body.get("couponCode"):
            raise ValidationException(err)
        active_q = select(POSOrder.order_id).where(POSOrder.status.in_(ACTIVE + ("PENDING_ACCEPTANCE",)))
        if ctx.stay:
            active_q = active_q.where(POSOrder.stay_id == ctx.stay.stay_id)
        elif ctx.kind == "ROOM":
            active_q = active_q.where(POSOrder.property_id == ctx.property_id, POSOrder.room_number == ctx.room.room_number,
                                      POSOrder.order_type == "DINE_IN", POSOrder.source == "GUEST_QR")
        else:
            active_q = active_q.where(POSOrder.table_id == ctx.table.table_id, POSOrder.source == "TABLE_QR")
        if len((await db.execute(active_q)).all()) >= MAX_ACTIVE_PER_SESSION * (1 if ctx.stay else 2):
            raise ConflictException("You already have several orders in progress. Please wait for one to arrive.")
        name = (body.get("customerName") or "").strip()[:100] or None
        phone = (body.get("customerPhone") or "").strip()[:20] or None
        note = (body.get("note") or "").strip()[:500] or None
        token = derived_token or new_tracking_token()
        online = body.get("payment") == "online" and ctx.kind == "TABLE"
        if online and not (await _restaurant(db, ctx.property_id, ctx.kind))["features"]["onlinePayment"]:
            raise ValidationException("Online payment is unavailable right now. Please choose pay at counter.")
        gw = gateway() if online else None
        cfg = await fnb_config.get_config(db, ctx.property_id)
        if ctx.stay:
            guest = await db.get(GuestProfile, ctx.folio.guest_id)
            order = await place_order(
                db, ctx.property_id, order_type="ROOM_SERVICE", lines=lines, table=None, stay=ctx.stay, room=ctx.room, folio=ctx.folio,
                guest_name=name or (guest.full_name if guest else None), notes=note, source="GUEST_QR", customer_phone=phone, tracking_token=token,
                client_request_id=key, status=guest_entry_status(cfg),
            )
        else:  # a table, or a vacant room (no folio): paid at the counter with a code
            order = await place_order(
                db, ctx.property_id, order_type="DINE_IN", lines=lines, table=ctx.table, stay=None, room=ctx.room, folio=None,
                guest_name=name, notes=note, source="GUEST_QR" if ctx.kind == "ROOM" else "TABLE_QR", customer_phone=phone, counter_code=True, tracking_token=token,
                status="AWAITING_PAYMENT" if gw == "razorpay" else guest_entry_status(cfg),  # the kitchen starts once payment is verified and staff accept
                client_request_id=key,
            )
            if coupon:
                order.discount_minor, order.coupon_code = discount, coupon.code
                order.tax_minor = tax
                order.total_minor, order.round_off_minor = round_total(subtotal - discount + tax, cfg.roundOffTotal)
                if coupon.single_use:
                    coupon.used_at = _now()
        out = {"orderId": order.order_id, "trackingToken": token, "displayNumber": order.order_number,
               "status": STATUS[order.status], "counterToken": order.counter_code, "customerName": order.guest_name, "customerPhone": phone}
        if gw:
            order.payment_method = "ONLINE"
            if gw == "demo":  # local testing only: no gateway, treat as paid
                order.paid_at, order.payment_ref = _now(), f"DEMO-{secrets.token_hex(4).upper()}"
            else:
                out["razorpay"] = await GuestDining._gateway_order(db, order)
        await db.commit()
        receipt_service.queue_receipt(order.order_id)  # only sends if already paid (demo gateway)
        return out

    # ── online payment (Razorpay) ────────────────────────────────────────────
    @staticmethod
    async def _gateway_order(db: AsyncSession, order: POSOrder) -> Dict[str, Any]:
        res = await get_payment_provider("razorpay").initiate_payment(PaymentRequest(
            folio_id=order.order_id, amount_minor=order.total_minor, payer_name=order.guest_name or "Guest",
            idempotency_key=f"FNB-{order.order_number}", notes=f"F&B {order.order_number}",
        ))
        order.payment_ref = res.provider_order_id
        return {"keyId": settings.RAZORPAY_KEY_ID, "orderId": res.provider_order_id, "amount": order.total_minor, "currency": "INR",
                "restaurantName": await property_name(db, order.property_id)}

    @staticmethod
    async def _mark_paid(db: AsyncSession, o: POSOrder, gateway_order: str, payment_id: str) -> None:
        if o.paid_at:
            return
        o.paid_at, o.payment_method, o.payment_ref = _now(), "ONLINE", f"{gateway_order}|{payment_id}"[:120]
        if o.status == "AWAITING_PAYMENT":
            o.status = guest_entry_status(await fnb_config.get_config(db, o.property_id))
        o.updated_at = _now()
        fnb_config.bump(o.property_id)

    @staticmethod
    async def retry_payment(db: AsyncSession, token: str) -> Dict[str, Any]:
        o = await GuestDining._by_token(db, token)
        if o.status != "AWAITING_PAYMENT" or o.paid_at:
            return {"alreadyPaid": True, "status": STATUS.get(o.status, "placed")}
        if gateway() != "razorpay":
            raise ValidationException("Online payment is unavailable right now. Please pay at the counter.")
        rzp = await GuestDining._gateway_order(db, o)
        await db.commit()
        return {"orderId": o.order_id, "displayNumber": o.order_number, "status": "awaiting_payment", "razorpay": rzp}

    @staticmethod
    async def verify_payment(db: AsyncSession, body: Dict[str, Any]) -> Dict[str, Any]:
        o = await db.get(POSOrder, str(body.get("orderId") or ""))
        rzp_order, rzp_payment, sig = (str(body.get(k) or "") for k in ("razorpayOrderId", "razorpayPaymentId", "razorpaySignature"))
        if not o or not o.payment_ref or not o.payment_ref.startswith(rzp_order) or not rzp_order:
            raise NotFoundException("Order not found")
        if not o.paid_at:
            if not get_payment_provider("razorpay").verify_signature(rzp_order, rzp_payment, sig):
                raise ValidationException("Payment could not be verified. Please contact the staff.")
            await GuestDining._mark_paid(db, o, rzp_order, rzp_payment)
            await db.commit()
            receipt_service.queue_receipt(o.order_id)
        return {"success": True, "orderId": o.order_id, "status": STATUS.get(o.status, "placed")}

    @staticmethod
    async def webhook(db: AsyncSession, raw: bytes, signature: str, event: Dict[str, Any]) -> Dict[str, Any]:
        """Razorpay webhook (payment.captured / order.paid): marks the order paid even if the guest closed the browser."""
        if not get_payment_provider("razorpay").verify_webhook_signature(raw, signature or ""):
            raise ForbiddenException("Bad signature")
        pay = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}
        if event.get("event") not in ("payment.captured", "order.paid") or not pay.get("order_id"):
            return {"ok": True, "ignored": True}
        o = (await db.execute(select(POSOrder).where(POSOrder.payment_ref.like(f"{pay['order_id']}%")))).scalars().first()
        if not o:
            return {"ok": True, "ignored": True}
        if int(pay.get("amount") or 0) != o.total_minor:
            raise ValidationException("Amount mismatch")
        await GuestDining._mark_paid(db, o, pay["order_id"], str(pay.get("id") or ""))
        await db.commit()
        receipt_service.queue_receipt(o.order_id)
        return {"ok": True}

    @staticmethod
    async def _by_token(db: AsyncSession, token: str) -> POSOrder:
        o = (await db.execute(select(POSOrder).where(POSOrder.tracking_token_hash == hash_token(token)))).scalars().first()
        if not o:
            raise NotFoundException("Order not found")
        return o

    @staticmethod
    async def track(db: AsyncSession, token: str) -> Tuple[str, Dict[str, Any]]:
        o = await GuestDining._by_token(db, token)
        cfg = await fnb_config.get_config(db, o.property_id)
        etag = f'W/"{o.order_id}-{o.status}-{o.paid_at is not None}-{o.game_played}-{o.review_rating}-{_aware(o.updated_at).timestamp()}"'
        created = _aware(o.created_at)
        room = o.order_type == "ROOM_SERVICE"
        lines = [{
            "itemId": it["menuItemId"], "name": it["name"], "variantName": it.get("variantName"), "addOnIds": [], "addOnNames": it.get("addOns") or [],
            "qty": it["quantity"], "unitPrice": _r(it["pricePaise"]), "lineTotal": _r(it["pricePaise"] * it["quantity"]), "categoryId": it.get("category"),
        } for it in (o.items or [])]
        restaurant = await _restaurant(db, o.property_id)
        return etag, {
            "orderId": o.order_id, "displayNumber": o.order_number, "referenceNumber": f"REF-{o.order_id[:8].upper()}",
            "table": f"Room {o.room_number}" if o.room_number and not o.table_number else f"Table {o.table_number}" if o.table_number else "Counter",
            "roomNumber": o.room_number if room else None, "restaurantName": restaurant["name"], "gstin": cfg.gstin or None, "fssaiLicense": cfg.fssai or None,
            "createdAt": created.isoformat(), "updatedAt": _aware(o.updated_at).isoformat(),
            "estimatedReadyTime": (created + timedelta(minutes=o.estimated_prep_minutes or 15)).isoformat(),
            "customerName": o.guest_name or "Guest", "customerPhone": o.customer_phone, "lines": lines, "note": o.notes,
            "subtotal": _r(o.subtotal_minor), "discount": _r(o.discount_minor or 0), "tax": _r(o.tax_minor), "total": _r(o.total_minor),
            "taxBreakdown": [{"percent": rate, "taxable": _r(taxable), "tax": _r(tax)} for rate, (taxable, tax) in
                             tax_breakdown(o.items or [], o.discount_minor or 0, o.tax_percent if o.tax_percent is not None else 5).items()],
            "payment": "online" if room or o.paid_at or o.payment_method == "ONLINE" else "counter",
            "paymentMethod": "room" if room else ((o.payment_method or "").lower() or None) if o.paid_at else None,
            "status": STATUS.get(o.status, "placed"), "counterToken": None if o.paid_at else o.counter_code,
            "features": restaurant["features"], "accent": restaurant["accent"],
            "reviewSubmitted": o.review_rating is not None,
        }

    # ── review, spin, game ───────────────────────────────────────────────────
    @staticmethod
    async def review(db: AsyncSession, token: str, body: Dict[str, Any]) -> Dict[str, Any]:
        o = await GuestDining._by_token(db, token)
        if not (await fnb_config.get_config(db, o.property_id)).reviewsEnabled:
            raise ForbiddenException("Reviews are turned off right now.")
        if o.review_rating is not None:
            raise ConflictException("Review already submitted for this order.")
        rating = int(body.get("rating") or 0)
        if not 1 <= rating <= 5:
            raise ValidationException("Please select a rating from 1 to 5 stars.")
        o.review_rating = rating
        o.review_comment = str(body.get("comment") or "").strip()[:1000] or None
        if body.get("phone") and not o.customer_phone:
            o.customer_phone = str(body["phone"]).strip()[:20]
        if body.get("name") and not o.guest_name:
            o.guest_name = str(body["name"]).strip()[:100]
        await db.commit()
        return {"ok": True, "reviewSubmitted": True}

    @staticmethod
    async def spin_config(db: AsyncSession, token: str) -> Dict[str, Any]:
        o = await GuestDining._by_token(db, token)
        cfg = await fnb_config.get_config(db, o.property_id)
        return {"enabled": cfg.spinWheelEnabled, "rewards": cfg.rewards, "couponPrefix": "DH"}

    @staticmethod
    async def _reward_coupon(db: AsyncSession, pid: str, kind: str, value: int, description: str, cap: Optional[int], source: str) -> POSCoupon:
        c = POSCoupon(
            property_id=pid, code=f"DH{secrets.token_hex(3).upper()}", kind=kind, value=value, description=description, single_use=True,
            max_discount_minor=cap, min_order_minor=19900, expires_at=_now() + timedelta(days=30), source=source,
        )
        db.add(c)
        return c

    @staticmethod
    async def spin(db: AsyncSession, token: str) -> Dict[str, Any]:
        o = await GuestDining._by_token(db, token)
        cfg = await fnb_config.get_config(db, o.property_id)
        if not cfg.spinWheelEnabled:
            raise ForbiddenException("The reward wheel is turned off right now.")
        if o.status not in ("DELIVERED", "BILLED"):
            raise ForbiddenException("Spin is only available after your meal is served.")
        if o.review_rating is None:
            raise ForbiddenException("Submit your review first to unlock the spin.")
        if o.spin_result:
            raise ConflictException("You have already spun the wheel for this order.")
        rewards = cfg.rewards
        idx = random.choices(range(len(rewards)), weights=[max(0, float(r.get("probability") or 0)) for r in rewards] or None)[0]
        prize = rewards[idx]
        out: Dict[str, Any] = {"prizeIndex": idx, "prize": {k: prize.get(k) for k in ("id", "label", "type", "value", "emoji")}}
        ptype, value = prize.get("type"), int(prize.get("value") or 0)
        if ptype not in (None, "none", "loyalty"):
            if ptype == "flat":
                c = await GuestDining._reward_coupon(db, o.property_id, "FLAT", value * 100, f"₹{value} off your next order", None, "SPIN")
            elif ptype in ("free_item", "free_drink"):
                c = await GuestDining._reward_coupon(db, o.property_id, "PERCENT", 100, f"{prize.get('label')} on your next order (up to ₹150)", 15000, "SPIN")
            elif ptype == "bogo":
                c = await GuestDining._reward_coupon(db, o.property_id, "PERCENT", 50, "Buy one get one on your next order", None, "SPIN")
            else:
                c = await GuestDining._reward_coupon(db, o.property_id, "PERCENT", max(1, min(value, 100)), f"{value}% off your next order", None, "SPIN")
            out["coupon"] = {"code": c.code, "description": c.description, "expiresAt": _aware(c.expires_at).isoformat()}
        o.spin_result = out
        await db.commit()
        return out


