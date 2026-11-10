"""QR library admin API served natively (used to fall through to the unreachable website service)."""
import pytest

from backend.app.core.config import settings

Q = f"{settings.API_V1_PREFIX}/website/qr-hub/admin"
LINK = {"title": "Book", "destination_url": "http://localhost:5173/book"}


@pytest.mark.asyncio
async def test_full_qr_library_lifecycle(client, auth_headers, db_session):
    h = auth_headers
    assert (await client.get(f"{Q}/organizations")).status_code == 401

    # create (slug derived from name) with a link; duplicates and bad input are rejected
    r = await client.post(f"{Q}/organizations", headers=h, json={"name": "Grand Hall", "category": "Banquet / Weddings", "links": [LINK]})
    assert r.status_code == 201, r.text
    ws = r.json()
    assert ws["organization"]["slug"] == "grand-hall" and ws["links"][0]["destination_url"] == LINK["destination_url"]
    assert (await client.post(f"{Q}/organizations", headers=h, json={"name": "Grand Hall"})).status_code == 409
    assert (await client.post(f"{Q}/organizations", headers=h, json={"name": "X", "category": "Nope"})).status_code == 422
    assert (await client.post(f"{Q}/organizations", headers=h, json={"category": "Hotel"})).status_code == 422
    assert (await client.post(f"{Q}/organizations", headers=h, json={"name": "Y", "website_url": "javascript:alert(1)"})).status_code == 422

    # list has the stats the library page shows
    item = next(i for i in (await client.get(f"{Q}/organizations", headers=h)).json()["items"] if i["slug"] == "grand-hall")
    assert (item["link_count"], item["placement_count"], item["visits"], item["clicks"]) == (1, 0, 0, 0)
    assert "wifi_password" not in item

    # update / status
    p = await client.patch(f"{Q}/organizations/grand-hall", headers=h, json={"description": "Hall", "wifi_visible": True})
    assert p.status_code == 200 and p.json()["organization"]["description"] == "Hall"
    assert (await client.patch(f"{Q}/organizations/grand-hall", headers=h, json={})).status_code == 422
    s = await client.patch(f"{Q}/organizations/grand-hall/status", headers=h, json={"qr_status": "active"})
    assert s.json()["organization"]["qr_status"] == "active"
    assert (await client.patch(f"{Q}/organizations/grand-hall/status", headers=h, json={"qr_status": "weird"})).status_code == 422

    # links: add, patch, reorder, bulk, delete
    l2 = (await client.post(f"{Q}/organizations/grand-hall/links", headers=h, json={"title": "Call", "destination_url": "tel:+911234567890"})).json()["link"]
    assert l2["sort_order"] == 1
    assert (await client.post(f"{Q}/organizations/grand-hall/links", headers=h, json={"title": "Bad", "destination_url": "javascript:x"})).status_code == 422
    up = await client.patch(f"{Q}/links/{l2['id']}", headers=h, json={"hours": {"open": "07:00", "close": "23:00"}, "is_featured": True})
    assert up.json()["link"]["hours"] == {"open": "07:00", "close": "23:00"}
    ids = [l["id"] for l in (await client.get(f"{Q}/organizations/grand-hall", headers=h)).json()["links"]]
    order = await client.put(f"{Q}/organizations/grand-hall/links/order", headers=h, json={"ids": ids[::-1]})
    assert [l["id"] for l in order.json()["links"]] == ids[::-1]
    bl = await client.post(f"{Q}/organizations/grand-hall/links/bulk", headers=h, json={"links": [{"title": "A", "destination_url": "https://a.example"}]})
    assert bl.status_code == 201 and len(bl.json()["links"]) == 1
    assert (await client.delete(f"{Q}/links/{l2['id']}", headers=h)).status_code == 204
    assert (await client.delete(f"{Q}/links/not-a-uuid", headers=h)).status_code == 422

    # placements: add, duplicate, range, list, patch, delete
    pl = await client.post(f"{Q}/organizations/grand-hall/placements", headers=h, json={"code": "lobby", "label": "Lobby", "kind": "lobby"})
    assert pl.status_code == 201 and pl.json()["placement"]["code"] == "lobby"
    assert (await client.post(f"{Q}/organizations/grand-hall/placements", headers=h, json={"code": "lobby", "label": "Again"})).status_code == 409
    rg = await client.post(f"{Q}/organizations/grand-hall/placements/bulk", headers=h, json={"kind": "room", "prefix": "room", "labelPrefix": "Room", "from": 1, "to": 3})
    assert [i["code"] for i in rg.json()["items"]] == ["room-1", "room-2", "room-3"]
    assert (await client.post(f"{Q}/organizations/grand-hall/placements/bulk", headers=h, json={"kind": "room", "prefix": "room", "labelPrefix": "Room", "from": 3, "to": 4})).status_code == 409
    rnd = await client.post(f"{Q}/organizations/grand-hall/placements/bulk", headers=h, json={"kind": "table", "prefix": "t", "labelPrefix": "Table", "from": 1, "to": 2, "random": True})
    assert all(len(i["code"]) > 6 for i in rnd.json()["items"])
    listed = (await client.get(f"{Q}/organizations/grand-hall/placements", headers=h)).json()["items"]
    assert len(listed) == 6
    pid = listed[0]["id"]
    assert (await client.patch(f"{Q}/placements/{pid}", headers=h, json={"status": "disabled"})).json()["placement"]["status"] == "disabled"
    assert (await client.delete(f"{Q}/placements/{pid}", headers=h)).status_code == 204

    # offers
    of = await client.post(f"{Q}/organizations/grand-hall/offers", headers=h, json={"text": "10% off", "starts_at": "2030-01-01T00:00", "ends_at": "2030-02-01T00:00"})
    assert of.status_code == 201 and of.json()["offer"]["starts_at"].startswith("2029-12-31T18:30")  # naive time = IST
    assert (await client.post(f"{Q}/organizations/grand-hall/offers", headers=h, json={"text": "x", "starts_at": "2030-02-01T00:00", "ends_at": "2030-01-01T00:00"})).status_code == 422
    oid = of.json()["offer"]["id"]
    assert (await client.patch(f"{Q}/offers/{oid}", headers=h, json={"text": "20% off"})).json()["offer"]["text"] == "20% off"
    assert len((await client.get(f"{Q}/organizations/grand-hall/offers", headers=h)).json()["items"]) == 1
    assert (await client.delete(f"{Q}/offers/{oid}", headers=h)).status_code == 204

    # bulk actions + multi-org link push
    ids = [i["id"] for i in (await client.get(f"{Q}/organizations/grand-hall/placements", headers=h)).json()["items"]]
    assert (await client.post(f"{Q}/bulk", headers=h, json={"entity": "placements", "ids": ids, "action": "disable"})).json() == {"affected": len(ids)}
    assert (await client.post(f"{Q}/bulk", headers=h, json={"entity": "placements", "ids": ["x"], "action": "disable"})).status_code == 422
    push = await client.post(f"{Q}/links/bulk-to-organizations", headers=h, json={"slugs": ["grand-hall"], "links": [LINK]})
    assert push.status_code == 201 and push.json() == {"organizations": 1, "links": 1}
    assert (await client.post(f"{Q}/links/bulk-to-organizations", headers=h, json={"slugs": ["ghost"], "links": [LINK]})).status_code == 404

    # export + integrations + import stub
    ex = await client.get(f"{Q}/export.json?slugs=grand-hall", headers=h)
    doc = ex.json()
    assert ex.status_code == 200 and doc["format"] == "dream-heavens-qr-hub" and doc["organizations"][0]["qr_urls"][0]["url"].endswith("/r/grand-hall")
    assert "password" not in doc["organizations"][0]["wifi"]
    assert (await client.get(f"{Q}/organizations/grand-hall/integrations", headers=h)).json()["connected"] is False

    # delete the organization and everything under it
    assert (await client.post(f"{Q}/bulk", headers=h, json={"entity": "organizations", "ids": [ws["organization"]["id"]], "action": "delete"})).json() == {"affected": 1}
    assert (await client.get(f"{Q}/organizations/grand-hall", headers=h)).status_code == 404
    assert (await client.delete(f"{Q}/organizations/grand-hall", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_delete_org_endpoint_and_non_admin_denied(client, auth_headers, db_session):
    await client.post(f"{Q}/organizations", headers=auth_headers, json={"name": "Temp Org"})
    assert (await client.delete(f"{Q}/organizations/temp-org", headers=auth_headers)).status_code == 204
    r = await client.post(f"{settings.API_V1_PREFIX}/auth/login", json={"username_or_email": "rajesh", "password": "password123"})
    low = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert (await client.get(f"{Q}/organizations", headers=low)).status_code == 403
    assert (await client.post(f"{Q}/organizations", headers=low, json={"name": "Nope"})).status_code == 403
