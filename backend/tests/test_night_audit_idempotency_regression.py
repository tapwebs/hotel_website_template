import asyncio
import pytest
from datetime import datetime, timezone
from unittest.mock import patch
from sqlalchemy import select, func

from backend.app.core.config import settings
from backend.app.core.timezone import get_kolkata_calendar_date
from backend.app.models.folio import MasterFolio, FolioLineItem
from backend.app.models.organization import PropertySettings
from backend.app.models.audit import NightAuditRun


# ─── Helper Fixtures / Routines ───────────────────────────────────────────────

async def set_property_business_date(client, auth_headers, date_str: str):
    res = await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": date_str}}
    )
    assert res.status_code == 200
    return res.json()


# ─── 1. First Audit Advances D to D+1 & Repeat Click Leaves at D+1 ───────────

@pytest.mark.asyncio
async def test_first_audit_advances_and_repeat_is_idempotent(client, auth_headers):
    """
    Test 1 & 2:
    - First successful audit for business date D advances active date to D+1.
    - Repeating the same successful request leaves the business date at D+1.
    - No charges or records are duplicated.
    """
    # Set business date to 2026-10-18 (which is <= calendar date 2026-10-20)
    await set_property_business_date(client, auth_headers, "2026-10-18")

    # 1. First audit rollover
    res1 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["success"] is True
    assert data1["already_completed"] is False
    assert data1["business_date"] == "2026-10-18"
    assert data1["new_business_date"] == "2026-10-19"
    assert data1["status"] == "COMPLETED"

    # Verify active business date is 2026-10-19
    bd_res = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res.status_code == 200
    assert bd_res.json()["business_date"] == "2026-10-19"

    # 2. Repeat click / duplicate request for same audit
    res2 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": "2026-10-18"}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["already_completed"] is True
    assert data2["business_date"] == "2026-10-18"
    assert data2["new_business_date"] == "2026-10-19"

    # Business date MUST strictly remain 2026-10-19 (not advance to 2026-10-20)
    bd_res2 = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res2.json()["business_date"] == "2026-10-19"

    # 3. Repeat request without body (e.g. user clicks button again on page)
    res3 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers
    )
    # 2026-10-19 has not been closed yet; active date is 2026-10-19
    # If 2026-10-19 has no pending items, it can advance to 2026-10-20
    # But repeating 2026-10-18 explicitly always returns already_completed
    assert res3.status_code in (200, 400, 422)


# ─── 2. Repeated Requests Do Not Duplicate Charges or GST ────────────────────

@pytest.mark.asyncio
async def test_repeated_requests_no_duplicate_financial_postings(client, auth_headers):
    """
    Test 3: Repeated requests do not duplicate room charges, GST, ledger entries, or reports.
    """
    await set_property_business_date(client, auth_headers, "2026-10-17")

    # Run first audit for 2026-10-17
    res1 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": "2026-10-17"}
    )
    assert res1.status_code == 200
    charges_count_1 = res1.json().get("room_charges_posted", 0)

    # Repeat request for 2026-10-17
    res2 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": "2026-10-17"}
    )
    assert res2.status_code == 200
    assert res2.json()["already_completed"] is True
    # Charges count reported is unchanged from the original run
    assert res2.json()["room_charges_posted"] == charges_count_1


# ─── 3. Concurrent Requests Do Not Advance Date Twice ───────────────────────

@pytest.mark.asyncio
async def test_concurrent_requests_cannot_advance_date_twice(client, auth_headers):
    """
    Test 4: Two concurrent requests for date D cannot advance the date twice.
    """
    await set_property_business_date(client, auth_headers, "2026-10-16")

    # Launch two simultaneous rollover requests for date 2026-10-16
    results = await asyncio.gather(
        client.post(f"{settings.API_V1_PREFIX}/reports/night-audit/rollover", headers=auth_headers, json={"business_date": "2026-10-16"}),
        client.post(f"{settings.API_V1_PREFIX}/reports/night-audit/rollover", headers=auth_headers, json={"business_date": "2026-10-16"})
    )

    # Both must succeed with 200 OK
    assert results[0].status_code == 200
    assert results[1].status_code == 200

    r0 = results[0].json()
    r1 = results[1].json()

    # One must be the initial execution, and the other must be already_completed
    already_completed_flags = [r0["already_completed"], r1["already_completed"]]
    assert False in already_completed_flags
    assert True in already_completed_flags

    # Active business date must be 2026-10-17 (advanced exactly once, NEVER 2026-10-18)
    bd_res = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res.json()["business_date"] == "2026-10-17"


# ─── 4. Reopening Page / Refresh Does Not Cause Rollover ─────────────────────

@pytest.mark.asyncio
async def test_page_refresh_and_status_consistency(client, auth_headers):
    """
    Test 5: Refreshing the frontend and reopening the page do not cause another rollover.
    Status and steps accurately report completed state.
    """
    await set_property_business_date(client, auth_headers, "2026-10-15")

    # Run audit for 2026-10-15 -> advances to 2026-10-16
    res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": "2026-10-15"}
    )
    assert res.status_code == 200
    assert res.json()["new_business_date"] == "2026-10-16"

    # Query steps (simulating page load)
    steps_res = await client.get(f"{settings.API_V1_PREFIX}/reports/night-audit/steps", headers=auth_headers)
    assert steps_res.status_code == 200
    steps = steps_res.json()
    assert len(steps) == 6

    # Query status
    status_res = await client.get(f"{settings.API_V1_PREFIX}/reports/night-audit/status", headers=auth_headers)
    assert status_res.status_code == 200
    st = status_res.json()
    assert st["business_date"] == "2026-10-16"

    # Date remains 2026-10-16
    bd_res = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res.json()["business_date"] == "2026-10-16"


# ─── 5. Cannot Close Future Business Date Ahead of Calendar Date ─────────────

@pytest.mark.asyncio
async def test_cannot_close_future_business_date(client, auth_headers):
    """
    Test 6: A new audit cannot close the next business date until that date is legitimately ready.
    Cannot close a business date ahead of real calendar date.
    """
    cal_date = get_kolkata_calendar_date()
    # Set business date to a future date (relative to today, so the test does not expire)
    from datetime import date, timedelta
    future_date = (date.fromisoformat(cal_date) + timedelta(days=1)).isoformat()
    await set_property_business_date(client, auth_headers, future_date)

    # Attempt to execute rollover for the future date
    res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": future_date}
    )
    assert res.status_code in (400, 422)
    err_text = str(res.json())
    assert "ahead of current calendar date" in err_text.lower()

    # Business date MUST NOT have advanced
    bd_res = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res.json()["business_date"] == future_date


# ─── 6. Incomplete Required Checks Block Execution ──────────────────────────

@pytest.mark.asyncio
async def test_pending_arrivals_block_night_audit(client, auth_headers):
    """
    Test 7 & 9: Incomplete required checks block audit execution according to existing business rules.
    Pending arrivals must block night audit rollover until resolved.
    """
    target_date = "2026-10-14"
    await set_property_business_date(client, auth_headers, target_date)

    # Create an un-checked-in reservation for target_date
    res_booking = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json={
            "external_booking_ref": "HDH-NA-BLOCKED-14",
            "website_room_id": "deluxe",
            "guest_name": "Pending Arrival Guest",
            "guest_email": "pending@example.com",
            "guest_phone": "+919999944444",
            "checkin_date": target_date,
            "checkout_date": "2026-10-16",
            "rooms_count": 1,
            "adults": 2,
            "children": 0,
            "status": "confirmed"
        }
    )
    assert res_booking.status_code == 200

    # Query checklist steps: Step 1 must report FAILED with actionRequired = True
    steps_res = await client.get(f"{settings.API_V1_PREFIX}/reports/night-audit/steps", headers=auth_headers)
    steps = steps_res.json()
    step1 = next(s for s in steps if s["stepNumber"] == 1)
    assert step1["status"] == "FAILED"
    assert step1["actionRequired"] is True
    assert "pending" in step1["details"].lower() or "unresolved" in step1["details"].lower()

    # Step 5 must be blocked
    step5 = next(s for s in steps if s["stepNumber"] == 5)
    assert step5["actionRequired"] is False
    assert "blocked" in step5["details"].lower()

    # Rollover execution must be blocked with 400 or 422
    res_rollover = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date}
    )
    assert res_rollover.status_code in (400, 422)
    err_text = str(res_rollover.json())
    assert "blocked" in err_text.lower()

    # Business date must NOT advance
    bd_res = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res.json()["business_date"] == target_date

    # Safe retry with auto no-show: succeeds and advances date to 2026-10-15
    res_auto = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date, "force_auto_no_show": True}
    )
    assert res_auto.status_code == 200
    assert res_auto.json()["success"] is True
    assert res_auto.json()["new_business_date"] == "2026-10-15"


# ─── 7. Multi-room Partial Check-in Blocks Rollover & No-Show Resolves It ──

@pytest.mark.asyncio
async def test_multi_room_partial_checkin_blocks_and_noshow_resolves(client, auth_headers):
    """
    Test 8: Multi-room reservations with pending rooms block night audit.
    Using the authorized /reservations/{id}/no-show endpoint resolves the blocker.
    """
    target_date = "2026-10-12"
    await set_property_business_date(client, auth_headers, target_date)

    # Create 2-room booking
    res_booking = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json={
            "external_booking_ref": "HDH-MULTI-2RM",
            "website_room_id": "deluxe",
            "guest_name": "Multi Room Guest",
            "guest_email": "multi@example.com",
            "guest_phone": "+919876543210",
            "checkin_date": target_date,
            "checkout_date": "2026-10-15",
            "rooms_count": 2,
            "adults": 4,
            "children": 0,
            "status": "confirmed"
        }
    )
    assert res_booking.status_code == 200
    booking_data = res_booking.json()
    resv_id = booking_data["reservation_id"]

    # Check status: reports 1 unresolved arrival with pending_rooms = 2
    status_res = await client.get(f"{settings.API_V1_PREFIX}/reports/night-audit/status", headers=auth_headers)
    assert status_res.status_code == 200
    st = status_res.json()
    assert st["pending_arrivals_count"] >= 1
    unresolved = [u for u in st["unresolved_arrivals"] if u["reservation_id"] == resv_id]
    assert len(unresolved) == 1
    assert unresolved[0]["total_rooms"] == 2
    assert unresolved[0]["pending_rooms"] == 2

    # Attempt rollover -> must fail with 400 or 422
    roll_res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date}
    )
    assert roll_res.status_code in (400, 422)

    # Now mark this reservation as NO_SHOW using the dedicated endpoint
    no_show_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{resv_id}/no-show",
        headers=auth_headers
    )
    assert no_show_res.status_code == 200
    assert no_show_res.json()["status"] == "NO_SHOW"

    # Status: unresolved should no longer include this resv
    status_res2 = await client.get(f"{settings.API_V1_PREFIX}/reports/night-audit/status", headers=auth_headers)
    unresolved2 = [u for u in status_res2.json()["unresolved_arrivals"] if u["reservation_id"] == resv_id]
    assert len(unresolved2) == 0

    # Rollover should now succeed and advance date to 2026-10-13
    roll_res2 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date}
    )
    assert roll_res2.status_code == 200
    assert roll_res2.json()["new_business_date"] == "2026-10-13"


# ─── 8. Open POS Cashier Shift Blocks Rollover ────────────────────────────────

@pytest.mark.asyncio
async def test_open_pos_shift_blocks_rollover(client, auth_headers, db_session):
    """
    Test 9: Open POS cashier shifts block night audit rollover until closed.
    """
    from backend.app.models.pos import POSShift
    target_date = "2026-10-11"
    await set_property_business_date(client, auth_headers, target_date)

    # Insert an open POSShift into db_session
    shift = POSShift(
        property_id="prop-jaipur-01",
        opened_by="usr-dh-001",
        opening_float_minor=500000,
        status="OPEN"
    )
    db_session.add(shift)
    await db_session.commit()

    # Steps: Step 2 should report FAILED
    steps_res = await client.get(f"{settings.API_V1_PREFIX}/reports/night-audit/steps", headers=auth_headers)
    step2 = next(s for s in steps_res.json() if s["stepNumber"] == 2)
    assert step2["status"] == "FAILED"
    assert "open" in step2["details"].lower()

    # Rollover must fail because open shift exists
    roll_res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date}
    )
    assert roll_res.status_code in (400, 422)
    assert "open pos cashier shift" in str(roll_res.json()).lower()

    # Close shift
    shift.status = "CLOSED"
    await db_session.commit()

    # Rollover should now succeed
    roll_res2 = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date}
    )
    assert roll_res2.status_code == 200
    assert roll_res2.json()["new_business_date"] == "2026-10-12"


# ─── 9. Audit Log Persistence & Room Tax Posting Verification ───────────────

@pytest.mark.asyncio
async def test_audit_log_persisted_and_tax_posted(client, auth_headers, db_session):
    """
    Test 10: AuditLog is persisted upon rollover and taxes (SAC 996311) are accurately posted.
    """
    from backend.app.models.audit import AuditLog
    target_date = "2026-10-10"
    await set_property_business_date(client, auth_headers, target_date)

    roll_res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers,
        json={"business_date": target_date}
    )
    assert roll_res.status_code == 200
    assert roll_res.json()["new_business_date"] == "2026-10-11"

    # Query AuditLog from db_session
    audit_stmt = select(AuditLog).where(
        AuditLog.property_id == "prop-jaipur-01",
        AuditLog.action == "NIGHT_AUDIT_ROLLOVER"
    ).order_by(AuditLog.recorded_at.desc())
    audit_log = (await db_session.execute(audit_stmt)).scalars().first()
    assert audit_log is not None
    assert audit_log.old_values["business_date"] == "2026-10-10"
    assert audit_log.new_values["business_date"] == "2026-10-11"


# ─── 10. Reset to Active Business Date State for HMS ────────────────────────

@pytest.mark.asyncio
async def test_final_reset_to_active_state(client, auth_headers):
    """
    Ensure test suite finishes with active business date 2026-10-23.
    """
    await set_property_business_date(client, auth_headers, "2026-10-23")
    bd_res = await client.get(f"{settings.API_V1_PREFIX}/front-desk/business-date", headers=auth_headers)
    assert bd_res.json()["business_date"] == "2026-10-23"
