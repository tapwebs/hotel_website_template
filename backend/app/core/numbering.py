"""Collision-resistant identifiers for folios, bookings and invoices.

The previous 4 and 5 digit random numbers hit the UNIQUE constraints after a few hundred records
(birthday problem), which would fail check-ins and bookings in production.
"""
import secrets
from datetime import datetime

from backend.app.core.timezone import get_kolkata_now

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I


def _token(n: int) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def new_folio_number(now: datetime | None = None) -> str:
    return f"FOL-{(now or get_kolkata_now()).year}-{_token(7)}"


def new_booking_ref(now: datetime | None = None) -> str:
    return f"DH-{(now or get_kolkata_now()).year}-{_token(6)}"


def financial_year(d: datetime | None = None) -> str:
    """Indian financial year (April to March), e.g. 2026-27 for any date from 1 Apr 2026 to 31 Mar 2027."""
    d = d or get_kolkata_now()
    start = d.year if d.month >= 4 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"
