import pytest
import pytest_asyncio
from backend.app.core.config import settings
from backend.app.core.website_auth import (
    COOKIE_NAME,
    hash_password,
    set_custom_google_verifier,
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


@pytest.mark.asyncio
async def test_customer_google_auth(client):
    """Verify Google OAuth token verification, auto-signup, and session creation."""
    # Mock Google Token payload
    def mock_verifier(token: str):
        if token == "valid-google-id-token":
            return {
                "sub": "google-user-sub-12345",
                "email": "google.guest@example.com",
                "email_verified": True,
                "name": "Google Guest User",
            }
        raise ValueError("Invalid token")

    set_custom_google_verifier(mock_verifier)
    try:
        # Invalid token
        res_bad = await client.post("/auth/google", json={"idToken": "invalid-token-here"})
        assert res_bad.status_code in (400, 401)

        # Valid token
        res_ok = await client.post(
            "/auth/google",
            json={"idToken": "valid-google-id-token"},
            headers={"Origin": "http://localhost:5173"},
        )
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["ok"] is True
        assert data["user"]["email"] == "google.guest@example.com"
        assert data["user"]["name"] == "Google Guest User"
        assert COOKIE_NAME in res_ok.cookies

        # Verify session is authenticated
        res_me = await client.get("/auth/me")
        assert res_me.status_code == 200
        assert res_me.json()["user"]["email"] == "google.guest@example.com"
    finally:
        set_custom_google_verifier(None)


@pytest.mark.asyncio
async def test_customer_google_auth_rs256_cryptography(client, monkeypatch):
    """Verify authentic RS256 JWT decoding via cryptography and JWK key resolution."""
    import time
    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    import backend.app.core.website_auth as wauth

    # Generate test RSA key pair
    private_key = rsa.generate_private_key(65537, 2048, default_backend())
    pem_private = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    pem_public = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    class MockSigningKey:
        def __init__(self, key):
            self.key = key

    class MockJWKClient:
        def get_signing_key_from_jwt(self, token):
            return MockSigningKey(pem_public)

    monkeypatch.setattr(wauth, "_google_jwk_client", MockJWKClient())

    client_id = "test-mock-google-client-id-12345.apps.googleusercontent.com"
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", client_id)
    now = int(time.time())

    # 1. Valid RS256 Google Token
    valid_claims = {
        "iss": "https://accounts.google.com",
        "sub": "google-rs256-sub-9999",
        "aud": client_id,
        "email": "rs256.guest@example.com",
        "email_verified": True,
        "name": "RS256 Guest",
        "iat": now,
        "exp": now + 3600,
    }
    valid_token = jwt.encode(valid_claims, pem_private, algorithm="RS256", headers={"kid": "test-kid-rs256"})

    res_valid = await client.post(
        "/auth/google",
        json={"idToken": valid_token},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["ok"] is True
    assert data["user"]["email"] == "rs256.guest@example.com"
    assert data["user"]["name"] == "RS256 Guest"
    assert COOKIE_NAME in res_valid.cookies

    # 2. Audience Mismatch RS256 Token -> 401 invalid_token
    wrong_aud_claims = dict(valid_claims, aud="wrong-client-id.apps.googleusercontent.com")
    wrong_token = jwt.encode(wrong_aud_claims, pem_private, algorithm="RS256", headers={"kid": "test-kid-rs256"})
    res_wrong_aud = await client.post(
        "/auth/google",
        json={"idToken": wrong_token},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res_wrong_aud.status_code == 401
    assert res_wrong_aud.json()["error"] == "invalid_token"

    # 3. Expired RS256 Token -> 401 invalid_token
    expired_claims = dict(valid_claims, exp=now - 60)
    expired_token = jwt.encode(expired_claims, pem_private, algorithm="RS256", headers={"kid": "test-kid-rs256"})
    res_expired = await client.post(
        "/auth/google",
        json={"idToken": expired_token},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res_expired.status_code == 401
    assert res_expired.json()["error"] == "invalid_token"

    # 4. Unverified Email -> 400 unverified_email
    unverified_claims = dict(valid_claims, email_verified=False, sub="google-unverified-111")
    unverified_token = jwt.encode(unverified_claims, pem_private, algorithm="RS256", headers={"kid": "test-kid-rs256"})
    res_unverified = await client.post(
        "/auth/google",
        json={"idToken": unverified_token},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res_unverified.status_code == 400
    assert res_unverified.json()["error"] == "unverified_email"
