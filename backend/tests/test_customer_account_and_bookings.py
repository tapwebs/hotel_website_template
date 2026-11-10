import pytest
from datetime import date, timedelta
from backend.app.services.website_booking_service import today_ist


async def register_and_login(client, email="guest.test@example.com", name="Guest Test"):
    signup_payload = {
        "name": name,
        "email": email,
        "phone": "+919876543220",
        "password": "InitialPassword123!",
        "consent": True,
    }
    res_s = await client.post("/auth/signup", json=signup_payload)
    assert res_s.status_code == 201

    res_l = await client.post(
        "/auth/login",
        json={"email": email, "password": "InitialPassword123!", "remember": True},
    )
    assert res_l.status_code == 200
    return res_l.json()["user"]


@pytest.mark.asyncio
async def test_customer_profile_and_password(client):
    """Verify profile read/patch and password update lifecycle."""
    user = await register_and_login(client, "profile.test@example.com", "Profile Test")

    # 1. Get profile
    res_prof = await client.get("/me/profile")
    assert res_prof.status_code == 200
    prof = res_prof.json()["profile"]
    assert prof["email"] == "profile.test@example.com"
    assert prof["name"] == "Profile Test"
    assert prof["preferences"]["bed"] == "no_preference"

    # 2. Patch profile
    patch_payload = {
        "city": "Jaipur",
        "state": "Rajasthan",
        "country": "India",
        "preferences": {
            "bed": "king",
            "dietary": "vegetarian",
            "notes": "Quiet room preferred",
        },
        "marketingOptIn": True,
    }
    res_patch = await client.patch("/me/profile", json=patch_payload)
    assert res_patch.status_code == 200
    updated_prof = res_patch.json()["profile"]
    assert updated_prof["city"] == "Jaipur"
    assert updated_prof["preferences"]["bed"] == "king"
    assert updated_prof["marketingOptIn"] is True

    # 3. Change password with wrong current password -> 422
    res_bad_pw = await client.post(
        "/me/password",
        json={"currentPassword": "WrongPassword!", "newPassword": "NewSecurePassword123!"},
    )
    assert res_bad_pw.status_code == 422

    # 4. Change password with correct current password -> 200
    res_good_pw = await client.post(
        "/me/password",
        json={"currentPassword": "InitialPassword123!", "newPassword": "NewSecurePassword123!"},
    )
    assert res_good_pw.status_code == 200
    assert res_good_pw.json() == {"ok": True}

    # Verify login with new password
    res_login_new = await client.post(
        "/auth/login",
        json={"email": "profile.test@example.com", "password": "NewSecurePassword123!"},
    )
    assert res_login_new.status_code == 200


@pytest.mark.asyncio
async def test_customer_booking_lifecycle_and_account_deletion_guard(client):
    """Verify booking creation, idempotency, cancellation, and delete guard."""
    user = await register_and_login(client, "booking.test@example.com", "Booking Test")

    today = today_ist()
    check_in = today + timedelta(days=5)
    check_out = today + timedelta(days=7)

    # 1. Create booking
    booking_req = {
        "requestId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "roomId": "deluxe",
        "checkIn": check_in.isoformat(),
        "checkOut": check_out.isoformat(),
        "rooms": 1,
        "adults": 2,
        "children": 0,
        "extraBed": False,
        "specialRequests": "Late check-in",
    }
    res_b = await client.post("/me/bookings", json=booking_req)
    assert res_b.status_code == 201
    b_data = res_b.json()["booking"]
    booking_id = b_data["id"]
    assert b_data["reference"].startswith("HDH-")
    assert b_data["status"] == "pending"
    assert b_data["totalAmount"] == 4000  # 2 nights * 2000
    assert b_data["canCancel"] is True

    # 2. Idempotent re-submission with same requestId -> 200 and same reference
    res_idem = await client.post("/me/bookings", json=booking_req)
    assert res_idem.status_code == 200
    assert res_idem.json()["booking"]["id"] == booking_id
    assert res_idem.json()["booking"]["reference"] == b_data["reference"]

    # 3. Attempt account deletion while upcoming booking is active -> 409
    res_del_bad = await client.request(
        "DELETE",
        "/me",
        json={"password": "InitialPassword123!"},
    )
    assert res_del_bad.status_code == 409
    assert res_del_bad.json() == {"error": "upcoming_bookings", "count": 1}

    # 4. Get booking by ID
    res_get = await client.get(f"/me/bookings/{booking_id}")
    assert res_get.status_code == 200
    assert res_get.json()["booking"]["reference"] == b_data["reference"]

    # 5. List bookings
    res_list = await client.get("/me/bookings?filter=all")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert list_data["total"] == 1
    assert list_data["counts"]["all"] == 1
    assert list_data["counts"]["upcoming"] == 1

    # 6. Cancel booking
    res_cancel = await client.post(f"/me/bookings/{booking_id}/cancel")
    assert res_cancel.status_code == 200
    cancelled_b = res_cancel.json()["booking"]
    assert cancelled_b["status"] == "cancelled"
    assert cancelled_b["canCancel"] is False

    # 7. Now delete account succeeds
    res_del_ok = await client.request(
        "DELETE",
        "/me",
        json={"password": "InitialPassword123!"},
    )
    assert res_del_ok.status_code == 200
    assert res_del_ok.json() == {"ok": True}

    # Session is cleared; subsequent /auth/me -> 401
    res_after = await client.get("/auth/me")
    assert res_after.status_code == 401
