"""TapMenu port: settlement, discounts/PIN, coupons, shifts, tables/QR, categories, import/export, variants, guest table
ordering, tracking, reviews, reward wheel, reservations and GST config."""
import pytest
import pytest_asyncio
from sqlalchemy import select

from backend.app.core import ratelimit
from backend.app.core.config import settings
from backend.app.models.folio import MasterFolio
from backend.app.models.pos import POSTable
from backend.app.models.reservation import Stay
from backend.app.services import fnb_config

API = settings.API_V1_PREFIX
PID = settings.DEFAULT_PROPERTY_ID


@pytest.fixture(autouse=True)
def _fresh():
    ratelimit.reset()
    fnb_config.reset_cache()


async def login(client, user):
    r = await client.post(f"{API}/auth/login", json={"username_or_email": user, "password": "password123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "X-Property-Id": PID}


@pytest_asyncio.fixture
async def pos(client):
    return await login(client, "rohan")


@pytest_asyncio.fixture
async def boss(client):
    return await login(client, "superadmin")


async def dine_in(client, h, items=None, **kw):
    r = await client.post(f"{API}/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1",
                                                     "items": items or [{"menuItemId": "menu-04", "quantity": 2}], **kw}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


async def deliver(client, h, oid):
    for s in ("PREPARING", "READY", "DELIVERED"):
        r = await client.patch(f"{API}/pos/orders/{oid}/status", json={"status": s}, headers=h)
    return r.json()


@pytest.mark.asyncio
async def test_settle_cash_then_table_billed_and_cleared(client, pos, db_session):
    o = await dine_in(client, pos)
    await deliver(client, pos, o["id"])
    short = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH", "tenderedPaise": 100}, headers=pos)
    assert short.status_code == 422
    r = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH", "tenderedPaise": 100000}, headers=pos)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["status"] == "BILLED" and b["paymentMethod"] == "CASH" and b["paidAt"] and b["tenderedPaise"] == 100000
    t = await db_session.scalar(select(POSTable).where(POSTable.table_id == "tbl-01"))
    await db_session.refresh(t)
    assert t.status == "BILLED"
    assert (await client.patch(f"{API}/pos/tables/tbl-01/status", json={"status": "AVAILABLE"}, headers=pos)).status_code == 200
    assert (await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH"}, headers=pos)).status_code == 409


@pytest.mark.asyncio
async def test_paid_before_delivery_closes_on_delivery_and_split_must_add_up(client, pos):
    o = await dine_in(client, pos)
    bad = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "SPLIT", "split": {"cash": 1, "digital": 1}}, headers=pos)
    assert bad.status_code == 422
    half = o["totalPaise"] // 2
    ok = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "SPLIT", "split": {"cash": half, "digital": o["totalPaise"] - half}}, headers=pos)
    assert ok.json()["status"] == "QUEUED" and ok.json()["paidAt"]
    assert (await deliver(client, pos, o["id"]))["status"] == "BILLED"


@pytest.mark.asyncio
async def test_big_discount_needs_manager_pin(client, pos, auth_headers):
    await client.put(f"{API}/pos/config", json={"managerPin": "4321", "maxDiscountPercentWithoutPin": 10, "gstPercent": 5}, headers=auth_headers)
    o = await dine_in(client, pos)  # 2 x 380 = 760
    body = {"method": "UPI", "discountPaise": 38000}
    assert (await client.post(f"{API}/pos/orders/{o['id']}/settle", json=body, headers=pos)).status_code == 403
    assert (await client.post(f"{API}/pos/orders/{o['id']}/settle", json={**body, "managerPin": "0000"}, headers=pos)).status_code == 403
    r = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={**body, "managerPin": "4321"}, headers=pos)
    assert r.status_code == 200
    assert r.json()["discountPaise"] == 38000 and r.json()["taxPaise"] == 1900 and r.json()["totalPaise"] == 39900
    assert "managerPin" not in (await client.get(f"{API}/pos/config", headers=pos)).text


@pytest.mark.asyncio
async def test_coupons_are_super_admin_only_and_single_use(client, pos, boss, auth_headers):
    c = {"code": "WELCOME10", "kind": "PERCENT", "value": 10, "singleUse": True}
    assert (await client.post(f"{API}/pos/coupons", json=c, headers=auth_headers)).status_code == 403
    assert (await client.post(f"{API}/pos/coupons", json=c, headers=pos)).status_code == 403
    assert (await client.post(f"{API}/pos/coupons", json=c, headers=boss)).status_code == 201
    a, b = await dine_in(client, pos), await dine_in(client, pos)
    r = await client.post(f"{API}/pos/orders/{a['id']}/settle", json={"method": "CARD", "couponCode": "welcome10"}, headers=pos)
    assert r.status_code == 200 and r.json()["discountPaise"] == 7600 and r.json()["couponCode"] == "WELCOME10"
    assert (await client.post(f"{API}/pos/orders/{b['id']}/settle", json={"method": "CARD", "couponCode": "WELCOME10"}, headers=pos)).status_code == 422


@pytest.mark.asyncio
async def test_cash_shift_expected_and_variance(client, pos):
    s = await client.post(f"{API}/pos/shifts/open", json={"openingFloatPaise": 200000}, headers=pos)
    assert s.status_code == 201
    assert (await client.post(f"{API}/pos/shifts/open", json={"openingFloatPaise": 1}, headers=pos)).status_code == 409
    o = await dine_in(client, pos)
    await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH"}, headers=pos)
    active = (await client.get(f"{API}/pos/shifts/active", headers=pos)).json()["shift"]
    assert active["cashSalesPaise"] == o["totalPaise"] and active["expectedCashPaise"] == 200000 + o["totalPaise"]
    closed = (await client.post(f"{API}/pos/shifts/close", json={"closingCashPaise": 200000}, headers=pos)).json()
    assert closed["status"] == "CLOSED" and closed["variancePaise"] == -o["totalPaise"]


@pytest.mark.asyncio
async def test_dine_in_charge_to_room_posts_to_folio(client, pos, db_session):
    f = await db_session.scalar(select(MasterFolio).where(MasterFolio.stay_id == "stay-901"))
    before = f.outstanding_balance_minor
    o = await dine_in(client, pos)
    r = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "ROOM", "roomNumber": "101"}, headers=pos)
    assert r.status_code == 200 and r.json()["stayId"] == "stay-901"
    await db_session.refresh(f)
    assert f.outstanding_balance_minor == before + o["totalPaise"]


@pytest.mark.asyncio
async def test_variants_addons_rush_kot_and_void_reason(client, pos, auth_headers):
    patch = {"variants": [{"name": "Half", "pricePaise": 20000}, {"name": "Full", "pricePaise": 38000, "isDefault": True}],
             "addOns": [{"name": "Extra mint chutney", "pricePaise": 3000}], "tags": ["bestseller"], "kcal": 420, "dietaryType": "veg"}
    m = (await client.patch(f"{API}/pos/menu/menu-04", json=patch, headers=auth_headers)).json()
    half, extra = m["variants"][0]["id"], m["addOns"][0]["id"]
    o = await dine_in(client, pos, items=[{"menuItemId": "menu-04", "quantity": 1, "variantId": half, "addOnIds": [extra], "notes": "less spicy"}], is_rush=True)
    assert o["subtotalPaise"] == 23000 and o["items"][0]["variantName"] == "Half" and o["items"][0]["addOns"] == ["Extra mint chutney"]
    assert o["isRush"] and o["estimatedPrepMinutes"] == 18
    assert (await client.post(f"{API}/pos/orders/{o['id']}/kot", headers=pos)).json()["kotPrintedAt"]
    assert (await client.patch(f"{API}/pos/orders/{o['id']}/priority", json={"isRush": False}, headers=pos)).json()["isRush"] is False
    c = await client.patch(f"{API}/pos/orders/{o['id']}/status", json={"status": "CANCELLED", "reason": "Guest left"}, headers=pos)
    assert c.json()["voidReason"] == "Guest left"


@pytest.mark.asyncio
async def test_gst_is_configurable(client, pos, auth_headers):
    await client.put(f"{API}/pos/config", json={"gstPercent": 18}, headers=auth_headers)
    o = await dine_in(client, pos)
    assert o["taxPercent"] == 18 and o["taxPaise"] == 13680


@pytest.mark.asyncio
async def test_orders_list_supports_etag(client, pos):
    r = await client.get(f"{API}/pos/orders", headers=pos)
    tag = r.headers["etag"]
    assert (await client.get(f"{API}/pos/orders", headers={**pos, "If-None-Match": tag})).status_code == 304
    await dine_in(client, pos)
    assert (await client.get(f"{API}/pos/orders", headers={**pos, "If-None-Match": tag})).status_code == 200


@pytest.mark.asyncio
async def test_categories_and_menu_import_export(client, auth_headers):
    cats = (await client.get(f"{API}/pos/categories", headers=auth_headers)).json()
    starters = next(c for c in cats if c["name"] == "STARTERS")
    assert (await client.patch(f"{API}/pos/categories/{starters['id']}", json={"name": "Small plates"}, headers=auth_headers)).json()["name"] == "SMALL PLATES"
    menu = (await client.get(f"{API}/pos/menu", headers=auth_headers)).json()
    assert any(m["category"] == "SMALL PLATES" for m in menu) and not any(m["category"] == "STARTERS" for m in menu)
    assert (await client.delete(f"{API}/pos/categories/{starters['id']}", headers=auth_headers)).status_code == 409
    ids = [c["id"] for c in reversed(cats)]
    assert (await client.put(f"{API}/pos/categories/reorder", json={"ids": ids}, headers=auth_headers)).json()[0]["id"] == ids[0]
    exported = (await client.get(f"{API}/pos/menu/export", headers=auth_headers)).json()
    assert sum(len(c["items"]) for c in exported["categories"]) == len(menu)
    payload = {"categories": [{"name": "Pizzas", "items": [{"name": "Margherita", "price": 349, "originalPrice": 399, "prepStation": "bakery",
                                                            "variants": [{"label": "Large", "price": 499}], "addOns": [{"name": "Cheese", "price": 60}]}]}]}
    assert (await client.post(f"{API}/pos/menu/import", json=payload, headers=auth_headers)).json() == {"created": 1, "updated": 0}
    pizza = next(m for m in (await client.get(f"{API}/pos/menu", headers=auth_headers)).json() if m["name"] == "Margherita")
    assert pizza["pricePaise"] == 34900 and pizza["originalPricePaise"] == 39900 and pizza["station"] == "MAIN_KITCHEN" and pizza["variants"][0]["pricePaise"] == 49900


@pytest.mark.asyncio
async def test_table_admin_and_qr_reset(client, pos, auth_headers):
    sec = (await client.post(f"{API}/pos/sections", json={"name": "Garden"}, headers=auth_headers)).json()
    assert (await client.post(f"{API}/pos/tables", json={"tableNumber": "g1", "capacity": 6, "sectionId": sec["id"]}, headers=auth_headers)).status_code == 201
    assert (await client.post(f"{API}/pos/tables", json={"tableNumber": "G1"}, headers=auth_headers)).status_code == 409
    assert (await client.post(f"{API}/pos/tables", json={"tableNumber": "G2"}, headers=pos)).status_code == 403
    tables = (await client.get(f"{API}/pos/tables", headers=pos)).json()
    g1 = next(t for t in tables if t["tableNumber"] == "G1")
    assert g1["sectionId"] == sec["id"] and g1["capacity"] == 6 and all(t["qrToken"] for t in tables)
    new = (await client.post(f"{API}/pos/tables/{g1['id']}/qr", headers=auth_headers)).json()["qrToken"]
    assert new != g1["qrToken"]
    assert (await client.post(f"{API}/guest/session/exchange", json={"token": g1["qrToken"]})).status_code == 404
    assert (await client.delete(f"{API}/pos/tables/{g1['id']}", headers=auth_headers)).status_code == 204
    assert not any(t["id"] == g1["id"] for t in (await client.get(f"{API}/pos/tables", headers=pos)).json())


async def guest_table(client, pos):
    tok = next(t for t in (await client.get(f"{API}/pos/tables", headers=pos)).json() if t["tableNumber"] == "T2")["qrToken"]
    s = await client.post(f"{API}/guest/session/exchange", json={"token": tok})
    assert s.status_code == 200, s.text
    return {"X-Dining-Session": s.json()["sessionId"]}, s.json()


@pytest.mark.asyncio
async def test_guest_table_order_counter_code_tracking_review_spin(client, pos):
    h, info = await guest_table(client, pos)
    assert info["tableLabel"] == "Table T2" and info["cartKey"]
    menu = (await client.get(f"{API}/guest/menu", headers=h)).json()
    assert menu["items"] and menu["categories"] and isinstance(menu["items"][0]["price"], float)
    q = (await client.post(f"{API}/guest/quote", json={"lines": [{"itemId": "menu-10", "qty": 2}]}, headers=h)).json()
    assert q == {"subtotal": 240.0, "discount": 0.0, "tax": 12.0, "total": 252.0}
    assert (await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter"})).status_code == 404
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 2}], "payment": "counter", "customerName": "Asha"}, headers=h)
    assert r.status_code == 201, r.text
    placed = r.json()
    assert len(placed["counterToken"]) == 6 and placed["status"] == "placed"
    t = await client.get(f"{API}/guest/orders/{placed['trackingToken']}")
    assert t.json()["status"] == "placed" and t.json()["counterToken"] == placed["counterToken"] and t.json()["estimatedReadyTime"]
    assert (await client.get(f"{API}/guest/orders/{placed['trackingToken']}", headers={"If-None-Match": t.headers["etag"]})).status_code == 304
    found = (await client.post(f"{API}/pos/orders/counter-code", json={"code": placed["counterToken"]}, headers=pos)).json()
    assert found["orderNumber"] == placed["displayNumber"] and found["source"] == "TABLE_QR" and found["guestName"] == "Asha"
    assert found["status"] == "PENDING_ACCEPTANCE"  # guest orders wait for staff to accept them
    assert (await client.post(f"{API}/pos/orders/{found['id']}/accept", headers=pos)).json()["status"] == "QUEUED"
    await deliver(client, pos, found["id"])
    await client.post(f"{API}/pos/orders/{found['id']}/settle", json={"method": "UPI"}, headers=pos)
    assert (await client.post(f"{API}/pos/orders/counter-code", json={"code": placed["counterToken"]}, headers=pos)).status_code == 404
    tk = placed["trackingToken"]
    assert (await client.post(f"{API}/guest/orders/{tk}/spin")).status_code == 403  # review first
    assert (await client.post(f"{API}/guest/orders/{tk}/review", json={"rating": 4, "comment": "Lovely chai"})).status_code == 200
    assert (await client.post(f"{API}/guest/orders/{tk}/review", json={"rating": 4})).status_code == 409
    spin = await client.post(f"{API}/guest/orders/{tk}/spin")
    assert spin.status_code == 200 and "prize" in spin.json()
    assert (await client.post(f"{API}/guest/orders/{tk}/spin")).status_code == 409


@pytest.mark.asyncio
async def test_guest_room_card_session_charges_folio_and_rotation_revokes(client, pos, db_session):
    stay = await db_session.scalar(select(Stay).where(Stay.stay_id == "stay-901"))
    old = stay.qr_access_token
    s = await client.post(f"{API}/guest/session/exchange", json={"token": old})
    assert s.json()["tableLabel"] == "Room 101" and s.json()["kind"] == "ROOM"
    h = {"X-Dining-Session": s.json()["sessionId"]}
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter"}, headers=h)
    assert r.status_code == 201 and r.json()["counterToken"] is None
    assert (await client.get(f"{API}/guest/orders/{r.json()['trackingToken']}")).json()["paymentMethod"] == "room"
    new = (await client.post(f"{API}/pos/room-qr/stay-901/rotate", headers=pos)).json()["token"]
    assert new != old
    assert (await client.get(f"{API}/guest/menu", headers=h)).status_code == 404
    assert (await client.post(f"{API}/guest/session/exchange", json={"token": new})).status_code == 200


@pytest.mark.asyncio
async def test_table_reservations_and_clash(client, pos, db_session):
    body = {"guestName": "Mehta family", "partySize": 5, "reservedFor": "2030-01-10T19:00:00+00:00", "tableId": "tbl-04"}
    a = await client.post(f"{API}/pos/reservations", json=body, headers=pos)
    assert a.status_code == 201 and a.json()["tableNumber"] == "T4"
    clash = await client.post(f"{API}/pos/reservations", json={**body, "guestName": "Rao", "reservedFor": "2030-01-10T20:00:00+00:00"}, headers=pos)
    assert clash.status_code == 409
    assert len((await client.get(f"{API}/pos/reservations?day=2030-01-10", headers=pos)).json()) == 1
    seated = await client.patch(f"{API}/pos/reservations/{a.json()['id']}", json={"status": "SEATED"}, headers=pos)
    assert seated.json()["status"] == "SEATED"
    t = await db_session.scalar(select(POSTable).where(POSTable.table_id == "tbl-04"))
    await db_session.refresh(t)
    assert t.status == "SEATED" and t.seated_at


# ── guest online payment ─────────────────────────────────────────────────────
import hashlib  # noqa: E402
import hmac  # noqa: E402
import json  # noqa: E402

from backend.app.services.payment_providers.base import PaymentResult  # noqa: E402
from backend.app.services.payment_providers.razorpay_provider import RazorpayPaymentProvider  # noqa: E402

LINE = {"lines": [{"itemId": "menu-10", "qty": 2}], "payment": "online"}


@pytest.fixture
def razorpay(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "razorpay")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "whsec")

    async def fake_initiate(self, req):
        return PaymentResult(status="PENDING", provider="RAZORPAY", transaction_ref="t", receipt_number="r",
                             amount_minor=req.amount_minor, provider_order_id=f"order_{req.folio_id[:8]}")
    monkeypatch.setattr(RazorpayPaymentProvider, "initiate_payment", fake_initiate)


def sign(order_id, payment_id):
    return hmac.new(b"secret", f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_online_payment_demo_mode_pays_immediately(client, pos):
    h, info = await guest_table(client, pos)
    assert info["restaurant"]["features"]["onlinePayment"] is True
    assert (await client.get(f"{API}/guest/menu", headers=h)).json()["onlinePaymentEnabled"] is True
    r = (await client.post(f"{API}/guest/orders", json=LINE, headers=h)).json()
    assert "razorpay" not in r and r["status"] == "placed"
    t = (await client.get(f"{API}/guest/orders/{r['trackingToken']}")).json()
    assert t["payment"] == "online" and t["paymentMethod"] == "online" and t["counterToken"] is None
    pending = (await client.get(f"{API}/pos/orders/pending", headers=pos)).json()
    o = next(o for o in pending if o["orderNumber"] == r["displayNumber"])
    assert o["paidAt"] and not any(b["orderNumber"] == r["displayNumber"] for b in (await client.get(f"{API}/pos/orders", headers=pos)).json())
    await client.post(f"{API}/pos/orders/{o['id']}/accept", headers=pos)
    board = (await client.get(f"{API}/pos/orders", headers=pos)).json()
    assert any(o["orderNumber"] == r["displayNumber"] and o["paidAt"] for o in board)


@pytest.mark.asyncio
async def test_online_payment_razorpay_waits_then_verifies(client, pos, razorpay):
    h, _ = await guest_table(client, pos)
    r = (await client.post(f"{API}/guest/orders", json=LINE, headers=h)).json()
    rz = r["razorpay"]
    assert r["status"] == "awaiting_payment" and rz["keyId"] == "rzp_test_key" and rz["amount"] == 25200
    assert not any(o["orderNumber"] == r["displayNumber"] for o in (await client.get(f"{API}/pos/orders", headers=pos)).json())  # not cooking yet
    bad = {"orderId": r["orderId"], "razorpayOrderId": rz["orderId"], "razorpayPaymentId": "pay_1", "razorpaySignature": "nope"}
    assert (await client.post(f"{API}/guest/payments/razorpay/verify", json=bad)).status_code == 422
    ok = {**bad, "razorpaySignature": sign(rz["orderId"], "pay_1")}
    v = await client.post(f"{API}/guest/payments/razorpay/verify", json=ok)
    assert v.status_code == 200 and v.json()["status"] == "placed"
    waiting = next(o for o in (await client.get(f"{API}/pos/orders/pending", headers=pos)).json() if o["orderNumber"] == r["displayNumber"])
    await client.post(f"{API}/pos/orders/{waiting['id']}/accept", headers=pos)
    board = (await client.get(f"{API}/pos/orders", headers=pos)).json()
    o = next(o for o in board if o["orderNumber"] == r["displayNumber"])
    assert o["status"] == "QUEUED" and o["paymentMethod"] == "ONLINE" and o["paidAt"]
    assert (await client.post(f"{API}/guest/orders/{r['trackingToken']}/razorpay-init")).json()["alreadyPaid"] is True


@pytest.mark.asyncio
async def test_online_payment_webhook_and_counter_fallback(client, pos, razorpay):
    h, _ = await guest_table(client, pos)
    a = (await client.post(f"{API}/guest/orders", json=LINE, headers=h)).json()
    retry = (await client.post(f"{API}/guest/orders/{a['trackingToken']}/razorpay-init")).json()
    assert retry["razorpay"]["orderId"]
    event = {"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_9", "order_id": retry["razorpay"]["orderId"], "amount": 25200}}}}
    raw = json.dumps(event).encode()
    assert (await client.post(f"{API}/guest/payments/razorpay/webhook", content=raw, headers={"X-Razorpay-Signature": "x"})).status_code == 403
    sig = hmac.new(b"whsec", raw, hashlib.sha256).hexdigest()
    assert (await client.post(f"{API}/guest/payments/razorpay/webhook", content=raw, headers={"X-Razorpay-Signature": sig})).json() == {"ok": True}
    assert (await client.get(f"{API}/guest/orders/{a['trackingToken']}")).json()["status"] == "placed"
    # guest chose online but walks to the counter instead
    b = (await client.post(f"{API}/guest/orders", json=LINE, headers=h)).json()
    found = (await client.post(f"{API}/pos/orders/counter-code", json={"code": b["counterToken"]}, headers=pos)).json()
    assert found["status"] == "AWAITING_PAYMENT"
    s = (await client.post(f"{API}/pos/orders/{found['id']}/settle", json={"method": "CASH"}, headers=pos)).json()
    assert s["status"] == "QUEUED" and s["paymentMethod"] == "CASH"


@pytest.mark.asyncio
async def test_online_payment_off_and_never_for_rooms(client, pos, auth_headers, db_session, monkeypatch):
    stay = await db_session.scalar(select(Stay).where(Stay.stay_id == "stay-901"))
    room = (await client.post(f"{API}/guest/session/exchange", json={"token": stay.qr_access_token})).json()
    assert room["restaurant"]["features"]["onlinePayment"] is False
    r = await client.post(f"{API}/guest/orders", json=LINE, headers={"X-Dining-Session": room["sessionId"]})
    assert r.status_code == 201 and "razorpay" not in r.json()  # room orders still go on the folio
    await client.put(f"{API}/pos/config", json={"onlinePayment": False}, headers=auth_headers)
    h, info = await guest_table(client, pos)
    assert info["restaurant"]["features"]["onlinePayment"] is False
    assert (await client.post(f"{API}/guest/orders", json=LINE, headers=h)).status_code == 422
    monkeypatch.setattr(settings, "APP_ENV", "production")  # demo gateway never pays for real guests
    await client.put(f"{API}/pos/config", json={"onlinePayment": True}, headers=auth_headers)
    assert (await client.post(f"{API}/guest/orders", json=LINE, headers=h)).status_code == 422
