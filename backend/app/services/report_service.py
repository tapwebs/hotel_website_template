import time
import asyncio
from datetime import datetime, timezone, timedelta, date
from backend.app.core.timezone import get_kolkata_calendar_date, KOLKATA_TZ, get_next_business_date
from collections import defaultdict
from typing import List, Optional, Dict, Any

_property_audit_locks: Dict[str, asyncio.Lock] = {}

def _get_property_audit_lock(property_id: str) -> asyncio.Lock:
    if property_id not in _property_audit_locks:
        _property_audit_locks[property_id] = asyncio.Lock()
    return _property_audit_locks[property_id]
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.errors import ConflictException, NotFoundException, ValidationException
from backend.app.models.organization import Property, PropertySettings
from backend.app.models.room import Room
from backend.app.models.reservation import Reservation, ReservationRoom, Stay
from backend.app.models.folio import MasterFolio, FolioLineItem, Payment
from backend.app.models.operations import HousekeepingTask, MaintenanceTicket
from backend.app.models.pos import POSOrder, MenuItem, POSShift
from backend.app.models.audit import NightAuditRun, AuditLog
from backend.app.core.tax import room_tax_minor
from backend.app.models.reservation import Reservation as _Reservation  # noqa: F401
from backend.app.services.folio_service import FolioService
from backend.app.services import report_metrics as rm
from backend.app.schemas.reports import (
    DashboardKPIsResponse,
    ManagerFlashReportResponse,
    NightAuditStepResponse,
    RoomStatusSummary,
    TaxLiabilityItem,
    FnbAnalyticsResponse,
    FnbIntegrationStatus,
    FnbSummaryKPIs,
    FnbOutletPerformance,
    FnbRevenueTrendPoint,
    FnbRevenueBreakdownItem,
    FnbTopSellingItem,
    FnbOperationalMetrics,
    FnbFolioReconciliation,
    FnbTrends,
)

# In-memory fast caches for heavy reports & KPIs to eliminate expensive multi-table joins
_dashboard_kpis_cache: dict[str, tuple[float, DashboardKPIsResponse]] = {}
_flash_report_cache: dict[str, tuple[float, ManagerFlashReportResponse]] = {}
_fnb_analytics_cache: dict[str, tuple[float, FnbAnalyticsResponse]] = {}

CACHE_TTL_SECONDS = 15.0
FLASH_CACHE_TTL_SECONDS = 30.0
FNB_CACHE_TTL_SECONDS = 60.0


def clear_reports_cache():
    """Clear all in-memory reports & KPI caches upon date changes or audit rollovers."""
    _dashboard_kpis_cache.clear()
    _flash_report_cache.clear()
    _fnb_analytics_cache.clear()



class ReportService:
    @staticmethod
    async def get_dashboard_kpis(db: AsyncSession, property_id: str, business_date: Optional[str] = None) -> DashboardKPIsResponse:
        """Live KPIs for the active business date, or the figures for a given (e.g. just-closed) date."""
        live = business_date is None
        if live:
            cached = _dashboard_kpis_cache.get(property_id)
            if cached and (time.time() - cached[0] < CACHE_TTL_SECONDS):
                return cached[1]

        settings_stmt = select(PropertySettings.current_business_date).where(PropertySettings.property_id == property_id)
        settings_date = (await db.execute(settings_stmt)).scalar_one_or_none()
        current_bd = settings_date if settings_date else get_kolkata_calendar_date()
        bd = business_date or current_bd

        # Physical rooms aggregate stats in a single query
        rooms_stmt = select(
            func.count(Room.room_id).label("total"),
            func.count(case((Room.clean_status == "CLEAN", 1))).label("clean"),
            func.count(case((Room.clean_status == "DIRTY", 1))).label("dirty"),
            func.count(case((Room.clean_status == "CLEANING", 1))).label("cleaning"),
            func.count(case((Room.clean_status == "INSPECTED", 1))).label("inspected"),
            func.count(case((or_(Room.occupancy_status == "OUT_OF_ORDER", Room.maintenance_status == "OUT_OF_ORDER"), 1))).label("ooo"),
            func.count(case((or_(Room.occupancy_status == "OUT_OF_SERVICE", Room.maintenance_status == "OUT_OF_SERVICE"), 1))).label("oos"),
            func.count(case((Room.occupancy_status == "OCCUPIED", 1))).label("occupied")
        ).where(Room.property_id == property_id)
        r_row = (await db.execute(rooms_stmt)).one()

        total_rooms = int(r_row.total or 0)
        ooo_cnt = int(r_row.ooo or 0)
        oos_cnt = int(r_row.oos or 0)
        sellable_rooms = max(0, total_rooms - ooo_cnt - oos_cnt)

        # Rooms occupied on the night of `bd` (accrued from stays) -> revenue, ADR, rooms sold
        night = await rm.stays_in_house_on(db, property_id, bd)
        rooms_sold = len(night)
        occupied_rooms = rooms_sold  # same definition live and historical, so occupancy, ADR and revenue always agree
        occupancy_pct = round((occupied_rooms / sellable_rooms) * 100, 1) if sellable_rooms else 0.0
        in_house_guests = sum(s.adults + s.children for s in night if s.status == "CHECKED_IN") if live else sum(s.adults + s.children for s in night)

        # Arrivals & departures
        res_stmt = select(
            func.count(case((and_(Reservation.checkin_date == bd, Reservation.status != "CANCELLED"), 1))).label("arr_expected"),
            func.count(case((and_(Reservation.checkout_date == bd, Reservation.status != "CANCELLED"), 1))).label("dep_expected")
        ).where(Reservation.property_id == property_id)
        res_row = (await db.execute(res_stmt)).one()
        arr_expected = res_row.arr_expected or 0
        dep_expected = res_row.dep_expected or 0

        stays_stmt = select(
            func.count(case((and_(Reservation.checkin_date == bd, Stay.status.in_(["CHECKED_IN", "CHECKED_OUT"])), 1))).label("arr_checked_in"),
            func.count(case((and_(Reservation.checkout_date == bd, Stay.status == "CHECKED_OUT"), 1))).label("dep_checked_out")
        ).select_from(Stay).join(ReservationRoom, Stay.reservation_room_id == ReservationRoom.reservation_room_id).join(Reservation, ReservationRoom.reservation_id == Reservation.reservation_id).where(
            Reservation.property_id == property_id,
            or_(Reservation.checkin_date == bd, Reservation.checkout_date == bd)
        )
        stays_row = (await db.execute(stays_stmt)).one()
        arr_checked_in = stays_row.arr_checked_in or 0
        dep_checked_out = stays_row.dep_checked_out or 0

        # Folio balances (live ledger state)
        folios_stmt = select(
            func.coalesce(func.sum(case((MasterFolio.status == "OPEN", MasterFolio.outstanding_balance_minor), else_=0)), 0).label("unsettled"),
            func.count(case((and_(MasterFolio.status == "OPEN", MasterFolio.outstanding_balance_minor > MasterFolio.credit_limit_minor), 1))).label("over_credit")
        ).where(MasterFolio.property_id == property_id)
        f_row = (await db.execute(folios_stmt)).one()

        # Revenue (pre-tax) for the business date
        room_rev = sum(s.rate_minor for s in night)
        ledger = await rm.ledger_non_room_on(db, property_id, bd)
        pos = await rm.pos_direct_on(db, property_id, bd)
        fnb_rev = ledger.by_type_net.get("FNB_CHARGE", 0) + pos.net_minor
        other_rev = sum(v for k, v in ledger.by_type_net.items() if k != "FNB_CHARGE")
        total_rev = room_rev + fnb_rev + other_rev
        adr_paise = room_rev // rooms_sold if rooms_sold else 0
        revpar_paise = room_rev // sellable_rooms if sellable_rooms else 0

        pending_hk = (await db.execute(select(func.count(HousekeepingTask.task_id)).where(
            HousekeepingTask.property_id == property_id,
            HousekeepingTask.status.in_(["DIRTY", "CLEANING"])
        ))).scalar() or 0
        critical_mnt = (await db.execute(select(func.count(MaintenanceTicket.ticket_id)).where(
            MaintenanceTicket.property_id == property_id,
            MaintenanceTicket.priority == "CRITICAL",
            MaintenanceTicket.status.in_(["OPEN", "IN_PROGRESS"])
        ))).scalar() or 0
        start, end = rm.day_bounds_utc(bd)
        payment_exceptions = (await db.execute(select(func.count(Payment.payment_id)).where(
            Payment.property_id == property_id, Payment.status == "FAILED",
            Payment.created_at >= start, Payment.created_at < end
        ))).scalar() or 0

        response = DashboardKPIsResponse(
            businessDate=bd,
            totalRooms=total_rooms,
            sellableRooms=sellable_rooms,
            occupiedRooms=occupied_rooms,
            occupancyPercentage=occupancy_pct,
            arrivalsToday={"expected": arr_expected, "checkedIn": arr_checked_in, "pending": max(0, arr_expected - arr_checked_in)},
            departuresToday={"expected": dep_expected, "checkedOut": dep_checked_out, "pending": max(0, dep_expected - dep_checked_out)},
            inHouseGuests=in_house_guests,
            adrPaise=adr_paise,
            revParPaise=revpar_paise,
            todaysRoomRevenuePaise=room_rev,
            todaysFnbRevenuePaise=fnb_rev,
            todaysTotalRevenuePaise=total_rev,
            unsettledFolioBalancePaise=int(f_row.unsettled),
            overCreditLimitCount=int(f_row.over_credit),
            roomStatusSummary=RoomStatusSummary(
                clean=int(r_row.clean or 0),
                dirty=int(r_row.dirty or 0),
                cleaning=int(r_row.cleaning or 0),
                inspected=int(r_row.inspected or 0),
                ooo=ooo_cnt,
                oos=oos_cnt
            ),
            pendingHousekeepingTasks=pending_hk,
            criticalMaintenanceAlerts=critical_mnt,
            paymentExceptionsCount=payment_exceptions
        )

        if live:
            _dashboard_kpis_cache[property_id] = (time.time(), response)
        return response

    @staticmethod
    async def get_night_audit_status(db: AsyncSession, property_id: str) -> dict:
        settings_stmt = select(PropertySettings).where(PropertySettings.property_id == property_id)
        settings_obj = (await db.execute(settings_stmt)).scalar_one_or_none()
        calendar_date_str = get_kolkata_calendar_date()
        business_date_str = settings_obj.current_business_date if settings_obj else calendar_date_str

        # Query latest completed audit run
        last_run_stmt = (
            select(NightAuditRun)
            .where(NightAuditRun.property_id == property_id, NightAuditRun.status == "COMPLETED")
            .order_by(NightAuditRun.business_date.desc())
            .limit(1)
        )
        last_run = (await db.execute(last_run_stmt)).scalar_one_or_none()

        # Query pending arrivals for business_date_str (include CONFIRMED and PENDING)
        arr_stmt = (
            select(Reservation)
            .where(
                Reservation.property_id == property_id,
                Reservation.checkin_date == business_date_str,
                Reservation.status.in_(["CONFIRMED", "PENDING"])
            )
            .options(
                selectinload(Reservation.rooms).selectinload(ReservationRoom.stay),
                selectinload(Reservation.guest)
            )
        )
        arrivals = (await db.execute(arr_stmt)).scalars().all()
        unresolved_arrivals: List[Dict[str, Any]] = []
        for r in arrivals:
            checked_in = [rm for rm in (r.rooms or []) if rm.stay and rm.stay.status in ("CHECKED_IN", "CHECKED_OUT")]
            pending_rooms = [rm for rm in (r.rooms or []) if rm not in checked_in]
            if pending_rooms or not r.rooms or r.status == "PENDING":
                guest_name = r.guest.full_name if r.guest else "Guest"
                unresolved_arrivals.append({
                    "reservation_id": r.reservation_id,
                    "booking_reference": r.booking_reference,
                    "external_booking_ref": r.external_booking_ref,
                    "guest_name": guest_name,
                    "status": r.status,
                    "total_rooms": len(r.rooms or []),
                    "checked_in_rooms": len(checked_in),
                    "pending_rooms": len(pending_rooms),
                    "checkin_date": r.checkin_date,
                    "checkout_date": r.checkout_date
                })
        pending_arrivals_count = len(unresolved_arrivals)

        # Query open POS orders (active in kitchen, or delivered dine-in/counter/takeaway pending settlement)
        pos_stmt = select(func.count(POSOrder.order_id)).where(
            POSOrder.property_id == property_id,
            or_(
                POSOrder.status.in_(["QUEUED", "PREPARING", "READY"]),
                and_(POSOrder.status == "DELIVERED", POSOrder.order_type != "ROOM_SERVICE")
            )
        )
        open_pos_count = (await db.execute(pos_stmt)).scalar() or 0

        # Query open cashier shifts
        open_shifts_stmt = select(func.count(POSShift.shift_id)).where(
            POSShift.property_id == property_id,
            POSShift.status == "OPEN"
        )
        open_shifts_count = (await db.execute(open_shifts_stmt)).scalar() or 0

        # Query in-house stays count
        stays_stmt = (
            select(func.count(Stay.stay_id))
            .join(ReservationRoom, Stay.reservation_room_id == ReservationRoom.reservation_room_id)
            .join(Reservation, ReservationRoom.reservation_id == Reservation.reservation_id)
            .where(Reservation.property_id == property_id, Stay.status == "CHECKED_IN")
        )
        in_house_stays_count = (await db.execute(stays_stmt)).scalar() or 0

        blocking_reasons: List[str] = []
        is_day_closed = False
        if last_run and (last_run.business_date == business_date_str or (business_date_str > calendar_date_str and last_run.new_business_date == business_date_str)):
            is_day_closed = True

        if is_day_closed:
            status = "COMPLETED"
            can_run = False
            blocking_reasons.append(f"Business day has already been audited and closed. Active business date is {business_date_str}.")
        elif business_date_str > calendar_date_str:
            status = "COMPLETED"
            can_run = False
            blocking_reasons.append(f"Active business date ({business_date_str}) is ahead of calendar date ({calendar_date_str}).")
        elif pending_arrivals_count > 0:
            status = "BLOCKED"
            can_run = False
            refs_summary = ", ".join(f"{a['booking_reference']} ({a['guest_name']})" for a in unresolved_arrivals[:3])
            blocking_reasons.append(f"{pending_arrivals_count} expected arrival(s) pending check-in or NO-SHOW: {refs_summary}.")
        elif open_shifts_count > 0:
            status = "BLOCKED"
            can_run = False
            blocking_reasons.append(f"{open_shifts_count} open POS cashier shift(s) pending closure.")
        elif open_pos_count > 0:
            status = "BLOCKED"
            can_run = False
            blocking_reasons.append(f"{open_pos_count} open POS order(s) pending settlement or closure.")
        elif settings_obj and settings_obj.night_audit_status == "FAILED":
            status = "FAILED"
            can_run = True
        elif settings_obj and settings_obj.night_audit_status == "IN_PROGRESS":
            status = "IN_PROGRESS"
            can_run = False
        else:
            status = "READY"
            can_run = True

        last_audit_data = None
        if last_run:
            last_audit_data = {
                "business_date": last_run.business_date,
                "new_business_date": last_run.new_business_date,
                "completed_at": last_run.completed_at.isoformat() if last_run.completed_at else None,
                "room_charges_posted": last_run.room_charges_posted,
                "total_charges_minor": last_run.total_charges_minor,
                "total_tax_minor": last_run.total_tax_minor
            }

        return {
            "property_id": property_id,
            "business_date": business_date_str,
            "calendar_date": calendar_date_str,
            "status": status,
            "can_run": can_run,
            "last_audit_run": last_audit_data,
            "pending_arrivals_count": pending_arrivals_count,
            "open_pos_orders_count": open_pos_count,
            "open_shifts_count": open_shifts_count,
            "in_house_stays_count": in_house_stays_count,
            "blocking_reasons": blocking_reasons,
            "unresolved_arrivals": unresolved_arrivals
        }

    @staticmethod
    async def room_posting_plan(db: AsyncSession, property_id: str, closing_date: str) -> List[Dict[str, Any]]:
        """For every in-house stay: what night audit will post for `closing_date`.

        Walk-in and booking flows post the whole stay to the folio up front. Those stays are *prepaid* and
        must not be charged again nightly; other stays get one nightly room charge plus GST (5% up to
        Rs 7,500 per night, 18% above). Charges are keyed per stay so multi-room folios post every room.
        """
        stmt = (
            select(Stay, Room)
            .outerjoin(Room, Room.room_id == Stay.room_id)
            .join(ReservationRoom, Stay.reservation_room_id == ReservationRoom.reservation_room_id)
            .join(Reservation, ReservationRoom.reservation_id == Reservation.reservation_id)
            .where(Reservation.property_id == property_id, Stay.status == "CHECKED_IN")
            .options(selectinload(Stay.reservation_room).selectinload(ReservationRoom.reservation).selectinload(Reservation.rooms))
        )
        plan: List[Dict[str, Any]] = []
        for stay, room in (await db.execute(stmt)).all():
            res_room = stay.reservation_room
            reservation = res_room.reservation if res_room else None
            folio = None
            if reservation and reservation.master_folio_id:
                folio = (await db.execute(
                    select(MasterFolio).where(MasterFolio.folio_id == reservation.master_folio_id).options(selectinload(MasterFolio.line_items))
                )).scalar_one_or_none()
            if not folio:
                folio = (await db.execute(
                    select(MasterFolio).where(MasterFolio.stay_id == stay.stay_id).options(selectinload(MasterFolio.line_items))
                )).scalar_one_or_none()

            rate = int(res_room.rate_per_night_minor or 0) if res_room else 0
            ref = f"NA-{closing_date}-{stay.stay_id[:8]}"
            post, reason = True, None
            if not folio:
                post, reason = False, "NO_FOLIO"
            elif rate <= 0:
                post, reason = False, "NO_RATE"
            else:
                lines = folio.line_items or []
                if any(i.reference_number == ref for i in lines):
                    post, reason = False, "ALREADY_POSTED"
                else:
                    expected = sum((rr.rate_per_night_minor or 0) * (rr.nights or 1) for rr in (reservation.rooms or [])) if reservation else 0
                    prepaid = sum(
                        (i.debit_minor or 0) - (i.credit_minor or 0)
                        for i in lines if i.transaction_type == "ROOM_CHARGE" and i.posted_by != "NIGHT_AUDIT"
                    )
                    within_booked_nights = res_room is not None and closing_date < res_room.checkout_date
                    if expected > 0 and prepaid >= expected and within_booked_nights:
                        post, reason = False, "PREPAID"
            plan.append({
                "stay": stay, "room_number": room.room_number if room else "N/A", "folio": folio,
                "rate_minor": rate, "tax_minor": room_tax_minor(rate), "post": post, "reason": reason, "reference": ref,
            })
        return plan

    @staticmethod
    async def get_night_audit_steps(db: AsyncSession, property_id: str) -> List[NightAuditStepResponse]:
        status_info = await ReportService.get_night_audit_status(db, property_id)
        b_date = status_info["business_date"]
        next_b_date = get_next_business_date(b_date)
        is_completed = status_info["status"] == "COMPLETED"
        pending_arrivals = status_info["pending_arrivals_count"]
        open_pos = status_info["open_pos_orders_count"]
        open_shifts = status_info.get("open_shifts_count", 0)
        in_house_stays = status_info["in_house_stays_count"]
        unresolved_arrs = status_info.get("unresolved_arrivals", [])

        # 1. Pending Arrivals
        step1_status = "PASSED" if (is_completed or pending_arrivals == 0) else "FAILED"
        if step1_status == "PASSED":
            step1_details = "All expected arrivals checked in or marked NO-SHOW."
        else:
            refs = ", ".join(a["booking_reference"] for a in unresolved_arrs[:3])
            step1_details = f"{pending_arrivals} expected arrival(s) unresolved: {refs}."
        step1_action = step1_status == "FAILED"

        # 2. Front Desk & POS Cash Drawers Reconciliation
        step2_status = "PASSED" if (is_completed or open_shifts == 0) else "FAILED"
        step2_details = "Front desk & POS cashier drawers balanced and closed." if step2_status == "PASSED" else f"{open_shifts} POS cashier shift(s) still open. Close shifts before audit."
        step2_action = step2_status == "FAILED"

        # 3. POS Outlets Closed
        step3_status = "PASSED" if (is_completed or open_pos == 0) else "FAILED"
        step3_details = "All F&B and Bar register batches closed." if step3_status == "PASSED" else f"{open_pos} open POS register order(s) pending closure."
        step3_action = step3_status == "FAILED"

        # 4. Room & Tax Posting
        if is_completed:
            last = status_info.get("last_audit_run") or {}
            step4_status = "PASSED"
            step4_details = (
                f"{last.get('room_charges_posted', 0)} room charge(s) posted, "
                f"GST (SAC 996311) ₹{(last.get('total_tax_minor') or 0) / 100:,.2f}."
            )
            step4_action = False
        else:
            plan = await ReportService.room_posting_plan(db, property_id, b_date)
            to_post = [x for x in plan if x["post"]]
            prepaid = [x for x in plan if x["reason"] == "PREPAID"]
            if not plan:
                step4_status = "PASSED"
                step4_details = "No rooms in house: nothing to post."
            else:
                step4_status = "PENDING"
                step4_details = (
                    f"{len(plan)} room(s) in house: {len(to_post)} to be charged tonight "
                    f"(₹{sum(x['rate_minor'] for x in to_post) / 100:,.2f} + GST ₹{sum(x['tax_minor'] for x in to_post) / 100:,.2f}), "
                    f"{len(prepaid)} already prepaid."
                )
            step4_action = False

        # 5. Rollover
        if is_completed:
            step5_status = "PASSED"
            step5_details = f"Business date successfully advanced to {b_date}."
            step5_action = False
        elif step1_status == "FAILED" or step2_status == "FAILED" or step3_status == "FAILED":
            step5_status = "PENDING"
            step5_details = "Blocked: resolve pending checklist items before date advancement."
            step5_action = False
        else:
            step5_status = "PENDING"
            step5_details = f"Ready to close {b_date} and transition to {next_b_date}."
            step5_action = True

        # 6. Flash Report
        if is_completed:
            step6_status = "PASSED"
            step6_details = "Daily Manager Flash Report compiled and archived."
        else:
            step6_status = "PENDING"
            step6_details = "Compiles automatically upon rollover completion."

        return [
            NightAuditStepResponse(
                id="na-1",
                stepNumber=1,
                title="Verify Pending Arrivals",
                description="Confirm all expected arrivals are checked in or marked NO-SHOW.",
                status=step1_status,
                details=step1_details,
                actionRequired=step1_action,
                unresolved_items=unresolved_arrs
            ),
            NightAuditStepResponse(
                id="na-2",
                stepNumber=2,
                title="Reconcile Front Desk Cash Drawers",
                description="Match physical cash collections against system recorded cash receipts.",
                status=step2_status,
                details=step2_details,
                actionRequired=False
            ),
            NightAuditStepResponse(
                id="na-3",
                stepNumber=3,
                title="Verify POS Outlets Closed",
                description="Verify all Restaurant POS and Bar register batches are closed.",
                status=step3_status,
                details=step3_details,
                actionRequired=step3_action
            ),
            NightAuditStepResponse(
                id="na-4",
                stepNumber=4,
                title="Automatic Room & Tax Posting",
                description="Post room rates and statutory taxes (SAC 9963) to all active in-house stays.",
                status=step4_status,
                details=step4_details,
                actionRequired=step4_action
            ),
            NightAuditStepResponse(
                id="na-5",
                stepNumber=5,
                title="Advance Business Date & Rollover",
                description="Transition PMS calendar to next business date.",
                status=step5_status,
                details=step5_details,
                actionRequired=step5_action
            ),
            NightAuditStepResponse(
                id="na-6",
                stepNumber=6,
                title="Generate Daily Flash Report & Backups",
                description="Compile Manager Flash Report and archive ledger state.",
                status=step6_status,
                details=step6_details,
                actionRequired=False
            )
        ]

    @staticmethod
    async def execute_rollover(
        db: AsyncSession,
        property_id: str,
        request: Optional[Any] = None,
        current_user: Optional[Any] = None
    ) -> dict:
        async with _get_property_audit_lock(property_id):
            # 1. Acquire row lock on PropertySettings to serialize concurrent requests
            settings_stmt = (
                select(PropertySettings)
                .where(PropertySettings.property_id == property_id)
                .with_for_update()
            )
            settings_obj = (await db.execute(settings_stmt)).scalar_one_or_none()
            if not settings_obj:
                raise NotFoundException("Property settings not found.")

            active_date_str = settings_obj.current_business_date
            requested_date = getattr(request, "business_date", None) if request else None
            force_auto_no_show = getattr(request, "force_auto_no_show", False) if request else False
            calendar_date_str = get_kolkata_calendar_date()

            # Determine target closing date
            if requested_date:
                closing_date_str = requested_date
            else:
                # If no explicit date given, check if active date is ahead of calendar date
                # and previous day's audit was already completed (repeat click / refresh)
                if active_date_str > calendar_date_str:
                    prev_d = (datetime.strptime(active_date_str, "%Y-%m-%d").date() - timedelta(days=1)).strftime("%Y-%m-%d")
                    prev_run_stmt = select(NightAuditRun).where(
                        NightAuditRun.property_id == property_id,
                        NightAuditRun.business_date == prev_d,
                        NightAuditRun.status == "COMPLETED"
                    )
                    prev_run = (await db.execute(prev_run_stmt)).scalar_one_or_none()
                    if prev_run:
                        return {
                            "success": True,
                            "already_completed": True,
                            "business_date": prev_d,
                            "new_business_date": active_date_str,
                            "status": "COMPLETED",
                            "message": f"Night audit for business date {prev_d} has already been completed.",
                            "room_charges_posted": prev_run.room_charges_posted,
                            "total_charges_minor": prev_run.total_charges_minor,
                            "total_tax_minor": prev_run.total_tax_minor,
                            "flash_report": prev_run.flash_report_snapshot
                        }
                closing_date_str = active_date_str

            # 2. Check if an audit run for closing_date_str is ALREADY COMPLETED (Idempotency)
            existing_run_stmt = select(NightAuditRun).where(
                NightAuditRun.property_id == property_id,
                NightAuditRun.business_date == closing_date_str,
                NightAuditRun.status == "COMPLETED"
            )
            existing_completed = (await db.execute(existing_run_stmt)).scalar_one_or_none()
            if existing_completed:
                return {
                    "success": True,
                    "already_completed": True,
                    "business_date": closing_date_str,
                    "new_business_date": existing_completed.new_business_date or active_date_str,
                    "status": "COMPLETED",
                    "message": f"Night audit for business date {closing_date_str} has already been completed.",
                    "room_charges_posted": existing_completed.room_charges_posted,
                    "total_charges_minor": existing_completed.total_charges_minor,
                    "total_tax_minor": existing_completed.total_tax_minor,
                    "flash_report": existing_completed.flash_report_snapshot
                }

            # 3. Validate active date vs closing date
            if closing_date_str != active_date_str:
                raise ValidationException(
                    f"Cannot execute night audit for business date {closing_date_str}. Active business date is {active_date_str}."
                )

            # 4. Cannot close a future business date ahead of current calendar date
            if closing_date_str > calendar_date_str:
                raise ValidationException(
                    f"Cannot close business date {closing_date_str}. It is ahead of current calendar date {calendar_date_str}."
                )

            # 5. Required pre-audit checks:
            # Check A: Pending arrivals for closing_date_str
            arr_stmt = (
                select(Reservation)
                .where(
                    Reservation.property_id == property_id,
                    Reservation.checkin_date == closing_date_str,
                    Reservation.status.in_(["CONFIRMED", "PENDING"])
                )
                .options(selectinload(Reservation.rooms).selectinload(ReservationRoom.stay))
            )
            arrivals = (await db.execute(arr_stmt)).scalars().all()
            pending_resvs = []
            for r in arrivals:
                checked_in = [rm for rm in (r.rooms or []) if rm.stay and rm.stay.status in ("CHECKED_IN", "CHECKED_OUT")]
                pending_rooms = [rm for rm in (r.rooms or []) if rm not in checked_in]
                if pending_rooms or not r.rooms or r.status == "PENDING":
                    pending_resvs.append(r)

            if pending_resvs:
                if force_auto_no_show:
                    for pr in pending_resvs:
                        pr.status = "NO_SHOW"
                else:
                    raise ValidationException(
                        f"Night audit blocked: {len(pending_resvs)} expected arrival(s) must be checked in or marked NO-SHOW before rollover."
                    )

            # Check B: Open cashier shifts (drawer reconciliation)
            open_shifts_stmt = select(func.count(POSShift.shift_id)).where(
                POSShift.property_id == property_id,
                POSShift.status == "OPEN"
            )
            open_shifts_count = (await db.execute(open_shifts_stmt)).scalar() or 0
            if open_shifts_count > 0:
                raise ValidationException(
                    f"Night audit blocked: {open_shifts_count} open POS cashier shift(s) must be closed before rollover."
                )

            # Check C: Open POS orders (active in kitchen, or delivered dine-in/counter/takeaway pending settlement)
            pos_stmt = select(func.count(POSOrder.order_id)).where(
                POSOrder.property_id == property_id,
                or_(
                    POSOrder.status.in_(["QUEUED", "PREPARING", "READY"]),
                    and_(POSOrder.status == "DELIVERED", POSOrder.order_type != "ROOM_SERVICE")
                )
            )
            open_pos_count = (await db.execute(pos_stmt)).scalar() or 0
            if open_pos_count > 0:
                raise ValidationException(
                    f"Night audit blocked: {open_pos_count} open POS order(s) must be closed or settled before rollover."
                )

            # 6. Post nightly room charge + GST (SAC 996311) for in-house stays that are not prepaid
            plan = await ReportService.room_posting_plan(db, property_id, closing_date_str)
            posted_count = 0
            total_posted_charges_minor = 0
            total_posted_tax_minor = 0

            for item in plan:
                if not item["post"]:
                    continue
                folio = item["folio"]
                rate_minor, tax_minor = item["rate_minor"], item["tax_minor"]
                charge_line = FolioLineItem(
                    folio_id=folio.folio_id,
                    business_date=closing_date_str,
                    transaction_type="ROOM_CHARGE",
                    service_category="ROOM_CHARGE",
                    sac_hsn_code="996311",
                    description=f"Nightly Accommodation - Room {item['room_number']} ({closing_date_str})",
                    debit_minor=rate_minor,
                    credit_minor=0,
                    net_minor=rate_minor,
                    tax_minor=tax_minor,
                    posted_by="NIGHT_AUDIT",
                    reference_number=item["reference"],
                )
                if folio.line_items is not None:
                    folio.line_items.append(charge_line)
                else:
                    db.add(charge_line)
                FolioService.recalculate_folio_balance(folio)
                posted_count += 1
                total_posted_charges_minor += rate_minor
                total_posted_tax_minor += tax_minor

            # 7. Advance business date exactly once
            curr_d = datetime.strptime(closing_date_str, "%Y-%m-%d").date()
            next_d = curr_d + timedelta(days=1)
            next_date_str = next_d.strftime("%Y-%m-%d")

            settings_obj.current_business_date = next_date_str
            settings_obj.night_audit_status = "IDLE"
            if settings_obj.settings_json and isinstance(settings_obj.settings_json, dict):
                if "businessDate" in settings_obj.settings_json and isinstance(settings_obj.settings_json["businessDate"], dict):
                    settings_obj.settings_json["businessDate"]["currentBusinessDate"] = next_date_str

            # Flush pending changes so flash report reflects the new ledger lines and updated date
            await db.flush()

            # 8. Generate and archive Daily Flash Report
            flash_report = await ReportService.get_flash_report(db, property_id, closing_date_str, use_archive=False)
            flash_snapshot = flash_report.model_dump() if hasattr(flash_report, "model_dump") else None

            # Check if an existing failed/in-progress run exists for closing_date_str
            existing_run_any_stmt = select(NightAuditRun).where(
                NightAuditRun.property_id == property_id,
                NightAuditRun.business_date == closing_date_str
            )
            existing_run_obj = (await db.execute(existing_run_any_stmt)).scalar_one_or_none()

            perf_by = getattr(current_user, "username", "NIGHT_AUDITOR") if current_user else "NIGHT_AUDITOR"

            if existing_run_obj:
                existing_run_obj.status = "COMPLETED"
                existing_run_obj.completed_at = datetime.now(timezone.utc)
                existing_run_obj.performed_by = perf_by
                existing_run_obj.new_business_date = next_date_str
                existing_run_obj.steps_completed = ["na-1", "na-2", "na-3", "na-4", "na-5", "na-6"]
                existing_run_obj.room_charges_posted = posted_count
                existing_run_obj.total_charges_minor = total_posted_charges_minor
                existing_run_obj.total_tax_minor = total_posted_tax_minor
                existing_run_obj.flash_report_snapshot = flash_snapshot
                existing_run_obj.error_message = None
            else:
                audit_run = NightAuditRun(
                    property_id=property_id,
                    business_date=closing_date_str,
                    status="COMPLETED",
                    started_at=datetime.now(timezone.utc),
                    completed_at=datetime.now(timezone.utc),
                    performed_by=perf_by,
                    new_business_date=next_date_str,
                    steps_completed=["na-1", "na-2", "na-3", "na-4", "na-5", "na-6"],
                    room_charges_posted=posted_count,
                    total_charges_minor=total_posted_charges_minor,
                    total_tax_minor=total_posted_tax_minor,
                    flash_report_snapshot=flash_snapshot
                )
                db.add(audit_run)

            # Record AuditLog entry for tracking the business date advancement
            actor_id = getattr(current_user, "user_id", None) or "usr-system"
            actor_name = getattr(current_user, "username", None) or perf_by
            db.add(AuditLog(
                property_id=property_id,
                actor_user_id=actor_id,
                actor_username=actor_name,
                action="NIGHT_AUDIT_ROLLOVER",
                entity_table="property_settings",
                entity_id=property_id,
                old_values={"business_date": closing_date_str},
                new_values={
                    "business_date": next_date_str,
                    "room_charges_posted": posted_count,
                    "total_charges_minor": total_posted_charges_minor,
                    "total_tax_minor": total_posted_tax_minor,
                },
                justification_reason=f"Night audit completed for {closing_date_str}"
            ))

            await db.commit()
            clear_reports_cache()

            return {
                "success": True,
                "already_completed": False,
                "business_date": closing_date_str,
                "new_business_date": next_date_str,
                "status": "COMPLETED",
                "message": f"Night audit for {closing_date_str} successfully finalized. Business date advanced to {next_date_str}.",
                "room_charges_posted": posted_count,
                "total_charges_minor": total_posted_charges_minor,
                "total_tax_minor": total_posted_tax_minor,
                "flash_report": flash_snapshot
            }

    @staticmethod
    async def get_flash_report(
        db: AsyncSession,
        property_id: str,
        business_date: Optional[str] = None,
        use_archive: bool = True,
    ) -> ManagerFlashReportResponse:
        """Manager flash report for the active business date, or for a past date.

        Past dates return the snapshot archived by night audit when there is one; otherwise the figures
        are recomputed from the ledger.
        """
        live = business_date is None
        if live:
            cached = _flash_report_cache.get(property_id)
            if cached and (time.time() - cached[0] < FLASH_CACHE_TTL_SECONDS):
                return cached[1]
        elif use_archive:
            run = (await db.execute(select(NightAuditRun).where(
                NightAuditRun.property_id == property_id,
                NightAuditRun.business_date == business_date,
                NightAuditRun.status == "COMPLETED",
            ))).scalar_one_or_none()
            if run and run.flash_report_snapshot:
                return ManagerFlashReportResponse.model_validate(run.flash_report_snapshot)

        prop = (await db.execute(select(Property).where(Property.property_id == property_id))).scalar_one_or_none()
        prop_name = prop.name if prop else ""

        kpis = await ReportService.get_dashboard_kpis(db, property_id, business_date)
        bd = kpis.businessDate
        night = await rm.stays_in_house_on(db, property_id, bd)
        ledger = await rm.ledger_non_room_on(db, property_id, bd)
        pos = await rm.pos_direct_on(db, property_id, bd)
        pays = await rm.payments_on(db, property_id, bd)

        room_rev = kpis.todaysRoomRevenuePaise
        by_type = ledger.by_type_net
        laundry = by_type.get("LAUNDRY", 0)
        spa = by_type.get("SPA", 0) + by_type.get("WELLNESS", 0)
        other = kpis.todaysTotalRevenuePaise - room_rev - kpis.todaysFnbRevenuePaise - laundry - spa

        # GST liability by SAC: room tax accrued per night, plus ledger and counter-POS tax
        sac: Dict[str, List[int]] = {k: [v[0], v[1]] for k, v in ledger.by_sac.items()}
        r = sac.setdefault("996311", [0, 0])
        r[0] += room_rev
        r[1] += sum(s.tax_minor for s in night)
        f = sac.setdefault("996331", [0, 0])
        f[0] += pos.net_minor
        f[1] += pos.tax_minor
        tax_rows = []
        for code in sorted(sac):
            taxable, tax = sac[code]
            if taxable == 0 and tax == 0:
                continue
            cgst = tax // 2
            tax_rows.append(TaxLiabilityItem(
                sacCode=code,
                description=rm.SAC_DESCRIPTIONS.get(code, "Other services"),
                taxablePaise=taxable,
                cgstPaise=cgst,
                sgstPaise=tax - cgst,
                igstPaise=0,
                totalTaxPaise=tax,
                ratePercent=round(tax * 100 / taxable, 1) if taxable else 0.0,
            ))
        taxes_collected = sum(t.totalTaxPaise for t in tax_rows)

        cash = pays.get("CASH", 0) + pos.cash_minor
        upi = pays.get("UPI", 0) + pos.upi_minor
        card = pays.get("CREDIT_CARD", 0) + pays.get("DEBIT_CARD", 0) + pays.get("CARD", 0) + pos.card_minor
        bank = pays.get("BANK_TRANSFER", 0)
        ledger_paise = pays.get("CITY_LEDGER", 0)

        report = ManagerFlashReportResponse(
            propertyId=property_id,
            propertyName=prop_name,
            businessDate=bd,
            generatedAt=datetime.now(timezone.utc).isoformat(),
            roomStats={
                "totalRooms": kpis.totalRooms,
                "oooRooms": kpis.roomStatusSummary.ooo,
                "oosRooms": kpis.roomStatusSummary.oos,
                "sellableRooms": kpis.sellableRooms,
                "roomsSold": kpis.occupiedRooms,
                "occupancyPct": kpis.occupancyPercentage,
                "compRooms": 0,
            },
            revenueSummary={
                "roomRevenuePaise": room_rev,
                "fnbRevenuePaise": kpis.todaysFnbRevenuePaise,
                "laundryRevenuePaise": laundry,
                "spaRevenuePaise": spa,
                "otherRevenuePaise": other,
                "taxesCollectedPaise": taxes_collected,
                "grossRevenuePaise": kpis.todaysTotalRevenuePaise,
            },
            financialMetrics={
                "adrPaise": kpis.adrPaise,
                "revParPaise": kpis.revParPaise,
                "averageCheckPaise": pos.total_minor // pos.orders if pos.orders else 0,
            },
            settlements={
                "cashPaise": cash,
                "upiPaise": upi,
                "cardPaise": card,
                "bankTransferPaise": bank,
                "cityLedgerPaise": ledger_paise,
                "totalCollectedPaise": cash + upi + card + bank + ledger_paise,
            },
            taxLiabilityBreakdown=tax_rows,
        )
        if live:
            _flash_report_cache[property_id] = (time.time(), report)
        return report

    @staticmethod
    async def get_night_audit_history(db: AsyncSession, property_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        runs = (await db.execute(
            select(NightAuditRun)
            .where(NightAuditRun.property_id == property_id)
            .order_by(NightAuditRun.business_date.desc())
            .limit(max(1, min(limit, 120)))
        )).scalars().all()
        out = []
        for r in runs:
            snap = r.flash_report_snapshot or {}
            rooms = (snap.get("roomStats") or {})
            rev = (snap.get("revenueSummary") or {})
            out.append({
                "business_date": r.business_date,
                "new_business_date": r.new_business_date,
                "status": r.status,
                "performed_by": r.performed_by,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "room_charges_posted": r.room_charges_posted,
                "total_charges_minor": r.total_charges_minor,
                "total_tax_minor": r.total_tax_minor,
                "rooms_sold": rooms.get("roomsSold"),
                "occupancy_pct": rooms.get("occupancyPct"),
                "gross_revenue_minor": rev.get("grossRevenuePaise"),
                "has_report": bool(r.flash_report_snapshot),
                "error_message": r.error_message,
            })
        return out

    @staticmethod
    async def get_fnb_analytics(db: AsyncSession, property_id: str) -> FnbAnalyticsResponse:
        """Aggregate real F&B data from pos_orders and folio_line_items with TTL caching."""
        now_ts = time.time()
        cached = _fnb_analytics_cache.get(property_id)
        if cached and (now_ts - cached[0] < FNB_CACHE_TTL_SECONDS):
            return cached[1]

        now = datetime.now(KOLKATA_TZ)
        today_str = now.strftime("%Y-%m-%d")

        # ── Fetch all orders for this property ───────────────────────────────
        orders_stmt = select(POSOrder).where(POSOrder.property_id == property_id)
        all_orders_raw: list[POSOrder] = (await db.execute(orders_stmt)).scalars().all()
        cancelled_today = sum(
            1 for o in all_orders_raw
            if o.status == "CANCELLED" and o.created_at.astimezone(KOLKATA_TZ).date() == now.date()
        )
        # Cancelled orders never count as revenue or sales
        all_orders = [o for o in all_orders_raw if o.status != "CANCELLED"]

        # Today's orders
        today_date = now.date()
        today_orders = [o for o in all_orders if o.created_at.astimezone(KOLKATA_TZ).date() == today_date]

        # Yesterday's orders
        yesterday_date = today_date - timedelta(days=1)
        yesterday_orders = [o for o in all_orders if o.created_at.astimezone(KOLKATA_TZ).date() == yesterday_date]

        # ── Summary KPIs ─────────────────────────────────────────────────────
        rev_today = sum(o.total_minor for o in today_orders)
        rev_yesterday = sum(o.total_minor for o in yesterday_orders)
        orders_today = len(today_orders)
        orders_yesterday = len(yesterday_orders)

        rev_change = (
            round(((rev_today - rev_yesterday) / rev_yesterday) * 100, 1)
            if rev_yesterday > 0 else 0.0
        )
        orders_change = (
            round(((orders_today - orders_yesterday) / orders_yesterday) * 100, 1)
            if orders_yesterday > 0 else 0.0
        )
        avg_order = int(rev_today / orders_today) if orders_today > 0 else 0
        rs_rev = sum(o.total_minor for o in today_orders if o.order_type == "ROOM_SERVICE")

        # F&B contribution — use FolioLineItem FNB_CHARGE / total room revenue ratio
        fnb_lines_stmt = select(FolioLineItem).join(MasterFolio).where(
            MasterFolio.property_id == property_id,
            FolioLineItem.business_date == today_str,
            FolioLineItem.transaction_type == "FNB_CHARGE",
        )
        fnb_lines = (await db.execute(fnb_lines_stmt)).scalars().all()
        room_lines_stmt = select(FolioLineItem).join(MasterFolio).where(
            MasterFolio.property_id == property_id,
            FolioLineItem.business_date == today_str,
            FolioLineItem.transaction_type == "ROOM_CHARGE",
        )
        room_lines = (await db.execute(room_lines_stmt)).scalars().all()
        total_folio_fnb = sum(l.debit_minor for l in fnb_lines)
        total_folio_room = sum(l.debit_minor for l in room_lines)
        total_hotel_rev = total_folio_fnb + total_folio_room
        fnb_contrib_pct = (
            round((total_folio_fnb / total_hotel_rev) * 100, 1) if total_hotel_rev > 0 else 0.0
        )

        # ── Outlet Performance (by order_type) ───────────────────────────────
        type_map: dict[str, list[POSOrder]] = defaultdict(list)
        for o in today_orders:
            type_map[o.order_type].append(o)

        outlet_definitions = [
            ("out-dine", "Dine-In Restaurant", "DINE_IN"),
            ("out-rs",   "In-Room Dining (Room Service)", "ROOM_SERVICE"),
            ("out-ta",   "Takeaway & Delivery", "TAKEAWAY"),
        ]
        outlets_out: list[FnbOutletPerformance] = []
        for oid, oname, otype in outlet_definitions:
            grp = type_map.get(otype, [])
            rev = sum(o.total_minor for o in grp)
            cnt = len(grp)
            # Derive top category from items JSON
            cat_counts: dict[str, int] = defaultdict(int)
            for o in grp:
                for it in (o.items or []):
                    if isinstance(it, dict):
                        cat_counts[it.get("station", "MAIN_KITCHEN")] += it.get("quantity", 1)
            top_cat = max(cat_counts, key=cat_counts.get) if cat_counts else "N/A"
            outlets_out.append(FnbOutletPerformance(
                id=oid,
                name=oname,
                type=otype,
                revenueMinor=rev,
                ordersCount=cnt,
                averageOrderValueMinor=int(rev / cnt) if cnt > 0 else 0,
                topCategory=top_cat,
            ))

        # ── Revenue Trends ────────────────────────────────────────────────────
        # Today: hourly buckets
        hourly: dict[str, tuple[int, int]] = {}
        for h in [7, 10, 13, 16, 19, 22]:
            hourly[f"{h:02d}:00"] = (0, 0)
        for o in today_orders:
            h = (o.created_at.astimezone(KOLKATA_TZ).hour // 3) * 3  # bucket to 3-hour slots
            key = f"{h:02d}:00"
            if key in hourly:
                r, c = hourly[key]
                hourly[key] = (r + o.total_minor, c + 1)
        today_trend = [
            FnbRevenueTrendPoint(periodLabel=k, revenueMinor=v[0], ordersCount=v[1])
            for k, v in sorted(hourly.items())
        ]

        # 7-day trend: day-by-day
        seven_days_trend: list[FnbRevenueTrendPoint] = []
        for i in range(6, -1, -1):
            day_d = (now - timedelta(days=i)).date()
            day_label = (now - timedelta(days=i)).strftime("%d %b")
            day_orders = [o for o in all_orders if o.created_at.astimezone(KOLKATA_TZ).date() == day_d]
            seven_days_trend.append(FnbRevenueTrendPoint(
                periodLabel=day_label,
                revenueMinor=sum(o.total_minor for o in day_orders),
                ordersCount=len(day_orders),
            ))

        # 30-day trend: weekly buckets
        thirty_days_trend: list[FnbRevenueTrendPoint] = []
        for week in range(4):
            start = now - timedelta(days=(week + 1) * 7)
            end = now - timedelta(days=week * 7)
            week_orders = [
                o for o in all_orders
                if start <= o.created_at.replace(tzinfo=timezone.utc) < end
            ]
            week_num = 4 - week
            thirty_days_trend.insert(0, FnbRevenueTrendPoint(
                periodLabel=f"Week {week_num}",
                revenueMinor=sum(o.total_minor for o in week_orders),
                ordersCount=len(week_orders),
            ))

        # ── Revenue Breakdown by channel ──────────────────────────────────────
        channel_map = {
            "Dine-In": "DINE_IN",
            "Room Service": "ROOM_SERVICE",
            "Takeaway": "TAKEAWAY",
        }
        total_rev = sum(o.total_minor for o in today_orders) or 1
        breakdown_out: list[FnbRevenueBreakdownItem] = []
        for channel, otype in channel_map.items():
            grp = [o for o in today_orders if o.order_type == otype]
            rev = sum(o.total_minor for o in grp)
            breakdown_out.append(FnbRevenueBreakdownItem(
                channel=channel,
                revenueMinor=rev,
                orderCount=len(grp),
                percentageContribution=round((rev / total_rev) * 100, 1),
            ))
        # "Other F&B" catches anything not in the 3 types above
        other_rev = sum(
            o.total_minor for o in today_orders
            if o.order_type not in ("DINE_IN", "ROOM_SERVICE", "TAKEAWAY")
        )
        breakdown_out.append(FnbRevenueBreakdownItem(
            channel="Other F&B",
            revenueMinor=other_rev,
            orderCount=sum(1 for o in today_orders if o.order_type not in ("DINE_IN", "ROOM_SERVICE", "TAKEAWAY")),
            percentageContribution=round((other_rev / total_rev) * 100, 1),
        ))

        # ── Top Selling Items (from JSON items column across all orders) ──────
        item_agg: dict[str, dict] = defaultdict(lambda: {"name": "", "category": "", "count": 0, "rev": 0})
        for o in today_orders:
            for it in (o.items or []):
                if not isinstance(it, dict):
                    continue
                mid = it.get("menuItemId") or it.get("name", "unknown")
                item_agg[mid]["name"] = it.get("name", mid)
                item_agg[mid]["category"] = it.get("station", "MAIN_KITCHEN")
                item_agg[mid]["count"] += it.get("quantity", 1)
                item_agg[mid]["rev"] += it.get("pricePaise", 0) * it.get("quantity", 1)

        sorted_items = sorted(item_agg.values(), key=lambda x: x["count"], reverse=True)[:5]
        top_items_out = [
            FnbTopSellingItem(
                rank=i + 1,
                itemName=it["name"],
                category=it["category"],
                ordersCount=it["count"],
                revenueMinor=it["rev"],
            )
            for i, it in enumerate(sorted_items)
        ]

        # ── Operational Metrics ───────────────────────────────────────────────
        total_kots = len(today_orders)
        avg_prep = (
            sum(o.elapsed_minutes for o in today_orders) / total_kots if total_kots > 0 else 0.0
        )
        completed = sum(1 for o in today_orders if o.status in ("DELIVERED", "BILLED"))
        cancelled = cancelled_today
        pending = sum(1 for o in today_orders if o.status in ("QUEUED", "PREPARING", "READY"))
        rs_count = sum(1 for o in today_orders if o.order_type == "ROOM_SERVICE")

        # ── Folio Reconciliation ──────────────────────────────────────────────
        fnb_gross = sum(o.total_minor for o in today_orders)
        posted_to_folio = total_folio_fnb
        pending_recon = max(0, fnb_gross - posted_to_folio)
        recon_status = "In Balance" if pending_recon == 0 else "Reconciliation Required"

        # Last reconciliation timestamp = latest FNB folio line item posted_at
        last_recon_at = "No activity today"
        if fnb_lines:
            latest = max(fnb_lines, key=lambda l: l.posted_at or datetime.min.replace(tzinfo=timezone.utc))
            if latest.posted_at:
                last_recon_at = latest.posted_at.strftime("%d-%b-%Y %H:%M")

        return FnbAnalyticsResponse(
            integration=FnbIntegrationStatus(
                posConnected=True,
                kdsConnected=True,
                lastSyncFormatted="Live",
                dataStatus="Synced",
                posProviderName="HMS Internal POS",
                kdsProviderName="HMS Kitchen Display System",
            ),
            summary=FnbSummaryKPIs(
                revenueTodayMinor=rev_today,
                revenueYesterdayMinor=rev_yesterday,
                revenueChangePct=rev_change,
                ordersToday=orders_today,
                ordersYesterday=orders_yesterday,
                ordersChangePct=orders_change,
                averageOrderValueMinor=avg_order,
                roomServiceRevenueMinor=rs_rev,
                fnbContributionToHotelRevenuePct=fnb_contrib_pct,
            ),
            outlets=outlets_out,
            trends=FnbTrends(
                today=today_trend,
                sevenDays=seven_days_trend,
                thirtyDays=thirty_days_trend,
            ),
            breakdown=breakdown_out,
            topSellingItems=top_items_out,
            operationalMetrics=FnbOperationalMetrics(
                totalKots=total_kots,
                averagePreparationTimeMinutes=round(avg_prep, 1),
                completedOrders=completed,
                cancelledOrders=cancelled,
                voidOrders=0,  # no void status in schema currently
                pendingOrders=pending,
                roomServiceOrders=rs_count,
            ),
            folioReconciliation=FnbFolioReconciliation(
                fnbGrossRevenueMinor=fnb_gross,
                postedToFolioMinor=posted_to_folio,
                directCashierSettledMinor=0,
                pendingReconciliationMinor=pending_recon,
                reconciliationStatus=recon_status,
                lastReconciliationAt=last_recon_at,
            ),
        )
