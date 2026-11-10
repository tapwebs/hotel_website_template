"""F&B: restaurant tables, menu, orders and the kitchen (KDS) lifecycle.

One order engine serves the POS (staff), the kitchen display and guest in-room ordering (see dining_service.py).
Prices, names and stations always come from the menu, never from the client. Room-service orders are posted to the
guest's open master folio when placed and reversed if the order is cancelled.
"""
import hashlib
import secrets
import uuid
import time
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import and_, delete, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.errors import ConflictException, NotFoundException, ValidationException
from backend.app.models.folio import FolioLineItem, MasterFolio
from backend.app.models.guest import GuestProfile
from backend.app.models.organization import Property
from backend.app.models.pos import DiningSession, MenuItem, MenuCategory, POSOrder, POSTable
from backend.app.services import fnb_config
from backend.app.models.reservation import Stay
from backend.app.models.room import Room
from backend.app.schemas.pos import (
    CreatePOSOrderRequest,
    InHouseRoomQr,
    MenuItemCreate,
    MenuItemResponse,
    MenuItemUpdate,
    OrderItemSchema,
    OrderLineIn,
    POSOrderResponse,
    POSTableResponse,
    RoomQrItem,
)

GST_PERCENT = 5  # restaurant GST
ACTIVE = ("QUEUED", "PREPARING", "READY")  # on the kitchen board
OPEN_AT_TABLE = ACTIVE + ("DELIVERED",)  # the table still owes a bill
KITCHEN_STATION = "MAIN_KITCHEN"  # the restaurant has a single kitchen station
PENDING = "PENDING_ACCEPTANCE"  # guest orders wait here until a captain, waiter or admin accepts them
TRANSITIONS = {
    "AWAITING_PAYMENT": {"CANCELLED"},  # an unpaid online order reaches the kitchen only once payment is verified
    PENDING: {"CANCELLED"},  # accepting goes through POSService.accept, not a plain status change
    "QUEUED": {"PREPARING", "CANCELLED"},
    "PREPARING": {"READY", "CANCELLED"},
    "READY": {"DELIVERED", "CANCELLED"},
    "DELIVERED": {"BILLED"},
}
KITCHEN_MOVES = {"PREPARING", "READY", "DELIVERED"}  # kitchen-only users (VIEW_KDS) may also bump a ready ticket to served
_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_MENU_CACHE_TTL_SECONDS = 5.0  # per worker; other workers see a sold-out flip within this window
_menu_cache: Dict[Tuple[str, bool], Tuple[float, List[MenuItemResponse]]] = {}


# Menu categories (FnbOps.categories), same short per-worker window as the menu; cleared together with it.
_CATEGORIES_CACHE_TTL_SECONDS = 3.0
_categories_cache: Dict[str, Tuple[float, list]] = {}


def _invalidate_menu_cache(property_id: Optional[str] = None) -> None:
    global _menu_cache
    if property_id is None:
        _menu_cache.clear()
        _categories_cache.clear()
    else:
        _menu_cache = {k: v for k, v in _menu_cache.items() if k[0] != property_id}
        _categories_cache.pop(property_id, None)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def round_total(raw: int, enabled: bool) -> Tuple[int, int]:
    """(total, round_off) with the total rounded to the nearest rupee when enabled; 50 paise rounds up."""
    if not enabled:
        return raw, 0
    total = (raw + 50) // 100 * 100
    return total, total - raw


def guest_entry_status(cfg) -> str:
    """Where a paid (or pay-later) guest order starts: waiting for acceptance, or straight to the kitchen."""
    return PENDING if cfg.guestOrderAcceptance else "QUEUED"


def tax_for(subtotal: int, percent: int = GST_PERCENT) -> int:
    return (subtotal * percent + 50) // 100


def tax_breakdown(items: Iterable[dict], discount: int, default_percent: int) -> Dict[int, Tuple[int, int]]:
    """{rate: (taxable, tax)} on tax-exclusive prices. A discount is spread over the lines pro rata so every line is taxed at its
    own rate; lines without a stored rate (older orders) use default_percent. Tax is rounded once per rate, so a single-rate bill
    matches tax_for() on the whole subtotal exactly."""
    items = list(items)
    gross = sum(it["pricePaise"] * it["quantity"] for it in items)
    discount = max(0, min(discount, gross))
    taxable: Dict[int, int] = {}
    given = 0
    for n, it in enumerate(items):
        line = it["pricePaise"] * it["quantity"]
        share = discount - given if n == len(items) - 1 else (discount * line // gross if gross else 0)
        given += share
        rate = it.get("taxPercent")
        rate = default_percent if rate is None else int(rate)
        taxable[rate] = taxable.get(rate, 0) + line - share
    return {r: (t, tax_for(t, r)) for r, t in sorted(taxable.items())}


def tax_for_items(items: Iterable[dict], discount: int, default_percent: int) -> int:
    return sum(tax for _, tax in tax_breakdown(items, discount, default_percent).values())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


MENU_IMAGE_PATH = "/menu-images/"


def menu_image_url(i: MenuItem) -> Optional[str]:
    """Uploaded photos are stored inline as data URLs (60-150 KB each). Menu responses link to /menu-images/{id} instead,
    versioned by a content hash so the image response can be cached forever. Absolute when PUBLIC_API_BASE_URL is set,
    because the HMS frontend is served from a different host than the API in production."""
    url = i.image_url
    if not url or not url.startswith("data:"):
        return url
    v = hashlib.sha1(url.encode()).hexdigest()[:12]
    return f"{settings.PUBLIC_API_BASE_URL.rstrip('/')}{settings.API_V1_PREFIX}{MENU_IMAGE_PATH}{i.item_id}?v={v}"


async def _stored_image(db: AsyncSession, property_id: str, value: Optional[str]) -> Optional[str]:
    """A client that saves an item back sends the /menu-images/ link it was given; store the original data URL again."""
    if not value or MENU_IMAGE_PATH not in value or value.startswith("data:"):
        return value
    src_id = value.split(MENU_IMAGE_PATH, 1)[1].split("?", 1)[0].split("/", 1)[0]
    src = await db.get(MenuItem, src_id)
    return src.image_url if src and src.property_id == property_id else value


def to_menu_response(i: MenuItem) -> MenuItemResponse:
    return MenuItemResponse(
        id=i.item_id, category=i.category, name=i.name, description=i.description or "", pricePaise=i.price_minor,
        isVeg=i.is_veg, isAvailable=i.is_available, station=i.station,
        preparationTimeMinutes=i.preparation_time_minutes, modifiers=i.modifiers or [],
        imageUrl=menu_image_url(i), tags=i.tags or [], kcal=i.kcal, originalPricePaise=i.original_price_minor,
        dietaryType=i.dietary_type or ("veg" if i.is_veg else "non-veg"), variants=i.variants or [], addOns=i.add_ons or [],
        sortOrder=i.sort_order or 0, taxPercent=i.tax_percent,
    )


def to_order_response(o: POSOrder, station: Optional[str] = None) -> POSOrderResponse:
    created = _aware(o.created_at)
    end = _aware(o.updated_at) if o.status not in ACTIVE + ("DELIVERED",) and o.updated_at else datetime.now(timezone.utc)
    items = [OrderItemSchema(**{**it, "lineId": it.get("lineId") or f"L{n}"}) for n, it in enumerate(o.items or [])
             if not station or it.get("station") == station]
    return POSOrderResponse(
        id=o.order_id, orderNumber=o.order_number, orderType=o.order_type, tableNumber=o.table_number,
        roomNumber=o.room_number, stayId=o.stay_id, guestName=o.guest_name, items=items,
        subtotalPaise=o.subtotal_minor, taxPaise=o.tax_minor, totalPaise=o.total_minor, status=o.status,
        source=o.source, notes=o.notes, createdAt=created.isoformat(),
        updatedAt=_aware(o.updated_at).isoformat() if o.updated_at else created.isoformat(),
        elapsedMinutes=max(0, int((end - created).total_seconds() // 60)),
        isRush=bool(o.is_rush), estimatedPrepMinutes=o.estimated_prep_minutes or 15,
        kotPrintedAt=_aware(o.kot_printed_at).isoformat() if o.kot_printed_at else None, voidReason=o.void_reason,
        acceptedAt=_aware(o.accepted_at).isoformat() if o.accepted_at else None, acceptedBy=o.accepted_by,
        roundOffPaise=o.round_off_minor or 0,
        kotSeq=o.kot_seq or 1, kotPrintedSeq=o.kot_printed_seq or 0, voidedItems=list(o.voided_items or []),
        taxPercent=o.tax_percent if o.tax_percent is not None else GST_PERCENT, discountPaise=o.discount_minor or 0,
        couponCode=o.coupon_code, paymentMethod=o.payment_method, splitAmounts=o.split_amounts, tenderedPaise=o.tendered_minor,
        paidAt=_aware(o.paid_at).isoformat() if o.paid_at else None, customerPhone=o.customer_phone, counterCode=o.counter_code,
        reviewRating=o.review_rating, reviewComment=o.review_comment,
    )


async def resolve_in_house(
    db: AsyncSession, property_id: str, *, stay_id: Optional[str] = None, room_number: Optional[str] = None
) -> Tuple[Stay, Room, MasterFolio]:
    """The checked-in stay (and its open folio) a room-service order belongs to."""
    stmt = (
        select(Stay, Room).join(Room, Room.room_id == Stay.room_id)
        .where(Room.property_id == property_id, Stay.status == "CHECKED_IN")
    )
    stmt = stmt.where(Stay.stay_id == stay_id) if stay_id else stmt.where(Room.room_number == room_number)
    row = (await db.execute(stmt)).first()
    if not row:
        raise ConflictException("No checked-in guest found for that room.")
    stay, room = row
    folio = (await db.execute(
        select(MasterFolio).where(MasterFolio.stay_id == stay.stay_id, MasterFolio.status == "OPEN")
    )).scalars().first()
    if not folio:
        raise ConflictException("That room has no open folio to charge.")
    return stay, room, folio


async def _guest_name(db: AsyncSession, folio: MasterFolio) -> str:
    g = await db.get(GuestProfile, folio.guest_id)
    return g.full_name if g else "Guest"


async def _new_order_number(db: AsyncSession) -> str:
    while True:
        num = "KOT-" + "".join(secrets.choice(_CODE_CHARS) for _ in range(6))
        if not await db.scalar(select(POSOrder.order_id).where(POSOrder.order_number == num)):
            return num


async def _sync_table(db: AsyncSession, property_id: str, table_id: Optional[str], *, settled: bool = False) -> None:
    """Recompute a table's status and running bill from the orders that still sit on it.

    With no open orders the table becomes BILLED after a settlement (guests may still be seated; staff clear it),
    otherwise AVAILABLE. A table staff marked CLEANING or MAINTENANCE keeps that status.
    """
    if not table_id:
        return
    table = await db.get(POSTable, table_id)
    if not table or table.property_id != property_id:
        return
    open_orders = (await db.execute(
        select(POSOrder).where(POSOrder.table_id == table_id, POSOrder.status.in_(OPEN_AT_TABLE)).order_by(POSOrder.created_at.asc())
    )).scalars().all()
    table.active_order_total_minor = sum(o.total_minor for o in open_orders)
    table.active_order_id = open_orders[-1].order_id if open_orders else None
    if not open_orders:
        if settled:
            table.status = "BILLED"
        elif table.status not in ("CLEANING", "MAINTENANCE"):
            table.status, table.seated_minutes, table.seated_at = "AVAILABLE", 0, None
    else:
        table.status = "ORDERED" if any(o.status in ACTIVE for o in open_orders) else "SEATED"
        if not table.seated_at:
            table.seated_at = _aware(open_orders[0].created_at)
    fnb_config.bump(property_id)


def _post_to_folio(db: AsyncSession, folio: MasterFolio, order: POSOrder, now: datetime) -> None:
    room = order.order_type == "ROOM_SERVICE"
    db.add(FolioLineItem(
        folio_id=folio.folio_id, business_date=now.strftime("%Y-%m-%d"), transaction_type="FNB_CHARGE",
        service_category="ROOM_SERVICE" if room else "RESTAURANT", sac_hsn_code="996331",
        description=f"{'Room Service' if room else 'Restaurant'} {order.order_number} ({len(order.items)} lines)",
        debit_minor=order.subtotal_minor, credit_minor=0, net_minor=order.subtotal_minor, tax_minor=order.tax_minor,
        posted_by="POS_SYSTEM", reference_number=order.order_number,
    ))
    folio.total_charges_minor += order.total_minor
    folio.total_taxes_minor += order.tax_minor
    folio.outstanding_balance_minor += order.total_minor


def _void_on_folio(db: AsyncSession, folio: MasterFolio, order: POSOrder, now: datetime) -> None:
    """Folio lines are immutable, so a cancelled order is reversed with an offsetting credit line."""
    db.add(FolioLineItem(
        folio_id=folio.folio_id, business_date=now.strftime("%Y-%m-%d"), transaction_type="FNB_CHARGE",
        service_category="ROOM_SERVICE" if order.order_type == "ROOM_SERVICE" else "RESTAURANT",
        sac_hsn_code="996331", description=f"Void {order.order_number}",
        debit_minor=0, credit_minor=order.subtotal_minor, net_minor=-order.subtotal_minor, tax_minor=-order.tax_minor,
        posted_by="POS_SYSTEM", reference_number=order.order_number,
    ))
    folio.total_charges_minor -= order.total_minor
    folio.total_taxes_minor -= order.tax_minor
    folio.outstanding_balance_minor -= order.total_minor


class POSService:
    # ── Tables & menu ────────────────────────────────────────────────────────
    @staticmethod
    async def get_tables(db: AsyncSession, property_id: str) -> List[POSTableResponse]:
        res = await db.execute(select(POSTable).where(POSTable.property_id == property_id).order_by(POSTable.table_number.asc()))
        return [
            POSTableResponse(
                id=t.table_id, tableNumber=t.table_number, section=t.section, capacity=t.capacity, status=t.status,
                activeOrderId=t.active_order_id, activeOrderTotalPaise=t.active_order_total_minor,
                seatedMinutes=max(0, int((datetime.now(timezone.utc) - _aware(t.seated_at)).total_seconds() // 60)) if t.seated_at else 0,
                sectionId=t.section_id, qrToken=t.qr_token, isActive=t.is_active,
            )
            for t in res.scalars().all() if t.is_active
        ]

    @staticmethod
    async def get_menu(db: AsyncSession, property_id: str, *, available_only: bool = False) -> List[MenuItemResponse]:
        now = time.monotonic()
        cache_key = (property_id, available_only)
        cached = _menu_cache.get(cache_key)
        if cached and (now - cached[0]) < _MENU_CACHE_TTL_SECONDS:
            return cached[1]
        stmt = select(MenuItem).where(MenuItem.property_id == property_id, MenuItem.is_active.is_(True))
        if available_only:
            stmt = stmt.where(MenuItem.is_available.is_(True))
        # One query: category order comes from menu_categories (outer join; items without a record sort last).
        stmt = stmt.add_columns(MenuCategory.sort_order).outerjoin(
            MenuCategory, and_(MenuCategory.property_id == MenuItem.property_id, MenuCategory.name == MenuItem.category))
        res = await db.execute(stmt.order_by(func.coalesce(MenuCategory.sort_order, 10_000), MenuItem.category.asc(), MenuItem.sort_order.asc(), MenuItem.name.asc()))
        items = [to_menu_response(i) for i, _ in res.all()]
        _menu_cache[cache_key] = (now, items)
        return items

    @staticmethod
    async def _menu_item(db: AsyncSession, property_id: str, item_id: str) -> MenuItem:
        item = await db.get(MenuItem, item_id)
        if not item or item.property_id != property_id or not item.is_active:
            raise NotFoundException("Menu item not found.")
        return item

    @staticmethod
    async def create_menu_item(db: AsyncSession, property_id: str, data: MenuItemCreate) -> MenuItemResponse:
        item = MenuItem(
            property_id=property_id, category=data.category.strip().upper(), name=data.name.strip(), description=data.description or "",
            price_minor=data.pricePaise, is_veg=data.isVeg, is_available=data.isAvailable, station=KITCHEN_STATION,
            preparation_time_minutes=data.preparationTimeMinutes, image_url=await _stored_image(db, property_id, data.imageUrl), tags=data.tags, kcal=data.kcal,
            original_price_minor=data.originalPricePaise, dietary_type=data.dietaryType or ("veg" if data.isVeg else "non-veg"),
            variants=[_with_id(v.model_dump()) for v in data.variants], add_ons=[_with_id(a.model_dump()) for a in data.addOns],
            tax_percent=data.taxPercent,
        )
        if data.dietaryType:
            item.is_veg = data.dietaryType in ("veg", "vegan")
        db.add(item)
        await _ensure_category(db, property_id, item.category)
        await db.commit()
        _invalidate_menu_cache(property_id)
        return to_menu_response(item)

    @staticmethod
    async def update_menu_item(db: AsyncSession, property_id: str, item_id: str, data: MenuItemUpdate) -> MenuItemResponse:
        item = await POSService._menu_item(db, property_id, item_id)
        patch = data.model_dump(exclude_unset=True)
        columns = {"name": "name", "category": "category", "description": "description", "pricePaise": "price_minor",
                   "isVeg": "is_veg", "isAvailable": "is_available", "station": "station", "preparationTimeMinutes": "preparation_time_minutes",
                   "imageUrl": "image_url", "tags": "tags", "kcal": "kcal", "originalPricePaise": "original_price_minor",
                   "dietaryType": "dietary_type", "variants": "variants", "addOns": "add_ons", "sortOrder": "sort_order",
                   "taxPercent": "tax_percent"}
        nullable = {"imageUrl", "kcal", "originalPricePaise", "taxPercent"}
        patch.pop("station", None)  # one kitchen station; older clients may still send one
        for key, value in patch.items():
            if value is None and key not in nullable:
                continue
            if key in ("variants", "addOns"):
                value = [_with_id(v) for v in value]
            if key == "imageUrl":
                value = await _stored_image(db, property_id, value)
            setattr(item, columns[key], value.strip().upper() if key == "category" else value.strip() if key == "name" else value)
            if key == "dietaryType":
                item.is_veg = value in ("veg", "vegan")
        if "category" in patch and patch["category"]:
            await _ensure_category(db, property_id, item.category)
        await db.commit()
        _invalidate_menu_cache(property_id)
        return to_menu_response(item)

    @staticmethod
    async def delete_menu_item(db: AsyncSession, property_id: str, item_id: str) -> None:
        item = await POSService._menu_item(db, property_id, item_id)
        item.is_active = False  # orders keep their copied lines; the item just leaves the menu
        await db.commit()
        _invalidate_menu_cache(property_id)

    # ── Orders ───────────────────────────────────────────────────────────────
    @staticmethod
    async def list_orders(
        db: AsyncSession, property_id: str, *, scope: str = "active", station: Optional[str] = None, limit: int = 200
    ) -> List[POSOrderResponse]:
        """scope=active is the kitchen board (oldest first); scope=all is recent history (newest first)."""
        stmt = select(POSOrder).where(POSOrder.property_id == property_id)
        if scope == "active":
            stmt = stmt.where(POSOrder.status.in_(ACTIVE)).order_by(POSOrder.created_at.asc())
        else:
            stmt = stmt.order_by(POSOrder.created_at.desc())
        orders = (await db.execute(stmt.limit(max(1, min(limit, 500))))).scalars().all()
        if station:
            orders = [o for o in orders if any(it.get("station") == station for it in (o.items or []))]
        first_at: Dict[str, datetime] = {}
        tables = {o.table_id for o in orders if o.table_id}
        if scope == "active" and tables:
            # The first open order on each table is the main KOT; anything ordered later for that table is an additional KOT.
            first_at = {tid: _aware(at) for tid, at in (await db.execute(
                select(POSOrder.table_id, func.min(POSOrder.created_at))
                .where(POSOrder.property_id == property_id, POSOrder.table_id.in_(tables), POSOrder.status.in_(OPEN_AT_TABLE))
                .group_by(POSOrder.table_id)
            )).all()}
        out = []
        for o in orders:
            r = to_order_response(o, station)
            r.additionalKot = bool(o.table_id in first_at and _aware(o.created_at) > first_at[o.table_id])
            out.append(r)
        return out

    @staticmethod
    async def create_order(db: AsyncSession, property_id: str, request: CreatePOSOrderRequest) -> POSOrderResponse:
        stay = room = folio = None
        table = None
        guest_name = request.guest_name
        if request.order_type == "ROOM_SERVICE":
            if not (request.stay_id or request.room_number):
                raise ValidationException("Room service needs a room number.")
            stay, room, folio = await resolve_in_house(db, property_id, stay_id=request.stay_id, room_number=request.room_number)
            guest_name = guest_name or await _guest_name(db, folio)
        elif request.order_type == "DINE_IN":
            if request.table_id:
                table = await db.get(POSTable, request.table_id)
            elif request.table_number:
                table = (await db.execute(select(POSTable).where(POSTable.property_id == property_id, POSTable.table_number == request.table_number))).scalars().first()
            if not table or table.property_id != property_id:
                raise ValidationException("Choose a table for a dine-in order.")
        order = await place_order(
            db, property_id, order_type=request.order_type, lines=request.items, table=table, stay=stay, room=room,
            folio=folio, guest_name=guest_name, notes=request.notes, source="STAFF",
            is_rush=request.is_rush, customer_phone=request.customer_phone,
        )
        await db.commit()
        return to_order_response(order)

    @staticmethod
    async def update_status(
        db: AsyncSession, property_id: str, order_id: str, new_status: str, *, can_all_moves: bool, reason: Optional[str] = None
    ) -> POSOrderResponse:
        order = await db.get(POSOrder, order_id)
        if not order or order.property_id != property_id:
            raise NotFoundException("Order not found.")
        if order.status == PENDING and new_status == "QUEUED":
            raise ConflictException("Use Accept to send a guest order to the kitchen.")
        if new_status not in TRANSITIONS.get(order.status, set()):
            raise ConflictException(f"An order that is {order.status.lower()} cannot move to {new_status.lower()}.")
        if not can_all_moves and new_status not in KITCHEN_MOVES:
            raise ConflictException("Kitchen staff can mark orders preparing or ready.")
        if new_status == "BILLED" and order.order_type == "ROOM_SERVICE":
            raise ConflictException("Room-service orders are billed on the guest folio.")
        if new_status == "CANCELLED" and reason:
            order.void_reason = reason.strip()[:200]
        await apply_status(db, order, new_status)
        await db.commit()
        return to_order_response(order)

    @staticmethod
    async def pending_guest_orders(db: AsyncSession, property_id: str) -> List[POSOrderResponse]:
        """Guest orders waiting for a captain, waiter or admin to accept them (oldest first)."""
        rows = (await db.execute(
            select(POSOrder).where(POSOrder.property_id == property_id, POSOrder.status == PENDING).order_by(POSOrder.created_at.asc()).limit(100)
        )).scalars().all()
        return [to_order_response(o) for o in rows]

    @staticmethod
    async def accept(db: AsyncSession, property_id: str, order_id: str, user_id: str) -> POSOrderResponse:
        """Accept a guest order and send it to the kitchen. The conditional update means two staff tapping Accept at once
        cannot both succeed."""
        now = datetime.now(timezone.utc)
        res = await db.execute(
            POSOrder.__table__.update()
            .where(POSOrder.order_id == order_id, POSOrder.property_id == property_id, POSOrder.status == PENDING)
            .values(status="QUEUED", accepted_at=now, accepted_by=user_id, updated_at=now)
        )
        order = await db.get(POSOrder, order_id)
        if not order or order.property_id != property_id:
            raise NotFoundException("Order not found.")
        if res.rowcount == 0:
            if order.status == PENDING:  # pragma: no cover - defensive
                raise ConflictException("Could not accept this order. Please try again.")
            raise ConflictException("Someone else already accepted or cancelled this order." if order.accepted_at or order.status == "CANCELLED"
                                    else f"This order is {order.status.lower()} and cannot be accepted.")
        await db.refresh(order)
        await _sync_table(db, property_id, order.table_id)
        await db.commit()
        fnb_config.bump(property_id)
        return to_order_response(order)

    @staticmethod
    async def claim_kot(db: AsyncSession, property_id: str, order_id: str) -> Dict[str, int | bool]:
        """Atomically claim every KOT round not printed yet. Only one device gets claimed=True for a round; it prints
        the items (and cancellations) with fromSeq < seq <= toSeq."""
        order = await db.get(POSOrder, order_id)
        if not order or order.property_id != property_id:
            raise NotFoundException("Order not found.")
        await db.refresh(order)
        start, end = order.kot_printed_seq or 0, order.kot_seq or 1
        res = await db.execute(
            POSOrder.__table__.update()
            .where(POSOrder.order_id == order_id, POSOrder.property_id == property_id, POSOrder.kot_printed_seq == start,
                   POSOrder.kot_seq == end, POSOrder.status.in_(ACTIVE), POSOrder.kot_printed_seq < POSOrder.kot_seq)
            .values(kot_printed_seq=end, kot_printed_at=func.coalesce(POSOrder.kot_printed_at, datetime.now(timezone.utc)))
        )
        await db.commit()
        if res.rowcount:
            fnb_config.bump(property_id)
        return {"claimed": bool(res.rowcount), "fromSeq": start, "toSeq": end}

    @staticmethod
    async def release_kot(db: AsyncSession, property_id: str, order_id: str, from_seq: int = 0, to_seq: Optional[int] = None) -> None:
        """Undo a claim when the printer failed, so another try (or another device) can print those rounds."""
        stmt = POSOrder.__table__.update().where(POSOrder.order_id == order_id, POSOrder.property_id == property_id)
        if to_seq is not None:
            stmt = stmt.where(POSOrder.kot_printed_seq == to_seq)
        await db.execute(stmt.values(kot_printed_seq=from_seq, **({"kot_printed_at": None} if from_seq == 0 else {})))
        await db.commit()
        fnb_config.bump(property_id)

    # ── In-room ordering QR codes ────────────────────────────────────────────
    @staticmethod
    async def rooms_qr(db: AsyncSession, property_id: str) -> List[RoomQrItem]:
        """Every room with its permanent QR, and the guest staying there (if any)."""
        rooms = (await db.execute(
            select(Room).where(Room.property_id == property_id).options(selectinload(Room.room_type))
            .order_by(Room.floor_number.asc(), Room.room_number.asc())
        )).scalars().all()
        missing = [r for r in rooms if not r.qr_token]
        for r in missing:  # rooms created by older code paths
            r.qr_token = str(uuid.uuid4())
        if missing:
            await db.commit()
        guests = {g.roomNumber: g.guestName for g in await POSService.in_house_qr(db, property_id)}
        return [RoomQrItem(
            id=r.room_id, roomNumber=r.room_number, floor=r.floor_number, roomTypeName=r.room_type.name if r.room_type else "",
            guestName=guests.get(r.room_number), occupied=r.room_number in guests, token=r.qr_token,
        ) for r in rooms]

    @staticmethod
    async def reset_room_qr(db: AsyncSession, property_id: str, room_id: str) -> str:
        """Issue a new QR for a room. The printed one stops working, and open ordering sessions for the room end."""
        room = await db.get(Room, room_id)
        if not room or room.property_id != property_id:
            raise NotFoundException("Room not found.")
        room.qr_token = str(uuid.uuid4())
        stays = (await db.execute(select(Stay.stay_id).where(Stay.room_id == room_id, Stay.status == "CHECKED_IN"))).scalars().all()
        if stays:
            await db.execute(delete(DiningSession).where(DiningSession.stay_id.in_(stays)))
        await db.commit()
        return room.qr_token

    # ── In-room ordering links ───────────────────────────────────────────────
    @staticmethod
    async def in_house_qr(db: AsyncSession, property_id: str) -> List[InHouseRoomQr]:
        rows = (await db.execute(
            select(Stay, Room).join(Room, Room.room_id == Stay.room_id)
            .where(Room.property_id == property_id, Stay.status == "CHECKED_IN").order_by(Room.room_number.asc())
        )).all()
        if not rows:
            return []
        stay_ids = [stay.stay_id for stay, _ in rows]
        folios = (await db.execute(select(MasterFolio).where(MasterFolio.stay_id.in_(stay_ids)))).scalars().all()
        folio_map = {f.stay_id: f for f in folios}
        guest_ids = {f.guest_id for f in folios if f.guest_id}
        guest_map = {}
        if guest_ids:
            guests = (await db.execute(select(GuestProfile).where(GuestProfile.guest_id.in_(guest_ids)))).scalars().all()
            guest_map = {g.guest_id: g.full_name for g in guests}

        out = []
        for stay, room in rows:
            folio = folio_map.get(stay.stay_id)
            guest_name = guest_map.get(folio.guest_id) if folio and folio.guest_id else (room.current_guest_name or "Guest")
            out.append(InHouseRoomQr(
                roomNumber=room.room_number, guestName=guest_name,
                stayId=stay.stay_id, token=stay.qr_access_token,
            ))
        return out


async def assert_available(db: AsyncSession, property_id: str, menu: Dict[str, MenuItem], ids: Iterable[str]) -> None:
    """Ids that never existed are a plain validation error. Dishes that are sold out or were removed from the menu give 409
    ITEM_UNAVAILABLE naming each one, so a client can drop just those lines instead of failing the whole cart."""
    ids = list(ids)
    missing = [i for i in ids if i not in menu]
    if missing:
        known = set((await db.execute(select(MenuItem.item_id).where(MenuItem.property_id == property_id, MenuItem.item_id.in_(missing)))).scalars())
        if any(i not in known for i in missing):
            raise ValidationException("Some items are not on the menu.")
    gone = [{"itemId": i, "name": menu[i].name if i in menu else None} for i in ids if i not in menu or not menu[i].is_available]
    if gone:
        names = ", ".join(g["name"] for g in gone if g["name"])
        raise ConflictException(f"Sold out right now: {names}." if names else "Some items are no longer on the menu.",
                                code="ITEM_UNAVAILABLE", details={"unavailable": gone})


async def place_order(
    db: AsyncSession, property_id: str, *, order_type: str, lines: Iterable[OrderLineIn], table: Optional[POSTable],
    stay: Optional[Stay], room: Optional[Room], folio: Optional[MasterFolio], guest_name: Optional[str], notes: Optional[str], source: str,
    is_rush: bool = False, customer_phone: Optional[str] = None, counter_code: bool = False, tracking_token: Optional[str] = None,
    status: str = "QUEUED", client_request_id: Optional[str] = None,
) -> POSOrder:
    """Price the lines from the menu, store the order, post room service to the folio and update the table. Caller commits."""
    lines = list(lines)
    ids = {l.menuItemId for l in lines}
    menu = {m.item_id: m for m in (await db.execute(
        select(MenuItem).where(MenuItem.property_id == property_id, MenuItem.item_id.in_(ids), MenuItem.is_active.is_(True))
    )).scalars().all()}
    await assert_available(db, property_id, menu, ids)
    cfg = await fnb_config.get_config(db, property_id)
    pct = cfg.gstPercent
    raw_items = [_price_line(menu[l.menuItemId], l, pct) for l in lines]
    items = []
    for it in raw_items:
        match = next((el for el in items if _items_equivalent(el, it)), None)
        if match is not None:
            match["quantity"] += it["quantity"]
            if match.get("rounds"):
                match["rounds"][0]["quantity"] = match["quantity"]
        else:
            it["rounds"] = [{"seq": 1, "quantity": it["quantity"]}]
            items.append(it)
    subtotal = sum(it["pricePaise"] * it["quantity"] for it in items)
    tax = tax_for_items(items, 0, pct)
    # Room service is billed on the folio, which rounds the final room invoice instead.
    total, round_off = round_total(subtotal + tax, cfg.roundOffTotal and order_type != "ROOM_SERVICE")
    if folio is not None and folio.outstanding_balance_minor + total > folio.credit_limit_minor:
        raise ConflictException("This would go over the room's credit limit. Please contact the front desk.")
    now = datetime.now(timezone.utc)
    order = POSOrder(
        property_id=property_id, order_number=await _new_order_number(db), order_type=order_type,
        table_id=table.table_id if table else None, table_number=table.table_number if table else None,
        room_number=room.room_number if room else None, stay_id=stay.stay_id if stay else None,
        guest_name=guest_name or "Guest", items=items, subtotal_minor=subtotal, tax_minor=tax, total_minor=total, round_off_minor=round_off,
        status=status, source=source, notes=notes or None, created_at=now, updated_at=now,
        is_rush=is_rush, customer_phone=customer_phone or None, tax_percent=pct,
        estimated_prep_minutes=max([menu[l.menuItemId].preparation_time_minutes or 15 for l in lines] or [15]),
        tracking_token_hash=hash_token(tracking_token) if tracking_token else None, client_request_id=client_request_id,
        counter_code=await _new_counter_code(db, property_id) if counter_code else None,
    )
    db.add(order)
    await db.flush()
    fnb_config.bump(property_id)
    if folio is not None:
        _post_to_folio(db, folio, order, now)
    if table is not None:
        await _sync_table(db, property_id, table.table_id)
    return order


async def apply_status(db: AsyncSession, order: POSOrder, new_status: str) -> None:
    """Move an order to a new status (already validated), reversing the folio charge on cancel and freeing the table."""
    now = datetime.now(timezone.utc)
    if new_status == "CANCELLED" and order.order_type == "ROOM_SERVICE" and order.stay_id:
        folio = (await db.execute(select(MasterFolio).where(MasterFolio.stay_id == order.stay_id, MasterFolio.status == "OPEN"))).scalars().first()
        if folio:
            _void_on_folio(db, folio, order, now)
    if new_status == "DELIVERED" and order.paid_at and order.order_type != "ROOM_SERVICE":
        new_status = "BILLED"  # already settled at the counter; nothing left to collect
    order.status = new_status
    order.updated_at = now
    await db.flush()
    await _sync_table(db, order.property_id, order.table_id, settled=new_status == "BILLED" and bool(order.paid_at))
    fnb_config.bump(order.property_id)


async def property_name(db: AsyncSession, property_id: str) -> str:
    p = await db.get(Property, property_id)
    return p.name if p else "Dream Heavens"


def _with_id(d: dict) -> dict:
    d = dict(d)
    d["id"] = d.get("id") or secrets.token_hex(4)
    return d


async def _ensure_category(db: AsyncSession, property_id: str, name: str) -> None:
    exists = await db.scalar(select(MenuCategory.category_id).where(MenuCategory.property_id == property_id, MenuCategory.name == name))
    if not exists:
        count = len((await db.execute(select(MenuCategory.category_id).where(MenuCategory.property_id == property_id))).all())
        db.add(MenuCategory(property_id=property_id, name=name, sort_order=count))
        await db.flush()


def _items_equivalent(a: dict, b: dict) -> bool:
    """Two order line items are equivalent if they share the same dish, size variant, add-ons, and notes."""
    if a.get("menuItemId") != b.get("menuItemId"):
        return False
    if (a.get("variantName") or None) != (b.get("variantName") or None):
        return False
    if sorted(a.get("addOns") or []) != sorted(b.get("addOns") or []):
        return False
    if (a.get("notes") or "").strip() != (b.get("notes") or "").strip():
        return False
    return True


def _price_line(m: MenuItem, l: OrderLineIn, default_tax: int = GST_PERCENT) -> dict:
    """Unit price = variant price (or base) + chosen add-ons, all from the menu. A dish with sizes needs one chosen; add-ons
    must exist and may each be picked once, so a crafted request can't skip a required choice or stack an extra."""
    unit = m.price_minor
    variant_name = None
    if m.variants and not l.variantId:
        raise ValidationException(f"Please choose a size for {m.name}.")
    if l.variantId:
        v = next((v for v in (m.variants or []) if v.get("id") == l.variantId), None)
        if not v:
            raise ValidationException(f"That size is not available for {m.name}.")
        unit, variant_name = int(v.get("pricePaise", unit)), v.get("name")
    if len(set(l.addOnIds or [])) != len(l.addOnIds or []):
        raise ValidationException(f"Each add-on can be chosen once for {m.name}.")
    addons = []
    for aid in l.addOnIds or []:
        a = next((a for a in (m.add_ons or []) if a.get("id") == aid), None)
        if not a:
            raise ValidationException(f"That add-on is not available for {m.name}.")
        unit += int(a.get("pricePaise", 0))
        addons.append(a.get("name"))
    return OrderItemSchema(
        menuItemId=m.item_id, name=m.name, quantity=l.quantity, pricePaise=unit, notes=(l.notes or None), station=KITCHEN_STATION,
        lineId=uuid.uuid4().hex[:10], seq=1,
        variantName=variant_name, addOns=addons, prepMinutes=m.preparation_time_minutes, category=m.category,
        taxPercent=m.tax_percent if m.tax_percent is not None else default_tax,
    ).model_dump()


async def _new_counter_code(db: AsyncSession, property_id: str) -> str:
    while True:
        code = f"{secrets.randbelow(900000) + 100000}"
        clash = await db.scalar(select(POSOrder.order_id).where(
            POSOrder.property_id == property_id, POSOrder.counter_code == code, POSOrder.paid_at.is_(None), POSOrder.status != "CANCELLED"))
        if not clash:
            return code


def new_tracking_token() -> str:
    return secrets.token_urlsafe(24)
