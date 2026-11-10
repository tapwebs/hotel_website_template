from datetime import datetime, timezone, timedelta

# Authoritative Application Timezone: Asia/Kolkata (IST: UTC+05:30)
KOLKATA_TZ = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")
KOLKATA_TIMEZONE_NAME = "Asia/Kolkata"


def get_kolkata_now() -> datetime:
    """Returns the current timezone-aware datetime in Asia/Kolkata."""
    return datetime.now(KOLKATA_TZ)


def get_kolkata_calendar_date() -> str:
    """Returns today's real calendar date in Asia/Kolkata formatted as 'YYYY-MM-DD'."""
    return get_kolkata_now().strftime("%Y-%m-%d")


def parse_kolkata_date(date_str: str) -> datetime:
    """Parses 'YYYY-MM-DD' into a timezone-aware datetime at midnight in Asia/Kolkata."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.replace(tzinfo=KOLKATA_TZ)


def get_next_business_date(date_str: str) -> str:
    """Returns the consecutive calendar date after date_str ('YYYY-MM-DD')."""
    dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    return (dt + timedelta(days=1)).strftime("%Y-%m-%d")

