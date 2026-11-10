import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_create_hold_and_confirm_booking(client, auth_headers):
    # 1. Create Hold
    hold_res = await client.post(
        f"{settings.API_V1_PREFIX}/availability/hold",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "categoryId": "cat-dlx-palace",
            "ratePlanId": "rp-dlx-cp",
            "checkIn": "2026-11-01",
            "checkOut": "2026-11-03",
            "adults": 2,
            "children": 0,
            "roomsCount": 1
        }
    )
    assert hold_res.status_code == 200
    hold = hold_res.json()
    assert "holdId" in hold
    assert hold["nights"] == 2
    assert hold["pricingSummary"]["grandTotalPaise"] > 0

    # 2. Confirm Booking
    confirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/confirm",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "holdId": hold["holdId"],
            "guest": {
                "title": "Mr",
                "firstName": "Amit",
                "lastName": "Patel",
                "email": "amit.patel@example.com",
                "phoneCountryCode": "+91",
                "phoneNumber": "+91 98888 77777",
                "agreeToTerms": True
            },
            "paymentMethod": "UPI"
        }
    )
    assert confirm_res.status_code == 200
    booking = confirm_res.json()
    assert booking["status"] == "CONFIRMED"
    assert "DH-2026-" in booking["bookingReference"]
    assert booking["guest"]["firstName"] == "Amit"


@pytest.mark.asyncio
async def test_invalid_dates_hold(client, auth_headers):
    response = await client.post(
        f"{settings.API_V1_PREFIX}/availability/hold",
        headers={**auth_headers, "X-Property-Id": settings.DEFAULT_PROPERTY_ID},
        json={
            "categoryId": "cat-dlx-palace",
            "ratePlanId": "rp-dlx-cp",
            "checkIn": "2026-11-05",
            "checkOut": "2026-11-02",  # Check-out before check-in!
            "adults": 2,
            "children": 0,
            "roomsCount": 1
        }
    )
    assert response.status_code == 422
    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_cancel_reservation(client, auth_headers):
    # Cancel existing res-101
    response = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/res-101/cancel",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_reservations_list_with_guest_missing_email_or_phone(client, auth_headers):
    # 1. Perform a walk-in check-in where guest has no email
    walk_in_payload = {
        "guest_name": "Tanish NoEmail",
        "guest_phone": "+91 99887 76655",
        "guest_email": None,
        "room_number": "104",
        "nights": 1,
        "deposit_payment_method": "CASH",
        "advance_amount_paise": 450000
    }
    walk_in_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json=walk_in_payload
    )
    assert walk_in_res.status_code == 200

    # 2. GET /api/v1/reservations must succeed (previously crashed with 500 ValidationError)
    res = await client.get(
        f"{settings.API_V1_PREFIX}/reservations",
        headers=auth_headers
    )
    assert res.status_code == 200
    reservations = res.json()
    assert any(r["guestName"] == "Tanish NoEmail" for r in reservations)


@pytest.mark.asyncio
async def test_confirm_pending_reservation(client, auth_headers):
    # 1. Create a pending website booking via integrations endpoint
    web_booking = {
        "external_booking_ref": "HDH-PEND-001",
        "website_room_id": "deluxe",
        "guest_name": "Pending Guest",
        "guest_email": "pending@example.com",
        "guest_phone": "+919876543210",
        "checkin_date": "2026-10-20",
        "checkout_date": "2026-10-22",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "special_requests": "Need quiet room",
        "status": "pending"
    }
    sync_res = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_booking
    )
    assert sync_res.status_code == 200
    res_data = sync_res.json()
    assert res_data["status"] == "PENDING"
    res_id = res_data["reservation_id"]

    # 2. Confirm the pending reservation via /reservations/{res_id}/confirm
    confirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_id}/confirm",
        headers=auth_headers
    )
    assert confirm_res.status_code == 200
    confirmed = confirm_res.json()
    assert confirmed["status"] == "CONFIRMED"

    # 3. Cancel the reservation
    cancel_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_id}/cancel",
        headers=auth_headers
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # 4. Cannot confirm a cancelled reservation
    reconfirm_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_id}/confirm",
        headers=auth_headers
    )
    assert reconfirm_res.status_code == 409


@pytest.mark.asyncio
async def test_reject_pending_reservation(client, auth_headers):
    web_booking = {
        "external_booking_ref": "HDH-REJ-001",
        "website_room_id": "deluxe",
        "guest_name": "Reject Guest",
        "guest_email": "reject@example.com",
        "guest_phone": "+919876543211",
        "checkin_date": "2026-10-22",
        "checkout_date": "2026-10-24",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "status": "pending"
    }
    sync_res = await client.post(
        f"{settings.API_V1_PREFIX}/integrations/website-bookings",
        headers={"X-HMS-Integration-Key": settings.HMS_INTEGRATION_API_KEY},
        json=web_booking
    )
    assert sync_res.status_code == 200
    res_id = sync_res.json()["reservation_id"]

    reject_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_id}/reject",
        headers=auth_headers
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "CANCELLED"

    rereject_res = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{res_id}/reject",
        headers=auth_headers
    )
    assert rereject_res.status_code == 409


