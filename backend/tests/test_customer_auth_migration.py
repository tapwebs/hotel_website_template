import pytest
import pytest_asyncio
from backend.app.core.config import settings
from backend.app.core.website_auth import (
    COOKIE_NAME,
    hash_password,
    verify_password,
)


@pytest.mark.asyncio
async def test_scrypt_password_compatibility():
    """Verify byte-compatible password hashing and verification."""
    password = "CustomerSecurePassword123!"
    hashed = hash_password(password)
    assert hashed.startswith("scrypt$16384$8$1$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password(password, None) is False


@pytest.mark.asyncio
async def test_customer_signup_and_duplicate(client):
    """Verify customer registration and email uniqueness constraint."""
    payload = {
        "name": "Arjun Sharma",
        "email": "arjun.sharma@example.com",
        "phone": "+919876543210",
        "password": "Password123!",
        "consent": True,
    }
    # Initial signup
    res1 = await client.post("/auth/signup", json=payload)
    assert res1.status_code == 201
    assert res1.json() == {"ok": True}

    # Duplicate signup should return 409 email_taken
    res2 = await client.post("/auth/signup", json=payload)
    assert res2.status_code == 409
    assert res2.json() == {"error": "email_taken"}


@pytest.mark.asyncio
async def test_customer_login_flow(client):
    """Verify password login, cookie issuance, and session restoration."""
    signup_payload = {
        "name": "Priya Patel",
        "email": "priya.patel@example.com",
        "phone": "+919876543211",
        "password": "SecretPassword123!",
        "consent": True,
    }
    res_signup = await client.post("/auth/signup", json=signup_payload)
    assert res_signup.status_code == 201

    # Invalid password login -> 401
    res_bad = await client.post(
        "/auth/login",
        json={"email": "priya.patel@example.com", "password": "WrongPassword!"},
    )
    assert res_bad.status_code == 401
    assert res_bad.json() == {"error": "invalid_credentials"}


    # Valid password login -> 200 with hdh_session cookie
    res_login = await client.post(
        "/auth/login",
        json={"email": "priya.patel@example.com", "password": "SecretPassword123!", "remember": True},
    )
    assert res_login.status_code == 200
    data = res_login.json()
    assert data["ok"] is True
    assert data["user"]["email"] == "priya.patel@example.com"
    assert data["user"]["role"] == "guest"
    assert COOKIE_NAME in res_login.cookies

    # Verify session check /auth/me with cookie
    res_me = await client.get("/auth/me")
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["user"]["email"] == "priya.patel@example.com"

    # Logout -> 204 and clears session
    res_logout = await client.post("/auth/logout")
    assert res_logout.status_code == 204

    # Subsequent /auth/me should return 401 unauthenticated
    res_me_after = await client.get("/auth/me")
    assert res_me_after.status_code == 401
