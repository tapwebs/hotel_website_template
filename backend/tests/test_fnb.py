"""F&B: POS orders, kitchen lifecycle, menu management, folio posting and guest in-room dining."""
import pytest
import pytest_asyncio
from sqlalchemy import select

from backend.app.core import ratelimit
from backend.app.core.config import settings
from backend.app.core.rbac import get_role_permissions
from backend.app.core.security import hash_password
from backend.app.models.folio import MasterFolio
from backend.app.models.pos import POSOrder, POSTable
from backend.app.models.reservation import Stay
from backend.app.models.user import User

API = settings.API_V1_PREFIX
PID = settings.DEFAULT_PROPERTY_ID


@pytest.fixture(autouse=True)
def _fresh_limits():
    ratelimit.reset()


async def login(client, user):
    r = await client.post(f"{API}/auth/login", json={"username_or_email": user, "password": "password123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}", "X-Property-Id": PID}


@pytest_asyncio.fixture
async def chef(client, db_session):
    db_session.add(User(
        user_id="usr-chef", org_id=settings.DEFAULT_ORG_ID, property_id=PID, username="chef", email="chef@dh.test", full_name="Chef",
        phone_number="+91 90000 00000", password_hash=hash_password("password123"), role_code="ROLE_KITCHEN_STAFF",
        permissions=list(get_role_permissions("ROLE_KITCHEN_STAFF")), is_active=True, token_version=1,
    ))
    await db_session.commit()
    return await login(client, "chef")


@pytest_asyncio.fixture
async def pos(client):
    return await login(client, "rohan")


def line(item="menu-04", qty=2, **kw):
    return {"menuItemId": item, "quantity": qty, **kw}


async def order(client, h, **kw):
    body = {"order_type": "DINE_IN", "table_number": "T1", "items": [line()], **kw}
    return await client.post(f"{API}/pos/orders", json=body, headers=h)


@pytest.mark.asyncio
async def test_menu_and_tables_seeded_and_gated(client, pos):
    assert len((await client.get(f"{API}/pos/menu", headers=pos)).json()) >= 12
    assert len((await client.get(f"{API}/pos/tables", headers=pos)).json()) >= 8
    assert (await client.get(f"{API}/pos/menu")).status_code == 401
    assert (await client.get(f"{API}/pos/menu", headers=await login(client, "priya"))).status_code == 403  # accountant


@pytest.mark.asyncio
async def test_prices_come_from_the_menu_not_the_client(client, pos):
    r = await order(client, pos, items=[line("menu-04", 2, pricePaise=1, name="free")])
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["items"][0]["pricePaise"] == 38000 and o["items"][0]["name"] == "Paneer Tikka"
    assert (o["subtotalPaise"], o["taxPaise"], o["totalPaise"]) == (76000, 3800, 79800)
    assert o["status"] == "QUEUED" and o["orderNumber"].startswith("KOT-") and o["source"] == "STAFF"


@pytest.mark.asyncio
async def test_order_validation(client, pos):
    assert (await order(client, pos, items=[line("nope")])).status_code in (400, 422)
    assert (await order(client, pos, items=[])).status_code == 422
    assert (await order(client, pos, items=[line(qty=0)])).status_code == 422
    assert (await order(client, pos, table_number="T99")).status_code in (400, 422)
    assert (await order(client, pos, order_type="ROOM_SERVICE", room_number="999")).status_code == 409  # nobody in house
    assert (await order(client, pos, order_type="ROOM_SERVICE")).status_code in (400, 422)


@pytest.mark.asyncio
async def test_eighty_six_blocks_ordering_until_restored(client, pos):
    assert (await client.patch(f"{API}/pos/menu/menu-04", json={"isAvailable": False}, headers=pos)).status_code == 200
    r = await order(client, pos)
    assert r.status_code == 409 and "Paneer Tikka" in r.text
    await client.patch(f"{API}/pos/menu/menu-04", json={"isAvailable": True}, headers=pos)
    assert (await order(client, pos)).status_code == 201


@pytest.mark.asyncio
async def test_menu_edit_needs_settings_access(client, pos, auth_headers):
    new = {"name": "Rasmalai", "category": "desserts", "pricePaise": 30000, "station": "MAIN_KITCHEN"}
    assert (await client.post(f"{API}/pos/menu", json=new, headers=pos)).status_code == 403
    assert (await client.patch(f"{API}/pos/menu/menu-04", json={"pricePaise": 1}, headers=pos)).status_code == 403
    r = await client.post(f"{API}/pos/menu", json=new, headers=auth_headers)
    assert r.status_code == 201 and r.json()["category"] == "DESSERTS"
    mid = r.json()["id"]
    assert (await client.patch(f"{API}/pos/menu/{mid}", json={"pricePaise": 32000}, headers=auth_headers)).json()["pricePaise"] == 32000
    assert (await client.delete(f"{API}/pos/menu/{mid}", headers=auth_headers)).status_code == 204
    assert mid not in [i["id"] for i in (await client.get(f"{API}/pos/menu", headers=pos)).json()]
    # a removed item cannot be ordered
    gone = await order(client, pos, items=[line(mid)])  # typed 409, so a client can drop just the removed dish
    assert gone.status_code == 409 and gone.json()["error"]["code"] == "ITEM_UNAVAILABLE"


@pytest.mark.asyncio
async def test_kitchen_lifecycle_and_who_may_do_what(client, pos, chef):
    o = (await order(client, pos)).json()
    url = f"{API}/pos/orders/{o['id']}/status"
    move = lambda h, s: client.patch(url, json={"status": s}, headers=h)
    assert (await move(pos, "READY")).status_code == 409  # cannot skip preparing
    assert (await move(chef, "PREPARING")).json()["status"] == "PREPARING"
    assert (await move(chef, "PREPARING")).status_code == 409  # double tap
    assert (await move(chef, "READY")).json()["status"] == "READY"
    assert (await move(chef, "DELIVERED")).json()["status"] == "DELIVERED"  # the kitchen may bump a ready ticket to served
    assert (await move(pos, "CANCELLED")).status_code == 409  # too late
    assert (await move(pos, "BILLED")).json()["status"] == "BILLED"
    assert (await client.get(f"{API}/pos/orders", headers=chef)).json() == []  # board only shows active
    assert len((await client.get(f"{API}/pos/orders?scope=all", headers=pos)).json()) == 1
    assert (await client.post(f"{API}/pos/orders", json={"order_type": "TAKEAWAY", "items": [line()]}, headers=chef)).status_code == 403


@pytest.mark.asyncio
async def test_one_kitchen_station_board_shows_every_line_oldest_first(client, pos, chef):
    first = (await order(client, pos, items=[line("menu-04"), line("menu-10")])).json()  # formerly tandoor + bar
    second = (await order(client, pos, table_number="T2", items=[line("menu-02")])).json()
    assert {i["station"] for i in first["items"]} == {"MAIN_KITCHEN"}
    board = (await client.get(f"{API}/pos/orders", headers=chef)).json()
    assert [b["id"] for b in board] == [first["id"], second["id"]]
    assert [i["name"] for i in board[0]["items"]] == [i["name"] for i in first["items"]]
    me = (await client.get(f"{API}/pos/me", headers=chef)).json()
    assert me["stations"] == []  # every cook sees every ticket


@pytest.mark.asyncio
async def test_table_follows_its_orders(client, pos, db_session):
    table = lambda: db_session.scalar(select(POSTable).where(POSTable.table_id == "tbl-01"))
    a = (await order(client, pos)).json()
    b = (await order(client, pos, items=[line("menu-09", 1)])).json()
    await db_session.refresh(await table())
    t = await table()
    assert t.status == "ORDERED" and t.active_order_total_minor == a["totalPaise"] + b["totalPaise"]
    for o in (a, b):
        for s in ("PREPARING", "READY", "DELIVERED"):
            await client.patch(f"{API}/pos/orders/{o['id']}/status", json={"status": s}, headers=pos)
    await db_session.refresh(t)
    assert t.status == "SEATED"
    await client.patch(f"{API}/pos/orders/{a['id']}/status", json={"status": "BILLED"}, headers=pos)
    await db_session.refresh(t)
    assert t.status == "SEATED" and t.active_order_total_minor == b["totalPaise"]
    await client.patch(f"{API}/pos/orders/{b['id']}/status", json={"status": "BILLED"}, headers=pos)
    await db_session.refresh(t)
    assert t.status == "AVAILABLE" and t.active_order_id is None and t.active_order_total_minor == 0


async def folio(db_session):
    f = await db_session.scalar(select(MasterFolio).where(MasterFolio.stay_id == "stay-901"))
    await db_session.refresh(f)
    return f


@pytest.mark.asyncio
async def test_room_service_posts_to_folio_and_cancel_reverses_it(client, pos, db_session):
    before = (await folio(db_session)).outstanding_balance_minor
    r = await order(client, pos, order_type="ROOM_SERVICE", room_number="101", table_number=None)
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["roomNumber"] == "101" and o["stayId"] == "stay-901" and o["guestName"]
    assert (await folio(db_session)).outstanding_balance_minor == before + o["totalPaise"]
    c = await client.patch(f"{API}/pos/orders/{o['id']}/status", json={"status": "CANCELLED"}, headers=pos)
    assert c.json()["status"] == "CANCELLED"
    f = await folio(db_session)
    assert f.outstanding_balance_minor == before
    # billed on the folio, never "billed" at the till
    o2 = (await order(client, pos, order_type="ROOM_SERVICE", room_number="101", table_number=None)).json()
    for s in ("PREPARING", "READY", "DELIVERED"):
        await client.patch(f"{API}/pos/orders/{o2['id']}/status", json={"status": s}, headers=pos)
    assert (await client.patch(f"{API}/pos/orders/{o2['id']}/status", json={"status": "BILLED"}, headers=pos)).status_code == 409


@pytest.mark.asyncio
async def test_credit_limit_blocks_room_service(client, pos, db_session):
    f = await folio(db_session)
    f.credit_limit_minor = f.outstanding_balance_minor + 100
    await db_session.commit()
    assert (await order(client, pos, order_type="ROOM_SERVICE", room_number="101", table_number=None)).status_code == 409


# ── Guest in-room dining ─────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def token(db_session):
    return (await db_session.scalar(select(Stay).where(Stay.stay_id == "stay-901"))).qr_access_token


@pytest.mark.asyncio
async def test_guest_sees_menu_without_staff_data(client, token):
    r = await client.get(f"{API}/dining/{token}")
    assert r.status_code == 200
    d = r.json()
    assert d["roomNumber"] == "101" and d["guestFirstName"] and d["taxRatePercent"] == 5 and len(d["menu"]) >= 12
    assert "stayId" not in r.text and "folio" not in r.text.lower()


@pytest.mark.asyncio
async def test_guest_hides_sold_out_items(client, token, pos):
    await client.patch(f"{API}/pos/menu/menu-04", json={"isAvailable": False}, headers=pos)
    ids = [m["id"] for m in (await client.get(f"{API}/dining/{token}")).json()["menu"]]
    assert "menu-04" not in ids
    r = await client.post(f"{API}/dining/{token}/orders", json={"items": [line("menu-04", 1)]})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_invalid_or_checked_out_token_is_the_same_404(client, token, db_session):
    assert (await client.get(f"{API}/dining/not-a-real-token")).status_code == 404
    s = await db_session.scalar(select(Stay).where(Stay.stay_id == "stay-901"))
    s.status = "CHECKED_OUT"
    await db_session.commit()
    r = await client.get(f"{API}/dining/{token}")
    assert r.status_code == 404
    assert (await client.post(f"{API}/dining/{token}/orders", json={"items": [line()]})).status_code == 404




@pytest.mark.asyncio
async def test_guest_orders_to_room_reaches_kitchen_and_folio(client, token, pos, chef, db_session):
    before = (await folio(db_session)).outstanding_balance_minor
    r = await client.post(f"{API}/dining/{token}/orders", json={"items": [line("menu-10", 2, pricePaise=1)], "notes": "No sugar"})
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["totalPaise"] == 25200 and g["status"] == "QUEUED" and g["canCancel"] and "stayId" not in r.text
    assert (await folio(db_session)).outstanding_balance_minor == before + 25200
    board = (await client.get(f"{API}/pos/orders", headers=chef)).json()
    assert board[0]["source"] == "GUEST_QR" and board[0]["roomNumber"] == "101" and board[0]["notes"] == "No sugar"
    assert [o["orderNumber"] for o in (await client.get(f"{API}/dining/{token}/orders")).json()] == [g["orderNumber"]]
    # once the kitchen starts, the guest can no longer cancel it
    await client.patch(f"{API}/pos/orders/{board[0]['id']}/status", json={"status": "PREPARING"}, headers=chef)
    assert (await client.post(f"{API}/dining/{token}/orders/{g['orderNumber']}/cancel")).status_code == 409


@pytest.mark.asyncio
async def test_guest_cancel_before_kitchen_reverses_charge(client, token, db_session):
    before = (await folio(db_session)).outstanding_balance_minor
    g = (await client.post(f"{API}/dining/{token}/orders", json={"items": [line("menu-10", 1)]})).json()
    c = await client.post(f"{API}/dining/{token}/orders/{g['orderNumber']}/cancel")
    assert c.status_code == 200 and c.json()["status"] == "CANCELLED"
    assert (await folio(db_session)).outstanding_balance_minor == before


@pytest.mark.asyncio
async def test_guest_cannot_touch_another_stays_order(client, token, pos):
    other = (await order(client, pos)).json()
    assert (await client.post(f"{API}/dining/{token}/orders/{other['orderNumber']}/cancel")).status_code == 404


@pytest.mark.asyncio
async def test_guest_limits(client, token):
    body = {"items": [line("menu-10", 1)]}
    for _ in range(3):
        assert (await client.post(f"{API}/dining/{token}/orders", json=body)).status_code == 201
    assert (await client.post(f"{API}/dining/{token}/orders", json=body)).status_code == 409  # 3 in progress
    assert (await client.post(f"{API}/dining/{token}/orders", json={"items": [line(qty=21)]})).status_code == 422
    for _ in range(2):
        await client.post(f"{API}/dining/{token}/orders", json=body)
    assert (await client.post(f"{API}/dining/{token}/orders", json=body)).status_code == 429  # 6 attempts per 10 minutes


@pytest.mark.asyncio
async def test_room_qr_list_for_front_desk(client, pos, token):
    r = await client.get(f"{API}/pos/room-qr", headers=pos)
    assert r.status_code == 200
    assert {"roomNumber": "101", "stayId": "stay-901", "token": token}.items() <= r.json()[0].items()
    assert (await client.get(f"{API}/pos/room-qr")).status_code == 401
