import pytest
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_successful_login(client):
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "admin", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_invalid_credentials(client):
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "admin", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_login_rate_limiting(client):
    # Attempt 5 failed logins for the same user
    for _ in range(5):
        res = await client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={"username_or_email": "ratelimit_user", "password": "badpassword"}
        )
        assert res.status_code == 401

    # 6th attempt must be throttled with HTTP 429
    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "ratelimit_user", "password": "badpassword"}
    )
    assert res.status_code == 429
    assert "Retry-After" in res.headers


@pytest.mark.asyncio
async def test_unauthorized_request(client):
    response = await client.get(f"{settings.API_V1_PREFIX}/auth/session")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_session_authenticated(client, auth_headers):
    response = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] if "username" in data else data["fullName"] == "Arjun Singhania"
    assert data["role"] == "ROLE_GENERAL_MANAGER"
    assert len(data["availableProperties"]) >= 1


@pytest.mark.asyncio
async def test_jwt_revocation_on_force_logout(client):
    """Verify that force_logout invalidates active JWT tokens immediately."""
    # 1. Login as priya
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "priya", "password": "password123"}
    )
    assert login_res.status_code == 200
    priya_token = login_res.json()["access_token"]
    priya_headers = {"Authorization": f"Bearer {priya_token}"}

    # Verify token works
    session_res = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=priya_headers)
    assert session_res.status_code == 200

    # 2. Admin executes force-logout on priya
    admin_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "superadmin", "password": "password123"}
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    logout_res = await client.post(f"{settings.API_V1_PREFIX}/staff/usr-dh-002/force-logout", headers=admin_headers)
    assert logout_res.status_code == 200

    # 3. Priya's token MUST now be rejected with 401
    revoked_res = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=priya_headers)
    assert revoked_res.status_code == 401
    assert "revoked" in revoked_res.text.lower() or "terminated" in revoked_res.text.lower()


@pytest.mark.asyncio
async def test_jwt_revocation_on_deactivation(client):
    """Verify that deactivating a staff account immediately rejects their active JWT token."""
    # 1. Login as rohan
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "rohan", "password": "password123"}
    )
    assert login_res.status_code == 200
    rohan_token = login_res.json()["access_token"]
    rohan_headers = {"Authorization": f"Bearer {rohan_token}"}

    # 2. SuperAdmin deactivates rohan (usr-dh-006)
    admin_login = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"username_or_email": "superadmin", "password": "password123"}
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    deact_res = await client.patch(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-006/status",
        json={"is_active": False},
        headers=admin_headers
    )
    assert deact_res.status_code == 200

    # 3. Rohan's token MUST now be rejected
    revoked_res = await client.get(f"{settings.API_V1_PREFIX}/auth/session", headers=rohan_headers)
    assert revoked_res.status_code == 401

    # Reactivate rohan to leave seed clean
    await client.patch(
        f"{settings.API_V1_PREFIX}/staff/usr-dh-006/status",
        json={"is_active": True},
        headers=admin_headers
    )

