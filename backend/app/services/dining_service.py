"""Guest in-room dining: a guest scans the QR card for their stay, browses the menu and orders to the room.

The stay's qr_access_token is the credential. It only works while the guest is checked in and the folio is open, so it
dies at check-out. Guests never see staff identifiers, and what they can do is deliberately small.
"""
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.errors import ConflictException, NotFoundException
from backend.app.models.guest import GuestProfile
from backend.app.models.pos import POSOrder
from backend.app.models.reservation import Stay
from backend.app.models.room import Room
from backend.app.models.folio import MasterFolio
from backend.app.schemas.pos import GuestDiningInfo, GuestOrderRequest, GuestOrderView, OrderItemSchema
from backend.app.services import fnb_config
from backend.app.services.pos_service import (
    ACTIVE, GST_PERCENT, POSService, apply_status, place_order, property_name,
)

MAX_ACTIVE_ORDERS = 3  # per stay, so one link cannot flood the kitchen
GONE = "This ordering link is no longer valid. Please ask the front desk for a new card."


async def _session(db: AsyncSession, token: str):
    row = (await db.execute(
        select(Stay, Room).join(Room, Room.room_id == Stay.room_id)
        .where(Stay.qr_access_token == token, Stay.status == "CHECKED_IN")
    )).first()
    folio = None
    if row:
        folio = (await db.execute(select(MasterFolio).where(MasterFolio.stay_id == row[0].stay_id, MasterFolio.status == "OPEN"))).scalars().first()
    if not row or not folio:
        raise NotFoundException(GONE)
    return row[0], row[1], folio


def _view(o: POSOrder) -> GuestOrderView:
    return GuestOrderView(
        orderNumber=o.order_number, status=o.status, items=[OrderItemSchema(**it) for it in (o.items or [])],
        subtotalPaise=o.subtotal_minor, taxPaise=o.tax_minor, totalPaise=o.total_minor, notes=o.notes,
        createdAt=o.created_at.isoformat(), canCancel=o.status in ("PENDING_ACCEPTANCE", "QUEUED"),
    )


class DiningService:
    @staticmethod
    async def info(db: AsyncSession, token: str) -> GuestDiningInfo:
        stay, room, folio = await _session(db, token)
        guest = await db.get(GuestProfile, folio.guest_id)
        return GuestDiningInfo(
            roomNumber=room.room_number, guestFirstName=guest.first_name if guest else "Guest",
            propertyName=await property_name(db, room.property_id), taxRatePercent=await fnb_config.gst_percent(db, room.property_id),
            menu=await POSService.get_menu(db, room.property_id, available_only=True),
        )

    @staticmethod
    async def orders(db: AsyncSession, token: str) -> List[GuestOrderView]:
        stay, _, _ = await _session(db, token)
        res = await db.execute(select(POSOrder).where(POSOrder.stay_id == stay.stay_id).order_by(POSOrder.created_at.desc()).limit(50))
        return [_view(o) for o in res.scalars().all()]

    @staticmethod
    async def place(db: AsyncSession, token: str, req: GuestOrderRequest) -> GuestOrderView:
        stay, room, folio = await _session(db, token)
        active = (await db.execute(select(POSOrder.order_id).where(POSOrder.stay_id == stay.stay_id, POSOrder.status.in_(ACTIVE)))).all()
        if len(active) >= MAX_ACTIVE_ORDERS:
            raise ConflictException("You already have several orders in progress. Please wait for one to arrive.")
        guest = await db.get(GuestProfile, folio.guest_id)
        order = await place_order(
            db, room.property_id, order_type="ROOM_SERVICE", lines=req.items, table=None, stay=stay, room=room, folio=folio,
            guest_name=guest.full_name if guest else None, notes=req.notes, source="GUEST_QR",
        )
        await db.commit()
        return _view(order)

    @staticmethod
    async def cancel(db: AsyncSession, token: str, order_number: str) -> GuestOrderView:
        stay, _, _ = await _session(db, token)
        order = (await db.execute(select(POSOrder).where(POSOrder.order_number == order_number, POSOrder.stay_id == stay.stay_id))).scalars().first()
        if not order:
            raise NotFoundException("Order not found.")
        if order.status not in ("PENDING_ACCEPTANCE", "QUEUED"):
            raise ConflictException("The kitchen has already started this order. Please call the front desk to change it.")
        await apply_status(db, order, "CANCELLED")
        await db.commit()
        return _view(order)
