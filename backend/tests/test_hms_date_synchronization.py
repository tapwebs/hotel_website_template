import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

from backend.app.core.config import settings
from backend.app.core.timezone import (
    KOLKATA_TZ,
    KOLKATA_TIMEZONE_NAME,
    get_kolkata_now,
    get_kolkata_calendar_date,
    parse_kolkata_date,
    get_next_business_date,
)
from backend.app.services.report_service import clear_reports_cache


# ─── 1. Timezone Handling Tests ─────────────────────────────────────────────

def test_kolkata_timezone_attributes():
    """Verify application timezone is Asia/Kolkata with correct +05:30 offset."""
    assert KOLKATA_TIMEZONE_NAME == "Asia/Kolkata"
    now_kolkata = get_kolkata_now()
    assert now_kolkata.tzinfo is not None
    offset = now_kolkata.utcoffset()
    assert offset == timedelta(hours=5, minutes=30)


def test_kolkata_midnight_boundary_conversion():
    """
    Verify timezone boundary math:
    When UTC is 2026-10-19 18:30:00 (6:30 PM UTC), in Asia/Kolkata (+05:30)
    it is already midnight (2026-10-20 00:00:00).
    """
    utc_dt = datetime(2026, 10, 19, 18, 30, 0, tzinfo=timezone.utc)
    kolkata_dt = utc_dt.astimezone(KOLKATA_TZ)
    assert kolkata_dt.year == 2026
    assert kolkata_dt.month == 10
    assert kolkata_dt.day == 20
    assert kolkata_dt.hour == 0
    assert kolkata_dt.minute == 0


def test_date_helpers():
    """Verify parse_kolkata_date and get_next_business_date utilities."""
    dt = parse_kolkata_date("2026-10-20")
    assert dt.year == 2026
    assert dt.month == 10
    assert dt.day == 20
    assert dt.tzinfo == KOLKATA_TZ

    next_date = get_next_business_date("2026-10-20")
    assert next_date == "2026-10-21"

    # Month boundary rollover
    month_end = get_next_business_date("2026-10-31")
    assert month_end == "2026-11-01"


# ─── 2. Business Date vs Calendar Date Endpoint Tests ─────────────────────────

@pytest.mark.asyncio
async def test_front_desk_business_date_endpoint_integrity(client, auth_headers):
    """
    Verify /front-desk/business-date returns:
    - business_date (persisted from PostgreSQL)
    - calendar_date (authoritative Asia/Kolkata real calendar date)
    - timezone: Asia/Kolkata
    - night_audit_status
    """
    # Initialize business date in DB to 2026-10-19
    await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )

    res = await client.get(
        f"{settings.API_V1_PREFIX}/front-desk/business-date",
        headers=auth_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["business_date"] == "2026-10-19"
    assert data["timezone"] == "Asia/Kolkata"
    assert data["calendar_date"] == get_kolkata_calendar_date()
    assert data["night_audit_status"] == "IDLE"


@pytest.mark.asyncio
async def test_calendar_date_does_not_advance_persisted_business_date(client, auth_headers):
    """
    Verify business rule: Even if calendar date changes, the persisted hotel business date
    MUST NOT advance without an explicit Night Audit rollover execution.
    """
    await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )

    # Simulate calendar date being simulated in the future
    future_date = "2026-10-25"
    with patch("backend.app.services.front_desk_service.get_kolkata_calendar_date", return_value=future_date):
        res = await client.get(
            f"{settings.API_V1_PREFIX}/front-desk/business-date",
            headers=auth_headers
        )
        assert res.status_code == 200
        data = res.json()
        # Persisted business date must remain 2026-10-19!
        assert data["business_date"] == "2026-10-19"
        # Calendar date reflects the simulated date
        assert data["calendar_date"] == future_date


# ─── 3. Night Audit Rollover & Stale-Cache Prevention ────────────────────────

@pytest.mark.asyncio
async def test_night_audit_rollover_clears_cache_and_advances_date(client, auth_headers):
    """
    Verify night audit rollover advances the business date and invalidates all
    reports/KPI caches so stale data is never served.
    """
    # 1. Start with 2026-10-19
    await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )

    # 2. Query KPIs (populating cache)
    kpi_before = await client.get(
        f"{settings.API_V1_PREFIX}/reports/dashboard-kpis",
        headers=auth_headers
    )
    assert kpi_before.status_code == 200
    assert kpi_before.json()["businessDate"] == "2026-10-19"

    # 3. Execute Night Audit Rollover
    rollover_res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers
    )
    assert rollover_res.status_code == 200
    assert rollover_res.json()["new_business_date"] == "2026-10-20"

    # 4. Immediate KPI query must return 2026-10-20 (not stale 2026-10-19)
    kpi_after = await client.get(
        f"{settings.API_V1_PREFIX}/reports/dashboard-kpis",
        headers=auth_headers
    )
    assert kpi_after.status_code == 200
    assert kpi_after.json()["businessDate"] == "2026-10-20"

    # 5. Immediate /front-desk/business-date must also reflect 2026-10-20
    fd_after = await client.get(
        f"{settings.API_V1_PREFIX}/front-desk/business-date",
        headers=auth_headers
    )
    assert fd_after.status_code == 200
    assert fd_after.json()["business_date"] == "2026-10-20"

    # 6. Reset back to 2026-10-19
    await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )


# ─── 4. Settings Stale Payload Protection ────────────────────────────────────

@pytest.mark.asyncio
async def test_settings_payload_stale_date_protection(client, auth_headers):
    """
    Verify that updating generic settings (e.g. property identity) with an outdated
    nested business date in settings_json does NOT overwrite the authoritative business date.
    """
    # 1. Establish business date as 2026-10-19
    await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )

    # 2. Submit PUT with stale nested date "2026-09-15"
    put_res = await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={
            "settings": {
                "propertyIdentity": {"propertyName": "Dream Heavens Palace"},
                "businessDate": {"currentBusinessDate": "2026-09-15"}
            }
        }
    )
    assert put_res.status_code == 200
    data = put_res.json()
    assert data["current_business_date"] == "2026-10-19"
    assert data["settings"]["businessDate"]["currentBusinessDate"] == "2026-10-19"
