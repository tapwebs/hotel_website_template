import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.organization import Organization, Property, PropertySettings
from backend.app.core.dependencies import evict_property_cache
from backend.app.core.config import settings


async def login(client: AsyncClient, username: str, password: str = "password123") -> dict:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password}
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_dynamic_property_lookup_without_hardcoded_cache(client: AsyncClient, db_session: AsyncSession):
    """Verify newly created property in DB works immediately without any hardcoded dictionary."""
    evict_property_cache()

    # Create a dynamic property in default org
    new_prop = Property(
        property_id="prop-new-dynamic-99",
        org_id=settings.DEFAULT_ORG_ID,
        code="TM-DYN99",
        name="TapMenu Dynamic Property",
        address_line1="Heritage Road 99",
        city="Jodhpur",
        state_code="08",
        postal_code="342001",
        country_code="IN"
    )
    new_settings = PropertySettings(
        property_id="prop-new-dynamic-99",
        current_business_date="2026-10-15",
        night_audit_status="IDLE",
        settings_json={}
    )
    db_session.add_all([new_prop, new_settings])
    await db_session.commit()

    # Admin of org-dreamheavens-01 should be able to access this property
    admin_headers = await login(client, "admin")
    resp = await client.get(
        "/api/v1/reports/dashboard-kpis",
        headers={**admin_headers, "X-Property-Id": "prop-new-dynamic-99"}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_nonexistent_property_rejected(client: AsyncClient):
    """Verify non-existent property returns 404 or 403 and is rejected."""
    evict_property_cache()
    admin_headers = await login(client, "admin")
    resp = await client.get(
        "/api/v1/reports/dashboard-kpis",
        headers={**admin_headers, "X-Property-Id": "prop-fake-nonexistent-999"}
    )
    assert resp.status_code in [403, 404], f"Expected 403/404 for fake property, got {resp.status_code}"


@pytest.mark.asyncio
async def test_cross_tenant_access_denied_for_owner_and_manager(client: AsyncClient, db_session: AsyncSession):
    """Verify hotel owner / manager cannot access a property belonging to a competitor organization."""
    evict_property_cache()

    # Create a competitor organization and property
    competitor_org = Organization(
        org_id="org-competitor-88",
        name="Competitor Luxury Hotels",
        legal_entity_name="Competitor Pvt Ltd",
        is_active=True
    )
    competitor_prop = Property(
        property_id="prop-competitor-88",
        org_id=competitor_org.org_id,
        code="COMP-88",
        name="Competitor Grand Resort",
        address_line1="Marine Drive 88",
        city="Mumbai",
        state_code="27",
        postal_code="400001",
        country_code="IN"
    )
    competitor_settings = PropertySettings(
        property_id="prop-competitor-88",
        current_business_date="2026-10-15",
        night_audit_status="IDLE",
        settings_json={}
    )
    db_session.add_all([competitor_org, competitor_prop, competitor_settings])
    await db_session.commit()

    # Dream Heavens GM (admin) attempts to access Competitor Property
    admin_headers = await login(client, "admin")
    resp_gm = await client.get(
        "/api/v1/reports/dashboard-kpis",
        headers={**admin_headers, "X-Property-Id": "prop-competitor-88"}
    )
    assert resp_gm.status_code == 403, f"Expected 403 for GM cross-tenant access, got {resp_gm.status_code}"

    # Dream Heavens Superadmin (Owner) attempts to access Competitor Property
    super_headers = await login(client, "superadmin")
    resp_super = await client.get(
        "/api/v1/reports/dashboard-kpis",
        headers={**super_headers, "X-Property-Id": "prop-competitor-88"}
    )
    assert resp_super.status_code == 403, f"Expected 403 for Owner cross-tenant access, got {resp_super.status_code}"


@pytest.mark.asyncio
async def test_staff_restricted_to_assigned_property_within_org(client: AsyncClient):
    """Operational staff cannot access another property even within the same organization."""
    priya_headers = await login(client, "priya")  # Assigned to prop-jaipur-01
    resp = await client.get(
        "/api/v1/reports/dashboard-kpis",
        headers={**priya_headers, "X-Property-Id": "prop-goa-02"}
    )
    assert resp.status_code == 403, f"Expected 403 for staff cross-property access, got {resp.status_code}"


@pytest.mark.asyncio
async def test_owner_cannot_switch_property_to_competitor_org(client: AsyncClient, db_session: AsyncSession):
    """Verify Hotel Owner cannot switch active property to a competitor organization's property."""
    evict_property_cache()
    super_headers = await login(client, "superadmin")
    resp = await client.post(
        "/api/v1/auth/switch-property",
        json={"property_id": "prop-competitor-88"},
        headers=super_headers
    )
    assert resp.status_code == 403, f"Expected 403 when Owner switches to other org property, got {resp.status_code}"


@pytest.mark.asyncio
async def test_owner_session_only_exposes_own_organization_properties(client: AsyncClient):
    """Verify Hotel Owner session only contains properties from their authorized organization."""
    super_headers = await login(client, "superadmin")
    resp = await client.get("/api/v1/auth/session", headers=super_headers)
    assert resp.status_code == 200
    data = resp.json()
    prop_ids = [p["propertyId"] for p in data["availableProperties"]]
    assert "prop-jaipur-01" in prop_ids
    assert "prop-competitor-88" not in prop_ids


@pytest.mark.asyncio
async def test_owner_cannot_access_or_mutate_competitor_staff(client: AsyncClient, db_session: AsyncSession):
    """Verify Hotel Owner cannot view, modify, reset password, or force logout staff in another organization."""
    from backend.app.models.user import User
    from backend.app.core.security import hash_password

    # Seed a competitor staff user
    comp_user = User(
        user_id="usr-comp-999",
        org_id="org-competitor-88",
        property_id="prop-competitor-88",
        username="competitor_staff",
        email="comp_staff@competitor.com",
        full_name="Competitor Staff",
        password_hash=hash_password("password123"),
        role_code="ROLE_FRONT_DESK",
        account_type="STAFF",
        job_role="RECEPTIONIST",
        permissions=["VIEW_FRONT_DESK"],
        is_active=True,
        token_version=1
    )
    db_session.add(comp_user)
    await db_session.commit()

    super_headers = await login(client, "superadmin")

    # 1. GET staff details -> 403
    r_get = await client.get("/api/v1/staff/usr-comp-999", headers=super_headers)
    assert r_get.status_code == 403, f"Expected 403 for cross-org get_staff, got {r_get.status_code}"

    # 2. PATCH staff -> 403
    r_patch = await client.patch("/api/v1/staff/usr-comp-999", json={"full_name": "Hacked"}, headers=super_headers)
    assert r_patch.status_code == 403, f"Expected 403 for cross-org update_staff, got {r_patch.status_code}"

    # 3. PATCH status -> 403
    r_status = await client.patch("/api/v1/staff/usr-comp-999/status", json={"is_active": False}, headers=super_headers)
    assert r_status.status_code == 403, f"Expected 403 for cross-org update_status, got {r_status.status_code}"

    # 4. POST reset-password -> 403
    r_reset = await client.post("/api/v1/staff/usr-comp-999/reset-password", json={"new_password": "NewSecret123!"}, headers=super_headers)
    assert r_reset.status_code == 403, f"Expected 403 for cross-org reset_password, got {r_reset.status_code}"

    # 5. POST force-logout -> 403
    r_logout = await client.post("/api/v1/staff/usr-comp-999/force-logout", headers=super_headers)
    assert r_logout.status_code == 403, f"Expected 403 for cross-org force_logout, got {r_logout.status_code}"

    # 6. GET /api/v1/staff listing does NOT include usr-comp-999
    r_list = await client.get("/api/v1/staff", headers=super_headers)
    assert r_list.status_code == 200
    listed_ids = [u["user_id"] for u in r_list.json()]
    assert "usr-comp-999" not in listed_ids

