"""Public customer authentication and account gateway to the website backend (Fastify).

The public website talks to the unified API domain (e.g. api.example.com).
Customer authentication and guest account endpoints (/auth/google, /auth/me, /auth/login,
/auth/signup, /auth/logout, and /me/*) are forwarded directly to the website-api service
where guest identities, password hashes, and sessions reside in the isolated 'website' schema.
HMS staff authentication (/api/v1/auth/login) remains completely separate and untouched.
"""
import httpx
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from backend.app.core.config import settings

router = APIRouter(tags=["Customer Authentication & Account"])


class GoogleAuthRequest(BaseModel):
    idToken: str = Field(..., min_length=10, max_length=8192, description="Google ID Token credential")


_REQ_HEADERS = ("content-type", "accept", "cookie", "origin", "referer", "x-request-id")
_RES_HEADERS = ("content-type", "cache-control", "retry-after")
_client = httpx.AsyncClient(timeout=15.0)


def get_target_urls(path: str) -> list[str]:
    clean_path = path.lstrip('/')
    primary = f"{settings.WEBSITE_API_URL.rstrip('/')}/{clean_path}"
    urls = [primary]
    # If primary is localhost/127.0.0.1, candidate http://website-api:3001 allows connecting via Docker network
    if "127.0.0.1" in settings.WEBSITE_API_URL or "localhost" in settings.WEBSITE_API_URL:
        candidate = f"http://website-api:3001/{clean_path}"
        if candidate not in urls:
            urls.append(candidate)
    elif "website-api" in settings.WEBSITE_API_URL:
        candidate = f"http://127.0.0.1:3001/{clean_path}"
        if candidate not in urls:
            urls.append(candidate)
    return urls


async def _proxy_to_website(path: str, request: Request) -> Response:
    headers = {k: v for k, v in request.headers.items() if k.lower() in _REQ_HEADERS}
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "127.0.0.1")
    headers["X-Forwarded-For"] = client_ip.split(",")[0].strip()

    targets = get_target_urls(path)
    body = await request.body()
    up = None
    for target_url in targets:
        try:
            up = await _client.request(
                method=request.method,
                url=target_url,
                params=request.query_params,
                content=body,
                headers=headers,
            )
            break
        except (httpx.ConnectError, httpx.ConnectTimeout):
            continue
        except httpx.HTTPError:
            return Response(status_code=502, content=b'{"error":"website_service_unavailable"}', media_type="application/json")

    if up is None:
        return Response(status_code=502, content=b'{"error":"website_service_unavailable"}', media_type="application/json")

    res_headers = {k: v for k, v in up.headers.items() if k.lower() in _RES_HEADERS}
    response = Response(content=up.content, status_code=up.status_code, headers=res_headers)
    for cookie_val in up.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", cookie_val)
    return response


@router.post("/auth/google", summary="Customer Google Sign-In")
async def customer_google_auth(body: GoogleAuthRequest, request: Request) -> Response:
    return await _proxy_to_website("auth/google", request)


@router.get("/auth/me", summary="Customer Session Restoration")
async def customer_get_session(request: Request) -> Response:
    return await _proxy_to_website("auth/me", request)


@router.post("/auth/login", summary="Customer Password Login")
async def customer_login(request: Request) -> Response:
    return await _proxy_to_website("auth/login", request)


@router.post("/auth/signup", summary="Customer Registration")
async def customer_signup(request: Request) -> Response:
    return await _proxy_to_website("auth/signup", request)


@router.post("/auth/logout", summary="Customer Logout")
async def customer_logout(request: Request) -> Response:
    return await _proxy_to_website("auth/logout", request)


@router.api_route("/me/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
async def customer_account(path: str, request: Request) -> Response:
    return await _proxy_to_website(f"me/{path}", request)
