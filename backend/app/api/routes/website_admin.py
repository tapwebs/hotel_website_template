"""Website administration routes for HMS staff and website administrators.

Mounted under /api/v1/website/ (and compatible prefixes) to handle:
- Admin user listing, creation, role/status updates, guest search (/admin/users, /admin/guest-search)
- Real-time website statistics and booking reports (/admin/stats, /admin/reports)
- Activity audit logging (/admin/activity)
- Room rate overrides (/admin/rooms, /admin/rooms/{roomId})
- Admin booking management and HMS sync (/admin/bookings, /admin/bookings/{id})
- Full QR Hub administrative management (/qr-hub/admin/*)
"""
import csv
import io
import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select, and_, or_, delete, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.core.errors import ForbiddenException
from backend.app.core.rbac import Permission, get_user_permissions
from backend.app.core.website_auth import (
    get_optional_website_user,
    hash_password,
)
from backend.app.models.base import generate_uuid, utc_now
from backend.app.models.website import (
    QrClick,
    QrLink,
    QrOffer,
    QrOrganization,
    QrPlacement,
    QrSetting,
    QrVisit,
    WebsiteActivityLog,
    WebsiteBooking,
    WebsiteRoomRate,
    WebsiteUser,
)
from backend.app.schemas.website import (
    ROOM_DEFINITIONS,
    ROOM_IDS,
    BookingCounts,
    BookingData,
    CreateBookingRequest,
    RoomInfo,
)
from backend.app.services.website_booking_service import (
    create_customer_booking,
    get_room_rate,
    to_booking_data,
    today_ist,
    IST_TIMEZONE,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/website", tags=["Website Admin & Operations"])


# ---- Authentication & Authorization Helper ----
async def get_admin_or_staff(
    request: Request,
    db: AsyncSession = Depends(get_db),
    hms_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Authenticates staff request via HMS Bearer token or website cookie.
    Returns dict with actor_id, actor_name, role ('admin' or 'staff').
    """
    if hms_user:
        perms = get_user_permissions(hms_user)
        if Permission.MANAGE_SETTINGS.value in perms:
            role = "admin"
        elif Permission.VIEW_RESERVATIONS.value in perms:
            role = "staff"
        else:
            raise HTTPException(status_code=403, detail={"error": "forbidden"})
        return {"id": hms_user.user_id, "name": hms_user.full_name, "role": role}

    # Fallback to website cookie session
    cookie_user = await get_optional_website_user(request, db)
    if cookie_user and cookie_user.role in ("admin", "staff"):
        return {"id": cookie_user.id, "name": cookie_user.name, "role": cookie_user.role}

    raise HTTPException(status_code=401, detail={"error": "unauthenticated"})


def require_admin(auth: Dict[str, Any] = Depends(get_admin_or_staff)) -> Dict[str, Any]:
    if auth["role"] != "admin":
        raise HTTPException(status_code=403, detail={"error": "forbidden"})
    return auth


async def log_activity(
    db: AsyncSession,
    actor_id: Optional[str],
    actor_name: str,
    action: str,
    target: str = "",
    detail: str = "",
) -> None:
    entry = WebsiteActivityLog(
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        target=target,
        detail=detail,
    )
    db.add(entry)


# ---- Users ----
@router.get("/admin/users", summary="List Website Users")
async def list_admin_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort: str = Query("createdAt"),
    order: str = Query("desc"),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WebsiteUser)
    if role:
        stmt = stmt.where(WebsiteUser.role == role)
    if status:
        stmt = stmt.where(WebsiteUser.status == status)
    if q:
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(WebsiteUser.name).like(term),
                func.lower(WebsiteUser.email).like(term),
                WebsiteUser.phone.like(term),
            )
        )

    # Count
    count_res = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_res.scalar() or 0

    # Sort
    col_map = {
        "createdAt": WebsiteUser.created_at,
        "name": WebsiteUser.name,
        "email": WebsiteUser.email,
        "lastLoginAt": WebsiteUser.last_login_at,
    }
    sort_col = col_map.get(sort, WebsiteUser.created_at)
    stmt = stmt.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    stmt = stmt.offset((page - 1) * pageSize).limit(pageSize)

    res = await db.execute(stmt)
    users = res.scalars().all()

    items = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role,
            "status": u.status,
            "createdAt": u.created_at.isoformat(),
            "updatedAt": u.updated_at.isoformat(),
            "lastLoginAt": u.last_login_at.isoformat() if u.last_login_at else None,
            "externalHmsId": u.external_hms_id,
            "externalPosId": u.external_pos_id,
            "googleSub": u.google_sub,
        }
        for u in users
    ]
    return {
        "items": items,
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "totalPages": max(1, math.ceil(total / pageSize)),
    }


# ---- Activity log ----
@router.get("/admin/activity", summary="Website Admin Activity Log")
async def list_activity(
    page: int = Query(1, ge=1, le=100000),
    pageSize: int = Query(30, ge=1, le=100),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    empty = {"items": [], "page": page, "pageSize": pageSize, "total": 0, "totalPages": 1}
    try:
        total = (await db.execute(select(func.count()).select_from(WebsiteActivityLog))).scalar() or 0
        rows = (
            await db.execute(
                select(WebsiteActivityLog)
                .order_by(WebsiteActivityLog.at.desc(), WebsiteActivityLog.id)
                .offset((page - 1) * pageSize)
                .limit(pageSize)
            )
        ).scalars().all()
    except DBAPIError:
        # e.g. the website.activity_log migration has not run: show an empty log, keep the cause in the server log.
        logger.exception("activity log query failed")
        await db.rollback()
        return empty
    return {
        "items": [
            {
                "id": str(a.id),
                "at": a.at.isoformat(),
                "actorName": a.actor_name,
                "action": a.action,
                "target": a.target or "",
                "detail": a.detail or "",
            }
            for a in rows
        ],
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "totalPages": max(1, math.ceil(total / pageSize)),
    }


@router.get("/admin/guest-search", summary="Guest Search for Reception")
async def guest_search(
    q: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(get_admin_or_staff),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WebsiteUser).where(WebsiteUser.role == "guest")
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(WebsiteUser.name).like(term),
                func.lower(WebsiteUser.email).like(term),
                WebsiteUser.phone.like(term),
            )
        )
    stmt = stmt.order_by(WebsiteUser.name.asc()).limit(6)
    res = await db.execute(stmt)
    users = res.scalars().all()
    return {
        "items": [{"id": u.id, "name": u.name, "email": u.email, "phone": u.phone} for u in users]
    }


# ---- Statistics & Reports ----
@router.get("/admin/stats", summary="Website Dashboard Statistics")
async def get_admin_stats(
    auth: Dict[str, Any] = Depends(get_admin_or_staff),
    db: AsyncSession = Depends(get_db),
):
    today = today_ist()

    # User counts
    users_res = await db.execute(select(WebsiteUser))
    all_users = users_res.scalars().all()

    totals = {
        "users": len(all_users),
        "active": sum(1 for u in all_users if u.status == "active"),
        "disabled": sum(1 for u in all_users if u.status == "disabled"),
        "guests": sum(1 for u in all_users if u.role == "guest"),
        "staff": sum(1 for u in all_users if u.role == "staff"),
        "admins": sum(1 for u in all_users if u.role == "admin"),
    }

    # Booking counts
    bookings_res = await db.execute(select(WebsiteBooking))
    all_b = bookings_res.scalars().all()

    by_status = {
        "pending": sum(1 for b in all_b if b.status == "pending"),
        "confirmed": sum(1 for b in all_b if b.status == "confirmed"),
        "cancelled": sum(1 for b in all_b if b.status == "cancelled"),
        "completed": sum(1 for b in all_b if b.status == "completed"),
    }
    upcoming = sum(1 for b in all_b if b.status in ("pending", "confirmed") and b.check_out >= today)

    return {
        "generatedAt": utc_now().isoformat(),
        "totals": totals,
        "signups": {"last7Days": 0, "last30Days": len(all_users)},
        "activeLast30Days": totals["active"],
        "lifecycle": {
            "registered": len(all_users),
            "everLoggedIn": sum(1 for u in all_users if u.last_login_at is not None),
            "everBooked": len(set(b.user_id for b in all_b if b.user_id)),
            "linkedHms": sum(1 for u in all_users if u.external_hms_id),
            "linkedPos": sum(1 for u in all_users if u.external_pos_id),
        },
        "bookings": {
            "total": len(all_b),
            "byStatus": by_status,
            "upcoming": upcoming,
            "createdLast7Days": len(all_b),
            "createdLast30Days": len(all_b),
        },
        "signupsByDay": [],
    }


# ---- Reports ----
@router.get("/admin/reports", summary="Website Booking Reports")
async def get_admin_reports(
    auth: Dict[str, Any] = Depends(get_admin_or_staff),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WebsiteBooking)
    res = await db.execute(stmt)
    all_b = res.scalars().all()

    def earns(b: WebsiteBooking) -> bool:
        return b.status in ("confirmed", "completed")

    months: Dict[str, Dict[str, Any]] = {}
    for b in all_b:
        m_key = b.check_in.strftime("%Y-%m") if hasattr(b.check_in, "strftime") else str(b.check_in)[:7]
        if m_key not in months:
            months[m_key] = {"month": m_key, "bookings": 0, "cancelled": 0, "revenue": 0, "nights": 0}
        m = months[m_key]
        m["bookings"] += 1
        if b.status == "cancelled":
            m["cancelled"] += 1
        if earns(b):
            m["revenue"] += int(b.total_amount or 0)
            m["nights"] += int((b.nights or 0) * (b.room_count or 1))

    def count_by(key_fn) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for b in all_b:
            val = str(key_fn(b) or "Unknown")
            counts[val] = counts.get(val, 0) + 1
        return sorted([{"name": k, "count": v} for k, v in counts.items()], key=lambda x: x["count"], reverse=True)

    kept = [b for b in all_b if earns(b)]
    total_revenue = sum(int(b.total_amount or 0) for b in kept)
    total_nights = sum(int((b.nights or 0) * (b.room_count or 1)) for b in kept)
    avg_stay = round(sum(int(b.nights or 0) for b in kept) / len(kept), 1) if kept else 0.0

    sorted_months = sorted(months.values(), key=lambda x: x["month"])[-12:]

    return {
        "generatedAt": utc_now().isoformat(),
        "totals": {
            "bookings": len(all_b),
            "cancelled": sum(1 for b in all_b if b.status == "cancelled"),
            "revenue": total_revenue,
            "roomNights": total_nights,
            "avgStay": avg_stay,
        },
        "months": sorted_months,
        "rooms": count_by(lambda b: b.room_name or b.room_id),
        "payments": count_by(lambda b: b.payment_status),
        "statuses": count_by(lambda b: b.status),
    }


# ---- Room Rates ----
@router.get("/admin/rooms", summary="List Room Rates")
async def list_rooms(
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rates_res = await db.execute(select(WebsiteRoomRate))
    rate_map = {r.room_id: r.rate for r in rates_res.scalars().all()}
    items = []
    for room_id in ROOM_IDS:
        default_rate = ROOM_DEFINITIONS[room_id]["ratePerNight"]
        items.append({
            "id": room_id,
            "name": ROOM_DEFINITIONS[room_id]["name"],
            "rate": rate_map.get(room_id, default_rate),
            "defaultRate": default_rate,
            "maxAdults": ROOM_DEFINITIONS[room_id]["maxAdults"],
        })
    return {"items": items}


class PutRoomRateBody(BaseModel):
    rate: int = Field(..., ge=100, le=1000000)


@router.put("/admin/rooms/{room_id}", summary="Set Room Rate")
async def put_room_rate(
    room_id: str,
    body: PutRoomRateBody,
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if room_id not in ROOM_DEFINITIONS:
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    stmt = select(WebsiteRoomRate).where(WebsiteRoomRate.room_id == room_id)
    res = await db.execute(stmt)
    rate_row = res.scalars().first()
    if rate_row:
        rate_row.rate = body.rate
        rate_row.updated_at = utc_now()
    else:
        rate_row = WebsiteRoomRate(room_id=room_id, rate=body.rate)
        db.add(rate_row)

    await log_activity(
        db,
        actor_id=auth["id"],
        actor_name=auth["name"],
        action="room.rate",
        target=ROOM_DEFINITIONS[room_id]["name"],
        detail=f"₹{body.rate}",
    )
    await db.commit()
    return {"id": room_id, "name": ROOM_DEFINITIONS[room_id]["name"], "rate": body.rate}


@router.get("/qr-hub/admin/settings", summary="Get QR Hub Settings")
async def get_qr_settings(
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(QrSetting)
    res = await db.execute(stmt)
    rows = res.scalars().all()
    settings_dict = {r.key: r.value for r in rows}
    if "baseUrl" not in settings_dict:
        settings_dict["baseUrl"] = "https://example.com"
    return {"settings": settings_dict}


@router.put("/qr-hub/admin/settings", summary="Update QR Hub Settings")
async def update_qr_settings(
    body: Dict[str, Any] = Body(...),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    for key, val in body.items():
        stmt = select(QrSetting).where(QrSetting.key == key)
        res = await db.execute(stmt)
        setting = res.scalars().first()
        if setting:
            setting.value = str(val)
        else:
            setting = QrSetting(key=key, value=str(val))
            db.add(setting)
    await db.commit()
    return {"ok": True, "settings": body}


# ---- QR Hub analytics + CSV export ----
async def _qr_scope(db: AsyncSession, slug: Optional[str]):
    """Organization id for a slug (404 if unknown), or None for 'all organizations'."""
    if not slug:
        return None
    org = (await db.execute(select(QrOrganization).where(QrOrganization.slug == slug))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return org.id


def _qr_range(from_: Optional[str], to: Optional[str]):
    """(first_day, last_day, utc_start, utc_end_exclusive) for an IST date range. Default: the last 30 days."""
    try:
        last = date.fromisoformat(to) if to else today_ist()
        first = date.fromisoformat(from_) if from_ else last - timedelta(days=29)
    except ValueError:
        raise HTTPException(status_code=422, detail={"error": "validation_failed", "issues": [{"path": "from", "message": "Use YYYY-MM-DD dates."}]})
    bad = '"from" must not be after "to".' if first > last else "Range is limited to 366 days." if (last - first).days > 366 else ""
    if bad:
        raise HTTPException(status_code=422, detail={"error": "validation_failed", "issues": [{"path": "from", "message": bad}]})
    start = datetime.combine(first, datetime.min.time(), tzinfo=IST_TIMEZONE)
    end = datetime.combine(last + timedelta(days=1), datetime.min.time(), tzinfo=IST_TIMEZONE)
    return first, last, start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def _as_ist(dt: datetime) -> datetime:
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(IST_TIMEZONE)


def _top(counter, limit: Optional[int] = None):
    rows = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{"name": k, "count": n} for k, n in (rows[:limit] if limit else rows)]


async def _qr_analytics(db: AsyncSession, slug: Optional[str], from_: Optional[str], to: Optional[str]):
    org_id = await _qr_scope(db, slug)
    first, last, start, end = _qr_range(from_, to)
    vq = select(QrVisit).where(QrVisit.visited_at >= start, QrVisit.visited_at < end)
    cq = select(QrClick).where(QrClick.clicked_at >= start, QrClick.clicked_at < end)
    if org_id:
        vq, cq = vq.where(QrVisit.organization_id == org_id), cq.where(QrClick.organization_id == org_id)
    visits = (await db.execute(vq)).scalars().all()
    clicks = (await db.execute(cq)).scalars().all()

    placements = {p.id: p for p in (await db.execute(select(QrPlacement))).scalars().all()}
    links = {l.id: l for l in (await db.execute(select(QrLink))).scalars().all()}

    daily_v: Dict[str, int] = {}
    daily_c: Dict[str, int] = {}
    hours = [0] * 24
    weekdays = [0] * 7  # Sunday = 0
    devices: Dict[str, int] = {}
    browsers: Dict[str, int] = {}
    referrers: Dict[str, int] = {}
    by_place: Dict[Any, Dict[str, int]] = {}
    for v in visits:
        t = _as_ist(v.visited_at)
        daily_v[t.date().isoformat()] = daily_v.get(t.date().isoformat(), 0) + 1
        hours[t.hour] += 1
        weekdays[(t.weekday() + 1) % 7] += 1
        devices[v.device_type] = devices.get(v.device_type, 0) + 1
        browsers[v.browser] = browsers.get(v.browser, 0) + 1
        if v.referrer_host:
            referrers[v.referrer_host] = referrers.get(v.referrer_host, 0) + 1
        row = by_place.setdefault(v.placement_id, {"scans": 0, "visits": 0, "clicks": 0})
        row["visits"] += 1
        row["scans"] += 1 if v.source == "scan" else 0
    link_clicks: Dict[Any, int] = {}
    for c in clicks:
        d = _as_ist(c.clicked_at).date().isoformat()
        daily_c[d] = daily_c.get(d, 0) + 1
        if c.link_id:
            link_clicks[c.link_id] = link_clicks.get(c.link_id, 0) + 1
        by_place.setdefault(c.placement_id, {"scans": 0, "visits": 0, "clicks": 0})["clicks"] += 1

    daily = []
    day = first
    while day <= last:
        k = day.isoformat()
        daily.append({"date": k, "visits": daily_v.get(k, 0), "clicks": daily_c.get(k, 0)})
        day += timedelta(days=1)
    top_links = sorted(
        ({"id": str(i), "title": links[i].title, "clicks": n} for i, n in link_clicks.items() if i in links),
        key=lambda r: (-r["clicks"], r["title"]),
    )[:10]
    by_placement = sorted(
        (
            {
                "placementId": str(pid) if pid else None,
                "code": placements[pid].code if pid in placements else None,
                "label": placements[pid].label if pid in placements else None,
                **r,
            }
            for pid, r in by_place.items()
        ),
        key=lambda r: (-r["scans"], -r["visits"], r["code"] or ""),
    )
    return {
        "range": {"from": first.isoformat(), "to": last.isoformat()},
        "totals": {
            "visits": len(visits),
            "scans": sum(1 for v in visits if v.source == "scan"),
            "clicks": len(clicks),
            "reviewClicks": sum(1 for c in clicks if c.is_review),
        },
        "daily": daily,
        "devices": _top(devices),
        "browsers": _top(browsers),
        "referrers": _top(referrers, 10),
        "topLinks": top_links,
        "byPlacement": by_placement,
        "byHour": [{"hour": h, "visits": n} for h, n in enumerate(hours)],
        "byWeekday": [{"weekday": d, "visits": n} for d, n in enumerate(weekdays)],
    }


@router.get("/qr-hub/admin/analytics", summary="QR Hub Analytics (all organizations)")
async def qr_analytics_all(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _qr_analytics(db, None, from_, to)


@router.get("/qr-hub/admin/organizations/{slug}/analytics", summary="QR Hub Analytics (one organization)")
async def qr_analytics_org(
    slug: str,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await _qr_analytics(db, slug, from_, to)


def _csv_cell(v: Any) -> str:
    """One CSV cell; text starting with = + - @ tab or CR gets a leading ' so spreadsheets never run it as a formula."""
    if v is None:
        return ""
    s = v.isoformat() if isinstance(v, datetime) else str(v)
    if isinstance(v, str) and s[:1] in ("=", "+", "-", "@", "\t", "\r"):
        s = "'" + s
    return '"' + s.replace('"', '""') + '"' if any(ch in s for ch in '",\r\n') else s


@router.get("/qr-hub/admin/export.csv", summary="Export QR Hub visits or clicks as CSV")
async def qr_export_csv(
    type: str = Query(..., pattern="^(visits|clicks)$"),
    slug: Optional[str] = Query(None),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    auth: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _qr_scope(db, slug)
    first, last, start, end = _qr_range(from_, to)
    orgs = {o.id: o.slug for o in (await db.execute(select(QrOrganization))).scalars().all()}
    placements = {p.id: p for p in (await db.execute(select(QrPlacement))).scalars().all()}
    if type == "visits":
        cols = ["visited_at", "organization", "placement_code", "placement_label", "source", "device_type", "browser", "os", "referrer_host"]
        q = select(QrVisit).where(QrVisit.visited_at >= start, QrVisit.visited_at < end).order_by(QrVisit.visited_at.desc()).limit(50000)
        if org_id:
            q = q.where(QrVisit.organization_id == org_id)
        rows = [
            {
                "visited_at": v.visited_at, "organization": orgs.get(v.organization_id),
                "placement_code": getattr(placements.get(v.placement_id), "code", None),
                "placement_label": getattr(placements.get(v.placement_id), "label", None),
                "source": v.source, "device_type": v.device_type, "browser": v.browser, "os": v.os, "referrer_host": v.referrer_host,
            }
            for v in (await db.execute(q)).scalars().all()
        ]
    else:
        links = {l.id: l for l in (await db.execute(select(QrLink))).scalars().all()}
        cols = ["clicked_at", "organization", "link_title", "destination_url", "placement_code", "placement_label", "device_type", "browser", "referrer_host"]
        q = select(QrClick).where(QrClick.clicked_at >= start, QrClick.clicked_at < end).order_by(QrClick.clicked_at.desc()).limit(50000)
        if org_id:
            q = q.where(QrClick.organization_id == org_id)
        rows = [
            {
                "clicked_at": c.clicked_at, "organization": orgs.get(c.organization_id),
                "link_title": links[c.link_id].title if c.link_id in links else "Review",
                "destination_url": links[c.link_id].destination_url if c.link_id in links else None,
                "placement_code": getattr(placements.get(c.placement_id), "code", None),
                "placement_label": getattr(placements.get(c.placement_id), "label", None),
                "device_type": c.device_type, "browser": c.browser, "referrer_host": c.referrer_host,
            }
            for c in (await db.execute(q)).scalars().all()
        ]
    body = "\r\n".join([",".join(cols)] + [",".join(_csv_cell(r[c]) for c in cols) for r in rows]) + "\r\n"
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="qr-hub-{type}-{first}_{last}.csv"'},
    )
