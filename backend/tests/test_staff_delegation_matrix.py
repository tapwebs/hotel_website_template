import pytest
from httpx import AsyncClient
from backend.app.core.config import settings
from backend.app.core.rbac import Role, Permission


async def get_login_headers(client: AsyncClient, username: str, password: str = "password123") -> dict:
    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": username, "password": password}
    )
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    token = res.json()["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "X-Property-Id": settings.DEFAULT_PROPERTY_ID
    }


# ========================================================
# 1. SUPERADMIN CAPABILITIES & TESTS
# ========================================================

@pytest.mark.asyncio
async def test_superadmin_manage_admin_and_delegation(client: AsyncClient):
    super_headers = await get_login_headers(client, "superadmin")

    # 1. Superadmin can create an ADMIN / General Manager
    create_res = await client.post(
        f"{settings.API_V1_PREFIX}/staff",
        headers=super_headers,
        json={
            "username": "new_gm",
            "email": "new_gm@example.com",
            "full_name": "New GM Account",
            "password": "password123",
            "role_code": Role.ROLE_GENERAL_MANAGER.value,
            "property_id": settings.DEFAULT_PROPERTY_ID,
            "management_scope": ["RESTAURANT_POS"]
        }
    )
    assert create_res.status_code == 200, create_res.text
    created_admin = create_res.json()
    admin_id = created_admin["user_id"]
    assert created_admin["role_code"] == Role.ROLE_GENERAL_MANAGER.value
    assert "RESTAURANT_POS" in created_admin["management_scope"]

    # 2. Superadmin can modify ADMIN management scope
    update_res = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}",
        headers=super_headers,
        json={
            "management_scope": ["RESTAURANT_POS", "ACCOUNTANT"]
        }
    )
    assert update_res.status_code == 200
    assert "ACCOUNTANT" in update_res.json()["management_scope"]

    # 3. Superadmin can deactivate ADMIN
    deactivate_res = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}/status",
        headers=super_headers,
        json={"is_active": False}
    )
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # Deactivated ADMIN cannot log in
    deact_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "new_gm", "password": "password123"}
    )
    assert deact_login.status_code == 401

    # 4. Superadmin can activate ADMIN
    activate_res = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}/status",
        headers=super_headers,
        json={"is_active": True}
    )
    assert activate_res.status_code == 200
    assert activate_res.json()["is_active"] is True

    # 5. Superadmin can reset ADMIN password
    reset_res = await client.post(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}/reset-password",
        headers=super_headers,
        json={"new_password": "new_secure_pwd_123"}
    )
    assert reset_res.status_code == 200

    # Old password fails, new password succeeds
    fail_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "new_gm", "password": "password123"}
    )
    assert fail_login.status_code == 401

    succ_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "new_gm", "password": "new_secure_pwd_123"}
    )
    assert succ_login.status_code == 200

    # 6. Superadmin can force logout ADMIN
    force_res = await client.post(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}/force-logout",
        headers=super_headers
    )
    assert force_res.status_code == 200


# ========================================================
# 2. ADMIN DELEGATED AUTHORITY & BOUNDARIES
# ========================================================

@pytest.mark.asyncio
async def test_admin_delegated_scope_and_restrictions(client: AsyncClient):
    admin_headers = await get_login_headers(client, "admin")
    super_headers = await get_login_headers(client, "superadmin")

    # 1. Admin can create subordinate staff in allowed scope (e.g. Front Desk)
    create_staff_res = await client.post(
        f"{settings.API_V1_PREFIX}/staff",
        headers=admin_headers,
        json={
            "username": "subordinate_fd",
            "email": "sub_fd@example.com",
            "full_name": "Subordinate Front Desk",
            "password": "password123",
            "role_code": Role.ROLE_WAITER.value,
            "property_id": settings.DEFAULT_PROPERTY_ID
        }
    )
    assert create_staff_res.status_code == 200, create_staff_res.text
    sub_id = create_staff_res.json()["user_id"]

    # 2. Admin can edit allowed subordinate staff
    edit_res = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{sub_id}",
        headers=admin_headers,
        json={"full_name": "Updated Subordinate Name"}
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["full_name"] == "Updated Subordinate Name"

    # 3. Restrict Admin's scope: Superadmin removes HOUSEKEEPING from Admin's scope
    admin_user_res = await client.get(
        f"{settings.API_V1_PREFIX}/staff",
        headers=super_headers
    )
    admin_record = [u for u in admin_user_res.json() if u["username"] == "admin"][0]

    # Update admin to only have FRONT_DESK in scope
    await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_record['user_id']}",
        headers=super_headers,
        json={"management_scope": ["RESTAURANT_POS"]}
    )

    # Re-login as Admin since scope modification deliberately revoked old session
    admin_headers = await get_login_headers(client, "admin")

    # Now Admin attempts to create a HOUSEKEEPING user -> MUST BE 403 FORBIDDEN
    denied_hk_create = await client.post(
        f"{settings.API_V1_PREFIX}/staff",
        headers=admin_headers,
        json={
            "username": "unauthorized_hk",
            "email": "unauthorized_hk@example.com",
            "full_name": "Unauthorized Housekeeper",
            "password": "password123",
            "role_code": Role.ROLE_ACCOUNTANT.value,
            "property_id": settings.DEFAULT_PROPERTY_ID
        }
    )
    assert denied_hk_create.status_code == 403
    assert "outside your delegated management scope" in denied_hk_create.text

    # Admin attempts to edit existing housekeeper (usr-dh-003 / rajesh) -> MUST BE 403
    denied_hk_edit = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-002",
        headers=admin_headers,
        json={"full_name": "Hacked Housekeeper"}
    )
    assert denied_hk_edit.status_code == 403

    # Admin attempts to deactivate rajesh -> MUST BE 403
    denied_hk_status = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-002/status",
        headers=admin_headers,
        json={"is_active": False}
    )
    assert denied_hk_status.status_code == 403


# ========================================================
# 3. PERMISSION DELEGATION RULE (GRANTED ⊆ OWN_PERMISSIONS)
# ========================================================

@pytest.mark.asyncio
async def test_permission_delegation_rule(client: AsyncClient):
    admin_headers = await get_login_headers(client, "admin")

    # Admin tries to grant a permission they DO NOT possess (e.g., MANAGE_SYSTEM)
    denied_perm = await client.post(
        f"{settings.API_V1_PREFIX}/staff",
        headers=admin_headers,
        json={
            "username": "overprivileged_agent",
            "email": "overprivileged@example.com",
            "full_name": "Overprivileged Agent",
            "password": "password123",
            "role_code": Role.ROLE_WAITER.value,
            "permissions": ["ACCESS_POS", "MANAGE_SYSTEM"]
        }
    )
    assert denied_perm.status_code == 403
    assert "exceeds your own administrative authority" in denied_perm.text


# ========================================================
# 4. ADMIN SELF-PROTECTION & DENIALS
# ========================================================

@pytest.mark.asyncio
async def test_admin_self_protection_and_hierarchical_denials(client: AsyncClient):
    admin_headers = await get_login_headers(client, "admin")
    admin_sess = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=admin_headers)
    admin_id = admin_sess.json()["userId"]

    # 1. Admin CANNOT modify their own role
    res_role = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}",
        headers=admin_headers,
        json={"role_code": Role.ROLE_SUPER_ADMIN.value}
    )
    assert res_role.status_code == 403
    assert "cannot alter their own assigned role" in res_role.text

    # 2. Admin CANNOT modify their own permissions
    res_perm = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}",
        headers=admin_headers,
        json={"permissions": ["MANAGE_SYSTEM"]}
    )
    assert res_perm.status_code == 403
    assert "cannot modify their own permissions" in res_perm.text

    # 3. Admin CANNOT modify their own management scope
    res_scope = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}",
        headers=admin_headers,
        json={"management_scope": ["SYSTEM"]}
    )
    assert res_scope.status_code == 403

    # 4. Admin CANNOT deactivate themselves
    res_deact = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/{admin_id}/status",
        headers=admin_headers,
        json={"is_active": False}
    )
    assert res_deact.status_code == 403
    assert "cannot deactivate their own account" in res_deact.text

    # 5. Admin CANNOT create a SUPERADMIN
    res_create_super = await client.post(
        f"{settings.API_V1_PREFIX}/staff",
        headers=admin_headers,
        json={
            "username": "evil_super",
            "email": "evil_super@example.com",
            "full_name": "Evil Super",
            "password": "password123",
            "role_code": Role.ROLE_SUPER_ADMIN.value
        }
    )
    assert res_create_super.status_code == 403

    # 6. Admin CANNOT modify a SUPERADMIN
    res_edit_super = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-000",
        headers=admin_headers,
        json={"full_name": "Tampered SuperAdmin"}
    )
    assert res_edit_super.status_code == 403


# ========================================================
# 5. SUPERADMIN SAFETY: CANNOT DEACTIVATE LAST SUPERADMIN
# ========================================================

@pytest.mark.asyncio
async def test_cannot_deactivate_last_active_superadmin(client: AsyncClient):
    super_headers = await get_login_headers(client, "superadmin")

    # There is only 1 superadmin seeded (usr-dh-000)
    res = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-000/status",
        headers=super_headers,
        json={"is_active": False}
    )
    # Backend protects with HTTP 409 Conflict
    assert res.status_code == 409
    assert "last active SUPERADMIN" in res.text


# ========================================================
# 6. FORCE LOGOUT & SESSION INVALIDATION
# ========================================================

@pytest.mark.asyncio
async def test_force_logout_invalidates_active_token(client: AsyncClient):
    super_headers = await get_login_headers(client, "superadmin")

    # Login as Priya (Front Desk)
    priya_headers = await get_login_headers(client, "priya")

    # Priya can access session endpoint
    sess1 = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=priya_headers)
    assert sess1.status_code == 200

    # SuperAdmin force logouts Priya
    force_res = await client.post(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-002/force-logout",
        headers=super_headers
    )
    assert force_res.status_code == 200

    # Priya's existing JWT token is now INVALID (401 Unauthorized)
    sess2 = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=priya_headers)
    assert sess2.status_code == 401
    assert "Session has been terminated or revoked" in sess2.text


# ========================================================
# 7. DEPARTMENT STAFF CANNOT ACCESS STAFF ADMINISTRATION
# ========================================================

@pytest.mark.asyncio
async def test_department_staff_forbidden_staff_admin(client: AsyncClient):
    priya_headers = await get_login_headers(client, "priya")

    # GET /staff -> 403
    res_get = await client.get(f"{settings.API_V1_PREFIX}/staff", headers=priya_headers)
    assert res_get.status_code == 403

    # POST /staff -> 403
    res_post = await client.post(
        f"{settings.API_V1_PREFIX}/staff",
        headers=priya_headers,
        json={
            "username": "rogue",
            "email": "rogue@dh.com",
            "full_name": "Rogue Staff",
            "password": "password123",
            "role_code": Role.ROLE_WAITER.value
        }
    )
    assert res_post.status_code == 403
