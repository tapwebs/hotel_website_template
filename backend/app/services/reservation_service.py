import random
import time
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.numbering import new_folio_number, new_booking_ref
from backend.app.core.errors import ConflictException, NotFoundException, ValidationException
from backend.app.core.config import settings
from backend.app.models.organization import Property
from backend.app.models.room import Room, RoomType, RatePlan
from backend.app.models.guest import GuestProfile
from backend.app.models.reservation import RoomHold, Reservation, ReservationRoom
from backend.app.models.folio import MasterFolio, FolioLineItem, Payment
from backend.app.models.base import utc_now
from backend.app.models.website import WebsiteBooking
from backend.app.schemas.reservation import (
    ConfirmBookingRequest,
    ConfirmedBookingPayment,
    ConfirmedBookingResponse,
    ConfirmedBookingStay,
    ReservationResponse,
    ReservationRoomItemResponse
)

# In-memory fast cache for recent reservations queries to eliminate roundtrips across WAN
_reservations_cache: dict[str, tuple[float, List[ReservationResponse]]] = {}
RESERVATIONS_CACHE_TTL = 5.0  # per worker; invalidation only reaches the writing worker


class ReservationService:
    @staticmethod
    def invalidate_cache():
        _reservations_cache.clear()

    @staticmethod
    async def confirm_booking(
        db: AsyncSession,
        property_id: str,
        request: ConfirmBookingRequest
    ) -> ConfirmedBookingResponse:
        # 1. Fetch RoomHold
        hold_stmt = select(RoomHold).where(
            RoomHold.hold_id == request.holdId,
            RoomHold.property_id == property_id
        )
        hold_res = await db.execute(hold_stmt)
        hold = hold_res.scalar_one_or_none()
        if not hold:
            raise NotFoundException("Room hold expired or not found. Please initiate a new search.")

        # Check expiration safely
        expires_at = hold.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if expires_at < now:
            raise ConflictException("Room hold has expired. Please re-select dates to continue.", code="HOLD_EXPIRED")

        # 2. Fetch Property, RoomType, RatePlan
        prop_stmt = select(Property).where(Property.property_id == property_id)
        prop = (await db.execute(prop_stmt)).scalar_one_or_none()

        cat_stmt = select(RoomType).where(RoomType.room_type_id == hold.room_type_id)
        category = (await db.execute(cat_stmt)).scalar_one_or_none()

        rp_stmt = select(RatePlan).where(RatePlan.rate_plan_id == hold.rate_plan_id)
        rate_plan = (await db.execute(rp_stmt)).scalar_one_or_none()

        if not category or not rate_plan:
            raise NotFoundException("Associated room category or rate plan not found.")

        # 3. Find or Create GuestProfile
        guest_phone = request.guest.phoneNumber
        guest_email = request.guest.email
        guest_stmt = select(GuestProfile).where(
            or_(GuestProfile.phone == guest_phone, GuestProfile.email == guest_email)
        )
        guest = (await db.execute(guest_stmt)).scalar_one_or_none()

        if not guest:
            full_name = f"{request.guest.firstName} {request.guest.lastName}".strip()
            guest = GuestProfile(
                org_id=prop.org_id if prop else settings.DEFAULT_ORG_ID,
                first_name=request.guest.firstName,
                last_name=request.guest.lastName,
                full_name=full_name,
                email=guest_email,
                phone=guest_phone,
                nationality="Indian",
                vip_tier="REGULAR",
                preferences={"specialNotes": request.guest.specialRequests or ""}
            )
            db.add(guest)
            await db.flush()

        # 4. Generate Unique Booking Reference
        booking_ref = new_booking_ref()

        pricing = hold.pricing_summary
        total_amount = pricing.get("grandTotalPaise", 0)
        paid_amount = pricing.get("depositRequiredPaise", total_amount)
        balance_due = max(0, total_amount - paid_amount)

        # 5. Create Master Folio
        folio_number = new_folio_number()
        master_folio = MasterFolio(
            property_id=property_id,
            reservation_id="",  # updated below
            guest_id=guest.guest_id,
            folio_number=folio_number,
            status="OPEN",
            credit_limit_minor=5000000,
            total_charges_minor=total_amount,
            total_taxes_minor=pricing.get("taxesPaise", 0),
            total_payments_minor=paid_amount,
            outstanding_balance_minor=balance_due
        )
        db.add(master_folio)
        await db.flush()

        # 6. Create Reservation
        reservation = Reservation(
            booking_reference=booking_ref,
            property_id=property_id,
            guest_id=guest.guest_id,
            source="DIRECT_WEB",
            status="CONFIRMED",
            checkin_date=hold.checkin_date,
            checkout_date=hold.checkout_date,
            nights=hold.nights,
            rooms_count=hold.rooms_count,
            total_amount_minor=total_amount,
            paid_amount_minor=paid_amount,
            balance_amount_minor=balance_due,
            payment_status="PAID" if balance_due == 0 else "PARTIALLY_PAID",
            special_requests=request.guest.specialRequests,
            master_folio_id=master_folio.folio_id
        )
        db.add(reservation)
        await db.flush()

        # Update folio with reservation_id
        master_folio.reservation_id = reservation.reservation_id

        # 7. Create Reservation Rooms
        for _ in range(hold.rooms_count):
            res_room = ReservationRoom(
                reservation_id=reservation.reservation_id,
                room_type_id=category.room_type_id,
                rate_plan_id=rate_plan.rate_plan_id,
                checkin_date=hold.checkin_date,
                checkout_date=hold.checkout_date,
                nights=hold.nights,
                adults=hold.adults,
                children=hold.children,
                rate_per_night_minor=rate_plan.base_price_minor,
                total_gross_minor=int(total_amount / hold.rooms_count)
            )
            db.add(res_room)

        # 8. Record Initial Advance Payment Transaction
        txn_ref = f"TXN-UPI-{random.randint(100000, 999999)}"
        payment = Payment(
            property_id=property_id,
            folio_id=master_folio.folio_id,
            transaction_ref=txn_ref,
            receipt_number=f"REC-2026-{random.randint(100, 999)}",
            amount_minor=paid_amount,
            currency="INR",
            payment_method=request.paymentMethod,
            provider="RAZORPAY",
            status="SUCCESS"
        )
        db.add(payment)

        # Record Initial Folio Line Items: Room Accommodation & Advance Payment
        taxes_amount = pricing.get("taxesPaise", 0)
        base_amount = pricing.get("baseAmountPaise", total_amount - taxes_amount)
        room_charge_line = FolioLineItem(
            folio_id=master_folio.folio_id,
            business_date=hold.checkin_date,
            transaction_type="ROOM_CHARGE",
            service_category="ROOM_CHARGE",
            sac_hsn_code="996311",
            description=f"Room Accommodation ({hold.nights} Nights - {category.name})",
            debit_minor=base_amount,
            credit_minor=0,
            net_minor=base_amount,
            tax_minor=taxes_amount,
            posted_by="RESERVATION_ENGINE",
            reference_number=booking_ref
        )
        db.add(room_charge_line)

        payment_line = FolioLineItem(
            folio_id=master_folio.folio_id,
            business_date=hold.checkin_date,
            transaction_type="PAYMENT",
            service_category="ADVANCE_DEPOSIT",
            sac_hsn_code="996311",
            description=f"Online Advance Deposit via {request.paymentMethod}",
            debit_minor=0,
            credit_minor=paid_amount,
            net_minor=-paid_amount,
            tax_minor=0,
            posted_by="PAYMENT_GATEWAY",
            reference_number=txn_ref
        )
        db.add(payment_line)

        # 9. Clean up hold
        await db.delete(hold)
        await db.commit()
        ReservationService.invalidate_cache()

        # Build response
        cancellation_policy_text = rate_plan.cancellation_policy.get(
            "description",
            "Free cancellation up to 48 hours prior to arrival date."
        ) if rate_plan.cancellation_policy else "Free cancellation up to 48 hours prior to arrival date."

        return ConfirmedBookingResponse(
            bookingReference=booking_ref,
            status="CONFIRMED",
            createdAt=now.isoformat(),
            guest=request.guest,
            stay=ConfirmedBookingStay(
                propertyId=property_id,
                propertyName=prop.name if prop else "",
                propertyAddress=prop.address_line1 if prop else "",
                propertyPhone=(prop.phone if prop else None) or "",
                propertyEmail=(prop.email if prop else None) or "",
                roomCategoryName=category.name,
                roomImage=category.hero_image or "",
                bedType=category.bed_type,
                ratePlanName=rate_plan.name,
                mealPlan=rate_plan.meal_plan,
                checkIn=hold.checkin_date,
                checkOut=hold.checkout_date,
                nights=hold.nights,
                adults=hold.adults,
                children=hold.children,
                cancellationPolicy=cancellation_policy_text
            ),
            payment=ConfirmedBookingPayment(
                transactionId=txn_ref,
                method=request.paymentMethod,
                amountPaidPaise=paid_amount,
                balanceDueAtCheckInPaise=balance_due,
                totalAmountPaise=total_amount,
                taxesPaise=pricing.get("taxesPaise", 0),
                currency="INR"
            )
        )

    @staticmethod
    async def get_all_reservations(
        db: AsyncSession,
        property_id: str,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 500,
        offset: int = 0
    ) -> List[ReservationResponse]:
        now_ts = time.time()
        cache_key = f"{property_id}:{status or 'ALL'}:{limit}:{offset}"
        if not search and cache_key in _reservations_cache:
            entry_ts, cached_data = _reservations_cache[cache_key]
            if now_ts - entry_ts < RESERVATIONS_CACHE_TTL:
                return cached_data

        query = (
            select(Reservation)
            .where(Reservation.property_id == property_id)
            .options(
                selectinload(Reservation.rooms).selectinload(ReservationRoom.stay),
                selectinload(Reservation.rooms)
            )
            .order_by(Reservation.created_at.desc(), Reservation.reservation_id.desc())
        )

        if status:
            query = query.where(Reservation.status == status)
        if not search:
            query = query.offset(offset).limit(limit)

        res = await db.execute(query)
        reservations = res.scalars().all()
        if not reservations:
            return []

        # 1. Fetch property ONCE
        prop_stmt = select(Property).where(Property.property_id == property_id)
        prop = (await db.execute(prop_stmt)).scalar_one_or_none()
        prop_name = prop.name if prop else "TapMenu Grand Resort"

        # 2. Batch fetch all referenced guests in ONE query
        guest_ids = {r.guest_id for r in reservations if r.guest_id}
        if guest_ids:
            g_stmt = select(GuestProfile).where(GuestProfile.guest_id.in_(guest_ids))
            guests = (await db.execute(g_stmt)).scalars().all()
            guest_map = {g.guest_id: g for g in guests}
        else:
            guest_map = {}

        # 3. Batch fetch all referenced room types, rate plans, and physical rooms
        room_type_ids = {rr.room_type_id for r in reservations for rr in r.rooms if rr.room_type_id}
        rate_plan_ids = {rr.rate_plan_id for r in reservations for rr in r.rooms if rr.rate_plan_id}
        assigned_room_ids = {rr.assigned_room_id for r in reservations for rr in r.rooms if rr.assigned_room_id}

        if room_type_ids:
            cat_stmt = select(RoomType).where(RoomType.room_type_id.in_(room_type_ids))
            cat_map = {c.room_type_id: c for c in (await db.execute(cat_stmt)).scalars().all()}
        else:
            cat_map = {}

        if rate_plan_ids:
            rp_stmt = select(RatePlan).where(RatePlan.rate_plan_id.in_(rate_plan_ids))
            rp_map = {rp.rate_plan_id: rp for rp in (await db.execute(rp_stmt)).scalars().all()}
        else:
            rp_map = {}

        if assigned_room_ids:
            rm_stmt = select(Room).where(Room.room_id.in_(assigned_room_ids))
            rm_map = {rm.room_id: rm for rm in (await db.execute(rm_stmt)).scalars().all()}
        else:
            rm_map = {}

        responses = []
        for r in reservations:
            guest = guest_map.get(r.guest_id)

            rooms_dto = []
            for rr in r.rooms:
                cat = cat_map.get(rr.room_type_id)
                rp = rp_map.get(rr.rate_plan_id)
                rm = rm_map.get(rr.assigned_room_id) if rr.assigned_room_id else None
                assigned_room_num = rm.room_number if rm else None

                stay_id = rr.stay.stay_id if rr.stay else None
                stay_status = rr.stay.status if rr.stay else "SCHEDULED"

                rooms_dto.append(ReservationRoomItemResponse(
                    id=rr.reservation_room_id,
                    reservationId=rr.reservation_id,
                    roomTypeId=rr.room_type_id,
                    roomTypeName=cat.name if cat else "Room",
                    assignedRoomId=rr.assigned_room_id,
                    assignedRoomNumber=assigned_room_num,
                    ratePlanId=rr.rate_plan_id,
                    ratePlanName=rp.name if rp else "Rate Plan",
                    checkIn=rr.checkin_date,
                    checkOut=rr.checkout_date,
                    nights=rr.nights,
                    adults=rr.adults,
                    children=rr.children,
                    ratePerNightPaise=rr.rate_per_night_minor,
                    totalGrossPaise=rr.total_gross_minor,
                    stayId=stay_id,
                    stayStatus=stay_status
                ))

            if search:
                s_lower = search.lower()
                matches_ref = s_lower in r.booking_reference.lower() or (r.external_booking_ref and s_lower in r.external_booking_ref.lower())
                matches_guest = guest and (s_lower in guest.full_name.lower() or (guest.phone and s_lower in guest.phone) or (guest.email and s_lower in guest.email.lower()))
                if not (matches_ref or matches_guest):
                    continue

            responses.append(ReservationResponse(
                id=r.reservation_id,
                bookingReference=r.booking_reference,
                propertyId=r.property_id,
                propertyName=prop_name,
                guestId=r.guest_id,
                guestName=guest.full_name if guest else "Guest",
                guestEmail=(guest.email or "") if guest else "",
                guestPhone=(guest.phone or "") if guest else "",
                guestVipStatus=guest.vip_tier if guest else "REGULAR",
                source=r.source,
                status=r.status,
                checkIn=r.checkin_date,
                checkOut=r.checkout_date,
                nights=r.nights,
                roomsCount=r.rooms_count,
                rooms=rooms_dto,
                totalAmountPaise=r.total_amount_minor,
                paidAmountPaise=r.paid_amount_minor,
                balanceAmountPaise=r.balance_amount_minor,
                paymentStatus=r.payment_status,
                specialRequests=r.special_requests,
                createdAt=r.created_at.isoformat(),
                updatedAt=r.updated_at.isoformat(),
                masterFolioId=r.master_folio_id,
                externalBookingRef=r.external_booking_ref
            ))

        if search:  # search filters in Python above, so page the filtered list
            return responses[offset:offset + limit]
        _reservations_cache[cache_key] = (now_ts, responses)

        return responses

    @staticmethod
    async def get_reservation_by_id(
        db: AsyncSession,
        property_id: str,
        id_or_ref: str
    ) -> Optional[ReservationResponse]:
        query = (
            select(Reservation)
            .where(
                Reservation.property_id == property_id,
                or_(
                    Reservation.reservation_id == id_or_ref,
                    Reservation.booking_reference == id_or_ref,
                    Reservation.external_booking_ref == id_or_ref,
                )
            )
            .options(
                selectinload(Reservation.rooms).selectinload(ReservationRoom.stay),
                selectinload(Reservation.rooms)
            )
        )
        res = await db.execute(query)
        reservation = res.scalar_one_or_none()
        if not reservation:
            return None

        # Batch-fetch all referenced entities in parallel-style (3 queries, not N*3)
        prop = (await db.execute(select(Property).where(Property.property_id == property_id))).scalar_one_or_none()
        guest = (await db.execute(select(GuestProfile).where(GuestProfile.guest_id == reservation.guest_id))).scalar_one_or_none()

        room_type_ids = {rr.room_type_id for rr in reservation.rooms if rr.room_type_id}
        rate_plan_ids = {rr.rate_plan_id for rr in reservation.rooms if rr.rate_plan_id}
        assigned_room_ids = {rr.assigned_room_id for rr in reservation.rooms if rr.assigned_room_id}

        cat_map: dict = {}
        if room_type_ids:
            cat_map = {c.room_type_id: c for c in (await db.execute(select(RoomType).where(RoomType.room_type_id.in_(room_type_ids)))).scalars().all()}

        rp_map: dict = {}
        if rate_plan_ids:
            rp_map = {rp.rate_plan_id: rp for rp in (await db.execute(select(RatePlan).where(RatePlan.rate_plan_id.in_(rate_plan_ids)))).scalars().all()}

        rm_map: dict = {}
        if assigned_room_ids:
            rm_map = {rm.room_id: rm for rm in (await db.execute(select(Room).where(Room.room_id.in_(assigned_room_ids)))).scalars().all()}

        rooms_dto = []
        for rr in reservation.rooms:
            cat = cat_map.get(rr.room_type_id)
            rp = rp_map.get(rr.rate_plan_id)
            rm = rm_map.get(rr.assigned_room_id) if rr.assigned_room_id else None
            assigned_room_num = rm.room_number if rm else None

            stay_id = rr.stay.stay_id if rr.stay else None
            stay_status = rr.stay.status if rr.stay else "SCHEDULED"

            rooms_dto.append(ReservationRoomItemResponse(
                id=rr.reservation_room_id,
                reservationId=rr.reservation_id,
                roomTypeId=rr.room_type_id,
                roomTypeName=cat.name if cat else "Room",
                assignedRoomId=rr.assigned_room_id,
                assignedRoomNumber=assigned_room_num,
                ratePlanId=rr.rate_plan_id,
                ratePlanName=rp.name if rp else "Rate Plan",
                checkIn=rr.checkin_date,
                checkOut=rr.checkout_date,
                nights=rr.nights,
                adults=rr.adults,
                children=rr.children,
                ratePerNightPaise=rr.rate_per_night_minor,
                totalGrossPaise=rr.total_gross_minor,
                stayId=stay_id,
                stayStatus=stay_status
            ))

        return ReservationResponse(
            id=reservation.reservation_id,
            bookingReference=reservation.booking_reference,
            propertyId=reservation.property_id,
            propertyName=prop.name if prop else "TapMenu Grand Resort",
            guestId=reservation.guest_id,
            guestName=guest.full_name if guest else "Guest",
            guestEmail=(guest.email or "") if guest else "",
            guestPhone=(guest.phone or "") if guest else "",
            guestVipStatus=guest.vip_tier if guest else "REGULAR",
            source=reservation.source,
            status=reservation.status,
            checkIn=reservation.checkin_date,
            checkOut=reservation.checkout_date,
            nights=reservation.nights,
            roomsCount=reservation.rooms_count,
            rooms=rooms_dto,
            totalAmountPaise=reservation.total_amount_minor,
            paidAmountPaise=reservation.paid_amount_minor,
            balanceAmountPaise=reservation.balance_amount_minor,
            paymentStatus=reservation.payment_status,
            specialRequests=reservation.special_requests,
            createdAt=reservation.created_at.isoformat(),
            updatedAt=reservation.updated_at.isoformat(),
            masterFolioId=reservation.master_folio_id,
            externalBookingRef=reservation.external_booking_ref
        )

    @staticmethod
    async def confirm_reservation(
        db: AsyncSession,
        property_id: str,
        reservation_id: str
    ) -> ReservationResponse:
        stmt = select(Reservation).where(
            Reservation.property_id == property_id,
            or_(
                Reservation.reservation_id == reservation_id,
                Reservation.booking_reference == reservation_id,
                Reservation.external_booking_ref == reservation_id,
            )
        )
        res = await db.execute(stmt)
        reservation = res.scalar_one_or_none()
        if not reservation:
            raise NotFoundException("Reservation not found.")

        if reservation.status in ["CANCELLED", "COMPLETED"]:
            raise ConflictException(f"Reservation cannot be confirmed in status: {reservation.status}")

        reservation.status = "CONFIRMED"

        # Reverse sync to WebsiteBooking if linked
        if reservation.external_booking_ref:
            wb_stmt = select(WebsiteBooking).where(WebsiteBooking.reference == reservation.external_booking_ref)
            wb = (await db.execute(wb_stmt)).scalar_one_or_none()
            if wb:
                wb.status = "confirmed"

        await db.commit()
        ReservationService.invalidate_cache()
        return await ReservationService.get_reservation_by_id(db, property_id, reservation.reservation_id)

    @staticmethod
    async def reject_reservation(
        db: AsyncSession,
        property_id: str,
        reservation_id: str
    ) -> ReservationResponse:
        stmt = select(Reservation).where(
            Reservation.property_id == property_id,
            or_(
                Reservation.reservation_id == reservation_id,
                Reservation.booking_reference == reservation_id,
                Reservation.external_booking_ref == reservation_id,
            )
        )
        res = await db.execute(stmt)
        reservation = res.scalar_one_or_none()
        if not reservation:
            raise NotFoundException("Reservation not found.")

        if reservation.status != "PENDING":
            raise ConflictException(f"Only pending reservations can be rejected (current status: {reservation.status})")

        reservation.status = "CANCELLED"

        # Reverse sync to WebsiteBooking if linked
        if reservation.external_booking_ref:
            wb_stmt = select(WebsiteBooking).where(WebsiteBooking.reference == reservation.external_booking_ref)
            wb = (await db.execute(wb_stmt)).scalar_one_or_none()
            if wb:
                wb.status = "cancelled"
                wb.cancelled_at = utc_now()

        await db.commit()
        ReservationService.invalidate_cache()
        return await ReservationService.get_reservation_by_id(db, property_id, reservation.reservation_id)

    @staticmethod
    async def cancel_reservation(
        db: AsyncSession,
        property_id: str,
        reservation_id: str
    ) -> ReservationResponse:
        stmt = (
            select(Reservation)
            .where(
                Reservation.property_id == property_id,
                or_(
                    Reservation.reservation_id == reservation_id,
                    Reservation.booking_reference == reservation_id,
                    Reservation.external_booking_ref == reservation_id,
                )
            )
        )
        res = await db.execute(stmt)
        reservation = res.scalar_one_or_none()
        if not reservation:
            raise NotFoundException("Reservation not found.")

        if reservation.status in ["CANCELLED", "COMPLETED"]:
            raise ConflictException(f"Reservation cannot be cancelled in status: {reservation.status}")

        reservation.status = "CANCELLED"

        # Reverse sync to WebsiteBooking if linked
        if reservation.external_booking_ref:
            wb_stmt = select(WebsiteBooking).where(WebsiteBooking.reference == reservation.external_booking_ref)
            wb = (await db.execute(wb_stmt)).scalar_one_or_none()
            if wb:
                wb.status = "cancelled"
                wb.cancelled_at = utc_now()

        await db.commit()
        ReservationService.invalidate_cache()
        return await ReservationService.get_reservation_by_id(db, property_id, reservation.reservation_id)

    @staticmethod
    async def mark_reservation_no_show(
        db: AsyncSession,
        property_id: str,
        reservation_id: str
    ) -> ReservationResponse:
        from backend.app.models.reservation import Stay
        stmt = (
            select(Reservation)
            .where(
                Reservation.property_id == property_id,
                or_(
                    Reservation.reservation_id == reservation_id,
                    Reservation.booking_reference == reservation_id,
                    Reservation.external_booking_ref == reservation_id,
                )
            )
            .options(
                selectinload(Reservation.rooms).selectinload(ReservationRoom.stay)
            )
        )
        res = await db.execute(stmt)
        reservation = res.scalar_one_or_none()
        if not reservation:
            raise NotFoundException("Reservation not found.")

        if reservation.status in ["CANCELLED", "COMPLETED", "NO_SHOW"]:
            raise ConflictException(f"Reservation cannot be marked NO-SHOW in status: {reservation.status}")

        checked_in_rooms = [rm for rm in (reservation.rooms or []) if rm.stay and rm.stay.status == "CHECKED_IN"]
        unassigned_rooms = [rm for rm in (reservation.rooms or []) if not (rm.stay and rm.stay.status in ("CHECKED_IN", "CHECKED_OUT"))]

        if not checked_in_rooms:
            # Entire booking is marked NO_SHOW
            reservation.status = "NO_SHOW"
            if reservation.external_booking_ref:
                wb_stmt = select(WebsiteBooking).where(WebsiteBooking.reference == reservation.external_booking_ref)
                wb = (await db.execute(wb_stmt)).scalar_one_or_none()
                if wb:
                    wb.status = "no_show"
        else:
            # Partial NO-SHOW: Some rooms are checked in, while unassigned rooms did not show up.
            # Clean up the pending unassigned room units so they no longer block Night Audit.
            for un_rm in unassigned_rooms:
                if un_rm.stay:
                    await db.delete(un_rm.stay)
                await db.delete(un_rm)

            remaining_rooms = [rm for rm in reservation.rooms if rm not in unassigned_rooms]
            reservation.rooms_count = max(1, len(remaining_rooms))
            reservation.total_amount_minor = sum(rm.total_gross_minor for rm in remaining_rooms)
            reservation.balance_amount_minor = max(0, reservation.total_amount_minor - reservation.paid_amount_minor)

        await db.commit()
        ReservationService.invalidate_cache()
        return await ReservationService.get_reservation_by_id(db, property_id, reservation.reservation_id)
