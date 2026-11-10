"""Customer account and booking routes under /me/*.

Replaces Fastify routes/account.ts while preserving:
- /me/profile (GET, PATCH)
- /me/password (POST)
- /me (DELETE)
- /me/bookings (GET, POST)
- /me/bookings/{id} (GET)
- /me/bookings/{id}/cancel (POST)
- Exact status codes, camelCase fields, and validation error messages
"""
import math
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.website_auth import (
    clear_session_cookie,
    get_current_website_user,
    hash_password,
    hash_session_token,
    rate_limiter,
    read_session_cookie,
    verify_password,
)
from backend.app.models.base import utc_now
from backend.app.models.website import WebsiteBooking, WebsiteSession, WebsiteUser
from backend.app.schemas.website import (
    BookingCounts,
    BookingListResponse,
    BookingResponse,
    CreateBookingRequest,
    DeleteAccountRequest,
    PasswordChangeRequest,
    PreferencesSchema,
    ProfileData,
    ProfilePatchRequest,
    ProfileResponse,
)
from backend.app.services.website_booking_service import (
    cancel_customer_booking,
    count_active_bookings,
    create_customer_booking,
    to_booking_data,
    today_ist,
)

router = APIRouter(prefix="/me", tags=["Customer Account & Bookings"])


def build_profile_data(user: WebsiteUser) -> ProfileData:
    prefs_dict = user.preferences or {}
    preferences = PreferencesSchema(
        bed=prefs_dict.get("bed", "no_preference"),
        dietary=prefs_dict.get("dietary", "no_preference"),
        notes=prefs_dict.get("notes", ""),
    )
    return ProfileData(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        country=user.country,
        addressLine1=user.address_line1,
        addressLine2=user.address_line2,
        city=user.city,
        state=user.state,
        postcode=user.postcode,
        preferences=preferences,
        marketingOptIn=user.marketing_opt_in or False,
        role=user.role,
        createdAt=user.created_at.isoformat(),
        lastLoginAt=user.last_login_at.isoformat() if user.last_login_at else None,
    )


@router.get("/profile", response_model=ProfileResponse, summary="Get Customer Profile")
async def get_profile(
    user: WebsiteUser = Depends(get_current_website_user),
):
    return ProfileResponse(profile=build_profile_data(user))


@router.patch("/profile", response_model=ProfileResponse, summary="Update Customer Profile")
async def update_profile(
    body: ProfilePatchRequest,
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name
    if body.phone is not None:
        user.phone = body.phone
    if body.country is not None:
        user.country = body.country
    if body.addressLine1 is not None:
        user.address_line1 = body.addressLine1
    if body.addressLine2 is not None:
        user.address_line2 = body.addressLine2
    if body.city is not None:
        user.city = body.city
    if body.state is not None:
        user.state = body.state
    if body.postcode is not None:
        user.postcode = body.postcode
    if body.preferences is not None:
        user.preferences = body.preferences.model_dump()
    if body.marketingOptIn is not None:
        user.marketing_opt_in = body.marketingOptIn
        if body.marketingOptIn and not user.marketing_opt_in_at:
            user.marketing_opt_in_at = utc_now()

    user.updated_at = utc_now()
    await db.commit()
    await db.refresh(user)
    return ProfileResponse(profile=build_profile_data(user))


@router.post("/password", summary="Change Password")
async def change_password(
    request: Request,
    body: PasswordChangeRequest,
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    key = f"pw:{user.id}"
    wait = rate_limiter.hit(key, max_limit=10, window_ms=15 * 60 * 1000)
    if wait:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"}, headers={"Retry-After": str(wait)})

    if not verify_password(body.currentPassword, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_failed", "issues": [{"path": "currentPassword", "message": "Current password is incorrect."}]},
        )

    rate_limiter.refund(key)
    user.password_hash = hash_password(body.newPassword)
    user.updated_at = utc_now()

    # Invalidate all sessions except current one
    current_token = read_session_cookie(request)
    current_hash = hash_session_token(current_token) if current_token else None

    stmt = delete(WebsiteSession).where(
        WebsiteSession.user_id == user.id,
        WebsiteSession.token_hash != current_hash,
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.delete("", summary="Delete Account")
async def delete_account(
    request: Request,
    response: Response,
    body: DeleteAccountRequest,
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    key = f"del:{user.id}"
    wait = rate_limiter.hit(key, max_limit=10, window_ms=15 * 60 * 1000)
    if wait:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"}, headers={"Retry-After": str(wait)})

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_failed", "issues": [{"path": "password", "message": "Password is incorrect."}]},
        )

    rate_limiter.refund(key)
    today = today_ist()
    active_stays = await count_active_bookings(db, user.id, today)
    if active_stays > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "upcoming_bookings", "count": active_stays},
        )

    # Anonymize/delete user account and purge sessions
    await db.execute(delete(WebsiteSession).where(WebsiteSession.user_id == user.id))
    user.name = "Deleted Guest"
    user.email = f"deleted_{user.id[:8]}@anonymized.invalid"
    user.phone = None
    user.password_hash = None
    user.status = "disabled"
    user.google_sub = None
    user.updated_at = utc_now()
    await db.commit()

    clear_session_cookie(response)
    return {"ok": True}


@router.get("/bookings", response_model=BookingListResponse, summary="List Customer Bookings")
async def list_bookings(
    filter: str = Query("all", pattern="^(all|upcoming|past|cancelled)$"),
    page: int = Query(1, ge=1, le=100000),
    pageSize: int = Query(10, ge=1, le=50),
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    today = today_ist()

    # Counts across all categories
    all_stmt = select(WebsiteBooking).where(WebsiteBooking.user_id == user.id)
    all_res = await db.execute(all_stmt)
    all_bookings = all_res.scalars().all()

    c_all = len(all_bookings)
    c_cancelled = sum(1 for b in all_bookings if b.status == "cancelled")
    c_upcoming = sum(1 for b in all_bookings if b.status in ("pending", "confirmed") and b.check_out >= today)
    c_past = sum(1 for b in all_bookings if b.status != "cancelled" and b.check_out < today)

    # Filtered query
    stmt = select(WebsiteBooking).where(WebsiteBooking.user_id == user.id)
    if filter == "upcoming":
        stmt = stmt.where(WebsiteBooking.status.in_(["pending", "confirmed"]), WebsiteBooking.check_out >= today)
    elif filter == "past":
        stmt = stmt.where(WebsiteBooking.status != "cancelled", WebsiteBooking.check_out < today)
    elif filter == "cancelled":
        stmt = stmt.where(WebsiteBooking.status == "cancelled")

    # Order by check_in desc, created_at desc
    stmt = stmt.order_by(WebsiteBooking.check_in.desc(), WebsiteBooking.created_at.desc())

    # Get total count for this filter
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # Paginate
    stmt = stmt.offset((page - 1) * pageSize).limit(pageSize)
    paged_res = await db.execute(stmt)
    items = paged_res.scalars().all()

    total_pages = max(1, math.ceil(total / pageSize))
    return BookingListResponse(
        items=[to_booking_data(b, today) for b in items],
        page=page,
        pageSize=pageSize,
        total=total,
        totalPages=total_pages,
        counts=BookingCounts(all=c_all, upcoming=c_upcoming, past=c_past, cancelled=c_cancelled),
    )


@router.get("/bookings/{id}", response_model=BookingResponse, summary="Get Single Customer Booking")
async def get_booking(
    id: str,
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WebsiteBooking).where(
        WebsiteBooking.id == id,
        WebsiteBooking.user_id == user.id,
    )
    res = await db.execute(stmt)
    booking = res.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return BookingResponse(booking=to_booking_data(booking))


@router.post("/bookings", summary="Create Customer Booking")
async def create_booking(
    response: Response,
    body: CreateBookingRequest,
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    wait = rate_limiter.hit(f"book:{user.id}", max_limit=10, window_ms=60 * 1000)
    if wait:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"}, headers={"Retry-After": str(wait)})

    booking, created = await create_customer_booking(db, user.id, body)
    await db.commit()
    await db.refresh(booking)

    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return {"booking": to_booking_data(booking)}


@router.post("/bookings/{id}/cancel", response_model=BookingResponse, summary="Cancel Customer Booking")
async def cancel_booking(
    id: str,
    user: WebsiteUser = Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    booking, changed = await cancel_customer_booking(db, user.id, id)
    await db.commit()
    await db.refresh(booking)
    return BookingResponse(booking=to_booking_data(booking))
