"""Staff F&B API added by the TapMenu port: config, settlement, coupons (super admin), shifts, categories, menu import/export,
sections, table admin + QR, room-link rotation and table reservations. The original endpoints stay in pos.py."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_property_context, require_any_permission, require_permission
from backend.app.core.errors import ConflictException, ForbiddenException, ValidationException
from backend.app.core.rbac import Permission, Role, user_has_permission
from backend.app.models.pos import POSOrder
from backend.app.models.user import User
from backend.app.schemas.pos import (
    AddItemsRequest, MoveTableRequest, RoomQrItem, VoidItemRequest,
    CategoryIn, CategoryOut, CounterCodeIn, CouponIn, CouponOut, FnbConfig, FnbConfigUpdate, POSOrderResponse, PriorityUpdate,
    ReorderIn, ReservationIn, ReservationOut, ReservationUpdate, SectionIn, SectionOut, SettleRequest, ShiftCloseIn, ShiftOpenIn,
    ShiftOut, TableIn, TableStatusIn, TableUpdate,
)
from backend.app.services import fnb_config, receipt_service
from backend.app.services.fnb_ops_service import FnbOps, _order
from backend.app.services.pos_service import POSService

router = APIRouter(prefix="/pos", tags=["F&B POS & Kitchen KDS"])

POS = Permission.ACCESS_POS.value
KDS = Permission.VIEW_KDS.value
MANAGE = Permission.MANAGE_SETTINGS.value
DISCOUNT = Permission.APPLY_DISCOUNT.value
ACCEPT = Permission.ACCEPT_GUEST_ORDERS.value
floor = require_any_permission([POS, KDS])


async def super_admin(user: User = Depends(require_permission(MANAGE))) -> User:
    if user.role_code != Role.ROLE_SUPER_ADMIN.value:
        raise ForbiddenException("Only super admins can manage coupons.")
    return user


# ── config ───────────────────────────────────────────────────────────────────
@router.get("/config", response_model=FnbConfig, summary="F&B settings (GST, receipt, sound, stations, rewards)")
async def get_config(pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await fnb_config.get_config(db, pid)


@router.put("/config", response_model=FnbConfig, summary="Change F&B settings")
async def put_config(body: FnbConfigUpdate, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await fnb_config.update_config(db, pid, body)


@router.get("/me", summary="My kitchen stations (empty list = all)")
async def me(pid: str = Depends(get_property_context), user: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    cfg = await fnb_config.get_config(db, pid)
    # One kitchen station, so every cook sees every ticket.
    return {"userId": user.user_id, "stations": [], "role": user.role_code}


@router.get("/version", summary="Change counter for cheap polling")
async def get_version(pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    # Derived from the DB (not fnb_config's in-process counter) so every worker reports the same value.
    import hashlib
    from sqlalchemy import func, select
    from backend.app.models.pos import POSOrder, POSTable
    orders = (await db.execute(select(func.count(), func.max(POSOrder.updated_at)).where(POSOrder.property_id == pid))).one()
    tables = (await db.execute(select(POSTable.__table__).where(POSTable.property_id == pid).order_by(POSTable.table_id))).all()
    return {"version": int(hashlib.sha1(repr((tuple(orders), [tuple(r) for r in tables])).encode()).hexdigest()[:12], 16)}


# ── orders: settle, rush, KOT, counter code ─────────────────────────────────
@router.post("/orders/{order_id}/settle", response_model=POSOrderResponse, summary="Take payment (cash, UPI, card, split or charge to room)")
async def settle(order_id: str, body: SettleRequest, pid: str = Depends(get_property_context), user: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    # Admins skip the PIN; captains (APPLY_DISCOUNT) give discounts up to the no-PIN limit; waiters need the PIN for any discount.
    return await FnbOps.settle(db, pid, order_id, body, can_skip_pin=user_has_permission(user, MANAGE) or user.role_code == Role.ROLE_SUPER_ADMIN.value,
                               can_discount=user_has_permission(user, DISCOUNT))


@router.post("/orders/{order_id}/receipt", summary="Send (or resend) the paid-order receipt by WhatsApp/SMS")
async def send_receipt_now(order_id: str, body: Optional[Dict[str, Any]] = Body(None), pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    order = await _order(db, pid, order_id)
    if not receipt_service.channel():
        raise ConflictException("Receipts by WhatsApp/SMS are not set up on this server.")
    if not order.paid_at:
        raise ConflictException("Take payment before sending the receipt.")
    phone = str((body or {}).get("phone") or "")[:20] or None
    if not receipt_service.normalize_phone(phone or order.customer_phone):
        raise ValidationException("Enter a valid mobile number for the receipt.")
    sent = await receipt_service.send_receipt(order_id, phone=phone, force=True)
    if not sent:
        raise ConflictException("The receipt could not be sent. Please try again.")
    return {"sent": True}


@router.patch("/orders/{order_id}/priority", response_model=POSOrderResponse, summary="Mark or clear rush priority")
async def priority(order_id: str, body: PriorityUpdate, pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await FnbOps.set_priority(db, pid, order_id, body.isRush)


@router.post("/orders/{order_id}/kot", response_model=POSOrderResponse, summary="Record that the KOT was printed")
async def kot(order_id: str, pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await FnbOps.mark_kot(db, pid, order_id)


@router.post("/orders/{order_id}/kot/claim", summary="Claim the unprinted KOT rounds for this printer; only one device wins")
async def kot_claim(order_id: str, pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await POSService.claim_kot(db, pid, order_id)


@router.post("/orders/{order_id}/kot/release", status_code=204, summary="Give back a KOT claim after a failed print")
async def kot_release(order_id: str, fromSeq: int = Query(0, ge=0), toSeq: Optional[int] = Query(None, ge=0),
                      pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    await POSService.release_kot(db, pid, order_id, fromSeq, toSeq)


@router.post("/orders/{order_id}/items", response_model=POSOrderResponse, summary="Add dishes to an order already sent (prints as an additional KOT)")
async def add_items(order_id: str, body: AddItemsRequest, pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)),
                    db: AsyncSession = Depends(get_db)):
    return await FnbOps.add_items(db, pid, order_id, body.items, body.notes)


@router.post("/orders/{order_id}/items/{line_id}/void", response_model=POSOrderResponse, summary="Cancel some or all of one dish")
async def void_item(order_id: str, line_id: str, body: VoidItemRequest, pid: str = Depends(get_property_context),
                    user: User = Depends(require_permission(Permission.CANCEL_FNB_ORDERS.value)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.void_item(db, pid, order_id, line_id, body.quantity, body.reason, user.full_name or user.user_id)


@router.post("/orders/{order_id}/move", response_model=List[POSOrderResponse], summary="Move an order, or the whole table, to another table")
async def move_table(order_id: str, body: MoveTableRequest, pid: str = Depends(get_property_context),
                     _: User = Depends(require_permission(Permission.MOVE_FNB_TABLES.value)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.move_table(db, pid, order_id, body.tableId, body.allOnTable)


@router.post("/orders/counter-code", response_model=POSOrderResponse, summary="Find an unpaid guest order by its 6-digit counter code")
async def counter_code(body: CounterCodeIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.by_counter_code(db, pid, body.code)


# ── guest reviews (managers) ─────────────────────────────────────────────────
@router.get("/reviews", summary="Guest reviews left on orders, newest first, with a rating summary")
async def reviews(
    rating: Optional[int] = Query(None, ge=1, le=5), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    base = (POSOrder.property_id == pid, POSOrder.review_rating.is_not(None))
    dist = dict((await db.execute(select(POSOrder.review_rating, func.count()).where(*base).group_by(POSOrder.review_rating))).all())
    count = sum(dist.values())
    q = select(POSOrder).where(*base).order_by(POSOrder.updated_at.desc()).limit(limit).offset(offset)
    if rating:
        q = q.where(POSOrder.review_rating == rating)
    rows = (await db.execute(q)).scalars().all()
    return {
        "summary": {
            "count": count,
            "average": round(sum(k * v for k, v in dist.items()) / count, 2) if count else 0,
            "distribution": {str(i): dist.get(i, 0) for i in range(1, 6)},
        },
        "items": [
            {
                "orderId": o.order_id, "orderNumber": o.order_number, "orderType": o.order_type, "status": o.status,
                "location": f"Room {o.room_number}" if o.room_number else (f"Table {o.table_number}" if o.table_number else None),
                "guestName": o.guest_name, "phone": o.customer_phone, "rating": o.review_rating, "comment": o.review_comment,
                "totalMinor": o.total_minor, "orderedAt": o.created_at.isoformat(), "reviewedAt": o.updated_at.isoformat(),
                "spinPrize": ((o.spin_result or {}).get("prize") or {}).get("label"),
            }
            for o in rows
        ],
    }


# ── coupons (super admin only) ───────────────────────────────────────────────
@router.get("/coupons", response_model=List[CouponOut])
async def coupons(pid: str = Depends(get_property_context), _: User = Depends(super_admin), db: AsyncSession = Depends(get_db)):
    return await FnbOps.list_coupons(db, pid)


@router.post("/coupons", response_model=CouponOut, status_code=201)
async def add_coupon(body: CouponIn, pid: str = Depends(get_property_context), _: User = Depends(super_admin), db: AsyncSession = Depends(get_db)):
    return await FnbOps.save_coupon(db, pid, body)


@router.put("/coupons/{cid}", response_model=CouponOut)
async def edit_coupon(cid: str, body: CouponIn, pid: str = Depends(get_property_context), _: User = Depends(super_admin), db: AsyncSession = Depends(get_db)):
    return await FnbOps.save_coupon(db, pid, body, cid)


@router.delete("/coupons/{cid}", status_code=204)
async def del_coupon(cid: str, pid: str = Depends(get_property_context), _: User = Depends(super_admin), db: AsyncSession = Depends(get_db)):
    await FnbOps.delete_coupon(db, pid, cid)
    return Response(status_code=204)


# ── shifts ───────────────────────────────────────────────────────────────────
@router.get("/shifts/active", summary="The open cash shift, or null")
async def active_shift(pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return {"shift": await FnbOps.active_shift(db, pid)}


@router.get("/shifts", response_model=List[ShiftOut])
async def shifts(pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.shift_history(db, pid)


@router.post("/shifts/open", response_model=ShiftOut, status_code=201)
async def open_shift(body: ShiftOpenIn, pid: str = Depends(get_property_context), user: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.open_shift(db, pid, user.user_id, body.openingFloatPaise)


@router.post("/shifts/close", response_model=ShiftOut)
async def close_shift(body: ShiftCloseIn, pid: str = Depends(get_property_context), user: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.close_shift(db, pid, user.user_id, body.closingCashPaise)


# ── categories & menu import/export ─────────────────────────────────────────
@router.get("/categories", response_model=List[CategoryOut])
async def categories(pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await FnbOps.categories(db, pid)


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def add_category(body: CategoryIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.add_category(db, pid, body.name)


@router.put("/categories/reorder", response_model=List[CategoryOut])
async def reorder_categories(body: ReorderIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.reorder_categories(db, pid, body.ids)


@router.patch("/categories/{cid}", response_model=CategoryOut)
async def rename_category(cid: str, body: CategoryIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.rename_category(db, pid, cid, body.name)


@router.delete("/categories/{cid}", status_code=204)
async def delete_category(cid: str, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    await FnbOps.delete_category(db, pid, cid)
    return Response(status_code=204)


@router.get("/menu/export", summary="Menu as TapMenu JSON (prices in rupees)")
async def export_menu(pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await FnbOps.export_menu(db, pid)


@router.post("/menu/import", summary="Import TapMenu JSON. mode=merge updates dishes by name; mode=replace hides the old menu first")
async def import_menu(payload: Dict[str, Any] = Body(...), mode: str = Query("merge", pattern="^(merge|replace)$"),
                      pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.import_menu(db, pid, payload, mode == "replace")


# ── sections, tables, QR ─────────────────────────────────────────────────────
@router.get("/sections", response_model=List[SectionOut])
async def sections(pid: str = Depends(get_property_context), _: User = Depends(floor), db: AsyncSession = Depends(get_db)):
    return await FnbOps.sections(db, pid)


@router.post("/sections", response_model=SectionOut, status_code=201)
async def add_section(body: SectionIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.save_section(db, pid, body.name)


@router.patch("/sections/{sid}", response_model=SectionOut)
async def rename_section(sid: str, body: SectionIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.save_section(db, pid, body.name, sid)


@router.delete("/sections/{sid}", status_code=204)
async def delete_section(sid: str, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    await FnbOps.delete_section(db, pid, sid)
    return Response(status_code=204)


@router.post("/tables", status_code=201)
async def add_table(body: TableIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    await FnbOps.save_table(db, pid, body)
    return {"ok": True}


@router.patch("/tables/{tid}")
async def edit_table(tid: str, body: TableUpdate, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    await FnbOps.save_table(db, pid, body, tid)
    return {"ok": True}


@router.delete("/tables/{tid}", status_code=204)
async def delete_table(tid: str, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    await FnbOps.delete_table(db, pid, tid)
    return Response(status_code=204)


@router.post("/tables/{tid}/qr", summary="Reset a table's QR (old stickers stop working)")
async def reset_qr(tid: str, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return {"qrToken": await FnbOps.reset_table_qr(db, pid, tid)}


@router.patch("/tables/{tid}/status", summary="Seat, clear, clean or block a table")
async def table_status(tid: str, body: TableStatusIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    await FnbOps.set_table_status(db, pid, tid, body.status)
    return {"ok": True}


@router.get("/rooms-qr", response_model=List[RoomQrItem], summary="Every room with its permanent ordering QR")
async def rooms_qr(pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await POSService.rooms_qr(db, pid)


@router.post("/rooms-qr/{room_id}/reset", summary="Issue a new QR for a room (the printed one stops working)")
async def reset_room_qr(room_id: str, pid: str = Depends(get_property_context), _: User = Depends(require_permission(MANAGE)), db: AsyncSession = Depends(get_db)):
    return {"token": await POSService.reset_room_qr(db, pid, room_id)}


@router.post("/room-qr/{stay_id}/rotate", summary="Issue a new in-room ordering link (the old one stops working)")
async def rotate_room(stay_id: str, pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return {"token": await FnbOps.rotate_room_link(db, pid, stay_id)}


# ── table reservations ───────────────────────────────────────────────────────
@router.get("/reservations", response_model=List[ReservationOut])
async def reservations(day: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"), pid: str = Depends(get_property_context),
                       _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.reservations(db, pid, day)


@router.post("/reservations", response_model=ReservationOut, status_code=201)
async def add_reservation(body: ReservationIn, pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.create_reservation(db, pid, body)


@router.patch("/reservations/{rid}", response_model=ReservationOut)
async def edit_reservation(rid: str, body: ReservationUpdate, pid: str = Depends(get_property_context), _: User = Depends(require_permission(POS)), db: AsyncSession = Depends(get_db)):
    return await FnbOps.update_reservation(db, pid, rid, body)
