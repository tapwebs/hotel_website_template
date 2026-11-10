"""Regression: public QR hub payload contract (all five printed QR destinations) and the HMS Activity Log endpoint."""
import pytest
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.models.base import generate_uuid
from backend.app.models.website import QrLink, QrOrganization, QrPlacement, WebsiteActivityLog

SLUG = "hotel-dream-heavens"
PLACEMENTS = {"lobby": "Lobby standee", "reception": "Reception desk", "restaurant": "Restaurant", "banquet-hall": "Banquet Hall"}
ACTIVITY = f"{settings.API_V1_PREFIX}/website/admin/activity"


async def seed_hub(db):
    org_id = generate_uuid()
    db.add(QrOrganization(id=org_id, slug=SLUG, name="Hotel Dream Heaven’s", category="Hotel", qr_status="active", status="published"))
    for code, label in PLACEMENTS.items():
        db.add(QrPlacement(id=generate_uuid(), organization_id=org_id, code=code, label=label, kind="other", status="active"))
    db.add(QrPlacement(id=generate_uuid(), organization_id=org_id, code="off", label="Off", kind="other", status="disabled"))
    db.add(QrLink(id=generate_uuid(), organization_id=org_id, title="Book a Stay", destination_url="http://localhost:5173/book", sort_order=0, status="active"))
    db.add(QrLink(id=generate_uuid(), organization_id=org_id, title="Restaurant", destination_url="http://localhost:5173/dining", sort_order=1,
                  status="active", hours={"open": "00:00", "close": "23:59"}))
    db.add(QrLink(id=generate_uuid(), organization_id=org_id, title="Disabled", destination_url="https://x.example", sort_order=2, status="disabled"))
    await db.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("code", [None, *PLACEMENTS])
async def test_all_five_qr_destinations(client, db_session, code):
    await seed_hub(db_session)
    q = f"?p={code}" if code else ""
    scan = await client.get(f"/r/{SLUG}{q}", follow_redirects=False)
    assert scan.status_code == 302
    assert scan.headers["location"] == f"http://localhost:5173/hub/{SLUG}{q}"  # printed QR identity unchanged

    hub = (await client.get(f"/qr-hub/public/hub/{SLUG}{q}")).json()
    # Shape the website's HotelHub page reads (frontend/website/src/features/qrhub/lib/types.ts PublicHub)
    assert hub["organization"]["slug"] == SLUG and hub["organization"]["name"].startswith("Hotel Dream")
    assert [l["title"] for l in hub["links"]] == ["Book a Stay", "Restaurant"]
    assert {"destination_url", "title_hi", "is_featured", "open_now", "opens_at", "hours"} <= set(hub["links"][0])
    assert hub["links"][0]["open_now"] is True
    assert isinstance(hub["offers"], list)
    if code:
        assert hub["placement"]["code"] == code and hub["placement"]["label"] == PLACEMENTS[code]
    else:
        assert hub["placement"] is None


@pytest.mark.asyncio
async def test_hub_legacy_flat_fields_kept_and_disabled_placement_ignored(client, db_session):
    await seed_hub(db_session)
    hub = (await client.get(f"/hub/{SLUG}?p=off")).json()
    assert hub["slug"] == SLUG and hub["links"][0]["destinationUrl"].endswith("/book")
    assert hub["placement"] is None


@pytest.mark.asyncio
async def test_hub_unknown_is_404(client, db_session):
    assert (await client.get("/qr-hub/public/hub/ghost-x")).status_code == 404


async def login(client, user):
    r = await client.post(f"{settings.API_V1_PREFIX}/auth/login", json={"username_or_email": user, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_activity_requires_auth_and_admin(client, db_session):
    assert (await client.get(ACTIVITY)).status_code == 401
    # staff without settings access must stay out
    codes = {u: (await client.get(ACTIVITY, headers=await login(client, u))).status_code for u in ("rajesh", "kavita", "rohan")}
    assert set(codes.values()) <= {403}, codes


@pytest.mark.asyncio
async def test_activity_empty_then_records_and_pagination(client, auth_headers, db_session):
    r = await client.get(ACTIVITY, headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == {"items": [], "page": 1, "pageSize": 30, "total": 0, "totalPages": 1}

    for i in range(3):
        db_session.add(WebsiteActivityLog(actor_name="Vedansh", action="room.rate", target=f"Room {i}", detail="₹1 -> ₹2"))
    await db_session.commit()
    p1 = (await client.get(f"{ACTIVITY}?page=1&pageSize=2", headers=auth_headers)).json()
    p2 = (await client.get(f"{ACTIVITY}?page=2&pageSize=2", headers=auth_headers)).json()
    assert (p1["total"], p1["totalPages"], len(p1["items"]), len(p2["items"])) == (3, 2, 2, 1)
    assert set(p1["items"][0]) == {"id", "at", "actorName", "action", "target", "detail"}
    assert (await client.get(f"{ACTIVITY}?page=0", headers=auth_headers)).status_code == 422


@pytest.mark.asyncio
async def test_activity_missing_table_returns_empty_not_500(client, auth_headers, db_session):
    await db_session.execute(text("DROP TABLE website.activity_log"))
    await db_session.commit()
    r = await client.get(ACTIVITY, headers=auth_headers)
    assert r.status_code == 200 and r.json()["items"] == []


QR = f"{settings.API_V1_PREFIX}/website/qr-hub/admin"


@pytest.mark.asyncio
async def test_qr_analytics_and_csv_are_native(client, auth_headers, db_session):
    """The QR library Analytics tab used to fall through to the website service ("website_unavailable")."""
    from datetime import datetime, timezone
    from backend.app.models.website import QrClick, QrVisit

    await seed_hub(db_session)
    org = (await db_session.execute(text("SELECT id FROM website.qr_organizations"))).scalar()
    link = (await db_session.execute(text("SELECT id FROM website.qr_links WHERE title='Book a Stay'"))).scalar()
    place = (await db_session.execute(text("SELECT id FROM website.qr_placements WHERE code='lobby'"))).scalar()
    now = datetime.now(timezone.utc)
    db_session.add(QrVisit(organization_id=org, placement_id=place, source="scan", device_type="mobile", browser="chrome", os="android", visited_at=now))
    db_session.add(QrVisit(organization_id=org, source="direct", device_type="desktop", browser="safari", os="mac", referrer_host="=evil.example", visited_at=now))
    db_session.add(QrClick(organization_id=org, link_id=link, placement_id=place, device_type="mobile", browser="chrome", clicked_at=now))
    await db_session.commit()

    assert (await client.get(f"{QR}/analytics")).status_code == 401
    r = await client.get(f"{QR}/analytics", headers=auth_headers)
    assert r.status_code == 200
    a = r.json()
    assert (a["totals"]["visits"], a["totals"]["scans"], a["totals"]["clicks"]) == (2, 1, 1)
    assert len(a["daily"]) == 30 and sum(d["visits"] for d in a["daily"]) == 2
    assert len(a["byHour"]) == 24 and len(a["byWeekday"]) == 7
    assert a["byPlacement"][0]["code"] == "lobby" and a["byPlacement"][0]["clicks"] == 1
    assert a["topLinks"][0]["title"] == "Book a Stay"

    one = await client.get(f"{QR}/organizations/{SLUG}/analytics?from=2020-01-01&to=2020-01-03", headers=auth_headers)
    assert one.status_code == 200 and one.json()["totals"]["visits"] == 0 and len(one.json()["daily"]) == 3
    assert (await client.get(f"{QR}/organizations/ghost/analytics", headers=auth_headers)).status_code == 404
    assert (await client.get(f"{QR}/analytics?from=2025-02-01&to=2025-01-01", headers=auth_headers)).status_code == 422

    csv = await client.get(f"{QR}/export.csv?type=visits", headers=auth_headers)
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    assert csv.headers["content-disposition"].startswith("attachment")
    lines = csv.text.strip().split("\r\n")
    assert lines[0].startswith("visited_at,organization") and len(lines) == 3
    assert "'=evil.example" in csv.text  # formula-injection guard
    assert (await client.get(f"{QR}/export.csv?type=clicks", headers=auth_headers)).text.count("\r\n") == 2
    assert (await client.get(f"{QR}/export.csv?type=bogus", headers=auth_headers)).status_code == 422
