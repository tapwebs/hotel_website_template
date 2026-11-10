"""Website -> HMS booking sync: key check, idempotent create, status changes, no overbooking."""
import pytest

from backend.app.core.config import settings

KEY = "test-integration-key"
H = {"X-HMS-Integration-Key": KEY}
URL = "/api/v1/integrations/website-bookings"


@pytest.fixture(autouse=True)
def integration_key(monkeypatch):
    monkeypatch.setattr(settings, "HMS_INTEGRATION_API_KEY", KEY)
    # `suite` maps to ROYAL_SUITE, which has 7 rooms in the demo seed
    monkeypatch.setattr(settings, "WEBSITE_ROOM_MAP", "deluxe:DLX_PALACE,suite:ROYAL_SUITE")


def booking(ref: str, **kw):
    return {
        "external_booking_ref": ref, "website_room_id": "deluxe", "guest_name": "Asha Verma",
        "guest_email": f"{ref.lower()}@example.com", "guest_phone": "+919812345678",
        "checkin_date": "2027-03-10", "checkout_date": "2027-03-12", "rooms_count": 1,
        "adults": 2, "children": 0, "status": "pending", **kw,
    }


@pytest.mark.asyncio
async def test_key_is_required(client, monkeypatch):
    assert (await client.post(URL, json=booking("HDH-K1"))).status_code == 401
    assert (await client.post(URL, json=booking("HDH-K1"), headers={"X-HMS-Integration-Key": "wrong"})).status_code == 401
    monkeypatch.setattr(settings, "HMS_INTEGRATION_API_KEY", None)
    assert (await client.post(URL, json=booking("HDH-K1"), headers=H)).status_code == 503


@pytest.mark.asyncio
async def test_unknown_room_is_422_not_a_guess(client):
    r = await client.post(URL, json=booking("HDH-U1", website_room_id="nope"), headers=H)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_idempotent_create_and_status_flow(client):
    r1 = await client.post(URL, json=booking("HDH-T3"), headers=H)
    assert r1.status_code == 200, r1.text
    r2 = await client.post(URL, json=booking("HDH-T3"), headers=H)
    assert r2.json()["reservation_id"] == r1.json()["reservation_id"]
    assert r1.json()["status"] == "PENDING" and r1.json()["payment_status"] == "UNPAID"

    conf = await client.post(f"{URL}/HDH-T3/status", json={"status": "confirmed"}, headers=H)
    assert conf.json()["status"] == "CONFIRMED"
    canc = await client.post(f"{URL}/HDH-T3/status", json={"status": "cancelled"}, headers=H)
    assert canc.json()["status"] == "CANCELLED"
    assert (await client.post(f"{URL}/HDH-T3/status", json={"status": "confirmed"}, headers=H)).status_code == 409
    # replaying a create for a cancelled ref returns the cancelled reservation, never a new one
    again = await client.post(URL, json=booking("HDH-T3"), headers=H)
    assert again.json()["reservation_id"] == r1.json()["reservation_id"]


@pytest.mark.asyncio
async def test_no_overbooking_and_cancel_frees_room(client, db_session):
    from sqlalchemy import func, select
    from backend.app.models.room import Room, RoomType
    total = (await db_session.execute(
        select(func.count()).select_from(Room).join(RoomType, RoomType.room_type_id == Room.room_type_id)
        .where(RoomType.code == "ROYAL_SUITE", Room.maintenance_status == "OPERATIONAL")
    )).scalar_one()
    assert total >= 2
    suite = dict(website_room_id="suite")
    assert (await client.post(URL, json=booking("HDH-O1", rooms_count=total, **suite), headers=H)).status_code == 200
    full = await client.post(URL, json=booking("HDH-O2", **suite), headers=H)
    assert full.status_code == 409, full.text
    other_dates = booking("HDH-O3", checkin_date="2027-04-01", checkout_date="2027-04-02", **suite)
    assert (await client.post(URL, json=other_dates, headers=H)).status_code == 200
    await client.post(f"{URL}/HDH-O1/status", json={"status": "cancelled"}, headers=H)
    assert (await client.post(URL, json=booking("HDH-O2", **suite), headers=H)).status_code == 200


@pytest.mark.asyncio
async def test_get_and_status_404_for_unknown_ref(client):
    assert (await client.get(f"{URL}/NOPE", headers=H)).status_code == 404
    assert (await client.post(f"{URL}/NOPE/status", json={"status": "cancelled"}, headers=H)).status_code == 404


@pytest.mark.asyncio
async def test_website_booking_visible_in_reservations_list(client):
    # 1. Post a new website booking
    ref = "HDH-WLIST1"
    res = await client.post(URL, json=booking(ref, guest_name="Sanjay Singhania", guest_phone="+919988776655"), headers=H)
    assert res.status_code == 200
    res_data = res.json()
    reservation_id = res_data["reservation_id"]
    assert res_data["status"] == "PENDING"

    # 2. Login as front desk staff
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "admin", "password": "password123"}
    )
    assert login_res.status_code == 200
    auth_header = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # 3. Retrieve reservations list and verify created booking is present
    list_res = await client.get(f"{settings.API_V1_PREFIX}/reservations", headers=auth_header)
    assert list_res.status_code == 200
    items = list_res.json()
    matching = [r for r in items if r["id"] == reservation_id]
    assert len(matching) == 1
    found = matching[0]
    assert found["guestName"] == "Sanjay Singhania"
    assert found["guestPhone"] == "+919988776655"
    assert found["source"] in ("WEBSITE", "DIRECT_WEB")
    assert found["status"] == "PENDING"
    assert found["roomsCount"] == 1

    # 4. Retrieve single reservation detail
    detail_res = await client.get(f"{settings.API_V1_PREFIX}/reservations/{reservation_id}", headers=auth_header)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == reservation_id
    assert detail["masterFolioId"] is not None
