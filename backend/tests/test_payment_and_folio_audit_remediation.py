import pytest
from backend.app.core.numbering import financial_year
from backend.app.core.config import settings
from backend.app.models.folio import MasterFolio, FolioLineItem, Payment
from backend.app.models.reservation import Reservation, Stay
from backend.app.models.room import Room
from backend.app.services.folio_service import FolioService
from sqlalchemy import select


@pytest.mark.asyncio
async def test_website_booking_advance_payment_and_idempotency(client, auth_headers, monkeypatch, db_session):
    """
    Test Phase B: Website booking creation, advance payment recording, and idempotent retry.
    """
    monkeypatch.setattr(settings, "HMS_INTEGRATION_API_KEY", "test-key-web")
    monkeypatch.setattr(settings, "WEBSITE_ROOM_MAP", "deluxe:DLX_PALACE,suite:ROYAL_SUITE")
    h = {"X-HMS-Integration-Key": "test-key-web"}

    booking_ref = "WEB-ADV-TEST-8801"
    booking_data = {
        "external_booking_ref": booking_ref,
        "website_room_id": "deluxe",
        "guest_name": "Vikram Seth",
        "guest_email": "vikram.seth@example.com",
        "guest_phone": "+91 99887 76655",
        "checkin_date": "2027-06-10",
        "checkout_date": "2027-06-12",
        "rooms_count": 1,
        "adults": 2,
        "children": 0,
        "status": "confirmed"
    }

    # 1. Create booking via integration endpoint
    res1 = await client.post(f"{settings.API_V1_PREFIX}/integrations/website-bookings", json=booking_data, headers=h)
    assert res1.status_code == 200, res1.text
    res_info = res1.json()
    reservation_id = res_info["reservation_id"]
    assert res_info["payment_status"] == "UNPAID"

    # 2. Verify idempotent replay returns existing reservation
    res_repeat = await client.post(f"{settings.API_V1_PREFIX}/integrations/website-bookings", json=booking_data, headers=h)
    assert res_repeat.status_code == 200
    assert res_repeat.json()["reservation_id"] == reservation_id

    # 3. Locate the attached master folio
    f_stmt = select(MasterFolio).where(MasterFolio.reservation_id == reservation_id)
    folio_row = (await db_session.execute(f_stmt)).scalar_one_or_none()
    assert folio_row is not None
    folio_id = folio_row.folio_id
    initial_balance = folio_row.outstanding_balance_minor

    # 4. Record advance deposit of ₹3,000 (300000 paise)
    adv_res = await client.post(
        f"{settings.API_V1_PREFIX}/folios/payments",
        headers=auth_headers,
        json={
            "folio_id": folio_id,
            "amount_paise": 300000,
            "payment_method": "UPI",
            "reference_number": "TXN-WEB-ADV-8801"
        }
    )
    assert adv_res.status_code == 200
    adv_folio = adv_res.json()
    assert adv_folio["totalPaymentsPaise"] == 300000
    assert adv_folio["outstandingBalancePaise"] == initial_balance - 300000


@pytest.mark.asyncio
async def test_room_qr_ordering_posts_to_folio(client, auth_headers, db_session):
    """
    Test Phase E: Guest Room QR order reaches kitchen and charges to stay folio.
    """
    stay_row = (await db_session.execute(select(Stay).where(Stay.stay_id == "stay-901"))).scalar_one_or_none()
    assert stay_row is not None
    token = stay_row.qr_access_token

    # Check folio balance before
    f_before = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    balance_before = f_before["outstandingBalancePaise"]

    # Place guest QR order for 1 Masala Chai / dessert item (menu-10)
    order_res = await client.post(
        f"{settings.API_V1_PREFIX}/dining/{token}/orders",
        json={"items": [{"menuItemId": "menu-10", "quantity": 1}], "notes": "Extra hot"}
    )
    assert order_res.status_code == 201, order_res.text
    order_data = order_res.json()
    order_total = order_data["totalPaise"]
    assert order_total > 0

    # Folio balance must increase by exact order_total
    f_after = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    assert f_after["outstandingBalancePaise"] == balance_before + order_total

    # Cancel order before kitchen starts -> reverses the folio charge
    cancel_res = await client.post(f"{settings.API_V1_PREFIX}/dining/{token}/orders/{order_data['orderNumber']}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    f_reversed = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    assert f_reversed["outstandingBalancePaise"] == balance_before


@pytest.mark.asyncio
async def test_restaurant_pos_settlement_cash_vs_room_charge(client, auth_headers, db_session):
    """
    Test Phase F: Restaurant POS payment options:
    - Direct Cash settlement completes order, frees table, and is NOT charged to room folio.
    - Charge to Room posts order total to room folio.
    """
    pos_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "rohan", "password": "password123"}
    )
    assert pos_login.status_code == 200
    pos_headers = {
        "Authorization": f"Bearer {pos_login.json()['access_token']}",
        "X-Property-Id": settings.DEFAULT_PROPERTY_ID
    }

    f_init = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    folio_balance_before = f_init["outstandingBalancePaise"]

    # 1. Direct Dine-In Table Order settled with CASH
    order_cash_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders",
        headers=pos_headers,
        json={
            "order_type": "DINE_IN",
            "table_number": "T1",
            "items": [{"menuItemId": "menu-04", "quantity": 1}]
        }
    )
    assert order_cash_res.status_code == 201
    cash_order = order_cash_res.json()
    order_id_1 = cash_order["id"]
    total_1 = cash_order["totalPaise"]

    # Settle at restaurant with CASH
    settle_cash_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders/{order_id_1}/settle",
        headers=pos_headers,
        json={
            "method": "CASH",
            "tenderedPaise": total_1
        }
    )
    assert settle_cash_res.status_code == 200
    settled_1 = settle_cash_res.json()
    assert settled_1["paidAt"] is not None

    # Room folio must NOT be changed (cash was collected directly at restaurant)
    f_after_cash = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    assert f_after_cash["outstandingBalancePaise"] == folio_balance_before

    # 2. Table Order settled with ROOM charge
    order_room_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders",
        headers=pos_headers,
        json={
            "order_type": "DINE_IN",
            "table_number": "T2",
            "items": [{"menuItemId": "menu-04", "quantity": 1}]
        }
    )
    assert order_room_res.status_code == 201
    room_order = order_room_res.json()
    order_id_2 = room_order["id"]
    total_2 = room_order["totalPaise"]

    settle_room_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders/{order_id_2}/settle",
        headers=pos_headers,
        json={
            "method": "ROOM",
            "roomNumber": "101"
        }
    )
    assert settle_room_res.status_code == 200
    settled_2 = settle_room_res.json()
    assert settled_2["roomNumber"] == "101"

    # Folio must now reflect the room charge
    f_after_room = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    assert f_after_room["outstandingBalancePaise"] == folio_balance_before + total_2


@pytest.mark.asyncio
async def test_end_to_end_complete_guest_billing_lifecycle(client, auth_headers, db_session):
    """
    Test End-to-End Complete Guest Journey:
    1. Walk-in check-in to Room 105 (vacant) with initial advance payment.
    2. Check-in establishes stay and folio.
    3. Post manual ancillary charge (Laundry ₹800 + 18% GST).
    4. Post in-room dining food charge.
    5. Verify folio outstanding balance reflects:
       Room Rate + Ancillary + F&B - Advance Payment.
    6. Front desk check-out with Cash settlement.
    7. Folio status is SETTLED, balance is ₹0, invoice matches ledger totals.
    """
    # 1. Walk-in check-in to Room 105
    walkin_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/walk-in",
        headers=auth_headers,
        json={
            "guest_name": "Aditya Birla",
            "guest_phone": "+91 98888 77777",
            "guest_email": "aditya.b@example.com",
            "room_number": "105",
            "nights": 1,
            "deposit_payment_method": "UPI",
            "advance_amount_paise": 200000  # ₹2,000 advance
        }
    )
    assert walkin_res.status_code == 200, walkin_res.text
    walkin_data = walkin_res.json()
    stay_id = walkin_data["stay_id"]
    booking_ref = walkin_data["booking_reference"]

    # 2. Load folio
    res_detail = (await client.get(f"{settings.API_V1_PREFIX}/reservations/{booking_ref}", headers=auth_headers)).json()
    folio_id = res_detail["masterFolioId"]

    f1 = (await client.get(f"{settings.API_V1_PREFIX}/folios/{folio_id}", headers=auth_headers)).json()
    room_charges = f1["totalChargesPaise"]
    assert f1["totalPaymentsPaise"] == 200000
    assert f1["outstandingBalancePaise"] == room_charges - 200000

    # 3. Post Ancillary Laundry charge: ₹800 net + 18% GST (₹144) = ₹944 gross (94400 paise)
    ancillary_res = await client.post(
        f"{settings.API_V1_PREFIX}/folios/charges",
        headers=auth_headers,
        json={
            "folio_id": folio_id,
            "transaction_type": "LAUNDRY",
            "description": "Express Silk Dry Cleaning",
            "debit_paise": 80000,
            "tax_paise": 14400,
            "sac_code": "999719",
            "reference_number": "REF-LAUNDRY-ADITYA"
        }
    )
    assert ancillary_res.status_code == 200
    f2 = ancillary_res.json()
    assert f2["totalChargesPaise"] == room_charges + 94400

    # 4. Room Service Dinner: 2x Paneer Tikka (menu-04) @ ₹380 net = ₹760 net + 5% GST (₹38) = ₹798 gross (79800 paise)
    pos_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "rohan", "password": "password123"}
    )
    assert pos_login.status_code == 200
    pos_headers = {
        "Authorization": f"Bearer {pos_login.json()['access_token']}",
        "X-Property-Id": settings.DEFAULT_PROPERTY_ID
    }
    rs_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders",
        headers=pos_headers,
        json={
            "order_type": "ROOM_SERVICE",
            "room_number": "105",
            "items": [{"menuItemId": "menu-04", "quantity": 2}]
        }
    )
    assert rs_res.status_code == 201
    rs_order = rs_res.json()
    assert rs_order["totalPaise"] == 79800
    assert rs_order["subtotalPaise"] == 76000
    assert rs_order["taxPaise"] == 3800

    # 5. Direct restaurant Table T1 order paid in CASH: 1x Paneer Tikka @ ₹380 net + 5% GST (₹19) = ₹399 gross (39900 paise)
    # This must be settled directly at restaurant and EXCLUDED from room folio
    rest_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders",
        headers=pos_headers,
        json={
            "order_type": "DINE_IN",
            "table_number": "T1",
            "items": [{"menuItemId": "menu-04", "quantity": 1}]
        }
    )
    assert rest_res.status_code == 201
    rest_order = rest_res.json()
    assert rest_order["totalPaise"] == 39900
    settle_rest_res = await client.post(
        f"{settings.API_V1_PREFIX}/pos/orders/{rest_order['id']}/settle",
        headers=pos_headers,
        json={
            "method": "CASH",
            "tenderedPaise": 39900
        }
    )
    assert settle_rest_res.status_code == 200
    settled_rest = settle_rest_res.json()
    assert settled_rest["paidAt"] is not None

    # 6. Verify room folio before checkout:
    db_session.expire_all()
    f3 = (await client.get(f"{settings.API_V1_PREFIX}/folios/{folio_id}", headers=auth_headers)).json()
    assert f3["totalChargesPaise"] == 646700
    assert f3["totalTaxesPaise"] == 40700  # 22,500 room (5%) + 14,400 laundry + 3,800 dinner
    assert f3["totalPaymentsPaise"] == 200000
    assert f3["outstandingBalancePaise"] == 446700

    # 7. Check-out with settlement of exact remaining balance (₹4,467 in CASH)
    co_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": stay_id,
            "settle_remaining_with_method": "CASH"
        }
    )
    assert co_res.status_code == 200, co_res.text
    co_data = co_res.json()
    assert co_data["success"] is True
    assert f"INV/{financial_year()}/" in co_data["invoice_number"]

    # 8. Folio inspection post-checkout
    f_final = (await client.get(f"{settings.API_V1_PREFIX}/folios/{folio_id}", headers=auth_headers)).json()
    assert f_final["status"] == "SETTLED"
    assert f_final["outstandingBalancePaise"] == 0
    assert f_final["totalPaymentsPaise"] == 646700  # Cumulative payments: ₹2,000 advance + ₹4,467 checkout
    assert f_final["totalChargesPaise"] == 646700
    assert f_final["totalTaxesPaise"] == 40700

    # 9. Verify Tax Invoice
    inv_res = await client.get(f"{settings.API_V1_PREFIX}/folios/{folio_id}/invoice", headers=auth_headers)
    assert inv_res.status_code == 200
    inv = inv_res.json()
    assert inv["totalInvoicePaise"] == 646700
    assert inv["totalTaxablePaise"] == 606000  # ₹4,500 + ₹800 + ₹760 = ₹6,060
    assert inv["totalCgstPaise"] + inv["totalSgstPaise"] == 40700  # ₹407 total GST
    assert inv["paymentsAppliedPaise"] == 646700
    assert inv["balanceDuePaise"] == 0


@pytest.mark.asyncio
async def test_checkout_settles_balance_and_marks_folio_settled(client, auth_headers):
    """
    Test End-to-End: Check-out with settle_remaining_with_method settles the remaining balance
    to ₹0 and marks the MasterFolio status as SETTLED.
    """
    # 1. Fetch current folio balance for stay-901
    f_res = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    assert f_res.status_code == 200
    folio_data = f_res.json()
    balance = folio_data["outstandingBalancePaise"]

    # 2. Perform checkout with CASH settlement
    co_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": "stay-901",
            "settle_remaining_with_method": "CASH"
        }
    )
    assert co_res.status_code == 200
    co_data = co_res.json()
    assert co_data["success"] is True

    # 3. Folio must now have 0 balance and be SETTLED
    f_after_res = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    assert f_after_res.status_code == 200
    f_after = f_after_res.json()
    assert f_after["outstandingBalancePaise"] == 0
    assert f_after["status"] == "SETTLED"


@pytest.mark.asyncio
async def test_void_or_credit_line_item_reduces_charges(client, auth_headers, db_session):
    """
    Test Defect A: A void or credit line item (with credit_minor > 0)
    must reduce total_charges_minor and outstanding_balance_minor.
    """
    # 1. Post charge of ₹1,000 (100000 paise) + ₹50 (5000 paise) tax
    r1 = await client.post(
        f"{settings.API_V1_PREFIX}/folios/charges",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "transaction_type": "FNB_CHARGE",
            "description": "Room Service Royal Feast",
            "debit_paise": 100000,
            "tax_paise": 5000,
            "sac_code": "996331",
            "reference_number": "REF-TEST-FEAST-001"
        }
    )
    assert r1.status_code == 200
    folio_after_charge = r1.json()
    charges_with_feast = folio_after_charge["totalChargesPaise"]
    balance_with_feast = folio_after_charge["outstandingBalancePaise"]

    # 2. Simulate order cancellation / void posting offsetting credit line:
    # debit_minor = 0, credit_minor = 100000, tax_minor = -5000
    void_item = FolioLineItem(
        folio_id="fol-5501",
        business_date="2026-10-15",
        transaction_type="FNB_CHARGE",
        service_category="ROOM_SERVICE",
        sac_hsn_code="996331",
        description="Void Room Service Royal Feast",
        debit_minor=0,
        credit_minor=100000,
        net_minor=-100000,
        tax_minor=-5000,
        posted_by="POS_SYSTEM",
        reference_number="REF-TEST-FEAST-001"
    )
    db_session.add(void_item)
    await db_session.commit()
    db_session.expire_all()

    # 3. Retrieve folio again - recalculate_folio_balance must reduce charges
    r2 = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    assert r2.status_code == 200
    folio_after_void = r2.json()

    # The ₹1,050 charge should be completely eliminated by the void
    assert folio_after_void["totalChargesPaise"] == charges_with_feast - 105000
    assert folio_after_void["outstandingBalancePaise"] == balance_with_feast - 105000


@pytest.mark.asyncio
async def test_cross_property_checkout_rejected(client, auth_headers):
    """
    Test Defect B: An attempt to checkout a stay belonging to another property
    must be rejected with 403 Forbidden.
    """
    foreign_headers = dict(auth_headers)
    foreign_headers["X-Property-Id"] = "prop-goa-02"

    res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=foreign_headers,
        json={
            "stay_id": "stay-901",  # belongs to prop-jaipur-01 (Room 101)
            "settle_remaining_with_method": "CASH"
        }
    )
    # Must fail closed with 403 Forbidden
    assert res.status_code == 403
    err_msg = str(res.json()).lower()
    assert "cross-property" in err_msg or "forbidden" in err_msg


@pytest.mark.asyncio
async def test_cross_property_room_move_rejected(client, auth_headers):
    """
    Test Defect B2: An attempt to move a room across properties
    must be rejected with 403 Forbidden.
    """
    foreign_headers = dict(auth_headers)
    foreign_headers["X-Property-Id"] = "prop-goa-02"

    res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/room-move",
        headers=foreign_headers,
        json={
            "stay_id": "stay-901",  # belongs to prop-jaipur-01
            "new_room_id": "rm-102",
            "reason": "Air conditioner check"
        }
    )
    assert res.status_code == 403
    err_msg = str(res.json()).lower()
    assert "cross-property" in err_msg or "forbidden" in err_msg


@pytest.mark.asyncio
async def test_record_payment_invalid_amount_rejected(client, auth_headers):
    """
    Test Defect C: Payment amount <= 0 must be rejected.
    """
    res = await client.post(
        f"{settings.API_V1_PREFIX}/folios/payments",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": -5000,
            "payment_method": "CASH"
        }
    )
    assert res.status_code in (400, 422)


@pytest.mark.asyncio
async def test_record_payment_on_closed_folio_rejected(client, auth_headers, db_session):
    """
    Test Defect C2: Payment on a CLOSED folio must be rejected.
    """
    # Create or update a folio to CLOSED
    folio = await db_session.get(MasterFolio, "fol-5501")
    old_status = folio.status
    folio.status = "CLOSED"
    await db_session.commit()

    try:
        res = await client.post(
            f"{settings.API_V1_PREFIX}/folios/payments",
            headers=auth_headers,
            json={
                "folio_id": "fol-5501",
                "amount_paise": 10000,
                "payment_method": "CASH"
            }
        )
        assert res.status_code == 409
        err_msg = str(res.json()).lower()
        assert "closed" in err_msg
    finally:
        folio.status = old_status
        await db_session.commit()


@pytest.mark.asyncio
async def test_refund_failed_payment_rejected(client, auth_headers, db_session):
    """
    Test Defect D: A payment in FAILED or PENDING status cannot be refunded.
    """
    # Create a failed payment record
    failed_payment = Payment(
        property_id="prop-jaipur-01",
        folio_id="fol-5501",
        transaction_ref="TXN-TEST-FAILED-001",
        receipt_number="REC-TEST-FAIL",
        amount_minor=50000,
        currency="INR",
        payment_method="UPI",
        provider="DEMO",
        status="FAILED"
    )
    db_session.add(failed_payment)
    await db_session.commit()

    res = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": failed_payment.payment_id,
            "amount_paise": 50000,
            "reason": "Test refund failed payment"
        }
    )
    assert res.status_code in (400, 422)
    err_msg = str(res.json()).lower()
    assert "status" in err_msg or "only success" in err_msg


@pytest.mark.asyncio
async def test_partial_refund_marks_status_and_allows_subsequent_refund(client, auth_headers, db_session):
    """
    Test Defect D2: A partial refund sets status to PARTIALLY_REFUNDED
    and allows subsequent refund up to remaining balance.
    """
    # 1. Create a successful payment of ₹1,000 (100000 paise)
    test_pay = Payment(
        property_id="prop-jaipur-01",
        folio_id="fol-5501",
        transaction_ref="TXN-TEST-PARTIAL-001",
        receipt_number="REC-PARTIAL-001",
        amount_minor=100000,
        currency="INR",
        payment_method="UPI",
        provider="DEMO",
        status="SUCCESS"
    )
    db_session.add(test_pay)
    await db_session.commit()

    # 2. Refund ₹400 (40000 paise)
    r1 = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": test_pay.payment_id,
            "amount_paise": 40000,
            "reason": "Partial early check out refund"
        }
    )
    assert r1.status_code == 200

    # Verify payment status in DB is PARTIALLY_REFUNDED
    await db_session.refresh(test_pay)
    assert test_pay.status == "PARTIALLY_REFUNDED"

    # 3. Attempting to refund ₹700 (more than remaining ₹600) must fail
    r_excess = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": test_pay.payment_id,
            "amount_paise": 70000,
            "reason": "Exceeds remaining"
        }
    )
    assert r_excess.status_code in (400, 422)

    # 4. Refund remaining ₹600 (60000 paise)
    r2 = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": test_pay.payment_id,
            "amount_paise": 60000,
            "reason": "Remaining balance refund"
        }
    )
    assert r2.status_code == 200

    # Verify payment status is now fully REFUNDED
    await db_session.refresh(test_pay)
    assert test_pay.status == "REFUNDED"


@pytest.mark.asyncio
async def test_failed_payment_process_persists_audit_without_folio_credit(client, auth_headers, db_session):
    """
    Test Defect E: A failed payment simulation must be persisted in Payment table
    for financial audit trail, but must NOT post a credit to the folio.
    """
    folio_before = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    balance_before = folio_before["outstandingBalancePaise"]
    payments_before = folio_before["totalPaymentsPaise"]

    idem_key = "DEMO-FAIL-AUDIT-001"
    res = await client.post(
        f"{settings.API_V1_PREFIX}/payments/process",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 80000,
            "payment_method": "CREDIT_CARD",
            "idempotency_key": idem_key,
            "simulation_outcome": "FAILED"
        }
    )
    assert res.status_code == 200
    result_data = res.json()
    assert result_data["status"] == "FAILED"

    # Folio balance must be completely unchanged
    folio_after = (await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)).json()
    assert folio_after["outstandingBalancePaise"] == balance_before
    assert folio_after["totalPaymentsPaise"] == payments_before

    # Payment record must exist with status FAILED for audit
    p_stmt = select(Payment).where(Payment.transaction_ref == idem_key)
    persisted_p = (await db_session.execute(p_stmt)).scalar_one_or_none()
    assert persisted_p is not None
    assert persisted_p.status == "FAILED"
    assert persisted_p.amount_minor == 80000


@pytest.mark.asyncio
async def test_unauthorized_staff_cannot_authorize_refund(client):
    """
    Test Security: A front desk staff user (priya) lacks AUTHORIZE_REFUND permission.
    Any attempt to refund must fail with 403 Forbidden.
    """
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "priya", "password": "password123"}
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {token}",
        "X-Property-Id": settings.DEFAULT_PROPERTY_ID
    }

    res = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=staff_headers,
        json={
            "payment_id": "pay-001",
            "amount_paise": 10000,
            "reason": "Unauthorized refund attempt"
        }
    )
    assert res.status_code == 403
    assert "AUTHORIZE_REFUND" in str(res.json()) or "forbidden" in str(res.json()).lower()


@pytest.mark.asyncio
async def test_cross_property_folio_access_isolated(client, auth_headers):
    """
    Test Security: Attempting to access a property-01 folio using property-02 context
    must fail with 404 Not Found (cannot view folios of other properties).
    """
    foreign_headers = dict(auth_headers)
    foreign_headers["X-Property-Id"] = "prop-goa-02"

    res = await client.get(
        f"{settings.API_V1_PREFIX}/folios/fol-5501",
        headers=foreign_headers
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_checkout_settles_balance_and_marks_folio_settled(client, auth_headers):
    """
    Test End-to-End: Check-out with settle_remaining_with_method settles the remaining balance
    to ₹0 and marks the MasterFolio status as SETTLED.
    """
    # 1. Fetch current folio balance for stay-901
    f_res = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    assert f_res.status_code == 200
    folio_data = f_res.json()
    balance = folio_data["outstandingBalancePaise"]

    # 2. Perform checkout with CASH settlement
    co_res = await client.post(
        f"{settings.API_V1_PREFIX}/front-desk/check-out",
        headers=auth_headers,
        json={
            "stay_id": "stay-901",
            "settle_remaining_with_method": "CASH"
        }
    )
    assert co_res.status_code == 200
    co_data = co_res.json()
    assert co_data["success"] is True

    # 3. Folio must now have 0 balance and be SETTLED
    f_after_res = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    assert f_after_res.status_code == 200
    f_after = f_after_res.json()
    assert f_after["outstandingBalancePaise"] == 0
    assert f_after["status"] == "SETTLED"
