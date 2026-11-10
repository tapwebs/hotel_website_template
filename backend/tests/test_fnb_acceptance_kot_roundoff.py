"""Guest-order acceptance, one-time KOT claim, bill round-off and who may discount or cancel."""
import pytest
import pytest_asyncio
from backend.app.core import ratelimit
from backend.app.core.config import settings
from backend.app.services import fnb_config
from backend.app.services.pos_service import round_total

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
async def captain(client):
    return await login(client, "rohan")


@pytest_asyncio.fixture
async def waiter(client):
    return await login(client, "vikram")


async def guest_order(client, h):
    tok = next(t for t in (await client.get(f"{API}/pos/tables", headers=h)).json() if t["tableNumber"] == "T3")["qrToken"]
    s = (await client.post(f"{API}/guest/session/exchange", json={"token": tok})).json()
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter"},
                          headers={"X-Dining-Session": s["sessionId"]})
    assert r.status_code == 201, r.text
    return next(o for o in (await client.get(f"{API}/pos/orders/pending", headers=h)).json() if o["orderNumber"] == r.json()["displayNumber"])


def test_round_total():
    assert round_total(25249, True) == (25200, -49)
    assert round_total(25250, True) == (25300, 50)
    assert round_total(25200, True) == (25200, 0)
    assert round_total(25249, False) == (25249, 0)


@pytest.mark.asyncio
async def test_guest_order_waits_for_acceptance_and_only_one_accept_wins(client, captain, waiter):
    o = await guest_order(client, waiter)
    assert o["status"] == "PENDING_ACCEPTANCE" and o["acceptedAt"] is None
    board = (await client.get(f"{API}/pos/orders", headers=captain)).json()
    assert not any(b["id"] == o["id"] for b in board)  # the kitchen does not see it yet
    # a plain status change cannot skip acceptance
    assert (await client.patch(f"{API}/pos/orders/{o['id']}/status", json={"status": "QUEUED"}, headers=captain)).status_code in (409, 422)
    ok = await client.post(f"{API}/pos/orders/{o['id']}/accept", headers=waiter)  # waiters may accept
    assert ok.status_code == 200 and ok.json()["status"] == "QUEUED" and ok.json()["acceptedBy"] == "Vikram Seth"
    again = await client.post(f"{API}/pos/orders/{o['id']}/accept", headers=captain)
    assert again.status_code == 409
    assert any(b["id"] == o["id"] for b in (await client.get(f"{API}/pos/orders", headers=captain)).json())
    assert not any(p["id"] == o["id"] for p in (await client.get(f"{API}/pos/orders/pending", headers=captain)).json())


@pytest.mark.asyncio
async def test_rejecting_a_guest_order_needs_a_captain(client, captain, waiter):
    o = await guest_order(client, waiter)
    url = f"{API}/pos/orders/{o['id']}/status"
    assert (await client.patch(url, json={"status": "CANCELLED", "reason": "Kitchen closed"}, headers=waiter)).status_code == 403
    r = await client.patch(url, json={"status": "CANCELLED", "reason": "Kitchen closed"}, headers=captain)
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    assert (await client.post(f"{API}/pos/orders/{o['id']}/accept", headers=captain)).status_code == 409


@pytest.mark.asyncio
async def test_acceptance_can_be_switched_off(client, captain, auth_headers):
    assert (await client.put(f"{API}/pos/config", json={"guestOrderAcceptance": False}, headers=auth_headers)).status_code == 200
    tok = next(t for t in (await client.get(f"{API}/pos/tables", headers=captain)).json() if t["tableNumber"] == "T3")["qrToken"]
    s = (await client.post(f"{API}/guest/session/exchange", json={"token": tok})).json()
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter"},
                          headers={"X-Dining-Session": s["sessionId"]})
    assert any(b["orderNumber"] == r.json()["displayNumber"] for b in (await client.get(f"{API}/pos/orders", headers=captain)).json())


@pytest.mark.asyncio
async def test_kot_is_claimed_once_and_can_be_released(client, captain):
    o = (await client.post(f"{API}/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1",
                                                       "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=captain)).json()
    claim = lambda: client.post(f"{API}/pos/orders/{o['id']}/kot/claim", headers=captain)
    assert (await claim()).json() == {"claimed": True, "fromSeq": 0, "toSeq": 1}
    assert (await claim()).json()["claimed"] is False  # a second kitchen screen must not print it again
    assert (await client.post(f"{API}/pos/orders/{o['id']}/kot/release?fromSeq=0&toSeq=1", headers=captain)).status_code == 204
    assert (await claim()).json()["claimed"] is True


@pytest.mark.asyncio
async def test_round_off_applies_to_counter_bills_not_room_charges(client, captain, auth_headers):
    await client.put(f"{API}/pos/config", json={"roundOffTotal": True}, headers=auth_headers)
    # menu-10 at 1 x 120.00 + 5% = 126.00 -> no rounding; 3 x menu-04 (380) = 1140 + 57 = 1197.00; use a mix with paise
    o = (await client.post(f"{API}/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1",
                                                       "items": [{"menuItemId": "menu-04", "quantity": 1}, {"menuItemId": "menu-10", "quantity": 1}]},
                           headers=captain)).json()
    raw = o["subtotalPaise"] + o["taxPaise"]
    assert o["totalPaise"] % 100 == 0 and o["totalPaise"] - raw == o["roundOffPaise"] and abs(o["roundOffPaise"]) <= 50
    room = (await client.post(f"{API}/pos/orders", json={"order_type": "ROOM_SERVICE", "room_number": "101",
                                                          "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=captain)).json()
    assert room["roundOffPaise"] == 0 and room["totalPaise"] == room["subtotalPaise"] + room["taxPaise"]


@pytest.mark.asyncio
async def test_waiter_needs_the_pin_for_any_discount_captain_up_to_the_limit(client, captain, waiter, auth_headers):
    await client.put(f"{API}/pos/config", json={"managerPin": "4321", "maxDiscountPercentWithoutPin": 10}, headers=auth_headers)

    async def bill(h):
        o = (await client.post(f"{API}/pos/orders", json={"order_type": "TAKEAWAY", "items": [{"menuItemId": "menu-04", "quantity": 1}]},
                               headers=h)).json()
        return o["id"], o["subtotalPaise"]

    oid, sub = await bill(waiter)
    small = {"method": "CASH", "discountPaise": sub // 20}  # 5%
    assert (await client.post(f"{API}/pos/orders/{oid}/settle", json=small, headers=waiter)).status_code == 403
    assert (await client.post(f"{API}/pos/orders/{oid}/settle", json={**small, "managerPin": "4321"}, headers=waiter)).status_code == 200

    oid, sub = await bill(captain)
    assert (await client.post(f"{API}/pos/orders/{oid}/settle", json={"method": "CASH", "discountPaise": sub // 20}, headers=captain)).status_code == 200
    oid, sub = await bill(captain)
    big = {"method": "CASH", "discountPaise": sub // 4}  # 25%
    assert (await client.post(f"{API}/pos/orders/{oid}/settle", json=big, headers=captain)).status_code == 403
    assert (await client.post(f"{API}/pos/orders/{oid}/settle", json=big, headers=auth_headers)).status_code == 200  # admin


@pytest.mark.asyncio
async def test_room_invoice_rounds_when_hotel_setting_is_on(client, auth_headers, db_session):
    from sqlalchemy import select
    from backend.app.models.folio import MasterFolio
    f = await db_session.scalar(select(MasterFolio).where(MasterFolio.stay_id == "stay-901"))
    off = (await client.get(f"{API}/folios/{f.folio_id}/invoice", headers=auth_headers)).json()
    assert off["roundOffPaise"] == 0 and off["amountPayablePaise"] == off["totalInvoicePaise"]
    await client.put(f"{API}/settings", json={"settings": {"invoice": {"roundOffTotals": True}}}, headers=auth_headers)
    on = (await client.get(f"{API}/folios/{f.folio_id}/invoice", headers=auth_headers)).json()
    assert on["amountPayablePaise"] % 100 == 0
    assert on["amountPayablePaise"] - on["totalInvoicePaise"] == on["roundOffPaise"] and abs(on["roundOffPaise"]) <= 50


@pytest.mark.asyncio
async def test_public_branding_serves_only_safe_favicon_links(client, auth_headers):
    assert (await client.get(f"{API}/settings/public/branding")).status_code == 200  # no login needed
    await client.put(f"{API}/settings", json={"settings": {"branding": {"faviconUrl": "/brand/icon.png"}}}, headers=auth_headers)
    assert (await client.get(f"{API}/settings/public/branding")).json()["faviconUrl"] == "/brand/icon.png"
    await client.put(f"{API}/settings", json={"settings": {"branding": {"faviconUrl": "javascript:alert(1)"}}}, headers=auth_headers)
    assert (await client.get(f"{API}/settings/public/branding")).json()["faviconUrl"] == ""
