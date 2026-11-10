"""Public guest ordering API used by the copied TapMenu customer app (mounted at /dining/* in the frontend).

No login. A table QR or room card token is exchanged for a session id sent back as X-Dining-Session; order tracking,
reviews, and the reward wheel use the per-order tracking token. Errors use TapMenu's {"error": "..."} shape.
"""
import hashlib
import json
from typing import Any, Awaitable, Callable, Dict, Optional

from fastapi import APIRouter, Body, Depends, Header, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.errors import AppException
from backend.app.core.ratelimit import get_client_ip, hit
from backend.app.services.guest_dining_service import GuestDining

router = APIRouter(prefix="/guest", tags=["Guest Dining (TapMenu)"])


async def _run(fn: Callable[[], Awaitable[Any]]):
    try:
        return await fn()
    except AppException as e:
        body = {"error": e.message}
        if e.code == "ITEM_UNAVAILABLE":  # lets the app drop just the sold-out lines instead of failing the whole cart
            body.update(code=e.code, unavailable=e.details.get("unavailable", []))
        return JSONResponse(status_code=e.status_code, content=body)


def _limit(request: Request, key: str, n: int = 120, window: int = 60) -> None:
    hit(f"guest-{key}:{get_client_ip(request)}", n, window)


@router.post("/session/exchange")
async def exchange(request: Request, body: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_db)):
    _limit(request, "exchange", 30)
    token = str(body.get("token") or "")[:200]

    async def go():
        _, info = await GuestDining.exchange(db, token)
        return info
    return await _run(go)


@router.get("/session")
async def session(request: Request, x_dining_session: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    _limit(request, "read")
    return await _run(lambda: _info(db, x_dining_session))


async def _info(db, sid):
    return await GuestDining.info(db, await GuestDining.resolve(db, sid))


@router.get("/menu")
async def menu(request: Request, x_dining_session: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    _limit(request, "read")

    async def go():
        data = await GuestDining.menu(db, await GuestDining.resolve(db, x_dining_session))
        # ETag from the content itself: a repeat load or refresh gets a tiny 304 instead of the whole menu.
        etag = 'W/"m-' + hashlib.sha1(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:20] + '"'
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers={"ETag": etag})
        return JSONResponse(content=data, headers={"ETag": etag, "Cache-Control": "private, no-cache"})
    return await _run(go)


@router.post("/quote")
async def quote(request: Request, body: Dict[str, Any] = Body(...), x_dining_session: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    _limit(request, "read")

    async def go():
        return await GuestDining.quote(db, await GuestDining.resolve(db, x_dining_session), body)
    return await _run(go)


@router.post("/orders", status_code=201)
async def place(request: Request, body: Dict[str, Any] = Body(...), x_dining_session: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    _limit(request, "order", 10, 600)

    async def go():
        return JSONResponse(status_code=201, content=await GuestDining.place(db, await GuestDining.resolve(db, x_dining_session), body))
    return await _run(go)


@router.get("/orders/{token}")
async def track(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, "track", 240)

    async def go():
        etag, data = await GuestDining.track(db, token)
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers={"ETag": etag})
        return JSONResponse(content=data, headers={"ETag": etag, "Cache-Control": "private, no-cache"})
    return await _run(go)


@router.post("/orders/{token}/review")
async def review(token: str, request: Request, body: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_db)):
    _limit(request, "write", 20)
    return await _run(lambda: GuestDining.review(db, token, body))


@router.get("/orders/{token}/spin-config")
async def spin_config(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, "read")
    return await _run(lambda: GuestDining.spin_config(db, token))


@router.post("/orders/{token}/spin")
async def spin(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, "write", 20)
    return await _run(lambda: GuestDining.spin(db, token))



@router.post("/orders/{token}/razorpay-init")
async def razorpay_retry(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    _limit(request, "write", 20)
    return await _run(lambda: GuestDining.retry_payment(db, token))


@router.post("/payments/razorpay/verify")
async def razorpay_verify(request: Request, body: Dict[str, Any] = Body(...), db: AsyncSession = Depends(get_db)):
    _limit(request, "write", 30)
    return await _run(lambda: GuestDining.verify_payment(db, body))


@router.post("/payments/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook(request: Request, x_razorpay_signature: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    raw = await request.body()
    try:
        event = json.loads(raw or b"{}")
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Bad payload"})
    return await _run(lambda: GuestDining.webhook(db, raw, x_razorpay_signature or "", event))


# ── menu photos (public, mounted at /api/v1/menu-images) ─────────────────────
images_router = APIRouter(tags=["Guest Dining (TapMenu)"])
_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"}  # raster only: no SVG/HTML from the API origin


@images_router.get("/menu-images/{item_id}", summary="Menu item photo stored as a data URL, served as cacheable bytes")
async def menu_image(item_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    import base64
    import hashlib
    from urllib.parse import unquote_to_bytes
    from backend.app.models.pos import MenuItem

    item = await db.get(MenuItem, item_id[:50])
    url = (item.image_url or "") if item else ""
    header, sep, payload = url.partition(",")
    mime = header[5:].split(";", 1)[0].lower() if header.startswith("data:") else ""
    if not sep or mime not in _IMAGE_TYPES:
        return Response(status_code=404)
    etag = f'"{hashlib.sha1(url.encode()).hexdigest()[:16]}"'
    headers = {"ETag": etag, "Cache-Control": "public, max-age=31536000, immutable"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    try:
        body = base64.b64decode(payload) if ";base64" in header.lower() else unquote_to_bytes(payload)
    except Exception:
        return Response(status_code=404)
    return Response(content=body, media_type=mime, headers=headers)
