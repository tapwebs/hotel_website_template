import pytest
from datetime import date, timedelta
from backend.app.core.config import settings
from backend.app.services.website_booking_service import today_ist


async def register_customer(client, email="sync.guest@example.com", name="Sync Guest"):
    signup = {
        "name": name,
        "email": email,
        "phone": "+919876543333",
        "password": "Password123!",
        "consent": True,
    }
    r = await client.post("/auth/signup", json=signup)
    assert r.status_code == 201
    login = await client.post(
        "/auth/login",
        json={"email": email, "password": "Password123!", "remember": True},
    )
    assert login.status_code == 200
    return login.json()["user"]


@pytest.mark.asyncio
async def test_full_website_hms_booking_and_checkout_sync(client, auth_headers):
    """Test end-to-end synchronization:
    1. Website customer creates booking -> HMS Reservation created with source='WEBSITE' & external_booking_ref.
    2. HMS reservation accessible by both HMS bookingReference and website externalBookingRef.
    3. Front desk check-in succeeds.
    4. Front desk check-out marks HMS reservation COMPLETED and synchronizes WebsiteBooking to 'completed'.
    """
    await register_customer(client, "sync.guest1@example.com", "Ananya Sharma")

    today = today_ist()
    booking_req = {
        "requestId": "sync-req-001",
        "roomId": "deluxe",
        "checkIn": today.isoformat(),
        "checkOut": (today + timedelta(days=2)).isoformat(),
        "rooms": 1,
        "adults": 2,
        "children": 0,
        "extraBed": False,
        "specialRequests": "Ground floor preferred",
    }

    # 1. Create booking from website customer account
    res_b = await client.post("/me/bookings", json=booking_req)
    assert res_b.status_code == 201
    wb = res_b.json()["booking"]
    wb_id = wb["id"]
    wb_ref = wb["reference"]
    assert wb_ref.startswith("HDH-")
    assert wb["status"] == "pending"

    # 2. Verify HMS staff can query by website reference directly
    res_hms = await client.get(f"{settings.API_V1_PREFIX}/reservations/{wb_ref}", headers=auth_headers)
    assert res_hms.status_code == 200
    hms_res = res_hms.json()
    assert hms_res["source"] == "WEBSITE"
    assert hms_res["externalBookingRef"] == wb_ref
    assert hms_res["guestName"] == "Ananya Sharma"
    assert hms_res["status"] == "PENDING"
    hms_id = hms_res["id"]
    # Website bookings arrive PENDING; staff confirm before check-in.
    confirm = await client.post(f"{settings.API_V1_PREFIX}/reservations/{wb_ref}/confirm", headers=auth_headers)
    assert confirm.status_code == 200, confirm.text

    # 3. Front Desk Check-In
    checkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-in",
        headers=auth_headers,
        json={"reservation_id": wb_ref, "room_id": "rm-104"}
    )
    assert checkin_res.status_code == 200
    checkin_data = checkin_res.json()
    assert checkin_data["success"] is True
    stay_id = checkin_data["stay_id"]

    # 4. Front Desk Check-Out
    checkout_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={"stay_id": stay_id, "settle_remaining_with_method": "UPI"}
    )
    assert checkout_res.status_code == 200

    # Verify HMS reservation status is COMPLETED
    res_completed = await client.get(f"{settings.API_V1_PREFIX}/reservations/{hms_id}", headers=auth_headers)
    assert res_completed.status_code == 200
    assert res_completed.json()["status"] == "COMPLETED"

    # Verify customer account reflects 'completed'
    res_cust_get = await client.get(f"/me/bookings/{wb_id}")
    assert res_cust_get.status_code == 200
    assert res_cust_get.json()["booking"]["status"] == "completed"


@pytest.mark.asyncio
async def test_website_customer_cancellation_syncs_to_hms(client, auth_headers):
    """When a customer cancels a website booking, the linked HMS reservation is cancelled."""
    await register_customer(client, "sync.guest2@example.com", "Rohan Verma")
    today = today_ist()

    booking_req = {
        "requestId": "sync-req-002",
        "roomId": "deluxe",
        "checkIn": (today + timedelta(days=5)).isoformat(),
        "checkOut": (today + timedelta(days=7)).isoformat(),
        "rooms": 1,
        "adults": 1,
        "children": 0,
        "extraBed": False,
    }
    res_b = await client.post("/me/bookings", json=booking_req)
    assert res_b.status_code == 201
    wb = res_b.json()["booking"]
    wb_id = wb["id"]
    wb_ref = wb["reference"]

    # Cancel via website customer API
    res_c = await client.post(f"/me/bookings/{wb_id}/cancel")
    assert res_c.status_code == 200
    assert res_c.json()["booking"]["status"] == "cancelled"

    # Verify HMS reservation is cancelled
    res_hms = await client.get(f"{settings.API_V1_PREFIX}/reservations/{wb_ref}", headers=auth_headers)
    assert res_hms.status_code == 200
    assert res_hms.json()["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_hms_staff_cancellation_syncs_to_website(client, auth_headers):
    """When HMS staff cancels a reservation, the linked WebsiteBooking is cancelled."""
    await register_customer(client, "sync.guest3@example.com", "Pooja Patel")
    today = today_ist()

    booking_req = {
        "requestId": "sync-req-003",
        "roomId": "deluxe",
        "checkIn": (today + timedelta(days=3)).isoformat(),
        "checkOut": (today + timedelta(days=5)).isoformat(),
        "rooms": 1,
        "adults": 1,
        "children": 0,
        "extraBed": False,
    }
    res_b = await client.post("/me/bookings", json=booking_req)
    assert res_b.status_code == 201
    wb = res_b.json()["booking"]
    wb_id = wb["id"]
    wb_ref = wb["reference"]

    # Staff cancels reservation using website reference
    res_cancel_hms = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{wb_ref}/cancel",
        headers=auth_headers
    )
    assert res_cancel_hms.status_code == 200
    assert res_cancel_hms.json()["status"] == "CANCELLED"

    # Verify website booking is cancelled
    res_cust = await client.get(f"/me/bookings/{wb_id}")
    assert res_cust.status_code == 200
    assert res_cust.json()["booking"]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_idempotent_booking_submission_prevents_duplicate_reservations(client, auth_headers):
    """Submitting the same booking request with the same requestId returns the existing booking and creates no duplicate HMS reservation."""
    await register_customer(client, "sync.guest4@example.com", "Vikram Singh")
    today = today_ist()

    booking_req = {
        "requestId": "sync-req-idem-004",
        "roomId": "deluxe",
        "checkIn": (today + timedelta(days=10)).isoformat(),
        "checkOut": (today + timedelta(days=12)).isoformat(),
        "rooms": 1,
        "adults": 2,
        "children": 0,
        "extraBed": False,
    }
    # First submission -> 201 Created
    res1 = await client.post("/me/bookings", json=booking_req)
    assert res1.status_code == 201
    wb1 = res1.json()["booking"]

    # Second submission with same requestId -> 200 OK (idempotent)
    res2 = await client.post("/me/bookings", json=booking_req)
    assert res2.status_code == 200
    wb2 = res2.json()["booking"]
    assert wb1["id"] == wb2["id"]
    assert wb1["reference"] == wb2["reference"]

    # Verify only ONE HMS reservation exists
    res_hms_list = await client.get(f"{settings.API_V1_PREFIX}/reservations?search={wb1['reference']}", headers=auth_headers)
    assert res_hms_list.status_code == 200
    matching = [r for r in res_hms_list.json() if r.get("externalBookingRef") == wb1["reference"]]
    assert len(matching) == 1


@pytest.mark.asyncio
async def test_hms_staff_confirmation_syncs_to_website(client, auth_headers):
    """When staff confirms a pending reservation, linked website booking reflects confirmed."""
    await register_customer(client, "sync.guest5@example.com", "Meera Joshi")
    today = today_ist()

    booking_req = {
        "requestId": "sync-req-005",
        "roomId": "deluxe",
        "checkIn": (today + timedelta(days=4)).isoformat(),
        "checkOut": (today + timedelta(days=6)).isoformat(),
        "rooms": 1,
        "adults": 1,
        "children": 0,
        "extraBed": False,
    }
    res_b = await client.post("/me/bookings", json=booking_req)
    assert res_b.status_code == 201
    wb = res_b.json()["booking"]
    wb_ref = wb["reference"]

    # Confirm via HMS API
    res_confirm = await client.post(
        f"{settings.API_V1_PREFIX}/reservations/{wb_ref}/confirm",
        headers=auth_headers
    )
    assert res_confirm.status_code == 200
    assert res_confirm.json()["status"] == "CONFIRMED"

    # Website booking remains confirmed
    res_wb = await client.get(f"/me/bookings/{wb['id']}")
    assert res_wb.status_code == 200
    assert res_wb.json()["booking"]["status"] == "confirmed"
