import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_check_in_and_check_out_flow(client, auth_headers):
    # 1. Create a confirmed reservation first
    hold_res = await client.post(
        f"{settings.API_V1_PREFIX}/availability/hold",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "categoryId": "cat-dlx-palace",
            "ratePlanId": "rp-dlx-cp",
            "checkIn": "2026-10-15",
            "checkOut": "2026-10-16",
            "adults": 1,
            "children": 0,
            "roomsCount": 1
        }
    )
    hold = hold_res.json()
    confirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/confirm",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "holdId": hold["holdId"],
            "guest": {
                "title": "Mr",
                "firstName": "Sunil",
                "lastName": "Gavaskar",
                "email": "sunil.g@cricket.in",
                "phoneCountryCode": "+91",
                "phoneNumber": "+91 91234 56789",
                "agreeToTerms": True
            },
            "paymentMethod": "UPI"
        }
    )
    booking_ref = confirm_res.json()["bookingReference"]

    # Fetch reservation detail
    res_detail = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    res_id = res_detail["id"]

    # 2. Check-in to VACANT room 104
    checkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={
            "reservation_id": res_id,
            "room_id": "rm-104"
        }
    )
    assert checkin_res.status_code == 200
    checkin_data = checkin_res.json()
    assert checkin_data["success"] is True
    stay_id = checkin_data["stay_id"]

    # Verify Room 104 is now OCCUPIED
    room_104 = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r = next(item for item in room_104 if item["roomNumber"] == "104")
    assert r["occupancyStatus"] == "OCCUPIED"

    # 3. Check-out of Room 104
    checkout_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": stay_id,
            "settle_remaining_with_method": "CASH"
        }
    )
    assert checkout_res.status_code == 200
    checkout_data = checkout_res.json()
    assert checkout_data["success"] is True
    assert "INV/2026-27/" in checkout_data["invoice_number"]

    # Verify Room 104 is now VACANT and DIRTY
    room_104_after = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r_after = next(item for item in room_104_after if item["roomNumber"] == "104")
    assert r_after["occupancyStatus"] == "VACANT"
    assert r_after["housekeepingStatus"] == "DIRTY"


@pytest.mark.asyncio
async def test_prevent_check_in_to_occupied_room(client, auth_headers):
    # Try to check in to room 101 which is already OCCUPIED by Rahul Sharma
    response = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={
            "reservation_id": "res-101",
            "room_id": "rm-101"
        }
    )
    assert response.status_code in [409, 400]


@pytest.mark.asyncio
async def test_walk_in_check_in_flow(client, auth_headers):
    # Walk-in check-in to vacant room 104
    walk_in_payload = {
        "guest_name": "Ramesh Choudhary",
        "guest_phone": "+91 98765 43210",
        "guest_email": "ramesh@example.com",
        "room_number": "104",
        "nights": 2,
        "deposit_payment_method": "UPI",
        "advance_amount_paise": 900000
    }
    response = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json=walk_in_payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["room_number"] == "104"
    assert "booking_reference" in data
    assert "stay_id" in data

    # Verify Room 104 is now OCCUPIED
    rooms = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r = next(item for item in rooms if item["roomNumber"] == "104")
    assert r["occupancyStatus"] == "OCCUPIED"
    assert r["currentGuestName"] == "Ramesh Choudhary"

    # Verify reservation is returned in reservations list and marked CHECKED_IN
    booking_ref = data["booking_reference"]
    res_detail = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    assert res_detail["guestName"] == "Ramesh Choudhary"
    assert res_detail["source"] == "WALK_IN"
    assert res_detail["status"] == "CONFIRMED"
    assert res_detail["rooms"][0]["stayStatus"] == "CHECKED_IN"


@pytest.mark.asyncio
async def test_walk_in_check_in_occupied_room_rejected(client, auth_headers):
    # Room 101 is already OCCUPIED
    walk_in_payload = {
        "guest_name": "Invalid Walkin",
        "guest_phone": "+91 98765 00000",
        "room_number": "101",
        "nights": 1,
        "deposit_payment_method": "CASH",
        "advance_amount_paise": 450000
    }
    response = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json=walk_in_payload
    )
    assert response.status_code in [409, 400]


@pytest.mark.asyncio
async def test_early_check_out_flow(client, auth_headers):
    # Set business date to 2026-10-20
    await client.put(
        f"{settings.API_V1_PREFIX}/settings",
        headers=auth_headers,
        json={"settings": {"current_business_date": "2026-10-20"}}
    )

    # 1. Guest books from 2026-10-18 to 2026-10-22 (4 nights)
    hold_res = await client.post(
        f"{settings.API_V1_PREFIX}/availability/hold",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "categoryId": "cat-dlx-palace",
            "ratePlanId": "rp-dlx-cp",
            "checkIn": "2026-10-18",
            "checkOut": "2026-10-22",
            "adults": 1,
            "children": 0,
            "roomsCount": 1
        }
    )
    assert hold_res.status_code == 200
    hold = hold_res.json()

    confirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/confirm",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "holdId": hold["holdId"],
            "guest": {
                "title": "Mr",
                "firstName": "Arun",
                "lastName": "Lal",
                "email": "arun.lal@cricket.in",
                "phoneCountryCode": "+91",
                "phoneNumber": "+91 99887 76655",
                "agreeToTerms": True
            },
            "paymentMethod": "UPI"
        }
    )
    assert confirm_res.status_code == 200
    booking_ref = confirm_res.json()["bookingReference"]

    res_detail = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    res_id = res_detail["id"]
    assert res_detail["checkOut"] == "2026-10-22"
    assert res_detail["nights"] == 4

    # 2. Check-in guest to a vacant room
    rooms_before = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    vacant_rm = next(item for item in rooms_before if item["occupancyStatus"] == "VACANT")
    vacant_room_id = vacant_rm["id"]
    vacant_room_num = vacant_rm["roomNumber"]

    checkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={
            "reservation_id": res_id,
            "room_id": vacant_room_id
        }
    )
    assert checkin_res.status_code == 200
    checkin_data = checkin_res.json()
    stay_id = checkin_data["stay_id"]

    # Verify active in-house stay presence
    res_in_house = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    assert res_in_house["status"] == "CONFIRMED"
    assert res_in_house["rooms"][0]["stayStatus"] == "CHECKED_IN"
    # Not in departures today because checkOut is 2026-10-22 and business date is 2026-10-20
    assert res_in_house["checkOut"] != "2026-10-20"

    # Verify Room is now OCCUPIED
    rooms = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r_occupied = next(item for item in rooms if item["roomNumber"] == vacant_room_num)
    assert r_occupied["occupancyStatus"] == "OCCUPIED"

    # 3. Guest requests early check-out on 20 October (stay was scheduled until 22 October)
    # Check-out using the existing checkout endpoint
    checkout_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": stay_id,
            "settle_remaining_with_method": "UPI"
        }
    )
    assert checkout_res.status_code == 200
    checkout_data = checkout_res.json()
    assert checkout_data["success"] is True
    assert "INV/2026-27/" in checkout_data["invoice_number"]

    # 4. Verify post-early-checkout updates:
    # Physical room is now VACANT and DIRTY
    rooms_after = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    r_after = next(item for item in rooms_after if item["roomNumber"] == vacant_room_num)
    assert r_after["occupancyStatus"] == "VACANT"
    assert r_after["housekeepingStatus"] == "DIRTY"

    # Reservation is now COMPLETED, stayStatus is CHECKED_OUT
    res_after = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    assert res_after["status"] == "COMPLETED"
    assert res_after["rooms"][0]["stayStatus"] == "CHECKED_OUT"

    # Check-out date updated to early check-out date (2026-10-20)
    assert res_after["checkOut"] == "2026-10-20"
    assert res_after["rooms"][0]["checkOut"] == "2026-10-20"
    assert res_after["nights"] == 2  # 2026-10-18 to 2026-10-20

    # Folio / settlement updated
    assert res_after["balanceAmountPaise"] == 0
    assert res_after["paymentStatus"] == "PAID"

    # Active in-house stays condition: CONFIRMED and stayStatus == CHECKED_IN
    is_in_house = res_after["status"] == "CONFIRMED" and any(rm.get("stayStatus") == "CHECKED_IN" for rm in res_after["rooms"])
    assert is_in_house is False

    # Pending departures condition: CONFIRMED and checkOut == businessDate and stayStatus == CHECKED_IN
    is_pending_departure = (
        res_after["status"] == "CONFIRMED"
        and res_after["checkOut"] == "2026-10-20"
        and any(rm.get("stayStatus") == "CHECKED_IN" for rm in res_after["rooms"])
    )
    assert is_pending_departure is False

    # 5. Prevent duplicate check-out
    dup_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": stay_id,
            "settle_remaining_with_method": "UPI"
        }
    )
    assert dup_res.status_code == 409

    # 6. Verify business date was NOT altered
    b_date_res = await client.get(
        f"{settings.API_V1_PREFIX}/front-desk/business-date",
        headers=auth_headers
    )
    assert b_date_res.json()["business_date"] == "2026-10-20"


