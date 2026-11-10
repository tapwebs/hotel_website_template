import pytest
from httpx import AsyncClient


async def login(client: AsyncClient, username: str, password: str = "password123") -> dict:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password}
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_anonymous_cannot_get_reservation_detail(client: AsyncClient):
    """Anonymous request to get reservation detail must return 401 Unauthorized."""
    resp = await client.get("/api/v1/reservations/res-101")
    assert resp.status_code == 401, f"Expected 401 Unauthorized, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_anonymous_cannot_confirm_reservation(client: AsyncClient):
    """Anonymous request to confirm reservation must return 401 Unauthorized."""
    resp = await client.post("/api/v1/reservations/res-101/confirm")
    assert resp.status_code == 401, f"Expected 401 Unauthorized, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_anonymous_cannot_reject_reservation(client: AsyncClient):
    """Anonymous request to reject reservation must return 401 Unauthorized."""
    resp = await client.post("/api/v1/reservations/res-101/reject")
    assert resp.status_code == 401, f"Expected 401 Unauthorized, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_anonymous_cannot_cancel_reservation(client: AsyncClient):
    """Anonymous request to cancel reservation must return 401 Unauthorized."""
    resp = await client.post("/api/v1/reservations/res-101/cancel")
    assert resp.status_code == 401, f"Expected 401 Unauthorized, got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_user_without_permission_cannot_access_or_modify(client: AsyncClient):
    """Staff without VIEW_RESERVATIONS or MANAGE_RESERVATIONS must return 403 Forbidden."""
    # rajesh is ROLE_HOUSEKEEPING (no VIEW_RESERVATIONS or MANAGE_RESERVATIONS)
    headers = await login(client, "rajesh")

    resp_get = await client.get("/api/v1/reservations/res-101", headers=headers)
    assert resp_get.status_code == 403, f"Expected 403 for Housekeeping viewing reservation, got {resp_get.status_code}"

    resp_confirm = await client.post("/api/v1/reservations/res-101/confirm", headers=headers)
    assert resp_confirm.status_code == 403, f"Expected 403 for Housekeeping confirming reservation, got {resp_confirm.status_code}"

    resp_cancel = await client.post("/api/v1/reservations/res-101/cancel", headers=headers)
    assert resp_cancel.status_code == 403, f"Expected 403 for Housekeeping cancelling reservation, got {resp_cancel.status_code}"


@pytest.mark.asyncio
async def test_authorized_receptionist_can_view_and_manage(client: AsyncClient):
    """Admins (VIEW_RESERVATIONS & MANAGE_RESERVATIONS) can view and manage; front desk work now sits with admins."""
    headers = await login(client, "admin")

    resp_get = await client.get("/api/v1/reservations/res-101", headers=headers)
    assert resp_get.status_code == 200, f"Expected 200 for Front Desk, got {resp_get.status_code}: {resp_get.text}"
    assert resp_get.json()["id"] == "res-101"

    # Cancel reservation as front desk
    resp_cancel = await client.post("/api/v1/reservations/res-101/cancel", headers=headers)
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_cross_property_access_denied(client: AsyncClient):
    """Staff bound to another property cannot read prop-jaipur-01 data. (Admins and super admins span properties.)"""
    admin_headers = await login(client, "superadmin")
    resp_create = await client.post(
        "/api/v1/staff",
        json={
            "username": "goa_waiter",
            "email": "goa_waiter@example.com",
            "full_name": "Goa Waiter",
            "password": "password123",
            "role_code": "ROLE_WAITER",
            "property_id": "prop-goa-02"
        },
        headers=admin_headers
    )
    assert resp_create.status_code == 200, resp_create.text
    goa_headers = await login(client, "goa_waiter")
    resp = await client.get("/api/v1/pos/tables", headers={**goa_headers, "X-Property-Id": "prop-jaipur-01"})
    assert resp.status_code == 403, f"Expected 403 for cross-property access, got {resp.status_code}"


@pytest.mark.asyncio
async def test_unknown_reservation_returns_404(client: AsyncClient):
    """Authorized user querying nonexistent reservation returns 404 Not Found."""
    headers = await login(client, "admin")
    resp = await client.get("/api/v1/reservations/nonexistent-id-999", headers=headers)
    assert resp.status_code == 404
