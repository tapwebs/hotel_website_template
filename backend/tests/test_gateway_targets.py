import pytest
import httpx
from unittest.mock import AsyncMock, patch
from backend.app.api.routes.customer_gateway import get_target_urls, _proxy_to_website
from backend.app.core.config import settings
from starlette.requests import Request


def test_get_target_urls_with_localhost_default():
    """Verify localhost/127.0.0.1 primary generates website-api candidate for Docker network."""
    with patch.object(settings, "WEBSITE_API_URL", "http://127.0.0.1:3001"):
        urls = get_target_urls("/auth/login")
        assert urls == [
            "http://127.0.0.1:3001/auth/login",
            "http://website-api:3001/auth/login"
        ]


def test_get_target_urls_with_website_api_primary():
    """Verify website-api primary generates localhost candidate."""
    with patch.object(settings, "WEBSITE_API_URL", "http://website-api:3001"):
        urls = get_target_urls("auth/me")
        assert urls == [
            "http://website-api:3001/auth/me",
            "http://127.0.0.1:3001/auth/me"
        ]


def test_get_target_urls_with_custom_host():
    """Verify custom host keeps only the primary target."""
    with patch.object(settings, "WEBSITE_API_URL", "https://api.external.com"):
        urls = get_target_urls("/auth/google")
        assert urls == ["https://api.external.com/auth/google"]


@pytest.mark.asyncio
async def test_proxy_to_website_primary_succeeds(monkeypatch):
    """Verify when primary connects, secondary is never attempted (local dev speed)."""
    calls = []

    async def mock_request(method, url, **kwargs):
        calls.append(url)
        return httpx.Response(200, json={"ok": True}, headers={"content-type": "application/json"})

    from backend.app.api.routes import customer_gateway
    monkeypatch.setattr(customer_gateway._client, "request", mock_request)

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/auth/login",
        "headers": [(b"content-type", b"application/json"), (b"origin", b"http://localhost:5173")],
        "query_string": b"",
    }
    req = Request(scope, receive=AsyncMock(return_value={"type": "http.request", "body": b'{"email":"a@b.com"}'}))

    with patch.object(settings, "WEBSITE_API_URL", "http://127.0.0.1:3001"):
        res = await _proxy_to_website("auth/login", req)
        assert res.status_code == 200
        # Exactly one call to primary
        assert calls == ["http://127.0.0.1:3001/auth/login"]


@pytest.mark.asyncio
async def test_proxy_to_website_fallback_on_connect_error(monkeypatch):
    """Verify when primary fails with ConnectError (container network mismatch), fallback succeeds."""
    calls = []

    async def mock_request(method, url, **kwargs):
        calls.append(url)
        if "127.0.0.1" in url:
            raise httpx.ConnectError("Connection refused on 127.0.0.1:3001")
        return httpx.Response(200, json={"ok": True, "source": "website-api"}, headers={"content-type": "application/json"})

    from backend.app.api.routes import customer_gateway
    monkeypatch.setattr(customer_gateway._client, "request", mock_request)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/auth/me",
        "headers": [(b"cookie", b"hdh_session=abc"), (b"origin", b"http://localhost:5173")],
        "query_string": b"",
    }
    req = Request(scope, receive=AsyncMock(return_value={"type": "http.request", "body": b""}))

    with patch.object(settings, "WEBSITE_API_URL", "http://127.0.0.1:3001"):
        res = await _proxy_to_website("auth/me", req)
        assert res.status_code == 200
        assert b"website-api" in res.body
        # Both primary and fallback were attempted
        assert calls == [
            "http://127.0.0.1:3001/auth/me",
            "http://website-api:3001/auth/me"
        ]


@pytest.mark.asyncio
async def test_proxy_to_website_returns_502_when_all_fail(monkeypatch):
    """Verify 502 with website_service_unavailable when all targets fail."""
    async def mock_request(method, url, **kwargs):
        raise httpx.ConnectError("All targets down")

    from backend.app.api.routes import customer_gateway
    monkeypatch.setattr(customer_gateway._client, "request", mock_request)

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/auth/me",
        "headers": [],
        "query_string": b"",
    }
    req = Request(scope, receive=AsyncMock(return_value={"type": "http.request", "body": b""}))

    res = await _proxy_to_website("auth/me", req)
    assert res.status_code == 502
    assert b"website_service_unavailable" in res.body
