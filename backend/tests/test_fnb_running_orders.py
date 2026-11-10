"""Running orders: add dishes after the KOT, cancel one dish, move to another table."""
import pytest
import pytest_asyncio
from sqlalchemy import select
from backend.app.core import ratelimit
from backend.app.core.config import settings
from backend.app.models.folio import MasterFolio
from backend.app.models.pos import POSTable
from backend.app.services import fnb_config

API = settings.API_V1_PREFIX
PID = settings.DEFAULT_PROPERTY_ID


@pytest.fixture(autouse=True)
def _fresh():
    ratelimit.reset()
    fnb_config.reset_cache()


async def login(client, user):
    r = await client.post(f"{API}/auth/login", json={"username_or_email": user, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}", "X-Property-Id": PID}


@pytest_asyncio.fixture
async def captain(client):
    return await login(client, "rohan")


@pytest_asyncio.fixture
async def waiter(client):
    return await login(client, "vikram")


async def dine_in(client, h, table="T1", items=None):
    r = await client.post(f"{API}/pos/orders", json={"order_type": "DINE_IN", "table_number": table,
                                                      "items": items or [{"menuItemId": "menu-04", "quantity": 2}]}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_added_dishes_form_a_new_kot_round(client, captain, waiter):
    o = await dine_in(client, waiter)
    claim = lambda: client.post(f"{API}/pos/orders/{o['id']}/kot/claim", headers=captain)
    assert (await claim()).json() == {"claimed": True, "fromSeq": 0, "toSeq": 1}
    for s in ("PREPARING", "READY"):
        await client.patch(f"{API}/pos/orders/{o['id']}/status", json={"status": s}, headers=captain)
    r = await client.post(f"{API}/pos/orders/{o['id']}/items", json={"items": [{"menuItemId": "menu-10", "quantity": 1}], "notes": "with lemon"},
                          headers=waiter)  # waiters may add dishes
    assert r.status_code == 200, r.text
    up = r.json()
    assert up["kotSeq"] == 2 and up["status"] == "QUEUED"  # back on the kitchen board
    assert [i["seq"] for i in up["items"]] == [1, 2] and all(i["lineId"] for i in up["items"])
    assert up["subtotalPaise"] == o["subtotalPaise"] + 12000 and up["totalPaise"] > o["totalPaise"]
    assert "with lemon" in up["notes"]
    # only round 2 is left for the kitchen printer
    assert (await claim()).json() == {"claimed": True, "fromSeq": 1, "toSeq": 2}


@pytest.mark.asyncio
async def test_cancel_one_dish_needs_a_captain_and_reprices(client, captain, waiter):
    o = await dine_in(client, waiter, items=[{"menuItemId": "menu-04", "quantity": 2}, {"menuItemId": "menu-10", "quantity": 1}])
    await client.post(f"{API}/pos/orders/{o['id']}/kot/claim", headers=captain)
    paneer = o["items"][0]["lineId"]
    url = f"{API}/pos/orders/{o['id']}/items/{paneer}/void"
    assert (await client.post(url, json={"quantity": 1, "reason": "Too spicy"}, headers=waiter)).status_code == 403
    assert (await client.post(url, json={"quantity": 3, "reason": "x"}, headers=captain)).status_code == 422
    r = (await client.post(url, json={"quantity": 1, "reason": "Too spicy"}, headers=captain)).json()
    assert r["items"][0]["quantity"] == 1 and r["subtotalPaise"] == o["subtotalPaise"] - 38000
    v = r["voidedItems"][0]
    assert v["name"] == "Paneer Tikka" and v["quantity"] == 1 and v["reason"] == "Too spicy" and v["by"] == "Rohan Mehta" and v["noSlip"] is False
    assert r["kotSeq"] == 2 and r["kotPrintedSeq"] == 1  # the cancellation slip is waiting for the kitchen printer
    # cancelling every dish cancels the order
    for line in r["items"]:
        r = (await client.post(f"{API}/pos/orders/{o['id']}/items/{line['lineId']}/void", json={"quantity": line["quantity"], "reason": "Left"}, headers=captain)).json()
    assert r["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_room_service_changes_follow_the_folio(client, captain, db_session):
    f = await db_session.scalar(select(MasterFolio).where(MasterFolio.stay_id == "stay-901"))
    await db_session.refresh(f)
    before = f.outstanding_balance_minor
    o = (await client.post(f"{API}/pos/orders", json={"order_type": "ROOM_SERVICE", "room_number": "101",
                                                       "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=captain)).json()
    up = (await client.post(f"{API}/pos/orders/{o['id']}/items", json={"items": [{"menuItemId": "menu-10", "quantity": 1}]}, headers=captain)).json()
    await db_session.refresh(f)
    assert f.outstanding_balance_minor == before + up["totalPaise"]
    tea = next(i for i in up["items"] if i["menuItemId"] == "menu-10")["lineId"]
    down = (await client.post(f"{API}/pos/orders/{o['id']}/items/{tea}/void", json={"quantity": 1, "reason": "Wrong dish"}, headers=captain)).json()
    await db_session.refresh(f)
    assert f.outstanding_balance_minor == before + down["totalPaise"] == before + o["totalPaise"]


@pytest.mark.asyncio
async def test_move_order_or_whole_table(client, captain, waiter, db_session):
    a = await dine_in(client, captain, "T5")
    b = await dine_in(client, captain, "T5", items=[{"menuItemId": "menu-10", "quantity": 1}])
    url = f"{API}/pos/orders/{a['id']}/move"
    assert (await client.post(url, json={"tableId": "tbl-06"}, headers=waiter)).status_code == 403
    moved = (await client.post(url, json={"tableId": "tbl-06"}, headers=captain)).json()
    assert [m["tableNumber"] for m in moved] == ["T6"]
    rest = (await client.post(f"{API}/pos/orders/{b['id']}/move", json={"tableId": "tbl-06", "allOnTable": True}, headers=captain)).json()
    assert [m["id"] for m in rest] == [b["id"]]
    t5 = await db_session.scalar(select(POSTable).where(POSTable.table_number == "T5"))
    t6 = await db_session.scalar(select(POSTable).where(POSTable.table_number == "T6"))
    await db_session.refresh(t5)
    await db_session.refresh(t6)
    assert t5.status == "AVAILABLE" and t6.status == "ORDERED" and t6.active_order_total_minor == a["totalPaise"] + b["totalPaise"]
    assert (await client.post(url, json={"tableId": "tbl-06"}, headers=captain)).status_code == 422  # already there


@pytest.mark.asyncio
async def test_paid_orders_cannot_change(client, captain):
    o = (await client.post(f"{API}/pos/orders", json={"order_type": "TAKEAWAY", "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=captain)).json()
    await client.post(f"{API}/pos/orders/{o['id']}/settle", json={"method": "CASH"}, headers=captain)
    assert (await client.post(f"{API}/pos/orders/{o['id']}/items", json={"items": [{"menuItemId": "menu-10", "quantity": 1}]}, headers=captain)).status_code == 409
    assert (await client.post(f"{API}/pos/orders/{o['id']}/items/{o['items'][0]['lineId']}/void", json={"quantity": 1, "reason": "x"}, headers=captain)).status_code == 409
