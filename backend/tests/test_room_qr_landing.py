"""Room placement QR (hub landing page) -> existing Room Dining link. The dining tokens are never created or changed."""
import pytest
from backend.app.core import ratelimit
from backend.app.core.config import settings
from backend.app.services import fnb_config
from backend.app.models.room import Room
from sqlalchemy import delete

API = settings.API_V1_PREFIX
Q = f"{API}/website/qr-hub/admin"
SLUG = "room-landing"


@pytest.fixture(autouse=True)
def _fresh():
    ratelimit.reset()
    fnb_config.reset_cache()


async def _hub(client, code):
    return await client.get(f"/qr-hub/public/hub/{SLUG}", params={"p": code})


@pytest.mark.asyncio
async def test_room_placements_open_the_existing_room_dining_link(client, auth_headers, db_session):
    h = auth_headers
    # The hotel has 16 rooms: trim the seeded rooms (test database only) to 16 real, differently numbered ones.
    extra = ["207", "208", "301", "302", "303", "304", "401"]
    await db_session.execute(delete(Room).where(Room.room_number.in_(extra)))
    await db_session.commit()
    org = await client.post(f"{Q}/organizations", headers=h, json={"name": "Room Landing"})
    assert org.status_code == 201, org.text
    await client.patch(f"{Q}/organizations/{SLUG}/status", headers=h, json={"qr_status": "active"})
    await client.patch(f"{Q}/organizations/{SLUG}", headers=h, json={"status": "published"})
    await client.post(f"{Q}/organizations/{SLUG}/placements", headers=h, json={"code": "lobby", "label": "Lobby", "kind": "lobby"})

    rooms = (await client.get(f"{API}/pos/rooms-qr", headers=h)).json()
    tokens_before = {r["roomNumber"]: r["token"] for r in rooms}
    assert len(tokens_before) == 16 and not set(extra) & set(tokens_before)

    # A dry run only previews: nothing is written.
    dry = (await client.post(f"{Q}/organizations/{SLUG}/placements/rooms?dry_run=true", headers=h)).json()
    assert dry["created"] == [] and len(dry["wouldCreate"]) == 16
    assert not [p for p in (await client.get(f"{Q}/organizations/{SLUG}/placements", headers=h)).json()["items"] if p["kind"] == "room"]
    # Creating the room QRs is idempotent: a second run adds nothing.
    first = (await client.post(f"{Q}/organizations/{SLUG}/placements/rooms", headers=h)).json()
    assert len(first["created"]) == 16
    assert all(p["code"].startswith("rm-") and len(p["code"]) == 35 for p in first["created"])
    assert len({p["code"] for p in first["created"]}) == 16
    assert {p["label"] for p in first["created"]} == {f"Room {n}" for n in tokens_before}
    assert all(p["kind"] == "room" and p["status"] == "active" for p in first["created"])
    again = (await client.post(f"{Q}/organizations/{SLUG}/placements/rooms", headers=h)).json()
    assert again["created"] == [] and again["existing"] == len(tokens_before)
    placements = (await client.get(f"{Q}/organizations/{SLUG}/placements", headers=h)).json()["items"]
    room_placements = [p for p in placements if p["kind"] == "room"]
    assert len(room_placements) == 16
    assert all(p["code"].startswith("rm-") for p in room_placements)
    assert not {f"Room {n}" for n in ["17", "18", "19", "20"]} & {p["label"] for p in room_placements}

    # Every room: the landing page names the room and Order Food is that room's own, unchanged, dining link.
    site = "http://localhost:5173"
    placement_by_number = {p["label"].replace("Room ", ""): p["code"] for p in first["created"]}
    for number, token in tokens_before.items():
        code = placement_by_number[number]
        # Sequential guessing of room numbers cannot resolve a room (IDOR security guarantee)
        assert (await _hub(client, f"room{number}")).json()["placement"] is None
        body = (await _hub(client, code)).json()
        assert body["placement"]["label"] == f"Room {number}"
        assert body["placement"]["code"] == code
        assert body["placement"]["order_url"] == f"{site}/dining/r/{token}"
        ex = await client.post(f"{API}/guest/session/exchange", json={"token": token})
        if ex.status_code == 200:  # occupied room: the existing session names the same room
            assert ex.json()["roomNumber"] == number

    # The tokens were not touched.
    after = {r["roomNumber"]: r["token"] for r in (await client.get(f"{API}/pos/rooms-qr", headers=h)).json()}
    assert after == tokens_before

    # Other placements, unknown rooms and unknown codes get no dining link (and no error).
    assert "order_url" not in (await _hub(client, "lobby")).json()["placement"]
    await client.post(f"{Q}/organizations/{SLUG}/placements", headers=h, json={"code": "room9999", "label": "Room 9999", "kind": "room"})
    ghost = await _hub(client, "room9999")
    assert ghost.status_code == 200 and ghost.json().get("placement") is None
    assert (await _hub(client, "room-nope")).json()["placement"] is None
    assert (await client.post(f"{Q}/organizations/{SLUG}/placements/rooms")).status_code == 401
