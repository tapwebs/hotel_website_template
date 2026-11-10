"""Customer authentication routes: Signup, Login, Google Sign-In, Session Check, Logout.

Directly replaces the Fastify auth endpoints while preserving:
- All URLs (/auth/signup, /auth/login, /auth/google, /auth/me, /auth/logout)
- Cookie session management (hdh_session)
- Exact status codes and JSON error responses
- Rate limiting with failed-login refund semantics
- Password hashing and verification compatibility
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.website_auth import (
    clear_session_cookie,
    get_client_ip,
    get_optional_website_user,
    hash_password,
    hash_session_token,
    is_origin_allowed,
    new_session_token,
    rate_limiter,
    read_session_cookie,
    session_expiry,
    set_session_cookie,
    verify_google_id_token,
    verify_password,
)
from backend.app.models.base import generate_uuid, utc_now
from backend.app.models.website import WebsiteSession, WebsiteUser
from backend.app.schemas.website import (
    AuthMeResponse,
    GoogleAuthRequest,
    LoginRequest,
    LoginSuccessResponse,
    SessionUserInfo,
    SignupRequest,
)

router = APIRouter(prefix="/auth", tags=["Customer Authentication"])

# Pre-computed dummy hash so email guessing does not leak timing information
_DUMMY_HASH = hash_password("not-a-real-password")


@router.post("/signup", status_code=status.HTTP_201_CREATED, summary="Customer Registration")
async def signup(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    wait = rate_limiter.hit(f"signup:{ip}", max_limit=10, window_ms=15 * 60 * 1000)
    if wait:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited"},
            headers={"Retry-After": str(wait)},
        )

    try:
        body_json = await request.json()
        data = SignupRequest.model_validate(body_json)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "invalid_request"})

    email_lower = data.email.lower()
    # Check if email is already taken
    existing = await db.execute(select(WebsiteUser).where(WebsiteUser.email == email_lower))
    if existing.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error": "email_taken"})

    user = WebsiteUser(
        id=generate_uuid(),
        name=data.name,
        email=email_lower,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role="guest",
        status="active",
    )
    db.add(user)
    await db.commit()
    return {"ok": True}


@router.post("/login", summary="Customer Password Login")
async def login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    try:
        body_json = await request.json()
        data = LoginRequest.model_validate(body_json)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "invalid_request"})

    ip = get_client_ip(request)
    email_lower = data.email.lower()

    # Reserve slot up front for IP and email
    ip_key = f"login-ip:{ip}"
    email_key = f"login-email:{email_lower}"
    wait_ip = rate_limiter.hit(ip_key, max_limit=10, window_ms=15 * 60 * 1000)
    wait_email = rate_limiter.hit(email_key, max_limit=10, window_ms=15 * 60 * 1000)
    wait = max(wait_ip, wait_email)
    if wait > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited"},
            headers={"Retry-After": str(wait)},
        )

    # Lookup user
    stmt = select(WebsiteUser).where(WebsiteUser.email == email_lower)
    result = await db.execute(stmt)
    user = result.scalars().first()

    pw_ok = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not pw_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "invalid_credentials"})

    # Credentials valid: refund rate limit budget
    rate_limiter.refund(ip_key)
    rate_limiter.refund(email_key)

    if user.status == "disabled":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "account_disabled"})

    # Create session
    token = new_session_token()
    token_hash = hash_session_token(token)
    remember = bool(data.remember)
    expires = session_expiry(remember)

    sess = WebsiteSession(
        token_hash=token_hash,
        user_id=user.id,
        expires_at=expires,
    )
    db.add(sess)
    user.last_login_at = utc_now()
    await db.commit()

    set_session_cookie(response, token, remember=remember)
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@router.post("/google", summary="Customer Google Sign-In")
async def google_auth(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    origin = request.headers.get("origin")
    if origin and not is_origin_allowed(origin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden_origin"})

    ip = get_client_ip(request)
    wait = rate_limiter.hit(f"google:{ip}", max_limit=10, window_ms=15 * 60 * 1000)
    if wait:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate_limited"},
            headers={"Retry-After": str(wait)},
        )

    try:
        body_json = await request.json()
        data = GoogleAuthRequest.model_validate(body_json)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "invalid_request"})

    token_payload = verify_google_id_token(data.idToken)
    sub = token_payload["sub"]
    email = token_payload["email"]
    email_verified = token_payload.get("email_verified", False)
    name = token_payload.get("name")

    if not email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"error": "unverified_email"})

    # 1. Look up existing user by google_sub
    res_sub = await db.execute(select(WebsiteUser).where(WebsiteUser.google_sub == sub))
    user = res_sub.scalars().first()

    if user:
        if user.role != "guest":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden"})
        if user.status == "disabled":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "account_disabled"})
    else:
        # 2. Look up existing user by verified email
        res_email = await db.execute(select(WebsiteUser).where(WebsiteUser.email == email))
        existing_by_email = res_email.scalars().first()

        if existing_by_email:
            if existing_by_email.role != "guest":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden"})
            if existing_by_email.status == "disabled":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "account_disabled"})
            if existing_by_email.google_sub and existing_by_email.google_sub != sub:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error": "account_conflict"})

            existing_by_email.google_sub = sub
            user = existing_by_email
        else:
            # 3. Create new customer with role 'guest'
            user_id = generate_uuid()
            customer_name = (name.strip() if name and name.strip() else email.split("@")[0])[:100]
            user = WebsiteUser(
                id=user_id,
                name=customer_name,
                email=email,
                google_sub=sub,
                role="guest",
                status="active",
            )
            db.add(user)

    token = new_session_token()
    token_hash = hash_session_token(token)
    expires = session_expiry(remember=True)
    sess = WebsiteSession(
        token_hash=token_hash,
        user_id=user.id,
        expires_at=expires,
    )
    db.add(sess)
    user.last_login_at = utc_now()
    await db.commit()

    set_session_cookie(response, token, remember=True)
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@router.get("/me", summary="Customer Session Restoration")
async def get_me(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await get_optional_website_user(request, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": "unauthenticated"})
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Customer Logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    origin = request.headers.get("origin")
    if origin and not is_origin_allowed(origin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"error": "forbidden_origin"})

    token = read_session_cookie(request)
    if token:
        token_hash = hash_session_token(token)
        stmt = select(WebsiteSession).where(WebsiteSession.token_hash == token_hash)
        res = await db.execute(stmt)
        sess = res.scalars().first()
        if sess:
            await db.delete(sess)
            await db.commit()

    clear_session_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
