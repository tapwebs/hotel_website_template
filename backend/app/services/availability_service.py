from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.tax import room_tax_minor
from backend.app.core.errors import AppException, ConflictException, NotFoundException, ValidationException
from backend.app.models.room import Room, RoomType, RatePlan
from backend.app.models.reservation import RoomHold
from backend.app.schemas.reservation import BookingSearchParams, HoldCreateRequest, PricingSummary, RoomHoldResponse
from backend.app.services.room_service import RoomService


class AvailabilityService:
    @staticmethod
    def calculate_nights(check_in: str, check_out: str) -> int:
        try:
            d_in = datetime.strptime(check_in, "%Y-%m-%d").date()
            d_out = datetime.strptime(check_out, "%Y-%m-%d").date()
            delta = (d_out - d_in).days
            if delta <= 0:
                raise ValidationException("Check-out date must be strictly after check-in date.")
            return delta
        except ValueError:
            raise ValidationException("Invalid date format. Expected YYYY-MM-DD.")

    @staticmethod
    async def create_hold(
        db: AsyncSession,
        property_id: str,
        request: HoldCreateRequest,
        enforce_vacant: bool = True
    ) -> RoomHoldResponse:
        # enforce_vacant=False: caller does its own date-aware inventory check (VACANT only reflects today).
        nights = AvailabilityService.calculate_nights(request.checkIn, request.checkOut)

        # Verify room category
        cat_stmt = select(RoomType).where(
            RoomType.property_id == property_id,
            RoomType.room_type_id == request.categoryId,
            RoomType.is_active == True
        )
        cat_res = await db.execute(cat_stmt)
        category = cat_res.scalar_one_or_none()
        if not category:
            raise NotFoundException("Room category not found.")

        # Verify rate plan
        rp_stmt = select(RatePlan).where(
            RatePlan.rate_plan_id == request.ratePlanId,
            RatePlan.room_type_id == request.categoryId,
            RatePlan.is_active == True
        )
        rp_res = await db.execute(rp_stmt)
        rate_plan = rp_res.scalar_one_or_none()
        if not rate_plan:
            raise NotFoundException("Rate plan not found for this room category.")

        # Server-side physical room availability check
        rooms_stmt = select(Room).where(
            Room.room_type_id == request.categoryId,
            Room.occupancy_status == "VACANT",
            Room.maintenance_status == "OPERATIONAL"
        )
        rooms_res = await db.execute(rooms_stmt)
        available_rooms = rooms_res.scalars().all()

        if enforce_vacant and len(available_rooms) < request.roomsCount:
            raise ConflictException(
                "Requested room units are no longer available for the selected dates.",
                code="ROOM_NOT_AVAILABLE"
            )

        # Calculate exact monetary pricing in minor units (paise)
        base_rate = rate_plan.base_price_minor
        base_total = base_rate * nights * request.roomsCount
        # Statutory Indian GST slab (5% up to Rs 7,500 per room-night, 18% above)
        taxes_total = room_tax_minor(base_rate, base_total)
        grand_total = base_total + taxes_total
        deposit_required = grand_total

        pricing_dict = {
            "baseAmountPaise": base_total,
            "taxesPaise": taxes_total,
            "grandTotalPaise": grand_total,
            "depositRequiredPaise": deposit_required
        }

        # 10 minute hold expiration
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=10)

        hold = RoomHold(
            property_id=property_id,
            room_type_id=request.categoryId,
            rate_plan_id=request.ratePlanId,
            checkin_date=request.checkIn,
            checkout_date=request.checkOut,
            nights=nights,
            rooms_count=request.roomsCount,
            adults=request.adults,
            children=request.children,
            pricing_summary=pricing_dict,
            expires_at=expires_at
        )
        db.add(hold)
        await db.commit()
        await db.refresh(hold)

        return RoomHoldResponse(
            holdId=hold.hold_id,
            roomCategoryId=hold.room_type_id,
            ratePlanId=hold.rate_plan_id,
            checkIn=hold.checkin_date,
            checkOut=hold.checkout_date,
            nights=hold.nights,
            roomsCount=hold.rooms_count,
            adults=hold.adults,
            children=hold.children,
            expiresAt=hold.expires_at.isoformat(),
            remainingSeconds=600,
            pricingSummary=PricingSummary(**pricing_dict)
        )
