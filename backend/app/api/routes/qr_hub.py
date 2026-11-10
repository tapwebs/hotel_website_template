"""QR Hub public endpoints: scan redirects (/r/:slug), public hub profile, visit and click analytics.

Preserves exact routes and parameters expected by:
- Public QR code scans (/r/:slug?p=placement)
- Public Digital Hub page (/hub/:slug, /qr-hub/public/hub/:slug)
- Public click and visit beacons (/qr-hub/public/click, /qr-hub/public/visit)
"""
from datetime import datetime, timezone
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.website_auth import get_client_ip, rate_limiter
from backend.app.models.base import generate_uuid, utc_now
from backend.app.models.room import Room
from backend.app.models.website import (
    QrClick,
    QrLink,
    QrOffer,
    QrOrganization,
    QrPlacement,
    QrVisit,
)
from backend.app.schemas.website import QrClickRequest, QrVisitRequest

router = APIRouter(tags=["QR Hub Public"])


def get_public_site_url() -> str:
    """Returns origin for public QR landing pages."""
    site_url = getattr(settings, "PUBLIC_SITE_URL", None)
    if site_url:
        return site_url.rstrip("/")
    if settings.CORS_ORIGINS:
        return settings.CORS_ORIGINS[0].rstrip("/")
    return "http://localhost:5173"


async def room_for_placement(
    db: AsyncSession,
    placement: Optional[QrPlacement],
    org: QrOrganization,
) -> Optional[Room]:
    """Resolves the authorized Room for a verified active room placement.

    Security guarantees:
    - Never parse or trust room numbers or client parameters from URLs.
    - Placement must be explicitly active and of kind 'room'.
    - Must be bound to an authorized Room via placement.room_id.
    - Validates property boundary: the room must belong to the organization's property.
    - Rejects invalid, revoked, or cross-property tokens immediately.
    """
    if not placement or placement.kind != "room" or placement.status != "active":
        return None

    if not placement.room_id:
        return None

    room = await db.get(Room, placement.room_id)
    if not room:
        return None

    # Validate property boundary
    expected_property_id = getattr(org, "property_id", None) or settings.DEFAULT_PROPERTY_ID
    if room.property_id != expected_property_id:
        return None

    return room


def parse_user_agent(ua_string: Optional[str]) -> dict:
    """Extracts simplified client device/browser info from User-Agent string."""
    ua = (ua_string or "").lower()
    is_bot = any(b in ua for b in ["bot", "spider", "crawl", "preview", "whatsapp", "telegram", "facebookexternalhit"])
    device_type = "mobile" if "mobile" in ua or "android" in ua or "iphone" in ua else "desktop"
    browser = "chrome" if "chrome" in ua else "safari" if "safari" in ua else "firefox" if "firefox" in ua else "unknown"
    os_name = "android" if "android" in ua else "ios" if "iphone" in ua or "ipad" in ua else "windows" if "windows" in ua else "mac" if "macintosh" in ua else "linux" if "linux" in ua else "unknown"
    return {"bot": is_bot, "device_type": device_type, "browser": browser, "os": os_name}


def _open_state(hours, now: datetime) -> dict:
    """Asia/Kolkata opening-hours state, same rule as the website API (open at open, closed from close; overnight ok)."""
    if not hours or not hours.get("open") or not hours.get("close"):
        return {"open_now": True, "opens_at": None}

    def to_min(hhmm: str) -> int:
        return int(hhmm[:2]) * 60 + int(hhmm[3:5])

    m = (now.hour * 60 + now.minute + 330) % 1440
    a, b = to_min(hours["open"]), to_min(hours["close"])
    is_open = True if a == b else (a <= m < b) if a < b else (m >= a or m < b)
    return {"open_now": is_open, "opens_at": None if is_open else hours["open"]}


@router.get("/r/{slug}", summary="QR Code Scan Redirect")
async def qr_scan_redirect(
    slug: str,
    request: Request,
    p: Optional[str] = Query(None, description="Placement code, e.g. lobby, reception"),
    db: AsyncSession = Depends(get_db),
):
    site_url = get_public_site_url()
    # Find organization by slug
    stmt = select(QrOrganization).where(QrOrganization.slug == slug)
    res = await db.execute(stmt)
    org = res.scalars().first()

    if not org or org.status != "published" or org.qr_status == "inactive":
        return RedirectResponse(url=f"{site_url}/hub/unavailable", status_code=302)

    placement_id = None
    is_valid_placement = False
    if p:
        stmt_p = select(QrPlacement).where(
            QrPlacement.organization_id == org.id,
            QrPlacement.code == p,
            QrPlacement.status == "active",
        )
        res_p = await db.execute(stmt_p)
        placement = res_p.scalars().first()
        if placement:
            if placement.kind == "room":
                room = await room_for_placement(db, placement, org)
                if room:
                    is_valid_placement = True
                    placement_id = placement.id
            else:
                is_valid_placement = True
                placement_id = placement.id

    # Record scan visit
    ua = parse_user_agent(request.headers.get("user-agent"))
    if not ua["bot"]:
        referrer = request.headers.get("referer", "")[:255] or None
        visit = QrVisit(
            organization_id=org.id,
            placement_id=placement_id,
            source="scan",
            device_type=ua["device_type"],
            browser=ua["browser"],
            os=ua["os"],
            referrer_host=referrer,
        )
        db.add(visit)
        await db.commit()

    dest = f"{site_url}/hub/{slug}"
    if is_valid_placement and p:
        dest += f"?p={p}"
    return RedirectResponse(url=dest, status_code=302)


@router.get("/hub/{slug}", summary="Get Public Hub Data")
@router.get("/qr-hub/public/hub/{slug}", summary="Get Public Hub Data (Alternative Path)")
async def get_public_hub(
    slug: str,
    response: Response,
    p: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    # Public QR traffic: a 10 s per-worker cache, so admin edits and offer start/end times show within 10 s.
    response.headers["Cache-Control"] = "public, max-age=10"
    key = (slug, p or "")
    hit = _hub_cache.get(key)
    if hit and time.monotonic() - hit[0] < _HUB_CACHE_TTL_SECONDS:
        return hit[1]
    data = await _load_public_hub(slug, p, db)
    if len(_hub_cache) >= 500:
        _hub_cache.clear()
    _hub_cache[key] = (time.monotonic(), data)
    return data


_HUB_CACHE_TTL_SECONDS = 10.0
_hub_cache: dict = {}


def invalidate_hub_cache(slug: Optional[str] = None):
    """Evict cached public hub data immediately upon admin updates or token revocation."""
    if slug:
        keys = [k for k in _hub_cache if k[0] == slug]
        for k in keys:
            _hub_cache.pop(k, None)
    else:
        _hub_cache.clear()


async def _load_public_hub(slug: str, p: Optional[str], db: AsyncSession):
    stmt = select(QrOrganization).where(QrOrganization.slug == slug)
    res = await db.execute(stmt)
    org = res.scalars().first()

    if not org or org.status != "published":
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    if org.qr_status == "inactive":
        return {"inactive": True}

    # Links
    now = utc_now()
    stmt_links = select(QrLink).where(
        QrLink.organization_id == org.id,
        QrLink.status == "active",
        or_(QrLink.show_from.is_(None), QrLink.show_from <= now),
        or_(QrLink.show_until.is_(None), QrLink.show_until > now),
    ).order_by(QrLink.sort_order.asc())
    links_res = await db.execute(stmt_links)
    links = links_res.scalars().all()

    # Placements
    placement_info = None
    if p:
        stmt_p = select(QrPlacement).where(
            QrPlacement.organization_id == org.id,
            QrPlacement.code == p,
            QrPlacement.status == "active",
        )
        p_res = await db.execute(stmt_p)
        place = p_res.scalars().first()
        if place:
            if place.kind == "room":
                # Strict server-side room validation
                room = await room_for_placement(db, place, org)
                if room and room.qr_token:
                    placement_info = {
                        "code": place.code,
                        "label": place.label,
                        "kind": place.kind,
                        "order_url": f"{get_public_site_url()}/dining/r/{room.qr_token}",
                    }
                else:
                    # Invalid, revoked, or cross-property room token -> reject
                    placement_info = None
            else:
                placement_info = {"code": place.code, "label": place.label, "kind": place.kind}

    # Offers
    stmt_offers = select(QrOffer).where(
        QrOffer.organization_id == org.id,
    )
    offers_res = await db.execute(stmt_offers)
    offers = offers_res.scalars().all()

    active_offers = []
    for o in offers:
        if o.starts_at and o.starts_at > now:
            continue
        if o.ends_at and o.ends_at < now:
            continue
        active_offers.append({
            "id": o.id,
            "text": o.text,
            "textHi": o.text_hi,
            "linkUrl": o.link_url,
            "text_hi": o.text_hi,
            "link_url": o.link_url,
        })

    wifi = {"ssid": org.wifi_ssid, "password": org.wifi_password} if org.wifi_visible and org.wifi_ssid else None
    return {
        # Contract read by the public website hub page (same shape as the website API): snake_case, nested organization.
        "organization": {
            "slug": org.slug,
            "name": org.name,
            "category": org.category,
            "description": org.description,
            "description_hi": org.description_hi,
            "phone": org.phone,
            "whatsapp": org.whatsapp,
            "email": org.email,
            "address": org.address,
            "maps_url": org.maps_url,
            "website_url": org.website_url,
            "review_url": org.review_url,
            "profile_image": org.profile_image,
            "logo": org.logo,
            "theme": org.theme or {},
        },
        # Legacy flat camelCase fields, kept so existing API consumers keep working.
        "id": org.id,
        "slug": org.slug,
        "name": org.name,
        "category": org.category,
        "description": org.description,
        "descriptionHi": org.description_hi,
        "phone": org.phone,
        "whatsapp": org.whatsapp,
        "email": org.email,
        "address": org.address,
        "mapsUrl": org.maps_url,
        "websiteUrl": org.website_url,
        "reviewUrl": org.review_url,
        "profileImage": org.profile_image,
        "logo": org.logo,
        "theme": org.theme or {},
        "wifi": wifi,
        "placement": placement_info,
        "offers": active_offers,
        "links": [
            {
                "id": l.id,
                "title": l.title,
                "title_hi": l.title_hi,
                "titleHi": l.title_hi,
                "destination_url": l.destination_url,
                "destinationUrl": l.destination_url,
                "category": l.category,
                "icon": l.icon,
                "description": l.description,
                "description_hi": l.description_hi,
                "descriptionHi": l.description_hi,
                "is_featured": l.is_featured,
                "isFeatured": l.is_featured,
                "hours": l.hours,
                **_open_state(l.hours, now),
            }
            for l in links
        ],
    }


@router.post("/qr-hub/public/visit", status_code=status.HTTP_204_NO_CONTENT, summary="Record Public Direct Visit")
async def record_public_visit(
    request: Request,
    body: QrVisitRequest,
    db: AsyncSession = Depends(get_db),
):
    ua = parse_user_agent(request.headers.get("user-agent"))
    if not ua["bot"]:
        stmt = select(QrOrganization).where(QrOrganization.slug == body.slug)
        res = await db.execute(stmt)
        org = res.scalars().first()
        if org:
            visit = QrVisit(
                organization_id=org.id,
                source="direct",
                device_type=ua["device_type"],
                browser=ua["browser"],
                os=ua["os"],
                referrer_host=(request.headers.get("referer", "")[:255] or None),
            )
            db.add(visit)
            await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/qr-hub/public/click", status_code=status.HTTP_204_NO_CONTENT, summary="Record Public Link Click")
async def record_public_click(
    request: Request,
    body: QrClickRequest,
    db: AsyncSession = Depends(get_db),
):
    ua = parse_user_agent(request.headers.get("user-agent"))
    if not ua["bot"]:
        stmt = select(QrOrganization).where(QrOrganization.slug == body.slug)
        res = await db.execute(stmt)
        org = res.scalars().first()
        if org:
            link_id = body.linkId
            is_review = False
            if not link_id:
                is_review = True
            click = QrClick(
                organization_id=org.id,
                link_id=link_id,
                is_review=is_review,
                device_type=ua["device_type"],
                browser=ua["browser"],
                referrer_host=(request.headers.get("referer", "")[:255] or None),
            )
            db.add(click)
            if link_id:
                # Increment click count on link
                await db.execute(
                    update(QrLink)
                    .where(QrLink.id == link_id)
                    .values(click_count=QrLink.click_count + 1, last_clicked_at=utc_now())
                )
            await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
