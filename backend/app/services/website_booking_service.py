"""Website customer booking and rate calculation service.

Enforces:
- Booking reference generation: HDH-[A-HJ-NP-Z2-9]{6}
- Quote calculation based on nightly room rates
- Maximum 10 active bookings limit
- Client request idempotency
- Cancellation eligibility (check_in >= today)
- Integration sync hooks to HMS
"""
import os
import random
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.numbering import new_folio_number, new_booking_ref
from backend.app.core.config import settings
from backend.app.models.base import generate_uuid, utc_now
from backend.app.models.website import (
    WebsiteBooking,
    WebsiteRoomRate,
    WebsiteUser,
)
from backend.app.schemas.website import (
    ROOM_DEFINITIONS,
    BookingCounts,
    BookingData,
    CreateBookingRequest,
    RoomInfo,
)

REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 32 chars, no 0, O, 1, I
MAX_ACTIVE_BOOKINGS = 10
IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def generate_booking_reference() -> str:
    """Generates `HDH-XXXXXX` reference matching Fastify domain/bookings.ts."""
    random_bytes = os.urandom(6)
    suffix = "".join(REF_ALPHABET[b & 31] for b in random_bytes)
    return f"HDH-{suffix}"


def today_ist() -> date:
    """Hotel's current calendar date in Asia/Kolkata timezone."""
    return datetime.now(IST_TIMEZONE).date()


async def get_room_rate(db: AsyncSession, room_id: str) -> int:
    """Returns the active nightly room rate (from database override or defaults)."""
    stmt = select(WebsiteRoomRate).where(WebsiteRoomRate.room_id == room_id)
    result = await db.execute(stmt)
    rate_row = result.scalars().first()
    if rate_row:
        return rate_row.rate
    if room_id in ROOM_DEFINITIONS:
        return ROOM_DEFINITIONS[room_id]["ratePerNight"]
    return 2000


async def quote_booking(
    db: AsyncSession,
    room_id: str,
    check_in: date,
    check_out: date,
    rooms: int,
) -> Tuple[int, int, str, int]:
    """Calculates (nights, rate_per_night, room_name, total_amount)."""
    nights = (check_out - check_in).days
    rate = await get_room_rate(db, room_id)
    room_name = ROOM_DEFINITIONS.get(room_id, {}).get("name", "Standard Room")
    total_amount = nights * rate * rooms
    return nights, rate, room_name, total_amount


def can_cancel_booking(check_in: date, status: str, today: Optional[date] = None) -> bool:
    """A booking can be cancelled if it is active (pending or confirmed) and check_in is on or after today."""
    if today is None:
        today = today_ist()
    return status in ("pending", "confirmed") and check_in >= today


def to_booking_data(b: WebsiteBooking, today: Optional[date] = None) -> BookingData:
    """Converts a WebsiteBooking model into a Pydantic BookingData object."""
    if today is None:
        today = today_ist()
    can_cancel = can_cancel_booking(b.check_in, b.status, today)
    return BookingData(
        id=b.id,
        reference=b.reference,
        status=b.status,
        paymentStatus=b.payment_status,
        room=RoomInfo(id=b.room_id, name=b.room_name),
        roomCount=b.room_count,
        checkIn=b.check_in.isoformat(),
        checkOut=b.check_out.isoformat(),
        nights=b.nights,
        adults=b.adults,
        children=b.children,
        extraBed=b.extra_bed,
        specialRequests=b.special_requests,
        ratePerNight=b.rate_per_night,
        totalAmount=b.total_amount,
        currency="INR",
        canCancel=can_cancel,
        cancelledAt=b.cancelled_at.isoformat() if b.cancelled_at else None,
        createdAt=b.created_at.isoformat(),
        updatedAt=b.updated_at.isoformat(),
    )


async def count_active_bookings(db: AsyncSession, user_id: str, today: Optional[date] = None) -> int:
    """Counts active upcoming or in-progress bookings for a user."""
    if today is None:
        today = today_ist()
    stmt = (
        select(func.count())
        .select_from(WebsiteBooking)
        .where(
            WebsiteBooking.user_id == user_id,
            WebsiteBooking.status.in_(["pending", "confirmed"]),
            WebsiteBooking.check_out >= today,
        )
    )
    result = await db.execute(stmt)
    return result.scalar() or 0


async def create_customer_booking(
    db: AsyncSession,
    user_id: str,
    data: CreateBookingRequest,
    today: Optional[date] = None,
) -> Tuple[WebsiteBooking, bool]:
    """Creates a new customer booking or returns existing one if idempotent requestId matched.
    Returns (booking, created_boolean).
    """
    if today is None:
        today = today_ist()

    # Idempotency check: if requestId provided and already exists for user
    if data.requestId:
        stmt = select(WebsiteBooking).where(
            WebsiteBooking.user_id == user_id,
            WebsiteBooking.client_request_id == data.requestId,
        )
        res = await db.execute(stmt)
        existing = res.scalars().first()
        if existing:
            return existing, False

    # Check active booking limit
    active_count = await count_active_bookings(db, user_id, today)
    if active_count >= MAX_ACTIVE_BOOKINGS:
        raise HTTPException(status_code=409, detail={"error": "booking_limit"})

    nights, rate, room_name, total_amount = await quote_booking(
        db, data.roomId, data.checkIn, data.checkOut, data.rooms
    )

    booking = WebsiteBooking(
        id=generate_uuid(),
        reference=generate_booking_reference(),
        user_id=user_id,
        client_request_id=data.requestId,
        room_id=data.roomId,
        room_name=room_name,
        room_count=data.rooms,
        check_in=data.checkIn,
        check_out=data.checkOut,
        nights=nights,
        adults=data.adults,
        children=data.children,
        extra_bed=data.extraBed,
        special_requests=data.specialRequests,
        rate_per_night=rate,
        total_amount=total_amount,
        currency="INR",
        payment_status="unpaid",
        status="pending",  # staff must confirm in the HMS
    )
    db.add(booking)
    await db.flush()

    # Synchronize to HMS Reservation
    user = (await db.execute(select(WebsiteUser).where(WebsiteUser.id == user_id))).scalar_one_or_none()
    await sync_website_booking_to_hms(db, booking, user)

    return booking, True


async def cancel_customer_booking(
    db: AsyncSession,
    user_id: str,
    booking_id: str,
    today: Optional[date] = None,
) -> Tuple[WebsiteBooking, bool]:
    """Cancels a customer booking if allowed. Returns (booking, changed_boolean)."""
    if today is None:
        today = today_ist()

    stmt = select(WebsiteBooking).where(
        WebsiteBooking.id == booking_id,
        WebsiteBooking.user_id == user_id,
    )
    res = await db.execute(stmt)
    booking = res.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    if booking.status == "cancelled":
        return booking, False

    if not can_cancel_booking(booking.check_in, booking.status, today):
        raise HTTPException(status_code=409, detail={"error": "not_cancellable"})

    booking.status = "cancelled"
    booking.cancelled_at = utc_now()
    await db.flush()

    # Synchronize cancellation to HMS Reservation
    await sync_website_booking_cancellation_to_hms(db, booking)

    return booking, True


def room_type_code_for(website_room_id: str) -> Optional[str]:
    pairs = (p.split(":", 1) for p in settings.WEBSITE_ROOM_MAP.split(",") if ":" in p)
    room_map = {k.strip(): v.strip() for k, v in pairs}
    return room_map.get(website_room_id)


async def sync_website_booking_to_hms(
    db: AsyncSession,
    booking: WebsiteBooking,
    user: Optional[WebsiteUser] = None,
):
    """Idempotently syncs a WebsiteBooking to an HMS Reservation record."""
    from backend.app.models.guest import GuestProfile
    from backend.app.models.folio import MasterFolio
    from backend.app.models.organization import Property
    from backend.app.models.reservation import Reservation, ReservationRoom
    from backend.app.models.room import RatePlan, Room, RoomType
    from backend.app.services.reservation_service import ReservationService

    property_id = settings.DEFAULT_PROPERTY_ID

    # 1. Check if Reservation already exists
    criteria = [Reservation.external_booking_ref == booking.reference]
    if booking.external_hms_booking_id:
        criteria.append(Reservation.reservation_id == booking.external_hms_booking_id)
    existing_stmt = select(Reservation).where(or_(*criteria))
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        if booking.status == "cancelled" and existing.status != "CANCELLED":
            existing.status = "CANCELLED"
        elif booking.status == "confirmed" and existing.status == "PENDING":
            existing.status = "CONFIRMED"
        elif booking.status == "completed" and existing.status != "COMPLETED":
            existing.status = "COMPLETED"
        if not booking.external_hms_booking_id:
            booking.external_hms_booking_id = existing.reservation_id
        await db.flush()
        ReservationService.invalidate_cache()
        return existing

    if booking.status == "cancelled":
        return None

    # 2. Resolve HMS RoomType and RatePlan
    code = room_type_code_for(booking.room_id)
    room_type = None
    if code:
        rt_stmt = select(RoomType).where(
            RoomType.property_id == property_id,
            RoomType.code == code,
            RoomType.is_active == True
        )
        room_type = (await db.execute(rt_stmt)).scalar_one_or_none()
    if not room_type:
        rt_stmt = select(RoomType).where(RoomType.property_id == property_id, RoomType.is_active == True)
        room_type = (await db.execute(rt_stmt)).scalars().first()

    rate_plan = None
    if room_type:
        rp_stmt = select(RatePlan).where(
            RatePlan.room_type_id == room_type.room_type_id,
            RatePlan.is_active == True
        ).order_by(RatePlan.base_price_minor)
        rate_plan = (await db.execute(rp_stmt)).scalars().first()

    # 3. Resolve GuestProfile
    guest = None
    if user:
        if user.email:
            guest = (await db.execute(select(GuestProfile).where(GuestProfile.email == user.email))).scalars().first()
        if not guest and user.phone:
            guest = (await db.execute(select(GuestProfile).where(GuestProfile.phone == user.phone))).scalars().first()
        if not guest:
            first, _, last = user.name.strip().partition(" ")
            prop = (await db.execute(select(Property).where(Property.property_id == property_id))).scalar_one_or_none()
            guest = GuestProfile(
                org_id=prop.org_id if prop else settings.DEFAULT_ORG_ID,
                first_name=first or "Guest",
                last_name=last,
                full_name=user.name.strip(),
                email=user.email,
                phone=user.phone or "",
                nationality="Indian",
                vip_tier="REGULAR",
                preferences={"specialNotes": booking.special_requests or ""},
            )
            db.add(guest)
            await db.flush()

    # 4. Master Folio
    total_minor = booking.total_amount * 100
    folio = MasterFolio(
        property_id=property_id,
        reservation_id="",
        guest_id=guest.guest_id if guest else None,
        folio_number=new_folio_number(),
        status="OPEN",
        credit_limit_minor=5000000,
        total_charges_minor=total_minor,
        total_taxes_minor=0,
        total_payments_minor=0,
        outstanding_balance_minor=total_minor,
    )
    db.add(folio)
    await db.flush()

    # 5. Reservation
    checkin_str = booking.check_in.isoformat() if hasattr(booking.check_in, "isoformat") else str(booking.check_in)
    checkout_str = booking.check_out.isoformat() if hasattr(booking.check_out, "isoformat") else str(booking.check_out)
    hms_status = "CONFIRMED" if booking.status == "confirmed" else "PENDING"
    reservation = Reservation(
        booking_reference=new_booking_ref(),
        external_booking_ref=booking.reference,
        property_id=property_id,
        guest_id=guest.guest_id if guest else None,
        source="WEBSITE",
        status=hms_status,
        checkin_date=checkin_str,
        checkout_date=checkout_str,
        nights=booking.nights,
        rooms_count=booking.room_count,
        total_amount_minor=total_minor,
        paid_amount_minor=0,
        balance_amount_minor=total_minor,
        payment_status="UNPAID",
        special_requests=booking.special_requests,
        master_folio_id=folio.folio_id,
    )
    db.add(reservation)
    await db.flush()
    folio.reservation_id = reservation.reservation_id

    # 6. ReservationRoom
    for _ in range(booking.room_count):
        db.add(ReservationRoom(
            reservation_id=reservation.reservation_id,
            room_type_id=room_type.room_type_id if room_type else "",
            rate_plan_id=rate_plan.rate_plan_id if rate_plan else "",
            checkin_date=checkin_str,
            checkout_date=checkout_str,
            nights=booking.nights,
            adults=booking.adults,
            children=booking.children,
            rate_per_night_minor=rate_plan.base_price_minor if rate_plan else (booking.rate_per_night * 100),
            total_gross_minor=int(total_minor / max(1, booking.room_count)),
        ))
    booking.external_hms_booking_id = reservation.reservation_id
    await db.flush()
    ReservationService.invalidate_cache()
    return reservation


async def sync_website_booking_cancellation_to_hms(
    db: AsyncSession,
    booking: WebsiteBooking,
) -> bool:
    """Cancels the linked HMS reservation when a website booking is cancelled."""
    from backend.app.models.reservation import Reservation
    from backend.app.services.reservation_service import ReservationService

    criteria = [Reservation.external_booking_ref == booking.reference]
    if booking.external_hms_booking_id:
        criteria.append(Reservation.reservation_id == booking.external_hms_booking_id)
    stmt = select(Reservation).where(or_(*criteria))
    res_obj = (await db.execute(stmt)).scalar_one_or_none()
    if res_obj and res_obj.status not in ("CANCELLED", "COMPLETED"):
        res_obj.status = "CANCELLED"
        await db.flush()
        ReservationService.invalidate_cache()
        return True
    return False

