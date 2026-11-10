import random
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload, attributes
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.numbering import new_folio_number, new_booking_ref, financial_year
from backend.app.core.tax import room_tax_minor
from backend.app.core.errors import ConflictException, ForbiddenException, NotFoundException, ValidationException
from backend.app.core.config import settings
from backend.app.models.organization import PropertySettings
from backend.app.models.room import Room, RoomType, RatePlan
from backend.app.models.guest import GuestProfile
from backend.app.models.reservation import Reservation, ReservationRoom, Stay
from backend.app.models.folio import MasterFolio, FolioLineItem, Payment, Invoice
from backend.app.models.operations import HousekeepingTask
from backend.app.models.website import WebsiteBooking
from backend.app.schemas.reservation import CheckInRequest, CheckOutRequest, RoomMoveRequest, WalkInCheckInRequest
from backend.app.core.timezone import get_kolkata_calendar_date, KOLKATA_TIMEZONE_NAME, parse_kolkata_date


class FrontDeskService:
    @staticmethod
    async def check_in_guest(
        db: AsyncSession,
        property_id: str,
        request: CheckInRequest
    ) -> dict:
        # Fetch reservation
        res_stmt = select(Reservation).where(
            Reservation.property_id == property_id,
            or_(
                Reservation.reservation_id == request.reservation_id,
                Reservation.booking_reference == request.reservation_id,
                Reservation.external_booking_ref == request.reservation_id,
            )
        )
        res = (await db.execute(res_stmt)).scalar_one_or_none()
        if not res:
            raise NotFoundException("Reservation not found.")

        if res.status != "CONFIRMED":
            raise ConflictException(f"Cannot check-in reservation in '{res.status}' status. Reservation must be CONFIRMED.")

        # Fetch room
        rm_stmt = select(Room).where(
            Room.property_id == property_id,
            Room.room_id == request.room_id
        )
        room = (await db.execute(rm_stmt)).scalar_one_or_none()
        if not room:
            raise NotFoundException("Physical room not found.")

        if room.occupancy_status != "VACANT":
            raise ConflictException(f"Room {room.room_number} is currently {room.occupancy_status}. Only VACANT rooms can be checked into.")
        if room.maintenance_status != "OPERATIONAL":
            raise ConflictException(f"Room {room.room_number} is currently blocked for maintenance ({room.maintenance_status}).")

        # Fetch Guest
        guest_stmt = select(GuestProfile).where(GuestProfile.guest_id == res.guest_id)
        guest = (await db.execute(guest_stmt)).scalar_one_or_none()
        guest_name = guest.full_name if guest else "Guest"

        # Fetch ReservationRoom
        rr_stmt = select(ReservationRoom).where(ReservationRoom.reservation_id == res.reservation_id)
        if request.reservation_room_id:
            rr_stmt = rr_stmt.where(ReservationRoom.reservation_room_id == request.reservation_room_id)
        else:
            rr_stmt = (
                rr_stmt.outerjoin(Stay, Stay.reservation_room_id == ReservationRoom.reservation_room_id)
                .where(or_(Stay.stay_id == None, Stay.status != "CHECKED_IN"))
            )
        res_room = (await db.execute(rr_stmt)).scalars().first()
        if not res_room:
            raise NotFoundException("No pending reservation room units available for check-in.")

        # Create Stay record
        stay = Stay(
            reservation_room_id=res_room.reservation_room_id,
            room_id=room.room_id,
            status="CHECKED_IN",
            checkin_timestamp=datetime.now(timezone.utc)
        )
        db.add(stay)
        await db.flush()

        # Update physical room
        room.occupancy_status = "OCCUPIED"
        room.current_stay_id = stay.stay_id
        room.current_guest_name = guest_name

        # Update ReservationRoom
        res_room.assigned_room_id = room.room_id

        # Update MasterFolio
        if res.master_folio_id:
            folio_stmt = select(MasterFolio).where(MasterFolio.folio_id == res.master_folio_id)
            folio = (await db.execute(folio_stmt)).scalar_one_or_none()
            if folio:
                folio.stay_id = stay.stay_id
                folio.room_number = room.room_number

        await db.commit()
        from backend.app.services.reservation_service import ReservationService
        ReservationService.invalidate_cache()

        return {
            "success": True,
            "message": f"Guest {guest_name} successfully checked into Room {room.room_number}.",
            "stay_id": stay.stay_id,
            "room_number": room.room_number,
            "qr_access_token": stay.qr_access_token
        }

    @staticmethod
    async def check_out_guest(
        db: AsyncSession,
        property_id: str,
        request: CheckOutRequest
    ) -> dict:
        stay = None
        if request.stay_id:
            stay_stmt = select(Stay).where(Stay.stay_id == request.stay_id)
            stay = (await db.execute(stay_stmt)).scalar_one_or_none()
        if not stay and request.reservation_id:
            rr_stmt = select(ReservationRoom.reservation_room_id).where(ReservationRoom.reservation_id == request.reservation_id)
            rr_ids = (await db.execute(rr_stmt)).scalars().all()
            if rr_ids:
                stay_stmt = select(Stay).where(Stay.reservation_room_id.in_(rr_ids), Stay.status == "CHECKED_IN")
                stay = (await db.execute(stay_stmt)).scalars().first()
        if not stay and request.room_id:
            stay_stmt = select(Stay).where(Stay.room_id == request.room_id, Stay.status == "CHECKED_IN")
            stay = (await db.execute(stay_stmt)).scalars().first()

        if not stay:
            raise NotFoundException("Stay record not found.")

        if stay.status != "CHECKED_IN":
            raise ConflictException(f"Cannot checkout stay in status: {stay.status}")

        # Fetch Room & verify property isolation
        room_stmt = select(Room).where(Room.room_id == stay.room_id)
        room = (await db.execute(room_stmt)).scalar_one_or_none()
        if room and room.property_id != property_id:
            raise ForbiddenException("Cross-property stay checkout is strictly forbidden.")

        # Fetch ReservationRoom
        rr_stmt = select(ReservationRoom).where(ReservationRoom.reservation_room_id == stay.reservation_room_id)
        rr = (await db.execute(rr_stmt)).scalar_one_or_none()

        # Fetch Folio
        folio_stmt = (
            select(MasterFolio)
            .where(MasterFolio.stay_id == stay.stay_id)
            .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
        )
        folio = (await db.execute(folio_stmt)).scalar_one_or_none()
        if not folio and rr:
            folio_stmt2 = (
                select(MasterFolio)
                .where(MasterFolio.reservation_id == rr.reservation_id)
                .options(selectinload(MasterFolio.line_items), selectinload(MasterFolio.payments))
            )
            folio = (await db.execute(folio_stmt2)).scalar_one_or_none()

        guest_stmt = select(GuestProfile).where(GuestProfile.guest_id == folio.guest_id) if folio else None
        guest = (await db.execute(guest_stmt)).scalar_one_or_none() if guest_stmt is not None else None
        recipient_name = guest.full_name if guest else "Guest"

        # Check balance settlement
        if folio and folio.outstanding_balance_minor > 0:
            if not request.settle_remaining_with_method:
                raise ConflictException(
                    f"Folio has outstanding balance of ₹{folio.outstanding_balance_minor / 100:.2f}. Settlement method required to finalize checkout.",
                    code="OUTSTANDING_FOLIO_BALANCE",
                    details={"outstandingBalancePaise": folio.outstanding_balance_minor}
                )
            # Process final settlement payment
            settle_amount = folio.outstanding_balance_minor
            txn_ref = f"TXN-SETTLE-{random.randint(100000, 999999)}"
            receipt_num = f"REC-2026-{random.randint(1000, 9999)}"

            payment = Payment(
                property_id=property_id,
                folio_id=folio.folio_id,
                transaction_ref=txn_ref,
                receipt_number=receipt_num,
                amount_minor=settle_amount,
                currency="INR",
                payment_method=request.settle_remaining_with_method,
                provider="CASH_REGISTER" if request.settle_remaining_with_method == "CASH" else "PINE_LABS_POS",
                status="SUCCESS"
            )
            db.add(payment)

            ps_stmt = select(PropertySettings.current_business_date).where(PropertySettings.property_id == property_id)
            active_b_date = (await db.execute(ps_stmt)).scalar_one_or_none() or get_kolkata_calendar_date()

            payment_line = FolioLineItem(
                folio_id=folio.folio_id,
                business_date=active_b_date,
                transaction_type="PAYMENT",
                service_category="CHECKOUT_SETTLEMENT",
                sac_hsn_code="996311",
                description=f"Checkout Final Settlement via {request.settle_remaining_with_method}",
                debit_minor=0,
                credit_minor=settle_amount,
                net_minor=-settle_amount,
                tax_minor=0,
                posted_by="FRONT_DESK",
                reference_number=txn_ref
            )
            db.add(payment_line)

            state = attributes.instance_state(folio)
            if "line_items" in state.dict and folio.line_items is not None:
                folio.line_items.append(payment_line)
                from backend.app.services.folio_service import FolioService
                FolioService.recalculate_folio_balance(folio)
            else:
                folio.total_payments_minor += settle_amount
                folio.outstanding_balance_minor = max(0, folio.total_charges_minor - folio.total_payments_minor)
            if folio.outstanding_balance_minor == 0:
                folio.status = "SETTLED"

        # Finalize Stay
        stay.status = "CHECKED_OUT"
        stay.checkout_timestamp = datetime.now(timezone.utc)

        # Update physical room to VACANT and DIRTY
        if room:
            room.occupancy_status = "VACANT"
            room.clean_status = "DIRTY"
            room.current_stay_id = None
            room.current_guest_name = None

            # Automatically dispatch or update Housekeeping turnover task
            active_hk_stmt = (
                select(HousekeepingTask)
                .where(
                    HousekeepingTask.property_id == property_id,
                    HousekeepingTask.room_id == room.room_id,
                    HousekeepingTask.status.in_(["DIRTY", "CLEANING", "CLEANED"])
                )
                .order_by(HousekeepingTask.created_at.desc())
            )
            existing_hk_task = (await db.execute(active_hk_stmt)).scalars().first()
            if existing_hk_task:
                existing_hk_task.task_type = "FULL_TURNOVER"
                existing_hk_task.status = "DIRTY"
                existing_hk_task.priority = "HIGH"
                existing_hk_task.notes = f"Checkout turnover for Room {room.room_number}"
                existing_hk_task.completed_at = None
                existing_hk_task.inspected_at = None
            else:
                hk_task = HousekeepingTask(
                    property_id=property_id,
                    room_id=room.room_id,
                    task_type="FULL_TURNOVER",
                    status="DIRTY",
                    priority="HIGH",
                    notes=f"Checkout turnover for Room {room.room_number}"
                )
                db.add(hk_task)

        # Update Reservation status and dates (handles early checkout and completion)
        if rr:
            res_stmt = select(Reservation).where(Reservation.reservation_id == rr.reservation_id)
            res_obj = (await db.execute(res_stmt)).scalar_one_or_none()
            if res_obj:
                if folio and folio.outstanding_balance_minor == 0:
                    res_obj.paid_amount_minor = res_obj.total_amount_minor
                    res_obj.balance_amount_minor = 0
                    res_obj.payment_status = "PAID"

                ps_stmt = select(PropertySettings.current_business_date).where(PropertySettings.property_id == property_id)
                active_b_date = (await db.execute(ps_stmt)).scalar_one_or_none() or get_kolkata_calendar_date()
                if active_b_date < rr.checkout_date:
                    effective_checkout = max(active_b_date, rr.checkin_date)
                    rr.checkout_date = effective_checkout
                    res_obj.checkout_date = effective_checkout
                    try:
                        ci_dt = datetime.strptime(rr.checkin_date, "%Y-%m-%d")
                        co_dt = datetime.strptime(effective_checkout, "%Y-%m-%d")
                        new_nights = max(1, (co_dt - ci_dt).days)
                        rr.nights = new_nights
                        res_obj.nights = new_nights
                    except Exception:
                        pass

                all_rrs_stmt = select(ReservationRoom).where(ReservationRoom.reservation_id == res_obj.reservation_id)
                all_rrs = (await db.execute(all_rrs_stmt)).scalars().all()
                all_checked_out = True
                for r_item in all_rrs:
                    st_stmt = select(Stay).where(Stay.reservation_room_id == r_item.reservation_room_id)
                    st = (await db.execute(st_stmt)).scalar_one_or_none()
                    if not st or (st.stay_id != stay.stay_id and st.status != "CHECKED_OUT"):
                        all_checked_out = False
                        break
                if all_checked_out:
                    res_obj.status = "COMPLETED"
                    if res_obj.external_booking_ref:
                        wb_stmt = select(WebsiteBooking).where(WebsiteBooking.reference == res_obj.external_booking_ref)
                        wb = (await db.execute(wb_stmt)).scalar_one_or_none()
                        if wb:
                            wb.status = "completed"

        # Generate GST Tax Invoice (one per folio, consecutive serial within the financial year)
        invoice_num = None
        if folio:
            invoice_num = (await db.execute(select(Invoice.invoice_number).where(Invoice.folio_id == folio.folio_id))).scalars().first()
            if not invoice_num:
                fy = financial_year()
                serial = (await db.execute(
                    select(func.count(Invoice.invoice_id)).where(Invoice.property_id == property_id, Invoice.financial_year == fy)
                )).scalar() or 0
                invoice_num = f"INV/{fy}/{serial + 1:05d}"
                db.add(Invoice(
                    property_id=property_id,
                    folio_id=folio.folio_id,
                    invoice_number=invoice_num,
                    financial_year=fy,
                    recipient_name=recipient_name,
                    total_taxable_minor=folio.total_charges_minor - folio.total_taxes_minor,
                    total_tax_minor=folio.total_taxes_minor,
                    total_invoice_minor=folio.total_charges_minor,
                    pdf_s3_key=f"invoices/{fy}/{invoice_num.replace('/', '_')}.pdf"
                ))
        await db.commit()
        from backend.app.services.reservation_service import ReservationService
        ReservationService.invalidate_cache()

        return {
            "success": True,
            "message": f"Checkout completed successfully for Room {room.room_number if room else ''}.",
            "invoice_number": invoice_num,
            "room_state": "VACANT_DIRTY",
            "housekeeping_task_dispatched": True
        }

    @staticmethod
    async def move_room(
        db: AsyncSession,
        property_id: str,
        request: RoomMoveRequest
    ) -> dict:
        stay_stmt = select(Stay).where(Stay.stay_id == request.stay_id)
        stay = (await db.execute(stay_stmt)).scalar_one_or_none()
        if not stay or stay.status != "CHECKED_IN":
            raise ConflictException("Active checked-in stay required for room move.")

        # Old room
        old_rm_stmt = select(Room).where(Room.room_id == stay.room_id)
        old_room = (await db.execute(old_rm_stmt)).scalar_one_or_none()
        if old_room and old_room.property_id != property_id:
            raise ForbiddenException("Cross-property room move is strictly forbidden.")

        # Target room
        new_rm_stmt = select(Room).where(Room.property_id == property_id, Room.room_id == request.new_room_id)
        new_room = (await db.execute(new_rm_stmt)).scalar_one_or_none()
        if not new_room:
            raise NotFoundException("Destination room not found.")

        if new_room.occupancy_status != "VACANT":
            raise ConflictException(f"Destination room {new_room.room_number} is {new_room.occupancy_status}.")
        if new_room.maintenance_status != "OPERATIONAL":
            raise ConflictException(f"Destination room {new_room.room_number} is currently blocked for maintenance ({new_room.maintenance_status}).")

        guest_name = old_room.current_guest_name if old_room else "Guest"

        # Update old room
        if old_room:
            old_room.occupancy_status = "VACANT"
            old_room.clean_status = "DIRTY"
            old_room.current_stay_id = None
            old_room.current_guest_name = None
            old_room.notes = f"Guest moved to {new_room.room_number}: {request.reason}"

        # Update new room
        new_room.occupancy_status = "OCCUPIED"
        new_room.current_stay_id = stay.stay_id
        new_room.current_guest_name = guest_name

        # Update stay
        stay.room_id = new_room.room_id

        # Update folio
        folio_stmt = select(MasterFolio).where(MasterFolio.stay_id == stay.stay_id)
        folio = (await db.execute(folio_stmt)).scalar_one_or_none()
        if folio:
            folio.room_number = new_room.room_number

        await db.commit()
        from backend.app.services.reservation_service import ReservationService
        ReservationService.invalidate_cache()

        return {
            "success": True,
            "message": f"Successfully moved guest from Room {old_room.room_number if old_room else ''} to Room {new_room.room_number}."
        }

    @staticmethod
    async def walk_in_check_in(
        db: AsyncSession,
        property_id: str,
        request: WalkInCheckInRequest
    ) -> dict:
        if not request.guest_name or not request.guest_name.strip():
            raise ValidationException("Guest name is required.")
        if not request.guest_phone or not request.guest_phone.strip():
            raise ValidationException("Guest phone is required.")
        if request.nights < 1:
            raise ValidationException("Nights must be at least 1.")

        # 1. Fetch Room by room_number and property_id
        rm_stmt = select(Room).where(
            Room.property_id == property_id,
            Room.room_number == str(request.room_number).strip()
        )
        room = (await db.execute(rm_stmt)).scalar_one_or_none()
        if not room:
            raise NotFoundException(f"Physical room {request.room_number} not found.")

        if room.occupancy_status != "VACANT":
            raise ConflictException(f"Room {room.room_number} is currently {room.occupancy_status}. Only VACANT rooms can be checked into.")
        if room.maintenance_status != "OPERATIONAL":
            raise ConflictException(f"Room {room.room_number} is currently blocked for maintenance ({room.maintenance_status}).")

        # 2. Get current business date from PropertySettings
        ps_stmt = select(PropertySettings).where(PropertySettings.property_id == property_id)
        prop_settings = (await db.execute(ps_stmt)).scalar_one_or_none()
        checkin_date = prop_settings.current_business_date if prop_settings else get_kolkata_calendar_date()

        try:
            checkin_dt = datetime.strptime(checkin_date, "%Y-%m-%d")
        except ValueError:
            checkin_date = get_kolkata_calendar_date()
            checkin_dt = datetime.strptime(checkin_date, "%Y-%m-%d")

        checkout_dt = checkin_dt + timedelta(days=request.nights)
        checkout_date = checkout_dt.strftime("%Y-%m-%d")

        # 3. Find or create GuestProfile
        guest_stmt = select(GuestProfile).where(
            or_(
                GuestProfile.phone == request.guest_phone.strip(),
                GuestProfile.email == (request.guest_email.strip() if request.guest_email else "___none___")
            )
        )
        guest = (await db.execute(guest_stmt)).scalars().first()
        if not guest:
            parts = request.guest_name.strip().split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
            guest = GuestProfile(
                org_id=room.org_id if hasattr(room, "org_id") and room.org_id else settings.DEFAULT_ORG_ID,
                first_name=first_name,
                last_name=last_name,
                full_name=request.guest_name.strip(),
                email=request.guest_email.strip() if request.guest_email else None,
                phone=request.guest_phone.strip(),
                nationality="Indian",
                vip_tier="REGULAR"
            )
            db.add(guest)
            await db.flush()

        # 4. Fetch RoomType and RatePlan
        rt_stmt = select(RoomType).where(RoomType.room_type_id == room.room_type_id)
        room_type = (await db.execute(rt_stmt)).scalar_one_or_none()
        rp_stmt = select(RatePlan).where(RatePlan.room_type_id == room.room_type_id, RatePlan.is_active == True)
        rate_plan = (await db.execute(rp_stmt)).scalars().first()

        advance_paise = request.advance_amount_paise or 0
        base_rate = rate_plan.base_price_minor if rate_plan else (room_type.base_rate_minor if room_type else 450000)
        rate_per_night = base_rate
        base_room_amount = rate_per_night * request.nights
        tax_amount = room_tax_minor(base_rate, base_room_amount)
        total_amount = base_room_amount + tax_amount

        balance_due = max(0, total_amount - advance_paise)
        payment_method = request.deposit_payment_method or "UPI"

        # 5. Create Master Folio
        folio_number = new_folio_number()
        master_folio = MasterFolio(
            property_id=property_id,
            reservation_id="",
            guest_id=guest.guest_id,
            room_number=room.room_number,
            folio_number=folio_number,
            status="OPEN",
            credit_limit_minor=5000000,
            total_charges_minor=total_amount,
            total_taxes_minor=tax_amount,
            total_payments_minor=advance_paise,
            outstanding_balance_minor=balance_due
        )
        db.add(master_folio)
        await db.flush()

        # 6. Create Reservation
        booking_ref = new_booking_ref()
        reservation = Reservation(
            booking_reference=booking_ref,
            property_id=property_id,
            guest_id=guest.guest_id,
            source="WALK_IN",
            status="CONFIRMED",
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            nights=request.nights,
            rooms_count=1,
            total_amount_minor=total_amount,
            paid_amount_minor=advance_paise,
            balance_amount_minor=balance_due,
            payment_status="PAID" if balance_due == 0 else "PARTIALLY_PAID" if advance_paise > 0 else "UNPAID",
            master_folio_id=master_folio.folio_id
        )
        db.add(reservation)
        await db.flush()

        master_folio.reservation_id = reservation.reservation_id

        # 7. Create ReservationRoom
        res_room = ReservationRoom(
            reservation_id=reservation.reservation_id,
            room_type_id=room.room_type_id,
            rate_plan_id=rate_plan.rate_plan_id if rate_plan else "rp-default",
            assigned_room_id=room.room_id,
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            nights=request.nights,
            adults=2,
            children=0,
            rate_per_night_minor=rate_per_night,
            total_gross_minor=total_amount
        )
        db.add(res_room)
        await db.flush()

        # 8. Create Stay
        stay = Stay(
            reservation_room_id=res_room.reservation_room_id,
            room_id=room.room_id,
            status="CHECKED_IN",
            checkin_timestamp=datetime.now(timezone.utc)
        )
        db.add(stay)
        await db.flush()

        # 9. Update room and folio
        room.occupancy_status = "OCCUPIED"
        room.current_stay_id = stay.stay_id
        room.current_guest_name = guest.full_name
        master_folio.stay_id = stay.stay_id

        # 10. Record initial room charge line item
        room_line = FolioLineItem(
            folio_id=master_folio.folio_id,
            business_date=checkin_date,
            transaction_type="ROOM_CHARGE",
            service_category="ROOM_CHARGE",
            sac_hsn_code="996311",
            description=f"Room Accommodation ({request.nights} Nights - {room.room_number})",
            debit_minor=base_room_amount,
            credit_minor=0,
            net_minor=base_room_amount,
            tax_minor=tax_amount,
            posted_by="FRONT_DESK",
            reference_number=booking_ref
        )
        db.add(room_line)

        # 11. Record advance payment if collected
        if advance_paise > 0:
            txn_ref = f"TXN-WALKIN-{random.randint(100000, 999999)}"
            payment = Payment(
                property_id=property_id,
                folio_id=master_folio.folio_id,
                transaction_ref=txn_ref,
                receipt_number=f"REC-2026-{random.randint(1000, 9999)}",
                amount_minor=advance_paise,
                currency="INR",
                payment_method=payment_method,
                provider="CASH_REGISTER" if payment_method == "CASH" else "POS_TERMINAL",
                status="SUCCESS"
            )
            db.add(payment)

            payment_line = FolioLineItem(
                folio_id=master_folio.folio_id,
                business_date=checkin_date,
                transaction_type="PAYMENT",
                service_category="ADVANCE_DEPOSIT",
                sac_hsn_code="996311",
                description=f"Walk-In Advance Deposit via {payment_method}",
                debit_minor=0,
                credit_minor=advance_paise,
                net_minor=-advance_paise,
                tax_minor=0,
                posted_by="FRONT_DESK",
                reference_number=txn_ref
            )
            db.add(payment_line)

        await db.commit()
        from backend.app.services.reservation_service import ReservationService
        ReservationService.invalidate_cache()

        return {
            "success": True,
            "message": f"Walk-in check-in completed for {guest.full_name} into Room {room.room_number}.",
            "room_number": room.room_number,
            "booking_reference": reservation.booking_reference,
            "stay_id": stay.stay_id,
            "reservation_id": reservation.reservation_id,
            "qr_access_token": stay.qr_access_token
        }

    @staticmethod
    async def get_business_date(db: AsyncSession, property_id: str) -> dict:
        stmt = select(PropertySettings.current_business_date, PropertySettings.night_audit_status).where(PropertySettings.property_id == property_id)
        row = (await db.execute(stmt)).first()

        current_calendar_date = get_kolkata_calendar_date()
        business_date = row[0] if row and row[0] else current_calendar_date
        audit_status = row[1] if row and row[1] else "IDLE"

        return {
            "property_id": property_id,
            "business_date": business_date,
            "calendar_date": current_calendar_date,
            "timezone": KOLKATA_TIMEZONE_NAME,
            "night_audit_status": audit_status
        }

