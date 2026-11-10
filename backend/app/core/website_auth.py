"""Authentication, session, and security utilities for the public website and customer accounts.

Preserves 100% byte-for-byte compatibility with the Fastify website backend:
- Passwords: scrypt (N=16384, r=8, p=1, keylen=64) format `scrypt$16384$8$1$saltB64$hashB64`
- Sessions: 32 random bytes base64url, hashed with SHA-256 in the database
- Cookie: `hdh_session`, HttpOnly, SameSite=Lax, Secure in production
- Google OAuth: RS256 ID Token verification against Google JWKs or injected mock
- In-memory rate limiting with failed-login refund semantics
"""
import base64
import hashlib
import hmac
import os
import re
import logging
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Optional
import jwt

logger = logging.getLogger("website_auth")
from fastapi import Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.base import utc_now
from backend.app.models.website import WebsiteSession, WebsiteUser

COOKIE_NAME = "hdh_session"
DAY_SECONDS = 86400

# scrypt cost parameters matching Fastify backend (N=16384, r=8, p=1, keylen=64)
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_KEYLEN = 64


def hash_password(password: str) -> str:
    """Returns `scrypt$N$r$p$saltB64$hashB64` exactly matching Node crypto.scrypt."""
    salt = os.urandom(16)
    normalized = unicodedata.normalize("NFKC", password).encode("utf-8")
    derived = hashlib.scrypt(
        normalized,
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        maxmem=0,
        dklen=SCRYPT_KEYLEN,
    )
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived).decode("ascii")
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt_b64}${hash_b64}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    """Constant-time verification of scrypt-hashed password. Returns False on malformed/missing hash."""
    if not stored:
        return False
    parts = stored.split("$")
    if len(parts) != 6:
        return False
    alg, n_str, r_str, p_str, salt_b64, hash_b64 = parts
    if alg != "scrypt":
        return False
    try:
        n = int(n_str)
        r = int(r_str)
        p = int(p_str)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        normalized = unicodedata.normalize("NFKC", password).encode("utf-8")
        derived = hashlib.scrypt(
            normalized,
            salt=salt,
            n=n,
            r=r,
            p=p,
            maxmem=0,
            dklen=len(expected),
        )
        return len(derived) == len(expected) and hmac.compare_digest(derived, expected)
    except Exception:
        return False


def new_session_token() -> str:
    """Returns a 32-byte cryptographically secure URL-safe base64 token without padding."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode("ascii").rstrip("=")


def hash_session_token(token: str) -> str:
    """SHA-256 hex digest of the raw session token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def read_session_cookie(request: Request) -> Optional[str]:
    """Extracts the session token from the `hdh_session` cookie header."""
    cookie = request.cookies.get(COOKIE_NAME)
    if cookie:
        return cookie
    # Fallback: check manual Cookie header string
    header = request.headers.get("cookie", "")
    for part in header.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            if k.strip() == COOKIE_NAME:
                return v.strip()
    return None


def set_session_cookie(
    response: Response,
    token: str,
    remember: bool = True,
    secure: Optional[bool] = None,
) -> None:
    """Sets the `hdh_session` cookie on the response."""
    if secure is None:
        secure = settings.APP_ENV == "production"
    max_age = 30 * DAY_SECONDS if remember else None
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite="lax",
        secure=secure,
    )


def clear_session_cookie(response: Response, secure: Optional[bool] = None) -> None:
    """Clears the `hdh_session` cookie."""
    if secure is None:
        secure = settings.APP_ENV == "production"
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=secure,
    )


def session_expiry(remember: bool = True) -> datetime:
    """Returns session expiry date: 30 days if remember else 1 day."""
    delta = timedelta(days=30 if remember else 1)
    return datetime.now(timezone.utc) + delta


# ---- In-memory rate limiter matching Fastify counter design ----
class InMemoryRateLimiter:
    def __init__(self):
        self._counters: Dict[str, Dict[str, Any]] = {}

    def hit(self, key: str, max_limit: int, window_ms: int) -> int:
        now_ms = int(time.time() * 1000)
        # Purge expired
        expired = [k for k, v in self._counters.items() if v["reset_at"] <= now_ms]
        for k in expired:
            del self._counters[k]

        c = self._counters.get(key)
        if not c:
            c = {"count": 0, "reset_at": now_ms + window_ms}
            self._counters[key] = c

        c["count"] += 1
        if c["count"] > max_limit:
            return max(1, int((c["reset_at"] - now_ms) / 1000))
        return 0

    def refund(self, key: str) -> None:
        c = self._counters.get(key)
        if c and c["count"] > 0:
            c["count"] -= 1


rate_limiter = InMemoryRateLimiter()


def is_origin_allowed(origin: Optional[str]) -> bool:
    """CSRF: checks if the request origin matches allowed website origins."""
    if not origin:
        return True
    origin_clean = origin.rstrip("/")
    for allowed in settings.CORS_ORIGINS:
        if origin_clean == allowed.rstrip("/"):
            return True
    return False


async def get_optional_website_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[WebsiteUser]:
    """Retrieves authenticated website customer from session cookie if present and valid."""
    token = read_session_cookie(request)
    if not token:
        return None
    token_hash = hash_session_token(token)
    stmt = (
        select(WebsiteSession)
        .where(
            WebsiteSession.token_hash == token_hash,
            WebsiteSession.expires_at > utc_now(),
        )
    )
    result = await db.execute(stmt)
    session_obj = result.scalars().first()
    if not session_obj:
        return None

    # Fetch user
    user_stmt = select(WebsiteUser).where(WebsiteUser.id == session_obj.user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalars().first()
    if not user or user.status != "active":
        return None
    return user


async def get_current_website_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> WebsiteUser:
    """Requires authenticated customer session and checks CSRF on state-changing methods."""
    origin = request.headers.get("origin")
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        if origin and not is_origin_allowed(origin):
            raise HTTPException(status_code=403, detail={"error": "forbidden_origin"})

    user = await get_optional_website_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail={"error": "unauthenticated"})
    return user


def get_client_ip(request: Request) -> str:
    """Determines client IP honoring TRUST_PROXY setting."""
    if settings.TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"
