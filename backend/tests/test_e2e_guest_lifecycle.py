import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_full_guest_and_folio_lifecycle(client, auth_headers):
    # 1. Public Availability Search
    cat_res = await client.get("/api/v1/availability/categories")
    assert cat_res.status_code == 200
    categories = cat_res.json()
    assert len(categories) > 0
    cat = categories[0]
    cat_id = cat["id"]
    assert len(cat["ratePlans"]) > 0
    rate_plan_id = cat["ratePlans"][0]["id"]

    # 3. Create Inventory Room Hold
    hold_res = await client.post("/api/v1/availability/hold", headers=auth_headers, json={
        "categoryId": cat_id,
        "ratePlanId": rate_plan_id,
        "checkIn": "2026-11-15",
        "checkOut": "2026-11-17",
        "roomsCount": 1,
        "adults": 2,
        "children": 0
    })
    assert hold_res.status_code == 200, f"Hold failed: {hold_res.text}"
    hold_data = hold_res.json()
    hold_id = hold_data["holdId"]

    # 4. Confirm Booking
    confirm_res = await client.post("/api/v1/reservations/confirm", headers=auth_headers, json={
        "holdId": hold_id,
        "guest": {
            "firstName": "Arjun",
            "lastName": "Sharma",
            "email": "arjun.sharma@example.com",
            "phoneNumber": "+91 98765 43210",
            "specialRequests": "Quiet upper floor room with palace view"
        },
        "paymentMethod": "UPI"
    })
    assert confirm_res.status_code == 200, f"Confirm failed: {confirm_res.text}"
    confirm_data = confirm_res.json()
    booking_ref = confirm_data["bookingReference"]
    assert booking_ref.startswith("DH-2026-")

    # 5. Fetch reservation as front desk
    res_lookup = await client.get(f"/api/v1/reservations/{booking_ref}", headers=auth_headers)
    assert res_lookup.status_code == 200
    res_info = res_lookup.json()
    res_id = res_info["id"]
    assert len(res_info["rooms"]) > 0
    res_room_id = res_info["rooms"][0]["id"]

    # 6. Check available rooms to assign
    rooms_res = await client.get("/api/v1/rooms?occupancy_status=VACANT", headers=auth_headers)
    assert rooms_res.status_code == 200
    vacant_rooms = rooms_res.json()
    assert len(vacant_rooms) > 0
    assign_room = vacant_rooms[0]
    room_id = assign_room["id"]

    # 7. Front Desk Check-in
    checkin_res = await client.post("/api/v1/front-desk/check-in", headers=auth_headers, json={
        "reservation_id": res_id,
        "reservation_room_id": res_room_id,
        "room_id": room_id
    })
    assert checkin_res.status_code == 200, f"Check-in failed: {checkin_res.text}"
    checkin_data = checkin_res.json()
    stay_id = checkin_data["stay_id"]
    assert stay_id is not None

    # 8. Fetch Folios to locate guest master folio
    folios_res = await client.get("/api/v1/folios?status=OPEN", headers=auth_headers)
    assert folios_res.status_code == 200
    folios = folios_res.json()
    target_folio = next((f for f in folios if f["stayId"] == stay_id), None)
    assert target_folio is not None, "Target stay folio not found"
    folio_id = target_folio["id"]

    # 9. Post Charge to Folio with Idempotency Key
    idempotency_charge_key = f"IDEM-CHG-{stay_id[:8]}-001"
    charge_res = await client.post(
        "/api/v1/folios/charges",
        headers={**auth_headers, "X-Idempotency-Key": idempotency_charge_key},
        json={
            "folio_id": folio_id,
            "transaction_type": "FNB_CHARGE",
            "sac_code": "996331",
            "description": "In-Room Dining Royal Thali & Beverages",
            "debit_paise": 150000,
            "tax_paise": 7500
        }
    )
    assert charge_res.status_code == 200, f"Post charge failed: {charge_res.text}"
    folio_after_charge = charge_res.json()
    assert folio_after_charge["outstandingBalancePaise"] >= 157500

    # Duplicate charge with same idempotency key must be safely handled
    charge_dup = await client.post(
        "/api/v1/folios/charges",
        headers={**auth_headers, "X-Idempotency-Key": idempotency_charge_key},
        json={
            "folio_id": folio_id,
            "transaction_type": "FNB_CHARGE",
            "sac_code": "996331",
            "description": "In-Room Dining Royal Thali & Beverages",
            "debit_paise": 150000,
            "tax_paise": 7500
        }
    )
    assert charge_dup.status_code == 200

    # 10. Record Folio Settlement Payment
    payment_res = await client.post(
        "/api/v1/folios/payments",
        headers={**auth_headers, "X-Idempotency-Key": f"IDEM-PAY-{stay_id[:8]}-001"},
        json={
            "folio_id": folio_id,
            "amount_paise": folio_after_charge["outstandingBalancePaise"],
            "payment_method": "CREDIT_CARD",
            "provider": "PINE_LABS_POS"
        }
    )
    assert payment_res.status_code == 200, f"Record payment failed: {payment_res.text}"
    folio_after_pay = payment_res.json()
    assert folio_after_pay["outstandingBalancePaise"] == 0

    # 11. Front Desk Check-out
    checkout_res = await client.post("/api/v1/front-desk/check-out", headers=auth_headers, json={
        "stay_id": stay_id
    })
    assert checkout_res.status_code == 200, f"Check-out failed: {checkout_res.text}"
    checkout_data = checkout_res.json()
    assert checkout_data["success"] is True
    assert checkout_data["room_state"] == "VACANT_DIRTY"
    assert checkout_data["housekeeping_task_dispatched"] is True
    assert checkout_data["invoice_number"].startswith("INV/2026-27/")
