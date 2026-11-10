"""Server-to-server endpoints used by the website backend (Fastify) to sync bookings.

Auth: X-HMS-Integration-Key header == settings.HMS_INTEGRATION_API_KEY (503 when unset).
Idempotency: website bookingRef is stored in reservations.external_booking_ref (unique).
"""
import hmac
import random
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.numbering import new_folio_number, new_booking_ref
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.errors import ConflictException, NotFoundException, ValidationException
from backend.app.models.folio import MasterFolio
from backend.app.models.guest import GuestProfile
from backend.app.models.organization import Property
from backend.app.models.reservation import Reservation, ReservationRoom, RoomHold, Stay
from backend.app.models.room import RatePlan, Room, RoomType
from backend.app.schemas.reservation import HoldCreateRequest
from backend.app.services.availability_service import AvailabilityService
from backend.app.services.reservation_service import ReservationService


async def require_integration_key(x_hms_integration_key: Optional[str] = Header(None)) -> None:
    expected = settings.HMS_INTEGRATION_API_KEY
    if not expected:
        raise HTTPException(status_code=503, detail="HMS integration is not configured")
    if not x_hms_integration_key or not hmac.compare_digest(x_hms_integration_key, expected):
        raise HTTPException(status_code=401, detail="Invalid integration key")


router = APIRouter(prefix="/integrations", tags=["Website Integration"], dependencies=[Depends(require_integration_key)])

DATE = r"^\d{4}-\d{2}-\d{2}$"


class WebsiteBookingUpsert(BaseModel):
    external_booking_ref: str = Field(..., min_length=3, max_length=64)
    website_room_id: str = Field(..., max_length=64)
    guest_name: str = Field(..., min_length=1, max_length=200)
    guest_email: Optional[str] = Field(None, max_length=200)
    guest_phone: Optional[str] = Field(None, max_length=30)
    checkin_date: str = Field(..., pattern=DATE)
    checkout_date: str = Field(..., pattern=DATE)
    rooms_count: int = Field(1, ge=1, le=10)
    adults: int = Field(2, ge=1, le=40)
    children: int = Field(0, ge=0, le=20)
    special_requests: Optional[str] = Field(None, max_length=1000)
    status: Literal["pending", "confirmed", "cancelled"] = "pending"
    property_id: Optional[str] = None


class WebsiteStatusUpdate(BaseModel):
    status: Literal["confirmed", "cancelled"]


def _room_map() -> dict[str, str]:
    pairs = (p.split(":", 1) for p in settings.WEBSITE_ROOM_MAP.split(",") if ":" in p)
    return {k.strip(): v.strip() for k, v in pairs}


async def _find(db: AsyncSession, ref: str) -> Optional[Reservation]:
    return (await db.execute(select(Reservation).where(Reservation.external_booking_ref == ref))).scalar_one_or_none()


async def _stay_status(db: AsyncSession, reservation_id: str) -> Optional[str]:
    rows = (await db.execute(
        select(Stay.status).join(ReservationRoom, Stay.reservation_room_id == ReservationRoom.reservation_room_id)
        .where(ReservationRoom.reservation_id == reservation_id)
    )).scalars().all()
    if "CHECKED_IN" in rows:
        return "CHECKED_IN"
    if rows and all(s == "CHECKED_OUT" for s in rows):
        return "CHECKED_OUT"
    return rows[0] if rows else None


async def _out(db: AsyncSession, r: Reservation) -> dict:
    return {
        "reservation_id": r.reservation_id,
        "booking_reference": r.booking_reference,
        "status": r.status,
        "total_amount_minor": r.total_amount_minor,
        "payment_status": r.payment_status,
        "stay_status": await _stay_status(db, r.reservation_id),
    }


def _locked(r: Reservation, stay: Optional[str]) -> bool:
    return r.status in ("COMPLETED", "NO_SHOW") or stay in ("CHECKED_IN", "CHECKED_OUT")


@router.post("/website-bookings", summary="Idempotent upsert of a website booking")
async def upsert_website_booking(payload: WebsiteBookingUpsert, db: AsyncSession = Depends(get_db)):
    existing = await _find(db, payload.external_booking_ref)
    if existing:
        stay = await _stay_status(db, existing.reservation_id)
        if payload.status == "cancelled" and existing.status != "CANCELLED":
            if _locked(existing, stay):
                raise ConflictException("Guest is in-house or stay is complete.", code="STAY_IN_PROGRESS")
            existing.status = "CANCELLED"
        elif payload.status == "confirmed" and existing.status == "PENDING":
            existing.status = "CONFIRMED"
        await db.commit()
        ReservationService.invalidate_cache()
        return await _out(db, existing)

    if payload.status == "cancelled":
        raise ValidationException("Cannot create a cancelled booking.")

    property_id = payload.property_id or settings.DEFAULT_PROPERTY_ID
    code = _room_map().get(payload.website_room_id)
    room_type = None
    if code:
        room_type = (await db.execute(select(RoomType).where(
            RoomType.property_id == property_id, RoomType.code == code, RoomType.is_active == True
        ))).scalar_one_or_none()
    if not room_type:
        raise HTTPException(status_code=422, detail={"code": "UNKNOWN_ROOM_TYPE", "message": f"No HMS room type mapped for '{payload.website_room_id}'"})

    rate_plan = (await db.execute(select(RatePlan).where(
        RatePlan.room_type_id == room_type.room_type_id, RatePlan.is_active == True
    ).order_by(RatePlan.base_price_minor))).scalars().first()
    if not rate_plan:
        raise HTTPException(status_code=422, detail={"code": "NO_RATE_PLAN", "message": "Room type has no active rate plan"})

    # Date-aware inventory: the booking engine's hold only looks at VACANT rooms today, so also count
    # overlapping active reservations of this room type against the operational rooms.
    total_rooms = (await db.execute(select(func.count()).select_from(Room).where(
        Room.room_type_id == room_type.room_type_id, Room.maintenance_status == "OPERATIONAL"
    ))).scalar_one()
    booked = (await db.execute(
        select(func.count()).select_from(ReservationRoom)
        .join(Reservation, Reservation.reservation_id == ReservationRoom.reservation_id)
        .where(
            ReservationRoom.room_type_id == room_type.room_type_id,
            Reservation.status.in_(["PENDING", "CONFIRMED"]),
            ReservationRoom.checkin_date < payload.checkout_date,
            ReservationRoom.checkout_date > payload.checkin_date,
        )
    )).scalar_one()
    if booked + payload.rooms_count > total_rooms:
        raise ConflictException("No availability for these dates.", code="NO_AVAILABILITY")

    # Reuse the booking engine's availability + pricing check (raises 409 ROOM_NOT_AVAILABLE).
    hold = await AvailabilityService.create_hold(db, property_id, HoldCreateRequest(
        categoryId=room_type.room_type_id, ratePlanId=rate_plan.rate_plan_id,
        checkIn=payload.checkin_date, checkOut=payload.checkout_date,
        adults=payload.adults, children=payload.children, roomsCount=payload.rooms_count,
    ), enforce_vacant=False)
    hold_row = (await db.execute(select(RoomHold).where(RoomHold.hold_id == hold.holdId))).scalar_one()
    pricing = hold_row.pricing_summary
    total = pricing.get("grandTotalPaise", 0)

    guest = None
    if payload.guest_email:
        guest = (await db.execute(select(GuestProfile).where(GuestProfile.email == payload.guest_email))).scalars().first()
    if not guest and payload.guest_phone:
        guest = (await db.execute(select(GuestProfile).where(GuestProfile.phone == payload.guest_phone))).scalars().first()
    if not guest:
        first, _, last = payload.guest_name.strip().partition(" ")
        prop = (await db.execute(select(Property).where(Property.property_id == property_id))).scalar_one_or_none()
        guest = GuestProfile(
            org_id=prop.org_id if prop else settings.DEFAULT_ORG_ID,
            first_name=first, last_name=last, full_name=payload.guest_name.strip(),
            email=payload.guest_email, phone=payload.guest_phone or "",
            nationality="Indian", vip_tier="REGULAR",
            preferences={"specialNotes": payload.special_requests or ""},
        )
        db.add(guest)
        await db.flush()

    folio = MasterFolio(
        property_id=property_id, reservation_id="", guest_id=guest.guest_id,
        folio_number=new_folio_number(), status="OPEN",
        credit_limit_minor=5000000, total_charges_minor=total,
        total_taxes_minor=pricing.get("taxesPaise", 0), total_payments_minor=0,
        outstanding_balance_minor=total,
    )
    db.add(folio)
    await db.flush()

    # Unpaid: payment is collected at the hotel / via verified gateway, never trusted from the website.
    reservation = Reservation(
        booking_reference=new_booking_ref(),
        external_booking_ref=payload.external_booking_ref,
        property_id=property_id, guest_id=guest.guest_id, source="WEBSITE",
        status="CONFIRMED" if payload.status == "confirmed" else "PENDING",
        checkin_date=hold_row.checkin_date, checkout_date=hold_row.checkout_date,
        nights=hold_row.nights, rooms_count=hold_row.rooms_count,
        total_amount_minor=total, paid_amount_minor=0, balance_amount_minor=total,
        payment_status="UNPAID", special_requests=payload.special_requests,
        master_folio_id=folio.folio_id,
    )
    db.add(reservation)
    await db.flush()
    folio.reservation_id = reservation.reservation_id
    for _ in range(hold_row.rooms_count):
        db.add(ReservationRoom(
            reservation_id=reservation.reservation_id, room_type_id=room_type.room_type_id,
            rate_plan_id=rate_plan.rate_plan_id, checkin_date=hold_row.checkin_date,
            checkout_date=hold_row.checkout_date, nights=hold_row.nights,
            adults=hold_row.adults, children=hold_row.children,
            rate_per_night_minor=rate_plan.base_price_minor,
            total_gross_minor=int(total / hold_row.rooms_count),
        ))
    await db.delete(hold_row)
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent retry of the same website booking won the unique external_booking_ref: return it.
        await db.rollback()
        winner = await _find(db, payload.external_booking_ref)
        if not winner:
            raise
        return await _out(db, winner)
    ReservationService.invalidate_cache()
    return await _out(db, reservation)


@router.get("/website-bookings/{ref}", summary="Get HMS status for a website booking")
async def get_website_booking(ref: str, db: AsyncSession = Depends(get_db)):
    r = await _find(db, ref)
    if not r:
        raise NotFoundException("No HMS reservation for this booking reference.")
    return await _out(db, r)


@router.post("/website-bookings/{ref}/status", summary="Confirm or cancel a website booking")
async def update_website_booking_status(ref: str, payload: WebsiteStatusUpdate, db: AsyncSession = Depends(get_db)):
    r = await _find(db, ref)
    if not r:
        raise NotFoundException("No HMS reservation for this booking reference.")
    stay = await _stay_status(db, r.reservation_id)
    if payload.status == "cancelled":
        if r.status != "CANCELLED":
            if _locked(r, stay):
                raise ConflictException("Guest is in-house or stay is complete.", code="STAY_IN_PROGRESS")
            r.status = "CANCELLED"
    else:
        if r.status == "CANCELLED":
            raise ConflictException("Cancelled reservation cannot be re-confirmed.", code="RESERVATION_CANCELLED")
        if r.status == "PENDING":
            r.status = "CONFIRMED"
    await db.commit()
    ReservationService.invalidate_cache()
    return await _out(db, r)
