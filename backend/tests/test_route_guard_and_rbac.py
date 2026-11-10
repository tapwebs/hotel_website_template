import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_unauthenticated_protected_endpoints_return_401(client: AsyncClient):
    """Verify that all staff operational endpoints reject unauthenticated access with HTTP 401."""
    protected_endpoints = [
        "/api/v1/reports/dashboard-kpis",
        "/api/v1/reservations",
        "/api/v1/rooms",
        "/api/v1/guests",
        "/api/v1/folios",
        "/api/v1/staff",
        "/api/v1/settings",
        "/api/v1/housekeeping/tasks",
        "/api/v1/maintenance/tickets",
        "/api/v1/pos/orders",
    ]
    for endpoint in protected_endpoints:
        response = await client.get(endpoint)
        assert response.status_code == 401, f"Expected 401 for {endpoint}, got {response.status_code}"


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client: AsyncClient):
    """Verify that forged or malformed tokens return HTTP 401."""
    headers = {"Authorization": "Bearer forged.invalid.token.123"}
    response = await client.get("/api/v1/reports/dashboard-kpis", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_authenticated_dashboard_and_operations(client: AsyncClient):
    """Verify that a valid token grants access to protected endpoints."""
    # 1. Login as admin
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin", "password": "password123"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "X-Property-Id": "prop-jaipur-01"}

    # 2. Access dashboard KPIs
    kpi_resp = await client.get("/api/v1/reports/dashboard-kpis", headers=headers)
    assert kpi_resp.status_code == 200
    data = kpi_resp.json()
    assert "totalRooms" in data
    assert "occupiedRooms" in data

    # 3. Access reservations
    res_resp = await client.get("/api/v1/reservations", headers=headers)
    assert res_resp.status_code == 200
    assert isinstance(res_resp.json(), list)


@pytest.mark.asyncio
async def test_rbac_enforcement(client: AsyncClient):
    """Verify that roles restrict access to administrative endpoints (403 Forbidden)."""
    # 1. Login as priya (Front Desk role)
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "priya", "password": "password123"}
    )
    assert login_resp.status_code == 200
    priya_token = login_resp.json()["access_token"]
    priya_headers = {"Authorization": f"Bearer {priya_token}", "X-Property-Id": "prop-jaipur-01"}

    # 2. Front Desk user trying to update settings should receive 403 Forbidden
    settings_payload = {
        "settings": {
            "general": {"hotelName": "Hacked Hotel Name"}
        }
    }
    forbidden_resp = await client.put("/api/v1/settings", json=settings_payload, headers=priya_headers)
    assert forbidden_resp.status_code == 403

    # 3. Front Desk user trying to create a new staff member should receive 403 Forbidden
    create_staff_payload = {
        "username": "hacker123",
        "email": "hacker@test.com",
        "full_name": "Hacker User",
        "password": "password123",
        "role_code": "ROLE_SUPER_ADMIN"
    }
    staff_forbidden = await client.post("/api/v1/staff", json=create_staff_payload, headers=priya_headers)
    assert staff_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_property_isolation(client: AsyncClient):
    """Verify that requests scoped to property A only return property A operational data."""
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin", "password": "password123"}
    )
    token = login_resp.json()["access_token"]

    # Request for Jaipur
    jaipur_headers = {"Authorization": f"Bearer {token}", "X-Property-Id": "prop-jaipur-01"}
    jaipur_report = await client.get("/api/v1/reports/flash-report", headers=jaipur_headers)
    assert jaipur_report.status_code == 200
    assert jaipur_report.json()["propertyId"] == "prop-jaipur-01"
    assert "Jaipur" in jaipur_report.json()["propertyName"]

    # Request for Goa
    goa_headers = {"Authorization": f"Bearer {token}", "X-Property-Id": "prop-goa-02"}
    goa_report = await client.get("/api/v1/reports/flash-report", headers=goa_headers)
    assert goa_report.status_code == 200
    assert goa_report.json()["propertyId"] == "prop-goa-02"
    assert "Beach Resort" in goa_report.json()["propertyName"]
