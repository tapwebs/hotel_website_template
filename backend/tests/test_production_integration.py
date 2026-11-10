import pytest


@pytest.mark.asyncio
async def test_health_endpoints(client):
    """Verify health and ready endpoints respond with 200."""
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "tapmenu-hms-backend"

    res_ready = await client.get("/health/ready")
    assert res_ready.status_code == 200
    data_ready = res_ready.json()
    assert data_ready["status"] == "ready"


@pytest.mark.asyncio
async def test_cors_production_origins(client):
    """Verify CORS headers for production domains."""
    # Preflight from HMS portal
    res_hms = await client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
    )
    assert res_hms.status_code == 200
    assert res_hms.headers.get("access-control-allow-origin") == "http://localhost:5174"

    # Preflight from public website
    res_web = await client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
    )
    assert res_web.status_code == 200
    assert res_web.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Unauthorized origin should NOT get access-control-allow-origin
    res_bad = await client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://malicious-attacker.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
    )
    assert "access-control-allow-origin" not in res_bad.headers


@pytest.mark.asyncio
async def test_auth_login_endpoint_registered_and_rejects_invalid_creds(client):
    """Verify /api/v1/auth/login exists and returns 401 for invalid credentials (NOT 404)."""
    # Valid JSON shape with incorrect credentials
    res = await client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": "invalid_staff_user@example.com",
            "password": "wrongpassword123"
        }
    )
    # MUST return 401 Unauthorized, never 404 Not Found
    assert res.status_code == 401
    body = res.json()
    assert "error" in body or "detail" in body

    # Missing payload fields should return 422 validation error, not 404
    res_invalid = await client.post("/api/v1/auth/login", json={})
    assert res_invalid.status_code == 422


@pytest.mark.asyncio
async def test_openapi_contains_exact_production_paths(client):
    """Verify that the backend OpenAPI schema registers exact production API paths for both frontends."""
    from backend.app.main import app
    schema = app.openapi()
    paths = schema["paths"]

    # HMS Staff Frontend paths
    assert "/api/v1/auth/login" in paths
    assert "post" in paths["/api/v1/auth/login"]
    assert "/api/v1/auth/session" in paths
    assert "get" in paths["/api/v1/auth/session"]
    assert "/api/v1/auth/switch-property" in paths
    assert "post" in paths["/api/v1/auth/switch-property"]

    # Public Guest Website paths
    assert "/auth/google" in paths
    assert "post" in paths["/auth/google"]
    assert "/auth/me" in paths
    assert "get" in paths["/auth/me"]
    assert "/auth/login" in paths
    assert "post" in paths["/auth/login"]
    assert "/auth/signup" in paths
    assert "post" in paths["/auth/signup"]
    assert "/auth/logout" in paths
    assert "post" in paths["/auth/logout"]


@pytest.mark.asyncio
async def test_customer_google_auth_schema_validation(client):
    """Verify /auth/google validates incoming payload schema (returns 400 or 422 for bad input, NOT 404)."""
    # Empty body
    res_empty = await client.post("/auth/google", json={})
    assert res_empty.status_code in (400, 422)

    # idToken too short
    res_short = await client.post("/auth/google", json={"idToken": "abc"})
    assert res_short.status_code in (400, 422)

    # idToken wrong type
    res_type = await client.post("/auth/google", json={"idToken": 12345})
    assert res_type.status_code in (400, 422)


@pytest.mark.asyncio
async def test_customer_google_auth_forwarding(client, monkeypatch):
    """Verify /auth/google accepts valid token and passes through session cookies."""
    from backend.app.core.website_auth import set_custom_google_verifier

    def mock_verifier(token: str):
        return {
            "sub": "usr-1",
            "email": "guest@example.com",
            "email_verified": True,
            "name": "Guest",
        }

    set_custom_google_verifier(mock_verifier)
    try:
        res = await client.post(
            "/auth/google",
            json={"idToken": "valid-google-id-token-abc123xyz"},
            headers={"Origin": "http://localhost:5173"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["user"]["role"] == "guest"
        assert "hdh_session" in res.headers.get("set-cookie", "")
    finally:
        set_custom_google_verifier(None)
