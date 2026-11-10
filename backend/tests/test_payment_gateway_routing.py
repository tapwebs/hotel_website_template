"""Regression tests: each payment gateway type works on its own, and switching one never breaks another.

Root cause these guard against: Payment.provider (where money was captured) was resolved through the same factory
as PAYMENT_PROVIDER (the active desk gateway), so card-machine/POS refunds crashed with 503, and guest QR online
payment switched off whenever the desk gateway was changed away from Razorpay.
"""
import pytest
from backend.app.core.config import settings
from backend.app.models.folio import Payment
from backend.app.services import guest_dining_service
from backend.app.services.payment_providers import BankGatewayPaymentProvider, DemoPaymentProvider, RazorpayPaymentProvider
from backend.app.services.payment_providers.factory import refund_provider_for

API = settings.API_V1_PREFIX


@pytest.mark.parametrize("provider,ref,expected", [
    ("DEMO", "TXN-1", DemoPaymentProvider),
    ("BANK", "TXN-1", BankGatewayPaymentProvider),
    ("RAZORPAY", "pay_ABC123", RazorpayPaymentProvider),
    ("RAZORPAY", "TXN-UPI-123456", None),  # staff-recorded deposit: no gateway payment id to reverse
    ("CASH_REGISTER", "TXN-1", None),
    ("PINE_LABS_POS", "TXN-1", None),
    ("POS_TERMINAL", "TXN-1", None),
    ("BANK_CSV", "TXN-1", None),
    ("", "TXN-1", None),
])
def test_refund_routing_by_capture_source(provider, ref, expected):
    got = refund_provider_for(provider, ref)
    assert (got is None) if expected is None else isinstance(got, expected)


@pytest.mark.parametrize("active", ["demo", "razorpay", "bank"])
def test_refund_routing_ignores_active_gateway(monkeypatch, active):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", active)
    assert refund_provider_for("POS_TERMINAL", "TXN-9") is None
    assert isinstance(refund_provider_for("DEMO", "TXN-9"), DemoPaymentProvider)


@pytest.mark.asyncio
@pytest.mark.parametrize("captured_by", ["PINE_LABS_POS", "POS_TERMINAL", "CASH_REGISTER", "BANK_CSV"])
async def test_offline_payment_refund_is_recorded_not_crashed(client, auth_headers, db_session, monkeypatch, captured_by):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "bank")  # an unconfigured live gateway must not matter
    pay = Payment(property_id="prop-jaipur-01", folio_id="fol-5501", transaction_ref=f"TXN-OFF-{captured_by}",
                  receipt_number="REC-OFF", amount_minor=50000, currency="INR", payment_method="CREDIT_CARD",
                  provider=captured_by, status="SUCCESS")
    db_session.add(pay)
    await db_session.commit()
    r = await client.post(f"{API}/payments/refund", headers=auth_headers,
                          json={"payment_id": pay.payment_id, "amount_paise": 20000, "reason": "Early checkout"})
    assert r.status_code == 200, r.text
    assert r.json()["isDemo"] is False
    await db_session.refresh(pay)
    assert pay.status == "PARTIALLY_REFUNDED"


@pytest.mark.parametrize("active", ["demo", "razorpay", "bank"])
def test_guest_online_payment_independent_of_desk_gateway(monkeypatch, active):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", active)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_abcdefgh1234")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    assert guest_dining_service.gateway() == "razorpay"


def test_guest_online_payment_never_demo_in_production(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", None)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", None)
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "demo")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    assert guest_dining_service.gateway() is None
    monkeypatch.setattr(settings, "APP_ENV", "development")
    assert guest_dining_service.gateway() == "demo"


@pytest.mark.asyncio
async def test_provider_status_masks_keys(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_live_SECRETPART9999")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "very-secret-value")
    r = await client.get(f"{API}/payments/provider-status", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["razorpay"]["configured"] is True and body["razorpay"]["mode"] == "PRODUCTION"
    assert "SECRETPART" not in r.text and "very-secret-value" not in r.text
    assert body["guestOnlinePayment"] == "razorpay"


@pytest.mark.asyncio
async def test_booking_engine_writes_need_staff_login(client):
    h = {"X-Property-Id": settings.DEFAULT_PROPERTY_ID}
    hold = {"categoryId": "cat-dlx-palace", "ratePlanId": "rp-dlx-cp", "checkIn": "2030-01-01", "checkOut": "2030-01-02", "adults": 2, "children": 0, "roomsCount": 1}
    assert (await client.post(f"{API}/availability/hold", headers=h, json=hold)).status_code == 401
    assert (await client.post(f"{API}/reservations/confirm", headers=h, json={"holdId": "x", "guest": {}})).status_code in (401, 422)
