import pytest
from sqlalchemy import select
from backend.app.models.base import generate_uuid
from backend.app.models.website import (
    QrLink,
    QrOrganization,
    QrPlacement,
    QrSetting,
    WebsiteRoomRate,
    WebsiteUser,
)


@pytest.mark.asyncio
async def test_qr_hub_public_and_redirects(client, db_session):
    """Verify QR redirects (/r/:slug), public hub API, and click/visit tracking."""
    # Seed QR Org
    org_id = generate_uuid()
    org = QrOrganization(
        id=org_id,
        slug="hotel-dream-heavens-test",
        name="TapMenu Grand Test",
        category="Hotel",
        qr_status="active",
        status="published",
    )
    db_session.add(org)

    placement = QrPlacement(
        id=generate_uuid(),
        organization_id=org_id,
        code="lobby",
        label="Lobby Standee",
        kind="lobby",
        status="active",
    )
    db_session.add(placement)

    link_id = generate_uuid()
    link = QrLink(
        id=link_id,
        organization_id=org_id,
        title="Book a Stay",
        destination_url="http://localhost:5173/book",
        category="Connect",
        sort_order=0,
        status="active",
    )
    db_session.add(link)
    await db_session.commit()

    # 1. Scan redirect
    res_scan = await client.get("/r/hotel-dream-heavens-test?p=lobby", follow_redirects=False)
    assert res_scan.status_code == 302
    assert "http://localhost:5173/hub/hotel-dream-heavens-test?p=lobby" in res_scan.headers["location"]

    # 2. Public Hub data
    res_hub = await client.get("/hub/hotel-dream-heavens-test?p=lobby")
    assert res_hub.status_code == 200
    hub_data = res_hub.json()
    assert hub_data["slug"] == "hotel-dream-heavens-test"
    assert hub_data["placement"]["code"] == "lobby"
    assert len(hub_data["links"]) == 1
    assert hub_data["links"][0]["title"] == "Book a Stay"

    # 3. Public visit beacon
    res_visit = await client.post("/qr-hub/public/visit", json={"slug": "hotel-dream-heavens-test"})
    assert res_visit.status_code == 204

    # 4. Public click beacon
    res_click = await client.post(
        "/qr-hub/public/click",
        json={"slug": "hotel-dream-heavens-test", "linkId": link_id, "placement": "lobby"},
    )
    assert res_click.status_code == 204


@pytest.mark.asyncio
async def test_website_admin_routes(client, auth_headers, db_session):
    """Verify HMS staff/admin access to /api/v1/website/admin/* and room rates."""
    # 1. Admin stats
    res_stats = await client.get("/api/v1/website/admin/stats", headers=auth_headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert "totals" in stats
    assert "bookings" in stats

    # 2. List room rates
    res_rooms = await client.get("/api/v1/website/admin/rooms", headers=auth_headers)
    assert res_rooms.status_code == 200
    rooms = res_rooms.json()["items"]
    assert len(rooms) >= 2

    # 3. Update room rate
    res_put_rate = await client.put(
        "/api/v1/website/admin/rooms/deluxe",
        json={"rate": 1800},
        headers=auth_headers,
    )
    assert res_put_rate.status_code == 200
    assert res_put_rate.json()["rate"] == 1800

    # Verify rate is persisted
    res_rooms_after = await client.get("/api/v1/website/admin/rooms", headers=auth_headers)
    deluxe = next(r for r in res_rooms_after.json()["items"] if r["id"] == "deluxe")
    assert deluxe["rate"] == 1800

    # 4. List users
    res_users = await client.get("/api/v1/website/admin/users", headers=auth_headers)
    assert res_users.status_code == 200
    assert "items" in res_users.json()

    # 5. Guest search
    res_search = await client.get("/api/v1/website/admin/guest-search?q=test", headers=auth_headers)
    assert res_search.status_code == 200
    assert "items" in res_search.json()

    # 6. QR Hub Admin organizations
    res_orgs = await client.get("/api/v1/website/qr-hub/admin/organizations", headers=auth_headers)
    assert res_orgs.status_code == 200
    assert "items" in res_orgs.json()

    # 7. QR Hub settings
    res_settings = await client.get("/api/v1/website/qr-hub/admin/settings", headers=auth_headers)
    assert res_settings.status_code == 200
    assert "settings" in res_settings.json()
