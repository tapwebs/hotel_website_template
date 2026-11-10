"""Indian GST rates used across the HMS (single source of truth).

Rates in force since 22 Sep 2025 (56th GST Council):
  * Hotel accommodation: 5% (no ITC) when the declared tariff is up to Rs 7,500 per room per day,
    18% above that.
  * Restaurant service: 5% (no ITC) at standalone restaurants and hotels whose tariff is up to Rs 7,500.
  * Other hotel services (laundry, minibar, transport, etc.): 18%. Spa / wellness: 18%.
"""

ROOM_TARIFF_THRESHOLD_MINOR = 750_000  # Rs 7,500 in paise

RESTAURANT_GST_PERCENT = 5
SERVICE_GST_PERCENT = 18


def room_gst_percent(rate_per_night_minor: int) -> int:
    """GST % for one room-night at the given declared tariff (in paise)."""
    return 5 if rate_per_night_minor <= ROOM_TARIFF_THRESHOLD_MINOR else 18


def percent_of(amount_minor: int, percent: int) -> int:
    """Round-half-up whole-number percentage of an integer paise amount (no float drift)."""
    return (amount_minor * percent + 50) // 100


def room_tax_minor(rate_per_night_minor: int, amount_minor: int | None = None) -> int:
    """GST on `amount_minor` (defaults to one night) charged at a room tariff of `rate_per_night_minor`."""
    base = rate_per_night_minor if amount_minor is None else amount_minor
    return percent_of(base, room_gst_percent(rate_per_night_minor))
