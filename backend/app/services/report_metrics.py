"""Real, database-derived numbers behind the dashboard, night audit and flash report.

Nothing here invents data: every figure comes from stays, folio lines, payments or POS orders.

Room revenue is *accrued per night* from stays (rate x nights in house) so it does not depend on how
the charge was posted. Walk-in and booking flows post the whole stay to the folio up front, while
night audit posts nightly for stays that were not prepaid; both reconcile to the same nightly figure.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.tax import room_tax_minor
from backend.app.core.timezone import KOLKATA_TZ
from backend.app.models.folio import FolioLineItem, MasterFolio, Payment
from backend.app.models.pos import POSOrder
from backend.app.models.reservation import Reservation, ReservationRoom, Stay
from backend.app.models.room import Room

# Ledger line types that are not revenue.
NON_REVENUE_TYPES = ("PAYMENT", "REFUND", "TAX", "DEPOSIT")

SAC_DESCRIPTIONS = {
    "996311": "Accommodation services (hotel rooms)",
    "996331": "Restaurant and room-dining services",
    "999711": "Spa and wellness services",
    "999799": "Other services (laundry, minibar, misc.)",
}


def day_bounds_utc(date_str: str) -> Tuple[datetime, datetime]:
    """UTC [start, end) of a Kolkata calendar day."""
    start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=KOLKATA_TZ)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


@dataclass
class NightStay:
    stay_id: str
    reservation_id: str
    folio_id: Optional[str]
    room_number: str
    rate_minor: int
    adults: int
    children: int
    nights: int
    status: str
    checkin_date: str
    checkout_date: str
    checkout_actual: Optional[str] = None

    @property
    def tax_minor(self) -> int:
        return room_tax_minor(self.rate_minor)


async def stays_in_house_on(db: AsyncSession, property_id: str, business_date: str) -> List[NightStay]:
    """Stays that occupy a room on the night of `business_date` (checked in, or already checked out later)."""
    stmt = (
        select(Stay, ReservationRoom, Reservation, Room)
        .join(ReservationRoom, Stay.reservation_room_id == ReservationRoom.reservation_room_id)
        .join(Reservation, ReservationRoom.reservation_id == Reservation.reservation_id)
        .outerjoin(Room, Room.room_id == Stay.room_id)
        .where(
            Reservation.property_id == property_id,
            Stay.status.in_(["CHECKED_IN", "CHECKED_OUT"]),
            ReservationRoom.checkin_date <= business_date,
        )
    )
    out: List[NightStay] = []
    for stay, rr, res, room in (await db.execute(stmt)).all():
        first_day = datetime.strptime(rr.checkin_date, "%Y-%m-%d").date()
        end = rr.checkout_date
        actual = None
        if stay.status == "CHECKED_IN":
            end = "9999-12-31"  # still in house (including overstays)
        elif stay.checkout_timestamp:
            actual = stay.checkout_timestamp.astimezone(KOLKATA_TZ).strftime("%Y-%m-%d")
            end = min(end, actual)
        min_end = (first_day + timedelta(days=1)).strftime("%Y-%m-%d")  # a stay is at least one night
        end = max(end, min_end)
        if not (rr.checkin_date <= business_date < end):
            continue
        out.append(NightStay(
            stay_id=stay.stay_id,
            reservation_id=res.reservation_id,
            folio_id=res.master_folio_id,
            room_number=room.room_number if room else "N/A",
            rate_minor=int(rr.rate_per_night_minor or 0),
            adults=int(rr.adults or 0),
            children=int(rr.children or 0),
            nights=int(rr.nights or 1),
            status=stay.status,
            checkin_date=rr.checkin_date,
            checkout_date=rr.checkout_date,
            checkout_actual=actual,
        ))
    return out


@dataclass
class PosDirect:
    """POS orders paid at the counter/table (not charged to a room folio) on a day."""
    orders: int = 0
    net_minor: int = 0       # taxable value after discount
    tax_minor: int = 0
    total_minor: int = 0
    cash_minor: int = 0
    upi_minor: int = 0       # UPI and any other digital split
    card_minor: int = 0


async def pos_direct_on(db: AsyncSession, property_id: str, business_date: str) -> PosDirect:
    start, end = day_bounds_utc(business_date)
    stmt = select(POSOrder).where(
        POSOrder.property_id == property_id,
        POSOrder.paid_at.is_not(None),
        POSOrder.paid_at >= start,
        POSOrder.paid_at < end,
        POSOrder.status != "CANCELLED",
        POSOrder.order_type != "ROOM_SERVICE",
        func.coalesce(POSOrder.payment_method, "") != "ROOM",
    )
    res = PosDirect()
    for o in (await db.execute(stmt)).scalars().all():
        res.orders += 1
        res.total_minor += o.total_minor
        res.tax_minor += o.tax_minor
        res.net_minor += o.total_minor - o.tax_minor
        m = (o.payment_method or "").upper()
        if m == "CASH":
            res.cash_minor += o.total_minor
        elif m == "CARD":
            res.card_minor += o.total_minor
        elif m == "SPLIT":
            parts = o.split_amounts or {}
            res.cash_minor += int(parts.get("cash", 0))
            res.upi_minor += int(parts.get("digital", 0))
        else:  # UPI and unknown digital methods
            res.upi_minor += o.total_minor
    return res


@dataclass
class LedgerDay:
    """Non-room revenue posted to folios on a business date, grouped by transaction type and SAC."""
    by_type_net: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    by_sac: Dict[str, Tuple[int, int]] = field(default_factory=dict)  # sac -> (taxable, tax)


async def ledger_non_room_on(db: AsyncSession, property_id: str, business_date: str) -> LedgerDay:
    stmt = (
        select(
            FolioLineItem.transaction_type,
            FolioLineItem.sac_hsn_code,
            func.coalesce(func.sum(FolioLineItem.debit_minor - FolioLineItem.credit_minor), 0),
            func.coalesce(func.sum(FolioLineItem.tax_minor), 0),
        )
        .join(MasterFolio, FolioLineItem.folio_id == MasterFolio.folio_id)
        .where(
            MasterFolio.property_id == property_id,
            FolioLineItem.business_date == business_date,
            FolioLineItem.transaction_type.notin_(NON_REVENUE_TYPES + ("ROOM_CHARGE",)),
        )
        .group_by(FolioLineItem.transaction_type, FolioLineItem.sac_hsn_code)
    )
    day = LedgerDay()
    for ttype, sac, net, tax in (await db.execute(stmt)).all():
        day.by_type_net[ttype] += int(net)
        t, x = day.by_sac.get(sac, (0, 0))
        day.by_sac[sac] = (t + int(net), x + int(tax))
    return day


async def payments_on(db: AsyncSession, property_id: str, business_date: str) -> Dict[str, int]:
    """Successful folio payments received on the day, by method."""
    start, end = day_bounds_utc(business_date)
    stmt = (
        select(Payment.payment_method, func.coalesce(func.sum(Payment.amount_minor), 0))
        .where(
            Payment.property_id == property_id,
            Payment.status == "SUCCESS",
            Payment.created_at >= start,
            Payment.created_at < end,
        )
        .group_by(Payment.payment_method)
    )
    return {m: int(v) for m, v in (await db.execute(stmt)).all()}
