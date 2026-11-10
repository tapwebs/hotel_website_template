"""Staff gateway: HMS auth first, then forward to the website backend with key + identity headers."""
import httpx
import pytest
from backend.app.api.routes import website_gateway
from backend.app.core.config import settings

URL = f"{settings.API_V1_PREFIX}/website"


@pytest.fixture
def upstream(monkeypatch):
    seen = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"ok": True}, headers={"content-disposition": "attachment", "set-cookie": "x=1"})

    monkeypatch.setattr(settings, "HMS_INTEGRATION_API_KEY", "gw-key")
    monkeypatch.setattr(website_gateway, "_client", httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    return seen


async def login(client, user):
    r = await client.post(f"{settings.API_V1_PREFIX}/auth/login", json={"username_or_email": user, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_requires_hms_login(client, upstream):
    assert (await client.get(f"{URL}/admin/bookings")).status_code == 401
    assert upstream == []


@pytest.mark.asyncio
async def test_forwards_with_key_and_identity(client, upstream):
    h = await login(client, "admin")
    h["X-HMS-User-Role"] = "admin"  # client-supplied identity headers must be ignored
    r = await client.get(f"{URL}/admin/bookings?status=pending", headers={**h, "X-HMS-Integration-Key": "stolen"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert "set-cookie" not in r.headers and r.headers["content-disposition"] == "attachment"
    req = upstream[0]
    assert req.url.path == "/admin/bookings" and req.url.params["status"] == "pending"
    assert req.headers["x-hms-integration-key"] == "gw-key"
    assert req.headers["x-hms-user-role"] == "admin" and req.headers["x-hms-user-id"]


@pytest.mark.asyncio
async def test_restaurant_and_finance_staff_are_refused(client, upstream):
    n = len(upstream)
    # the accountant has neither reservation nor settings access
    assert (await client.get(f"{URL}/admin/bookings", headers=await login(client, "priya"))).status_code == 403
    # a role with neither reservation nor settings access never reaches the website backend
    r = await client.get(f"{URL}/admin/bookings", headers=await login(client, "rohan"))
    assert r.status_code == 403 and len(upstream) == n


@pytest.mark.asyncio
async def test_unconfigured_and_unreachable(client, monkeypatch):
    h = await login(client, "admin")
    monkeypatch.setattr(settings, "HMS_INTEGRATION_API_KEY", None)
    assert (await client.get(f"{URL}/legacy/stats", headers=h)).status_code == 503
    monkeypatch.setattr(settings, "HMS_INTEGRATION_API_KEY", "gw-key")

    def boom(req):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(website_gateway, "_client", httpx.AsyncClient(transport=httpx.MockTransport(boom)))
    assert (await client.get(f"{URL}/legacy/stats", headers=h)).status_code == 502
