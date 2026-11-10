import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_front_desk_arrivals_vs_in_house_lifecycle(client, auth_headers):
    business_date = "2026-10-15"

    # 1. A confirmed website reservation arriving today
    web_booking_today = {
        "external_booking_ref": "HDH-FDESK-TODAY-01",
        "website_room_id": "deluxe",
        "guest_name": "Aarav Gupta",
        "guest_email": "aarav.gupta@example.com",
        "guest_phone": "+919811223344",
        "checkin_date": business_date,
        "checkout_date": "2026-10-17",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "status": "confirmed"
    }
    sync_res = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_booking_today
    )
    assert sync_res.status_code == 200
    res_web_id = sync_res.json()["reservation_id"]

    # 2. A confirmed offline reservation arriving today
    hold_res = await client.post(
        f"{settings.API_V1_PREFIX}/availability/hold",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "categoryId": "cat-dlx-palace",
            "ratePlanId": "rp-dlx-cp",
            "checkIn": business_date,
            "checkOut": "2026-10-17",
            "adults": 2,
            "children": 0,
            "roomsCount": 1
        }
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["holdId"]

    offline_confirm = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/confirm",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "holdId": hold_id,
            "guest": {
                "title": "Ms",
                "firstName": "Meera",
                "lastName": "Nair",
                "email": "meera.nair@example.com",
                "phoneNumber": "+91 98223 34455",
                "agreeToTerms": True
            },
            "paymentMethod": "CASH"
        }
    )
    assert offline_confirm.status_code == 200
    res_offline_ref = offline_confirm.json()["bookingReference"]

    # Fetch both reservations
    res_list = (await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_headers)).json()
    r_web = next(r for r in res_list if r["id"] == res_web_id)
    r_offline = next(r for r in res_list if r["bookingReference"] == res_offline_ref)

    # Helper functions reflecting FrontDeskPage filter logic
    def is_expected_arrival(r):
        return (
            r["status"] == "CONFIRMED"
            and r["checkIn"] == business_date
            and (not r["rooms"] or not any(rm.get("stayStatus") == "CHECKED_IN" for rm in r["rooms"]))
        )

    def is_active_in_house(r):
        return (
            r["status"] == "CONFIRMED"
            and any(rm.get("stayStatus") == "CHECKED_IN" for rm in r["rooms"])
        )

    # 3. VERIFY: Both confirmed reservations for today appear under Expected Arrivals Today
    assert is_expected_arrival(r_web) is True
    assert is_expected_arrival(r_offline) is True

    # 4. VERIFY: NEITHER reservation appears under Active In-House Stays before check-in!
    assert is_active_in_house(r_web) is False
    assert is_active_in_house(r_offline) is False

    # Also verify guest name mapping is accurate
    assert r_web["guestName"] == "Aarav Gupta"
    assert r_offline["guestName"] == "Meera Nair"

    # 5. Check in the website reservation to a vacant room (Room 104)
    rooms_before = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    vacant_104 = next(rm for rm in rooms_before if rm["roomNumber"] == "104")
    assert vacant_104["occupancyStatus"] == "VACANT"

    checkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={
            "reservation_id": r_web["id"],
            "room_id": vacant_104["id"],
            "reservation_room_id": r_web["rooms"][0]["id"]
        }
    )
    assert checkin_res.status_code == 200

    # 6. VERIFY: Immediately after check-in, cache is fresh and r_web has moved to Active In-House
    res_list_after = (await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_headers)).json()
    r_web_after = next(r for r in res_list_after if r["id"] == res_web_id)

    assert is_expected_arrival(r_web_after) is False
    assert is_active_in_house(r_web_after) is True

    # Verify physical room 104 is now OCCUPIED
    rooms_after = (await client.get(f"{settings.API_V1_PREFIX}/rooms", headers=auth_headers)).json()
    occupied_104 = next(rm for rm in rooms_after if rm["roomNumber"] == "104")
    assert occupied_104["occupancyStatus"] == "OCCUPIED"
    assert occupied_104["currentGuestName"] == "Aarav Gupta"

    # 7. VERIFY: Future reservation remains scheduled; does NOT appear in arrivals or in-house
    web_booking_future = {
        "external_booking_ref": "HDH-FDESK-FUT-01",
        "website_room_id": "deluxe",
        "guest_name": "Future Guest",
        "guest_email": "future.guest@example.com",
        "guest_phone": "+919833445566",
        "checkin_date": "2026-10-25",
        "checkout_date": "2026-10-27",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "status": "confirmed"
    }
    sync_fut = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_booking_future
    )
    fut_id = sync_fut.json()["reservation_id"]
    r_fut = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{fut_id}", headers=auth_headers)).json()

    assert is_expected_arrival(r_fut) is False
    assert is_active_in_house(r_fut) is False

    # 8. VERIFY: Fast Walk-In Check-In immediately creates active in-house stay
    walk_in_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json={
            "guest_name": "Immediate WalkIn",
            "guest_phone": "+91 98444 55566",
            "guest_email": "walkin@example.com",
            "room_number": "105",
            "nights": 1,
            "deposit_payment_method": "CASH",
            "advance_amount_paise": 450000
        }
    )
    assert walk_in_res.status_code == 200
    walk_in_ref = walk_in_res.json()["booking_reference"]

    res_list_walkin = (await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_headers)).json()
    r_walkin = next(r for r in res_list_walkin if r["bookingReference"] == walk_in_ref)

    assert is_expected_arrival(r_walkin) is False
    assert is_active_in_house(r_walkin) is True
