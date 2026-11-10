"""Staff gateway to the website backend (Fastify).

The console talks to ONE API (this one). Requests under /api/v1/website/* are authenticated here with the normal HMS
bearer token, then forwarded to the website backend with the shared integration key and the staff identity in
X-HMS-User-* headers. The website backend trusts those headers only together with the key, so it never has to call back
to the HMS to check a token, and the key never reaches a browser.

Role mapping: MANAGE_SETTINGS -> website "admin"; VIEW_RESERVATIONS -> website "staff"; anything else -> 403.
"""
import httpx
from fastapi import APIRouter, Depends, Request, Response
from backend.app.core.config import settings
from backend.app.core.dependencies import get_current_user
from backend.app.core.errors import ForbiddenException
from backend.app.core.rbac import Permission, get_user_permissions

router = APIRouter(prefix="/website", tags=["Website Gateway"])

# Request/response headers worth passing through; everything else (cookies, hop-by-hop, client-supplied X-HMS-*) is dropped.
_REQ = ("content-type", "accept", "if-none-match")
_RES = ("content-type", "content-disposition", "cache-control", "etag", "retry-after")
_client = httpx.AsyncClient(timeout=15.0)


def website_role(user) -> str:
    perms = get_user_permissions(user)
    if Permission.MANAGE_SETTINGS.value in perms:
        return "admin"
    if Permission.VIEW_RESERVATIONS.value in perms:
        return "staff"
    raise ForbiddenException("Website tools need reservation or settings access.")


from backend.app.api.routes.customer_gateway import get_target_urls


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
async def forward(path: str, request: Request, user=Depends(get_current_user)) -> Response:
    role = website_role(user)
    # Never fall back to a built-in key: anyone reading the source could then impersonate staff on the website API.
    key = settings.HMS_INTEGRATION_API_KEY
    if not key:
        return Response(status_code=503, content=b'{"error":"website_gateway_not_configured"}', media_type="application/json")
    headers = {k: v for k, v in request.headers.items() if k.lower() in _REQ}
    headers.update({
        "X-HMS-Integration-Key": key,
        "X-HMS-User-Id": user.user_id,
        "X-HMS-User-Name": user.full_name.encode("ascii", "ignore").decode() or "staff",
        "X-HMS-User-Email": user.email,
        "X-HMS-User-Role": role,
    })
    targets = get_target_urls(path)
    body = await request.body()
    up = None
    for target_url in targets:
        try:
            up = await _client.request(
                request.method,
                target_url,
                params=request.query_params,
                content=body,
                headers=headers,
            )
            break
        except (httpx.ConnectError, httpx.ConnectTimeout):
            continue
        except httpx.HTTPError:
            return Response(status_code=502, content=b'{"error":"website_unavailable"}', media_type="application/json")

    if up is None:
        return Response(status_code=502, content=b'{"error":"website_unavailable"}', media_type="application/json")
    return Response(content=up.content, status_code=up.status_code, headers={k: v for k, v in up.headers.items() if k.lower() in _RES})
