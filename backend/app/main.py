import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from backend.app.core.config import settings
from backend.app.core.database import async_session_factory
from backend.app.core.errors import register_exception_handlers
from backend.app.api.router import api_router
from backend.app.seed.demo_seed import seed_demo_data

slow_logger = logging.getLogger("backend.slow_requests")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure demo seed data exists in development only
    if settings.APP_ENV == "development" and settings.ENABLE_DEMO_SEED:
        async with async_session_factory() as session:
            try:
                await seed_demo_data(session)
            except Exception as e:
                print(f"Seed notice: {e}")
    yield
    # Shutdown logic if needed


app = FastAPI(
    title="TapMenu Open Hospitality Platform API",
    description="Production-grade, asynchronous modular monolith backend for TapMenu Open Hospitality Platform.",
    version="2.0.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    openapi_url="/openapi.json" if settings.APP_ENV != "production" else None,
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Response Gzip Compression Middleware (>1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)


import time
from fastapi.responses import JSONResponse
from sqlalchemy import text
from backend.app.core.database import get_db
from fastapi import Depends

# Request ID, Security Headers, Size Limit & High-Resolution Timing Middleware
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    # Enforce request payload size limit (mitigates memory exhaustion / DoS)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.MAX_REQUEST_SIZE_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"error": "payload_too_large", "message": "Request payload exceeds allowed limit."}
                )
        except ValueError:
            pass

    start_time = time.perf_counter()
    request_id = request.headers.get("X-Request-ID") or f"req-{uuid.uuid4()}"
    request.state.request_id = request_id
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    if duration_ms > 800:
        slow_logger.warning("slow request %s %s -> %s in %.0fms", request.method, request.url.path, response.status_code, duration_ms)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path in ("/docs", "/redoc") or request.url.path.startswith(("/docs/", "/redoc/")):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "worker-src 'self' blob:; "
            "frame-ancestors 'none';"
        )
    else:
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    if settings.APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Register Unified Error Handlers
register_exception_handlers(app)

# Mount API v1 Endpoints
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Mount Native Migrated Website Routers
from backend.app.api.routes.customer_auth import router as customer_auth_router
from backend.app.api.routes.customer_account import router as customer_account_router
from backend.app.api.routes.qr_hub import router as qr_hub_router

app.include_router(customer_auth_router)
app.include_router(customer_account_router)
app.include_router(qr_hub_router)

# Mount Customer Authentication & Account Gateway (transitional safety fallback)
from backend.app.api.routes.customer_gateway import router as customer_router
app.include_router(customer_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "tapmenu-hms-backend",
        "version": "2.0.0",
        "environment": settings.APP_ENV
    }


@app.get("/health/ready", tags=["Health"])
async def readiness_check(db = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "environment": settings.APP_ENV
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected", "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
