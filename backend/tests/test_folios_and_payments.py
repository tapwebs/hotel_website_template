import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_get_master_folios(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/folios", headers=auth_headers)
    assert response.status_code == 200
    folios = response.json()
    assert len(folios) >= 1
    assert any(f["folioNumber"] == "FOL-2026-5501" for f in folios)


@pytest.mark.asyncio
async def test_post_charge_to_folio(client, auth_headers):
    # Post laundry charge of ₹1,250.00 (125000 paise) + ₹150.00 GST (15000 paise)
    response = await client.post(
        f"{settings.API_V1_PREFIX}/folios/charges",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "transaction_type": "LAUNDRY",
            "description": "Express Silk Laundry Service",
            "debit_paise": 125000,
            "tax_paise": 15000,
            "sac_code": "998365"
        }
    )
    assert response.status_code == 200
    updated_folio = response.json()
    assert any(item["description"] == "Express Silk Laundry Service" for item in updated_folio["items"])
    assert updated_folio["outstandingBalancePaise"] >= 140000


@pytest.mark.asyncio
async def test_record_payment_to_folio(client, auth_headers):
    # Record payment of ₹500.00 (50000 paise)
    response = await client.post(
        f"{settings.API_V1_PREFIX}/folios/payments",
        headers=auth_headers,
        json={
            "folio_id": "fol-5501",
            "amount_paise": 50000,
            "payment_method": "UPI",
            "provider": "RAZORPAY",
            "upi_id": "sharma@upi"
        }
    )
    assert response.status_code == 200
    folio = response.json()
    assert folio["totalPaymentsPaise"] >= 1898000


@pytest.mark.asyncio
async def test_get_payments_list(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/payments", headers=auth_headers)
    assert response.status_code == 200
    payments = response.json()
    assert len(payments) >= 1
    assert any(p["paymentMethod"] == "UPI" for p in payments)


@pytest.mark.asyncio
async def test_post_charge_idempotency_retry(client, auth_headers):
    # Posting charge with the same reference_number twice must be idempotent
    payload = {
        "folio_id": "fol-5501",
        "transaction_type": "MINIBAR",
        "description": "Premium Sparkling Water",
        "debit_paise": 35000,
        "tax_paise": 4200,
        "reference_number": "REF-MINIBAR-IDEMPOTENT-001"
    }
    r1 = await client.post(f"{settings.API_V1_PREFIX}/folios/charges", headers=auth_headers, json=payload)
    assert r1.status_code == 200
    folio_first = r1.json()
    balance1 = folio_first["outstandingBalancePaise"]
    charges1 = folio_first["totalChargesPaise"]

    # Retry same payload with same reference_number
    r2 = await client.post(f"{settings.API_V1_PREFIX}/folios/charges", headers=auth_headers, json=payload)
    assert r2.status_code == 200
    folio_second = r2.json()
    assert folio_second["outstandingBalancePaise"] == balance1
    assert folio_second["totalChargesPaise"] == charges1
    # Check that item is only recorded once
    matching_items = [i for i in folio_second["items"] if i.get("referenceNumber") == "REF-MINIBAR-IDEMPOTENT-001"]
    assert len(matching_items) == 1


@pytest.mark.asyncio
async def test_record_payment_idempotency_retry(client, auth_headers):
    # Recording payment with the same transaction_ref twice must be idempotent
    payload = {
        "folio_id": "fol-5501",
        "amount_paise": 25000,
        "payment_method": "UPI",
        "provider": "RAZORPAY",
        "transaction_ref": "TXN-RZP-IDEMPOTENT-001"
    }
    r1 = await client.post(f"{settings.API_V1_PREFIX}/folios/payments", headers=auth_headers, json=payload)
    assert r1.status_code == 200
    f1 = r1.json()
    balance1 = f1["outstandingBalancePaise"]
    payments1 = f1["totalPaymentsPaise"]

    # Retry payment with same transaction_ref
    r2 = await client.post(f"{settings.API_V1_PREFIX}/folios/payments", headers=auth_headers, json=payload)
    assert r2.status_code == 200
    f2 = r2.json()
    assert f2["outstandingBalancePaise"] == balance1
    assert f2["totalPaymentsPaise"] == payments1

