import pytest
from httpx import AsyncClient
from backend.app.core.rbac import (
    AccountType,
    JobRole,
    Permission,
    Role,
    get_user_permissions,
    map_account_and_job_to_role,
    map_legacy_role_to_account_and_job,
    can_manage_account,
)
from backend.app.models.user import User


async def login(client: AsyncClient, username: str, password: str = "password123") -> dict:
    res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": username, "password": password}
    )
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_account_type_and_job_role_mappings():
    """Six roles: super admin, admin, accountant, kitchen staff, captain, waiter. Retired roles map to waiter."""
    assert map_account_and_job_to_role(AccountType.OWNER.value) == Role.ROLE_SUPER_ADMIN.value
    assert map_account_and_job_to_role(AccountType.MANAGER.value) == Role.ROLE_GENERAL_MANAGER.value
    assert map_account_and_job_to_role(AccountType.PLATFORM_ADMIN.value) == "ROLE_PLATFORM_SUPER_ADMIN"
    assert map_account_and_job_to_role(AccountType.STAFF.value, JobRole.CAPTAIN.value) == Role.ROLE_CAPTAIN.value
    assert map_account_and_job_to_role(AccountType.STAFF.value, JobRole.WAITER.value) == Role.ROLE_WAITER.value
    assert map_account_and_job_to_role(AccountType.STAFF.value, JobRole.KITCHEN_STAFF.value) == Role.ROLE_KITCHEN_STAFF.value
    assert map_account_and_job_to_role(AccountType.STAFF.value, JobRole.ACCOUNTANT.value) == Role.ROLE_ACCOUNTANT.value
    assert map_account_and_job_to_role(AccountType.STAFF.value, "RECEPTIONIST") == Role.ROLE_WAITER.value

    assert map_legacy_role_to_account_and_job(Role.ROLE_SUPER_ADMIN.value) == (AccountType.OWNER.value, None)
    assert map_legacy_role_to_account_and_job(Role.ROLE_GENERAL_MANAGER.value) == (AccountType.MANAGER.value, None)
    assert map_legacy_role_to_account_and_job(Role.ROLE_ACCOUNTANT.value) == (AccountType.STAFF.value, JobRole.ACCOUNTANT.value)
    assert map_legacy_role_to_account_and_job(Role.ROLE_CAPTAIN.value) == (AccountType.STAFF.value, JobRole.CAPTAIN.value)
    for retired in ("ROLE_FRONT_DESK", "ROLE_RESERVATIONS", "ROLE_RESTAURANT_POS", "ROLE_HOUSEKEEPING", "ROLE_MAINTENANCE", "ROLE_NIGHT_AUDITOR"):
        assert map_legacy_role_to_account_and_job(retired) == (AccountType.STAFF.value, JobRole.WAITER.value), retired


def test_permission_resolution_for_canonical_users():
    owner = User(account_type=AccountType.OWNER.value, role_code=Role.ROLE_SUPER_ADMIN.value)
    manager = User(account_type=AccountType.MANAGER.value, role_code=Role.ROLE_GENERAL_MANAGER.value)
    captain = User(account_type=AccountType.STAFF.value, job_role=JobRole.CAPTAIN.value)
    waiter = User(account_type=AccountType.STAFF.value, job_role=JobRole.WAITER.value)
    kitchen = User(account_type=AccountType.STAFF.value, job_role=JobRole.KITCHEN_STAFF.value)
    accountant = User(account_type=AccountType.STAFF.value, job_role=JobRole.ACCOUNTANT.value)
    retired = User(role_code="ROLE_FRONT_DESK")
    P = Permission

    owner_perms = get_user_permissions(owner)
    assert {P.MANAGE_SYSTEM.value, P.MANAGE_STAFF.value, P.AUTHORIZE_REFUND.value} <= owner_perms

    manager_perms = get_user_permissions(manager)
    assert {P.MANAGE_STAFF.value, P.EXECUTE_NIGHT_AUDIT.value, P.PERFORM_CHECK_IN.value, P.ACCEPT_GUEST_ORDERS.value} <= manager_perms
    assert P.MANAGE_SYSTEM.value not in manager_perms

    captain_perms = get_user_permissions(captain)
    assert {P.ACCESS_POS.value, P.VIEW_KDS.value, P.APPLY_DISCOUNT.value, P.CANCEL_FNB_ORDERS.value, P.ACCEPT_GUEST_ORDERS.value} <= captain_perms
    assert P.VIEW_FOLIO.value not in captain_perms and P.MANAGE_STAFF.value not in captain_perms

    waiter_perms = get_user_permissions(waiter)
    assert {P.ACCESS_POS.value, P.POST_CHARGES.value, P.ACCEPT_GUEST_ORDERS.value} <= waiter_perms
    assert not waiter_perms & {P.CANCEL_FNB_ORDERS.value, P.APPLY_DISCOUNT.value, P.VIEW_KDS.value, P.MANAGE_RESERVATIONS.value}

    assert get_user_permissions(kitchen) == {P.VIEW_KDS.value}

    accountant_perms = get_user_permissions(accountant)
    assert {P.VIEW_FOLIO.value, P.VIEW_FINANCIAL_REPORTS.value, P.EXPORT_TAX_REPORTS.value} <= accountant_perms
    assert P.ACCESS_POS.value not in accountant_perms and P.MANAGE_RESERVATIONS.value not in accountant_perms

    assert get_user_permissions(retired) == waiter_perms


@pytest.mark.asyncio
async def test_owner_can_create_manager_and_staff(client: AsyncClient):
    """Verify Hotel Owner (SuperAdmin) can create Managers and Staff using canonical account_type."""
    owner_headers = await login(client, "superadmin")

    # 1. Create a Manager
    manager_payload = {
        "username": "hotel_mgr_1",
        "email": "hotel_mgr_1@example.com",
        "full_name": "Test Hotel Manager",
        "password": "Password123!",
        "account_type": AccountType.MANAGER.value,
        "property_id": "prop-jaipur-01"
    }
    mgr_res = await client.post("/api/v1/staff", json=manager_payload, headers=owner_headers)
    assert mgr_res.status_code == 200, mgr_res.text
    mgr_data = mgr_res.json()
    assert mgr_data["account_type"] == AccountType.MANAGER.value
    assert mgr_data["role_code"] == Role.ROLE_GENERAL_MANAGER.value

    # 2. Create a Staff Waiter
    waiter_payload = {
        "username": "hotel_waiter_1",
        "email": "hotel_waiter_1@example.com",
        "full_name": "Test Hotel Waiter",
        "password": "Password123!",
        "account_type": AccountType.STAFF.value,
        "job_role": JobRole.WAITER.value,
        "property_id": "prop-jaipur-01"
    }
    waiter_res = await client.post("/api/v1/staff", json=waiter_payload, headers=owner_headers)
    assert waiter_res.status_code == 200, waiter_res.text
    waiter_data = waiter_res.json()
    assert waiter_data["account_type"] == AccountType.STAFF.value
    assert waiter_data["job_role"] == JobRole.WAITER.value
    assert waiter_data["role_code"] == Role.ROLE_WAITER.value


@pytest.mark.asyncio
async def test_hotel_admin_cannot_create_platform_admin(client: AsyncClient):
    """Verify hotel admins cannot create PLATFORM_ADMIN accounts (prevent privilege escalation)."""
    owner_headers = await login(client, "superadmin")

    payload = {
        "username": "rogue_platform_admin",
        "email": "rogue_admin@example.com",
        "full_name": "Rogue Platform Admin",
        "password": "Password123!",
        "account_type": AccountType.PLATFORM_ADMIN.value,
        "property_id": "prop-jaipur-01"
    }
    res = await client.post("/api/v1/staff", json=payload, headers=owner_headers)
    assert res.status_code == 403
    assert "Platform Super Admin" in res.text


@pytest.mark.asyncio
async def test_manager_cannot_create_owner_or_manager(client: AsyncClient):
    """Verify General Manager cannot create Owner or other Manager accounts."""
    mgr_headers = await login(client, "admin")

    # Attempt to create Owner
    owner_payload = {
        "username": "escalated_owner",
        "email": "escalated_owner@example.com",
        "full_name": "Escalated Owner",
        "password": "Password123!",
        "account_type": AccountType.OWNER.value,
        "property_id": "prop-jaipur-01"
    }
    res = await client.post("/api/v1/staff", json=owner_payload, headers=mgr_headers)
    assert res.status_code == 403

    # Attempt to create Manager
    peer_mgr_payload = {
        "username": "peer_manager",
        "email": "peer_manager@example.com",
        "full_name": "Peer Manager",
        "password": "Password123!",
        "account_type": AccountType.MANAGER.value,
        "property_id": "prop-jaipur-01"
    }
    res2 = await client.post("/api/v1/staff", json=peer_mgr_payload, headers=mgr_headers)
    assert res2.status_code == 403


@pytest.mark.asyncio
async def test_staff_creation_requires_job_role_for_staff(client: AsyncClient):
    """Verify staff account creation fails if job_role is missing when account_type is STAFF."""
    owner_headers = await login(client, "superadmin")

    payload = {
        "username": "staff_without_job",
        "email": "staff_no_job@example.com",
        "full_name": "No Job Staff",
        "password": "Password123!",
        "account_type": AccountType.STAFF.value,
        # job_role omitted!
        "property_id": "prop-jaipur-01"
    }
    res = await client.post("/api/v1/staff", json=payload, headers=owner_headers)
    assert res.status_code in [400, 422]
