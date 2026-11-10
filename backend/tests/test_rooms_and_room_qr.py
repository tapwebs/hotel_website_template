"""Adding rooms from the app, and the permanent in-room ordering QR."""
import pytest
import pytest_asyncio
from backend.app.core import ratelimit
from backend.app.core.config import settings
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


async def first_type(client, h):
    return (await client.get(f"{API}/rooms", headers=h)).json()[0]["roomTypeId"]


@pytest.mark.asyncio
async def test_admin_adds_rooms_and_they_are_bookable(client, auth_headers, captain):
    rt = await first_type(client, auth_headers)
    before = len((await client.get(f"{API}/rooms", headers=auth_headers)).json())
    cats = lambda: client.get(f"{API}/availability/categories")
    avail_before = next(c["availableUnits"] for c in (await cats()).json() if c["id"] == rt)
    body = {"room_type_id": rt, "room_numbers": ["801", "802", "802", " 803 ", "101"], "wing": "North"}
    assert (await client.post(f"{API}/rooms", json=body, headers=captain)).status_code == 403  # captains cannot add rooms
    r = await client.post(f"{API}/rooms", json=body, headers=auth_headers)
    assert r.status_code == 201, r.text
    out = r.json()
    assert [x["roomNumber"] for x in out["created"]] == ["801", "802", "803"]
    assert out["skipped"] == ["101"]  # already exists; never changed
    assert all(x["floor"] == 8 and x["wing"] == "North" and x["occupancyStatus"] == "VACANT" for x in out["created"])
    assert len((await client.get(f"{API}/rooms", headers=auth_headers)).json()) == before + 3
    assert next(c["availableUnits"] for c in (await cats()).json() if c["id"] == rt) == avail_before + 3


@pytest.mark.asyncio
async def test_room_number_and_type_are_validated(client, auth_headers):
    rt = await first_type(client, auth_headers)
    bad = await client.post(f"{API}/rooms", json={"room_type_id": rt, "room_numbers": ["10 1"]}, headers=auth_headers)
    assert bad.status_code == 422
    assert (await client.post(f"{API}/rooms", json={"room_type_id": "nope", "room_numbers": ["900"]}, headers=auth_headers)).status_code == 404
    assert (await client.post(f"{API}/rooms", json={"room_type_id": rt, "room_numbers": []}, headers=auth_headers)).status_code == 422
    one = await client.post(f"{API}/rooms", json={"room_type_id": rt, "room_numbers": ["G1"], "floor_number": 0}, headers=auth_headers)
    assert one.json()["created"][0]["floor"] == 0


@pytest.mark.asyncio
async def test_every_room_has_its_own_permanent_qr(client, captain, auth_headers):
    rooms = (await client.get(f"{API}/pos/rooms-qr", headers=captain)).json()
    assert len({r["token"] for r in rooms}) == len(rooms) >= 1
    r101 = next(r for r in rooms if r["roomNumber"] == "101")
    assert r101["occupied"] is True and r101["guestName"]
    rt = await first_type(client, auth_headers)
    await client.post(f"{API}/rooms", json={"room_type_id": rt, "room_numbers": ["810"]}, headers=auth_headers)
    new = next(r for r in (await client.get(f"{API}/pos/rooms-qr", headers=captain)).json() if r["roomNumber"] == "810")
    assert new["occupied"] is False and new["guestName"] is None and new["token"]


@pytest.mark.asyncio
async def test_room_qr_charges_whoever_is_staying_and_waits_for_acceptance(client, captain):
    rooms = (await client.get(f"{API}/pos/rooms-qr", headers=captain)).json()
    token = next(r["token"] for r in rooms if r["roomNumber"] == "101")
    s = await client.post(f"{API}/guest/session/exchange", json={"token": token})
    assert s.status_code == 200, s.text
    assert s.json()["kind"] == "ROOM" and s.json()["tableLabel"] == "Room 101"
    h = {"X-Dining-Session": s.json()["sessionId"]}
    placed = await client.post(f"{API}/guest/orders", json={"lines": [{"itemId": "menu-10", "qty": 1}], "payment": "counter"}, headers=h)
    assert placed.status_code == 201, placed.text
    pending = (await client.get(f"{API}/pos/orders/pending", headers=captain)).json()
    mine = next(o for o in pending if o["orderNumber"] == placed.json()["displayNumber"])
    assert mine["roomNumber"] == "101" and mine["orderType"] == "ROOM_SERVICE" and mine["status"] == "PENDING_ACCEPTANCE"


@pytest.mark.asyncio
async def test_empty_room_and_paused_ordering_refuse_politely(client, captain, auth_headers):
    rt = await first_type(client, auth_headers)
    await client.post(f"{API}/rooms", json={"room_type_id": rt, "room_numbers": ["811"]}, headers=auth_headers)
    rooms = (await client.get(f"{API}/pos/rooms-qr", headers=captain)).json()
    empty = next(r["token"] for r in rooms if r["roomNumber"] == "811")
    r = await client.post(f"{API}/guest/session/exchange", json={"token": empty})
    assert r.status_code == 404 and "Nobody is checked in" in r.text
    occupied = next(r["token"] for r in rooms if r["roomNumber"] == "101")
    await client.put(f"{API}/pos/config", json={"roomOrdering": False}, headers=auth_headers)
    paused = await client.post(f"{API}/guest/session/exchange", json={"token": occupied})
    assert paused.status_code == 403 and "paused" in paused.text


@pytest.mark.asyncio
async def test_reset_retires_the_printed_qr_and_open_sessions(client, captain, auth_headers):
    rooms = (await client.get(f"{API}/pos/rooms-qr", headers=captain)).json()
    r101 = next(r for r in rooms if r["roomNumber"] == "101")
    sid = (await client.post(f"{API}/guest/session/exchange", json={"token": r101["token"]})).json()["sessionId"]
    assert (await client.post(f"{API}/pos/rooms-qr/{r101['id']}/reset", headers=captain)).status_code == 403
    new = (await client.post(f"{API}/pos/rooms-qr/{r101['id']}/reset", headers=auth_headers)).json()["token"]
    assert new != r101["token"]
    assert (await client.post(f"{API}/guest/session/exchange", json={"token": r101["token"]})).status_code == 404
    assert (await client.get(f"{API}/guest/menu", headers={"X-Dining-Session": sid})).status_code == 404  # open session ended
    assert (await client.post(f"{API}/guest/session/exchange", json={"token": new})).status_code == 200


@pytest.mark.asyncio
async def test_standard_room_types_setup_is_admin_only_and_idempotent(client, captain):
    sa = await login(client, "superadmin")
    sa["X-Property-Id"] = "prop-goa-02"  # has no room types
    assert (await client.post(f"{API}/rooms/types/setup", headers=captain)).status_code == 403
    first = await client.post(f"{API}/rooms/types/setup", headers=sa)
    assert first.status_code == 200 and len(first.json()) == 2
    second = await client.post(f"{API}/rooms/types/setup", headers=sa)
    assert sorted(t["id"] for t in second.json()) == sorted(t["id"] for t in first.json())
    cats = (await client.get(f"{API}/availability/categories", headers=sa)).json()
    assert {c["id"] for c in cats} >= {t["id"] for t in first.json()}


@pytest.mark.asyncio
async def test_only_super_admin_changes_room_type_rate(client, auth_headers, captain):
    sa = await login(client, "superadmin")
    rt = await first_type(client, auth_headers)
    url = f"{API}/rooms/types/{rt}/rate"
    assert (await client.put(url, json={"rate": 2500}, headers=auth_headers)).status_code == 403  # general manager
    assert (await client.put(url, json={"rate": 2500}, headers=captain)).status_code == 403
    assert (await client.put(url, json={"rate": 50}, headers=sa)).status_code == 422
    assert (await client.put(url, json={"rate": 2500}, headers=sa)).status_code == 200
    cat = next(c for c in (await client.get(f"{API}/availability/categories")).json() if c["id"] == rt)
    assert cat["startingPricePerNightPaise"] == 250_000
