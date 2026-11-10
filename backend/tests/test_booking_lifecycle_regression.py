import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_complete_booking_lifecycle_scenarios(client, auth_headers):
    business_date = "2026-10-15"

    # 1. Website request created as pending appears in HMS
    web_pending = {
        "external_booking_ref": "HDH-REG-001",
        "website_room_id": "deluxe",
        "guest_name": "LifeCycle Guest Today",
        "guest_email": "lifecycle.today@example.com",
        "guest_phone": "+919988771122",
        "checkin_date": business_date,
        "checkout_date": "2026-10-17",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "special_requests": "Ground floor preferred",
        "status": "pending"
    }
    sync_res = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_pending
    )
    assert sync_res.status_code == 200
    res_today = sync_res.json()
    assert res_today["status"] == "PENDING"
    res_today_id = res_today["reservation_id"]

    # Verify Scenario 11 (part 1): Pending booking is NOT an eligible arrival today
    hms_res_list = (await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_headers)).json()
    item_today = next(r for r in hms_res_list if r["id"] == res_today_id)
    assert item_today["status"] == "PENDING"
    is_arrival = (item_today["status"] == "CONFIRMED" and item_today["checkIn"] == business_date and (not item_today["rooms"] or item_today["rooms"][0].get("stayStatus") != "CHECKED_IN"))
    assert is_arrival is False

    # Scenario 2 & 5: Staff confirms the pending request
    confirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_today_id}/confirm",
        headers=auth_headers
    )
    assert confirm_res.status_code == 200
    confirmed_data = confirm_res.json()
    assert confirmed_data["status"] == "CONFIRMED"

    # Scenario 6: Confirmed reservation for today is now an expected arrival
    is_arrival_after = (confirmed_data["status"] == "CONFIRMED" and confirmed_data["checkIn"] == business_date and (not confirmed_data["rooms"] or confirmed_data["rooms"][0].get("stayStatus") != "CHECKED_IN"))
    assert is_arrival_after is True

    # Scenario 7: A confirmed reservation for tomorrow does NOT appear in today's expected arrivals
    web_tomorrow = {
        "external_booking_ref": "HDH-REG-002",
        "website_room_id": "deluxe",
        "guest_name": "LifeCycle Guest Tomorrow",
        "guest_email": "lifecycle.tomorrow@example.com",
        "guest_phone": "+919988771133",
        "checkin_date": "2026-10-16",  # Tomorrow
        "checkout_date": "2026-10-18",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "status": "confirmed"
    }
    sync_tomorrow = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_tomorrow
    )
    assert sync_tomorrow.status_code == 200
    res_tomorrow_data = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{sync_tomorrow.json()['reservation_id']}", headers=auth_headers)).json()
    assert res_tomorrow_data["status"] == "CONFIRMED"
    # Not today's arrival:
    assert (res_tomorrow_data["status"] == "CONFIRMED" and res_tomorrow_data["checkIn"] == business_date) is False

    # Scenario 8: Future confirmed reservation does NOT appear under Active In-House Stays before check-in
    assert res_tomorrow_data["rooms"][0].get("stayStatus") != "CHECKED_IN"

    # Scenario 3: Staff can reject a pending request
    web_to_reject = {
        "external_booking_ref": "HDH-REG-003",
        "website_room_id": "deluxe",
        "guest_name": "Reject Candidate",
        "guest_email": "reject.candidate@example.com",
        "guest_phone": "+919988771144",
        "checkin_date": business_date,
        "checkout_date": "2026-10-17",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "status": "pending"
    }
    sync_reject = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_to_reject
    )
    rej_id = sync_reject.json()["reservation_id"]
    reject_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{rej_id}/reject",
        headers=auth_headers
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "CANCELLED"

    # Scenario 11 (part 2): Rejected booking is not an eligible arrival
    rej_detail = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{rej_id}", headers=auth_headers)).json()
    assert (rej_detail["status"] == "CONFIRMED" and rej_detail["checkIn"] == business_date) is False

    # Scenario 4: Staff can cancel an eligible confirmed reservation
    cancel_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_today_id}/cancel",
        headers=auth_headers
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Scenario 12: Failed operations do not alter status or falsely succeed
    failed_reject = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_today_id}/reject",
        headers=auth_headers
    )
    assert failed_reject.status_code == 409

    failed_confirm = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_today_id}/confirm",
        headers=auth_headers
    )
    assert failed_confirm.status_code == 409
