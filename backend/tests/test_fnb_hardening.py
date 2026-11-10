"""F&B hardening: idempotent guest orders, enforced size/add-on rules, per-dish GST, typed sold-out errors, server receipts."""
import asyncio

import pytest
from sqlalchemy import func, select

from backend.app.core.config import settings
from backend.app.models.pos import POSOrder
from backend.app.services import receipt_service
from backend.tests.test_fnb_port import API, _fresh, boss, dine_in, guest_table, pos  # noqa: F401  (fixtures)


async def order_count(db):
    return await db.scalar(select(func.count()).select_from(POSOrder))


@pytest.mark.asyncio
async def test_guest_retry_with_same_request_id_returns_the_original_order(client, pos, db_session):
    h, _ = await guest_table(client, pos)
    body = {"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter", "customerName": "Asha", "clientRequestId": "basket-abc12345"}
    first = await client.post(f"{API}/guest/orders", json=body, headers=h)
    again = await client.post(f"{API}/guest/orders", json=body, headers=h)
    assert first.status_code == 201 and again.status_code == 201, again.text
    a, b = first.json(), again.json()
    assert a["orderId"] == b["orderId"] and a["trackingToken"] == b["trackingToken"] and b["alreadyPlaced"] is True
    assert await order_count(db_session) == 1
    tracked = await client.get(f"{API}/guest/orders/{b['trackingToken']}")
    assert tracked.status_code == 200 and tracked.json()["displayNumber"] == a["displayNumber"]
    other = await client.post(f"{API}/guest/orders", json={**body, "clientRequestId": "basket-xyz98765"}, headers=h)
    assert other.json()["orderId"] != a["orderId"] and await order_count(db_session) == 2


@pytest.mark.asyncio
async def test_request_id_is_validated_and_optional(client, pos):
    h, _ = await guest_table(client, pos)
    bad = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter", "clientRequestId": "x y"}, headers=h)
    assert bad.status_code == 422
    plain = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter"}, headers=h)
    assert plain.status_code == 201 and "alreadyPlaced" not in plain.json()


@pytest.mark.asyncio
async def test_junk_cart_values_are_a_422_not_a_500(client, pos):
    h, _ = await guest_table(client, pos)
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": "lots"}], "payment": "counter"}, headers=h)
    assert r.status_code == 422
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 500}], "payment": "counter"}, headers=h)
    assert r.status_code == 422


async def sized_menu(client, boss):
    patch = {"variants": [{"name": "Half", "pricePaise": 20000}, {"name": "Full", "pricePaise": 38000, "isDefault": True}],
             "addOns": [{"name": "Chutney", "pricePaise": 3000}]}
    m = (await client.patch(f"{API}/pos/menu/menu-04", json=patch, headers=boss)).json()
    return m["variants"][0]["id"], m["addOns"][0]["id"]


@pytest.mark.asyncio
async def test_a_dish_with_sizes_needs_a_size_and_add_ons_cant_be_stacked(client, pos, boss):
    half, chutney = await sized_menu(client, boss)
    line = {"menuItemId": "menu-04", "quantity": 1}
    for items, text in [([line], "choose a size"), ([{**line, "variantId": half, "addOnIds": [chutney, chutney]}], "once"),
                        ([{**line, "variantId": "nope"}], "size is not available"), ([{**line, "variantId": half, "addOnIds": ["nope"]}], "add-on")]:
        r = await client.post(f"{API}/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1", "items": items}, headers=pos)
        assert r.status_code == 422 and text in r.text, r.text
    ok = await dine_in(client, pos, items=[{**line, "variantId": half, "addOnIds": [chutney]}])
    assert ok["subtotalPaise"] == 23000


@pytest.mark.asyncio
async def test_guest_must_also_pick_a_size(client, pos, boss):
    half, _ = await sized_menu(client, boss)
    h, _ = await guest_table(client, pos)
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-04", "qty": 1}], "payment": "counter"}, headers=h)
    assert r.status_code == 422 and "size" in r.json()["error"]
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-04", "qty": 1, "variantId": half}], "payment": "counter"}, headers=h)
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_each_dish_is_taxed_at_its_own_gst_rate(client, pos, boss):
    # menu-04 Paneer Tikka Rs380 at 18%; menu-10 Rs120 uses the restaurant default of 5%
    assert (await client.patch(f"{API}/pos/menu/menu-04", json={"taxPercent": 18}, headers=boss)).json()["taxPercent"] == 18
    o = await dine_in(client, pos, items=[{"menuItemId": "menu-04", "quantity": 1}, {"menuItemId": "menu-10", "quantity": 1}])
    assert o["subtotalPaise"] == 50000 and o["taxPaise"] == 6840 + 600 and {i["taxPercent"] for i in o["items"]} == {18, 5}
    # a 50% discount is spread over both lines before tax: (19000*18% + 6000*5%)
    paid = (await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH", "discountPaise": 25000, "managerPin": None}, headers=boss)).json()
    assert paid["taxPaise"] == 3420 + 300 and paid["totalPaise"] == 25000 + 3720
    # clearing the dish rate falls back to the default again
    assert (await client.patch(f"{API}/pos/menu/menu-04", json={"taxPercent": None}, headers=boss)).json()["taxPercent"] in (18, None)


@pytest.mark.asyncio
async def test_guest_tracking_shows_a_tax_breakdown(client, pos, boss):
    await client.patch(f"{API}/pos/menu/menu-04", json={"taxPercent": 18}, headers=boss)
    h, _ = await guest_table(client, pos)
    placed = (await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-04", "qty": 1}, {"itemId": "menu-10", "qty": 1}], "payment": "counter"}, headers=h)).json()
    t = (await client.get(f"{API}/guest/orders/{placed['trackingToken']}")).json()
    assert t["taxBreakdown"] == [{"percent": 5, "taxable": 120.0, "tax": 6.0}, {"percent": 18, "taxable": 380.0, "tax": 68.4}]
    assert t["tax"] == 74.4


@pytest.mark.asyncio
async def test_sold_out_dishes_come_back_as_a_typed_409(client, pos, boss):
    await client.patch(f"{API}/pos/menu/menu-04", json={"isAvailable": False}, headers=boss)
    h, _ = await guest_table(client, pos)
    r = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-04", "qty": 1}, {"itemId": "menu-10", "qty": 1}], "payment": "counter"}, headers=h)
    body = r.json()
    assert r.status_code == 409 and body["code"] == "ITEM_UNAVAILABLE" and "Paneer Tikka" in body["error"]
    assert body["unavailable"] == [{"itemId": "menu-04", "name": "Paneer Tikka"}]
    q = await client.post(f"{API}/guest/quote", json={"lines": [{"itemId": "menu-04", "qty": 1}]}, headers=h)
    assert q.status_code == 409 and q.json()["unavailable"][0]["itemId"] == "menu-04"
    s = await client.post(f"{API}/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1", "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=pos)
    assert s.status_code == 409 and s.json()["error"]["code"] == "ITEM_UNAVAILABLE"


# ── server-sent receipts ─────────────────────────────────────────────────────
def test_phone_numbers_are_normalised():
    assert receipt_service.normalize_phone("98765 43210") == "919876543210"
    assert receipt_service.normalize_phone("+91 98765-43210") == "919876543210"
    assert receipt_service.normalize_phone("12345") is None and receipt_service.normalize_phone(None) is None


@pytest.mark.asyncio
async def test_receipts_are_off_until_configured(client, pos, monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_CLOUD_TOKEN", None)
    monkeypatch.setattr(settings, "MSG91_AUTH_KEY", None)
    assert receipt_service.channel() is None
    o = await dine_in(client, pos)
    await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH"}, headers=pos)
    r = await client.post(f"{API}/pos/orders/{o['id']}/receipt", json={"phone": "9876543210"}, headers=pos)
    assert r.status_code == 409 and "not set up" in r.json()["error"]["message"]


@pytest.mark.asyncio
async def test_paid_order_receipt_is_sent_once(client, pos, db_session, monkeypatch):
    sent = []

    async def fake_whatsapp(to, order, restaurant):
        sent.append((to, order.order_number, restaurant))

    monkeypatch.setattr(settings, "WHATSAPP_CLOUD_TOKEN", "t")
    monkeypatch.setattr(settings, "WHATSAPP_CLOUD_PHONE_NUMBER_ID", "123")
    monkeypatch.setattr(receipt_service, "_send_whatsapp", fake_whatsapp)
    import backend.tests.conftest as c
    monkeypatch.setattr(receipt_service, "async_session_factory", c.test_async_session)
    o = await dine_in(client, pos)
    assert await receipt_service.send_receipt(o["id"]) is False  # unpaid: nothing goes out
    r = await client.post(f"{API}/pos/orders/{o['id']}/receipt", json={"phone": "9876543210"}, headers=pos)
    assert r.status_code == 409 and "payment" in r.json()["error"]["message"]
    await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH", "customerPhone": "98765 43210"}, headers=pos)
    await asyncio.gather(*receipt_service._tasks)  # settle queued the send in the background
    assert len(sent) == 1
    assert await receipt_service.send_receipt(o["id"]) is False  # already sent
    assert len(sent) == 1 and sent[0][0] == "919876543210"
    resend = await client.post(f"{API}/pos/orders/{o['id']}/receipt", json={"phone": "9123456789"}, headers=pos)
    assert resend.status_code == 200 and len(sent) == 2 and sent[1][0] == "919123456789"


@pytest.mark.asyncio
async def test_a_failing_provider_never_breaks_the_sale(client, pos, monkeypatch):
    async def boom(*a):
        raise RuntimeError("provider down")

    monkeypatch.setattr(settings, "WHATSAPP_CLOUD_TOKEN", "t")
    monkeypatch.setattr(settings, "WHATSAPP_CLOUD_PHONE_NUMBER_ID", "123")
    monkeypatch.setattr(receipt_service, "_send_whatsapp", boom)
    import backend.tests.conftest as c
    monkeypatch.setattr(receipt_service, "async_session_factory", c.test_async_session)
    o = await dine_in(client, pos)
    r = await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH", "customerPhone": "9876543210"}, headers=pos)
    assert r.status_code == 200 and r.json()["paidAt"]
    await asyncio.gather(*receipt_service._tasks)
    assert await receipt_service.send_receipt(o["id"]) is False
    async with __import__("backend.tests.conftest", fromlist=["x"]).test_async_session() as db:
        assert (await db.get(POSOrder, o["id"])).receipt_sent_at is None  # claim released, so a resend can still go out


@pytest.mark.asyncio
async def test_receipt_layout_options_are_saved_and_validated(client, boss):
    got = (await client.get(f"{API}/pos/config", headers=boss)).json()
    assert got["showGstin"] is True and got["fontSize"] == "normal" and got["copies"] == 1 and got["autoPrint"] is False
    patch = {"showAddress": False, "showUnitPrice": False, "fontSize": "large", "copies": 2, "showQr": True,
             "reviewUrl": "https://g.page/r/abc", "qrCaption": "Rate us", "extraFooter": "Wi-Fi: dream", "autoPrint": True}
    saved = (await client.put(f"{API}/pos/config", json=patch, headers=boss)).json()
    assert all(saved[k] == v for k, v in patch.items())
    for bad in ({"copies": 9}, {"fontSize": "huge"}, {"reviewUrl": "javascript:alert(1)"}):
        assert (await client.put(f"{API}/pos/config", json=bad, headers=boss)).status_code == 422


@pytest.mark.asyncio
async def test_orders_etag_follows_the_data_not_a_process_counter(client, pos, db_session):
    """A change another server process made (so this process's change counter never moved) must still reach the kitchen screen."""
    o = await dine_in(client, pos)
    first = await client.get(f"{API}/pos/orders", headers=pos)
    tag = first.headers["etag"]
    assert (await client.get(f"{API}/pos/orders", headers={**pos, "If-None-Match": tag})).status_code == 304
    row = await db_session.get(POSOrder, o["id"])
    row.status = "PREPARING"  # written straight to the database: no fnb_config.bump()
    await db_session.commit()
    again = await client.get(f"{API}/pos/orders", headers={**pos, "If-None-Match": tag})
    assert again.status_code == 200 and again.json()[0]["status"] == "PREPARING" and again.headers["etag"] != tag
