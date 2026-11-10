import pytest
from backend.app.core.numbering import financial_year
from backend.app.core.config import settings
from backend.app.services.payment_providers import (
    PaymentConfigurationError,
    get_payment_provider,
)


@pytest.mark.asyncio
async def test_folio_5501_discrepancy_regression(client, auth_headers):
    """
    Regression Test for FOL-2026-5501 Discrepancy.
    Visible debits must match gross charges ₹19,477.50:
    - 3 nights Room Charge (14, 15, 16 Oct) @ ₹5,500 net + 12% GST (₹660) = ₹6,160 each = ₹18,480.00
    - 1 F&B Room Service order @ ₹950 net + 5% GST (₹47.50) = ₹997.50
    Total Gross Charges = ₹19,477.50 (1,947,750 paise).
    Advance payment = ₹18,480.00 (1,848,000 paise).
    Outstanding balance = ₹997.50 (99,750 paise).
    """
    res = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    assert res.status_code == 200
    folio = res.json()

    assert folio["folioNumber"] == "FOL-2026-5501"
    assert folio["guestName"] == "Rahul Sharma"
    assert folio["roomNumber"] == "101"

    # Verify gross charges
    assert folio["totalChargesPaise"] == 1947750
    assert folio["totalTaxesPaise"] == 202750
    assert folio["totalPaymentsPaise"] == 1848000
    assert folio["outstandingBalancePaise"] == 99750

    # Verify all 3 nights are present in ledger items
    room_charges = [i for i in folio["items"] if i["transactionType"] == "ROOM_CHARGE"]
    assert len(room_charges) == 3, f"Expected 3 room charges for 3-night stay, found {len(room_charges)}"
    for rc in room_charges:
        assert rc["debitPaise"] == 550000
        assert rc["taxPaise"] == 66000

    # Verify F&B order is present
    fnb_charges = [i for i in folio["items"] if i["transactionType"] == "FNB_CHARGE"]
    assert len(fnb_charges) == 1
    assert fnb_charges[0]["debitPaise"] == 95000
    assert fnb_charges[0]["taxPaise"] == 4750

    # Authoritative ledger check: sum of debits + taxes matches totalChargesPaise
    sum_gross_ledger = sum(i["debitPaise"] + i["taxPaise"] for i in folio["items"] if i["transactionType"] not in ("PAYMENT", "REFUND"))
    assert sum_gross_ledger == folio["totalChargesPaise"]


@pytest.mark.asyncio
async def test_post_ancillary_charge_with_tax(client, auth_headers):
    # Post Spa Treatment charge of ₹2,000.00 (200000 paise)
    ref = "REF-SPA-TEST-001"
    response = await client.post(
        f"{settings.API_V1_PREFIX}/folios/charges",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "transaction_type": "SPA",
            "description": "Royal Ayurvedic Massage",
            "debit_paise": 200000,
            "tax_paise": 36000,  # 18% GST
            "sac_code": "999711",
            "reference_number": ref
        }
    )
    assert response.status_code == 200
    folio = response.json()
    spa_item = next((i for i in folio["items"] if i.get("referenceNumber") == ref), None)
    assert spa_item is not None
    assert spa_item["debitPaise"] == 200000
    assert spa_item["taxPaise"] == 36000
    assert spa_item["sacCode"] == "999711"

    # Idempotent retry with same reference_number must not duplicate
    r2 = await client.post(
        f"{settings.API_V1_PREFIX}/folios/charges",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "transaction_type": "SPA",
            "description": "Royal Ayurvedic Massage",
            "debit_paise": 200000,
            "tax_paise": 36000,
            "sac_code": "999711",
            "reference_number": ref
        }
    )
    assert r2.status_code == 200
    f2 = r2.json()
    matching = [i for i in f2["items"] if i.get("referenceNumber") == ref]
    assert len(matching) == 1


@pytest.mark.asyncio
async def test_unified_demo_provider_flow(client, auth_headers):
    # Process payment via unified endpoint
    idem_key = "DEMO-PAY-IDEM-001"
    response = await client.post(
        f"{settings.API_V1_PREFIX}/payments/process",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 50000,  # ₹500.00
            "payment_method": "UPI",
            "payer_name": "Rahul Sharma",
            "payer_upi": "sharma@okhdfcbank",
            "idempotency_key": idem_key,
            "simulation_outcome": "SUCCESS"
        }
    )
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "SUCCESS"
    assert res["provider"] == "DEMO"
    assert res["is_demo"] is True
    assert res["transaction_ref"] == idem_key

    # Check that folio received the payment
    folio_res = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501", headers=auth_headers)
    folio = folio_res.json()
    matching_item = next((i for i in folio["items"] if i.get("referenceNumber") == idem_key), None)
    assert matching_item is not None
    assert matching_item["creditPaise"] == 50000


@pytest.mark.asyncio
async def test_unified_demo_simulation_outcomes(client, auth_headers):
    # Pending simulation
    r_pend = await client.post(
        f"{settings.API_V1_PREFIX}/payments/process",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 20000,
            "payment_method": "CREDIT_CARD",
            "simulation_outcome": "PENDING"
        }
    )
    assert r_pend.status_code == 200
    assert r_pend.json()["status"] == "PENDING"

    # Failed simulation
    r_fail = await client.post(
        f"{settings.API_V1_PREFIX}/payments/process",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 20000,
            "payment_method": "UPI",
            "simulation_outcome": "FAILED"
        }
    )
    assert r_fail.status_code == 200
    assert r_fail.json()["status"] == "FAILED"

    # Provider Error simulation
    r_err = await client.post(
        f"{settings.API_V1_PREFIX}/payments/process",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 20000,
            "payment_method": "UPI",
            "simulation_outcome": "PROVIDER_ERROR"
        }
    )
    assert r_err.status_code == 400
    assert r_err.json()["error"]["code"] == "PAYMENT_PROVIDER_ERROR"


@pytest.mark.asyncio
async def test_provider_status_endpoint(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/payments/provider-status", headers=auth_headers)
    assert response.status_code == 200
    info = response.json()
    assert "activeProvider" in info
    assert info["isDemo"] is True
    assert info["configurationValid"] is True


def test_unconfigured_providers_fail_clearly():
    # If razorpay is selected without credentials, it must raise PaymentConfigurationError
    rzp_provider = get_payment_provider("razorpay")
    with pytest.raises(PaymentConfigurationError) as exc_info:
        rzp_provider.validate_configuration()
    assert "missing required credentials" in str(exc_info.value).lower()

    # If bank is selected without credentials, it must raise PaymentConfigurationError
    bank_provider = get_payment_provider("bank")
    with pytest.raises(PaymentConfigurationError) as exc_info2:
        bank_provider.validate_configuration()
    assert "missing" in str(exc_info2.value).lower()


@pytest.mark.asyncio
async def test_refund_workflow_and_guards(client, auth_headers):
    # First record a distinct payment of ₹1,000.00
    txn_ref = "TXN-REFUND-TARGET-001"
    pay_res = await client.post(
        f"{settings.API_V1_PREFIX}/payments/process",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 100000,
            "payment_method": "UPI",
            "idempotency_key": txn_ref,
            "simulation_outcome": "SUCCESS"
        }
    )
    assert pay_res.status_code == 200

    # Find the payment record
    payments_res = await client.get(f"{settings.API_V1_PREFIX}/payments", headers=auth_headers)
    payments = payments_res.json()
    target_payment = next(p for p in payments if p["transactionRef"] == txn_ref)

    # 1. Attempt refund exceeding eligible amount (e.g. ₹1,500 on ₹1,000 payment)
    bad_refund = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": target_payment["id"],
            "amount_paise": 150000,
            "reason": "Excessive refund test"
        }
    )
    assert bad_refund.status_code == 422

    # 2. Process partial refund of ₹400.00 (40000 paise)
    ref1 = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": target_payment["id"],
            "amount_paise": 40000,
            "reason": "Partial satisfaction refund",
            "simulation_outcome": "SUCCESS"
        }
    )
    assert ref1.status_code == 200
    assert ref1.json()["status"] == "SUCCESS"
    assert ref1.json()["refundAmountPaise"] == 40000

    # 3. Process remaining refund of ₹600.00 (60000 paise)
    ref2 = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": target_payment["id"],
            "amount_paise": 60000,
            "reason": "Final settlement of refund",
            "simulation_outcome": "SUCCESS"
        }
    )
    assert ref2.status_code == 200
    assert ref2.json()["status"] == "SUCCESS"

    # 4. Attempt further refund after fully refunded payment
    ref3 = await client.post(
        f"{settings.API_V1_PREFIX}/payments/refund",
        headers=auth_headers,
        json={
            "payment_id": target_payment["id"],
            "amount_paise": 10000,
            "reason": "Should fail because balance is 0"
        }
    )
    assert ref3.status_code == 422


@pytest.mark.asyncio
async def test_gateway_reconciliation_flow(client, auth_headers):
    # Run demo reconciliation
    response = await client.get(f"{settings.API_V1_PREFIX}/payments/reconciliation", headers=auth_headers)
    assert response.status_code == 200
    rep = response.json()

    assert rep["provider"] == "DEMO"
    assert rep["isDemo"] is True
    assert rep["status"] == "COMPLETED"
    assert len(rep["items"]) >= 1

    # Check for matched transaction TXN-2026-9041
    matched_item = next((i for i in rep["items"] if i["transactionRef"] == "TXN-2026-9041"), None)
    assert matched_item is not None
    assert matched_item["matchStatus"] == "MATCHED"
    assert matched_item["settlementAmountPaise"] == 1848000

    # Reconcile via CSV upload
    csv_sample = """transaction_ref,amount,fee,date
TXN-2026-9041,18480.00,369.60,2026-10-15
TXN-UNKNOWN-999,5000.00,100.00,2026-10-15
"""
    csv_res = await client.post(
        f"{settings.API_V1_PREFIX}/payments/reconciliation/import-csv",
        headers=auth_headers,
        json={"csv_content": csv_sample}
    )
    assert csv_res.status_code == 200
    csv_rep = csv_res.json()
    assert csv_rep["matchedCount"] >= 1
    assert csv_rep["discrepancyCount"] >= 1

    unknown = next((i for i in csv_rep["items"] if i["transactionRef"] == "TXN-UNKNOWN-999"), None)
    assert unknown is not None
    assert unknown["matchStatus"] == "MISSING_IN_HMS"


@pytest.mark.asyncio
async def test_export_payments_csv(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/payments/export-csv", headers=auth_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    content = response.text
    assert "Transaction Ref" in content
    assert "Folio Number" in content
    assert "Amount (INR)" in content
    assert "TXN-2026-9041" in content


@pytest.mark.asyncio
async def test_official_tax_invoice_generation(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/folios/fol-5501/invoice", headers=auth_headers)
    assert response.status_code == 200
    inv = response.json()

    assert f"INV/{financial_year()}/" in inv["invoiceNumber"]
    assert inv["financialYear"] == financial_year()
    # Registration data comes from the property record (never a hard-coded placeholder)
    assert inv["hotelDetails"]["gstin"] == "08AAAAA0000A1Z5"
    assert inv["guestDetails"]["name"] == "Rahul Sharma"
    assert inv["guestDetails"]["roomNumber"] == "101"

    # Itemized items must include accommodation and F&B
    assert len(inv["items"]) >= 2
    assert any(i["sacCode"] == "996311" for i in inv["items"])
    assert any(i["sacCode"] == "996331" for i in inv["items"])
    assert inv["totalInvoicePaise"] == 1947750
