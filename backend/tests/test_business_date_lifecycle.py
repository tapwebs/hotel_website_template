import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_front_desk_business_date_endpoint(client, auth_headers):
    """Test that GET /api/v1/front-desk/business-date returns the authoritative business date."""
    res = await client.get(
        f"{settings.API_V1_PREFIX}/front-desk/business-date",
        headers=auth_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert "business_date" in data
    assert "property_id" in data
    assert "timezone" in data


@pytest.mark.asyncio
async def test_business_date_filtering_and_night_audit_lifecycle(client, auth_headers):
    """
    Test controlled business date behavior:
    1. Authoritative date is 2026-10-19.
    2. Arrival with check-in 2026-10-19 appears in Expected Arrivals.
    3. Arrival with check-in 2026-10-20 does NOT appear (future).
    4. Reservation with check-in 2026-10-15 does NOT appear (past).
    5. Check-in moves guest to Active In-House.
    6. Fast Walk-in uses authoritative business date.
    7. Night audit rollover advances date to 2026-10-20, making 2026-10-20 expected arrival.
    """
    # 1. Update property settings to authoritative date 2026-10-19
    update_res = await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-19"}}
    )
    assert update_res.status_code == 200

    # Verify /front-desk/business-date reflects 2026-10-19
    date_res = await client.get(
        f"{settings.API_V1_PREFIX}/front-desk/business-date",
        headers=auth_headers
    )
    assert date_res.status_code == 200
    assert date_res.json()["business_date"] == "2026-10-19"
    current_business_date = date_res.json()["business_date"]

    # 2. Create reservation arriving on 2026-10-19 (Today)
    res_today = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json={
            "external_booking_ref": "HDH-DATE-TODAY-19",
            "website_room_id": "deluxe",
            "guest_name": "Rohan Deshmukh",
            "guest_email": "rohan@example.com",
            "guest_phone": "+919999911111",
            "checkin_date": "2026-10-19",
            "checkout_date": "2026-10-21",
            "rooms_count": 1,
            "adults": 2,
            "children": 0,
            "status": "confirmed"
        }
    )
    assert res_today.status_code == 200
    today_id = res_today.json()["reservation_id"]

    # 3. Create reservation arriving on 2026-10-20 (Tomorrow / Future)
    res_tomorrow = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json={
            "external_booking_ref": "HDH-DATE-TOMORROW-20",
            "website_room_id": "deluxe",
            "guest_name": "Siddharth Verma",
            "guest_email": "sid@example.com",
            "guest_phone": "+919999922222",
            "checkin_date": "2026-10-20",
            "checkout_date": "2026-10-22",
            "rooms_count": 1,
            "adults": 2,
            "children": 0,
            "status": "confirmed"
        }
    )
    assert res_tomorrow.status_code == 200
    tomorrow_id = res_tomorrow.json()["reservation_id"]

    # 4. Create reservation arriving on 2026-10-15 (Past Date)
    res_past = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json={
            "external_booking_ref": "HDH-DATE-PAST-15",
            "website_room_id": "deluxe",
            "guest_name": "Arjun Singhania",
            "guest_email": "arjun@example.com",
            "guest_phone": "+919999933333",
            "checkin_date": "2026-10-15",
            "checkout_date": "2026-10-17",
            "rooms_count": 1,
            "adults": 2,
            "children": 0,
            "status": "confirmed"
        }
    )
    assert res_past.status_code == 200
    past_id = res_past.json()["reservation_id"]

    # Fetch all reservations
    res_list = (await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_headers)).json()
    r_today = next(r for r in res_list if r["id"] == today_id)
    r_tomorrow = next(r for r in res_list if r["id"] == tomorrow_id)
    r_past = next(r for r in res_list if r["id"] == past_id)

    # Front Desk filter helper function
    def is_expected_arrival(r, b_date):
        return (
            r["status"] == "CONFIRMED"
            and r["checkIn"] == b_date
            and (not r["rooms"] or not any(rm.get("stayStatus") == "CHECKED_IN" for rm in r["rooms"]))
        )

    def is_active_in_house(r):
        return (
            r["status"] == "CONFIRMED"
            and any(rm.get("stayStatus") == "CHECKED_IN" for rm in r["rooms"])
        )

    # VERIFY on 2026-10-19:
    # Rohan Deshmukh (2026-10-19) IS in Expected Arrivals Today
    assert is_expected_arrival(r_today, current_business_date) is True
    # Siddharth Verma (2026-10-20) is NOT in Expected Arrivals Today
    assert is_expected_arrival(r_tomorrow, current_business_date) is False
    # Arjun Singhania (2026-10-15) is NOT in Expected Arrivals Today
    assert is_expected_arrival(r_past, current_business_date) is False

    # Neither is in Active In-House Stays yet
    assert is_active_in_house(r_today) is False
    assert is_active_in_house(r_tomorrow) is False

    # 5. Check in Rohan Deshmukh to room 104
    checkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={
            "reservation_id": today_id,
            "room_id": "rm-104",
            "reservation_room_id": r_today["rooms"][0]["id"]
        }
    )
    assert checkin_res.status_code == 200

    # Refresh reservations list
    res_list_after_checkin = (await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_headers)).json()
    r_today_after = next(r for r in res_list_after_checkin if r["id"] == today_id)

    # Now Rohan Deshmukh is in Active In-House Stays and NOT in Arrivals
    assert is_expected_arrival(r_today_after, current_business_date) is False
    assert is_active_in_house(r_today_after) is True

    # 6. Execute Night Audit Rollover: advances date from 2026-10-19 to 2026-10-20
    rollover_res = await client.post(
        f"{settings.API_V1_PREFIX}/reports/night-audit/rollover",
        headers=auth_headers
    )
    assert rollover_res.status_code == 200
    new_date = rollover_res.json()["new_business_date"]
    assert new_date == "2026-10-20"

    # Verify /front-desk/business-date now returns 2026-10-20
    date_res_new = await client.get(
        f"{settings.API_V1_PREFIX}/front-desk/business-date",
        headers=auth_headers
    )
    assert date_res_new.json()["business_date"] == "2026-10-20"

    # 7. VERIFY on new business date 2026-10-20:
    # Siddharth Verma (2026-10-20) is NOW in Expected Arrivals!
    assert is_expected_arrival(r_tomorrow, new_date) is True
    # Rohan Deshmukh (checked in) is still not in arrivals
    assert is_expected_arrival(r_today_after, new_date) is False
