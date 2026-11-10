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
async def test_superadmin_full_access(client: AsyncClient):
    """Verify SUPERADMIN has unrestricted access across all modules."""
    headers = await login(client, "superadmin")

    # Staff administration
    staff_resp = await client.get("/api/v1/staff", headers=headers)
    assert staff_resp.status_code == 200

    # Settings management
    settings_resp = await client.get("/api/v1/settings", headers=headers)
    assert settings_resp.status_code == 200

    # Dashboard & Reports
    kpi_resp = await client.get("/api/v1/reports/dashboard-kpis", headers=headers)
    assert kpi_resp.status_code == 200

    # Can create another admin or staff member
    new_staff_resp = await client.post(
        "/api/v1/staff",
        json={
            "username": "newmanager",
            "email": "newmanager@example.com",
            "full_name": "New Manager",
            "password": "password123",
            "role_code": "ROLE_GENERAL_MANAGER"
        },
        headers=headers
    )
    assert new_staff_resp.status_code == 200
    assert new_staff_resp.json()["role_code"] == "ROLE_GENERAL_MANAGER"


@pytest.mark.asyncio
async def test_general_manager_hotel_admin_access(client: AsyncClient):
    """Verify GENERAL_MANAGER has complete operational access but cannot create SUPERADMIN."""
    headers = await login(client, "admin")

    # Allowed hotel admin operations
    assert (await client.get("/api/v1/reports/dashboard-kpis", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/staff", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/settings", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/folios", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/payments", headers=headers)).status_code == 200
    assert (await client.post("/api/v1/reports/night-audit/rollover", headers=headers)).status_code == 200

    # Guard: GM CANNOT create a SUPERADMIN
    create_superadmin_resp = await client.post(
        "/api/v1/staff",
        json={
            "username": "roguesuper",
            "email": "rogue@example.com",
            "full_name": "Rogue Super",
            "password": "password123",
            "role_code": "ROLE_SUPER_ADMIN"
        },
        headers=headers
    )
    assert create_superadmin_resp.status_code == 403


@pytest.mark.asyncio
async def test_accountant_allowed_and_denied_actions(client: AsyncClient):
    """ACCOUNTANT sees folios, payments and reports, but not front desk, staff, settings or the restaurant."""
    headers = await login(client, "priya")
    assert (await client.get("/api/v1/reports/dashboard-kpis", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/folios", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/payments", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/reservations", headers=headers)).status_code == 403
    assert (await client.post("/api/v1/reports/night-audit/rollover", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/staff", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/settings", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/pos/tables", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_kitchen_staff_only_sees_the_kitchen(client: AsyncClient):
    """KITCHEN_STAFF reads the kitchen board and nothing else."""
    headers = await login(client, "rajesh")
    assert (await client.get("/api/v1/pos/orders", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/pos/orders/pending", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/pos/tables", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/folios", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/staff", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/settings", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_waiter_takes_and_accepts_orders_but_cannot_cancel(client: AsyncClient):
    """WAITER (and every retired role, which now maps to Waiter) works the restaurant only."""
    headers = await login(client, "vikram")
    headers["X-Property-Id"] = "prop-jaipur-01"
    assert (await client.get("/api/v1/pos/tables", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/pos/orders/pending", headers=headers)).status_code == 200
    o = await client.post("/api/v1/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1",
                                                       "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=headers)
    assert o.status_code == 201, o.text
    cancel = await client.patch(f"/api/v1/pos/orders/{o.json()['id']}/status", json={"status": "CANCELLED"}, headers=headers)
    assert cancel.status_code == 403
    assert (await client.get("/api/v1/reports/dashboard-kpis", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/reservations", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/maintenance/tickets", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/staff", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_captain_can_cancel_and_sees_the_kitchen(client: AsyncClient):
    headers = await login(client, "rohan")
    headers["X-Property-Id"] = "prop-jaipur-01"
    o = await client.post("/api/v1/pos/orders", json={"order_type": "DINE_IN", "table_number": "T1",
                                                       "items": [{"menuItemId": "menu-04", "quantity": 1}]}, headers=headers)
    cancel = await client.patch(f"/api/v1/pos/orders/{o.json()['id']}/status", json={"status": "CANCELLED", "reason": "Guest left"}, headers=headers)
    assert cancel.status_code == 200 and cancel.json()["status"] == "CANCELLED"
    assert (await client.get("/api/v1/pos/orders", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/folios", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/settings", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_unauthorized_and_unauthenticated_api(client: AsyncClient):
    """Verify 401 for unauthenticated and 403 for unauthorized requests."""
    # 401 Unauthenticated
    resp_401 = await client.get("/api/v1/staff")
    assert resp_401.status_code == 401

    # 403 Unauthorized (priya lacks MANAGE_STAFF)
    headers = await login(client, "priya")
    resp_403 = await client.get("/api/v1/staff", headers=headers)
    assert resp_403.status_code == 403


@pytest.mark.asyncio
async def test_strict_property_isolation(client: AsyncClient):
    """Verify that department staff cannot bypass property isolation by modifying X-Property-Id."""
    # Priya is assigned to prop-jaipur-01
    priya_headers = await login(client, "priya")
    priya_headers["X-Property-Id"] = "prop-goa-02"

    # Access to another property must be rejected with 403
    forbidden_resp = await client.get("/api/v1/reservations", headers=priya_headers)
    assert forbidden_resp.status_code == 403

    # Superadmin cross-property access is allowed
    super_headers = await login(client, "superadmin")
    super_headers["X-Property-Id"] = "prop-goa-02"
    super_resp = await client.get("/api/v1/reservations", headers=super_headers)
    assert super_resp.status_code == 200


@pytest.mark.asyncio
async def test_staff_cannot_elevate_own_role(client: AsyncClient):
    """Verify that staff members cannot change their own role."""
    headers = await login(client, "admin")

    # admin's user_id is usr-dh-001
    resp = await client.patch(
        "/api/v1/staff/usr-dh-001/role",
        json={"role_code": "ROLE_SUPER_ADMIN"},
        headers=headers
    )
    assert resp.status_code == 403
