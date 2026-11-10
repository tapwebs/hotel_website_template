from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import evict_user_cache, get_current_user
from backend.app.core.errors import ForbiddenException
from backend.app.core.ratelimit import get_client_ip, hit, refund
from backend.app.core.rbac import AccountType, Role
from backend.app.models.organization import Property
from backend.app.models.user import User
from backend.app.schemas.auth import LoginRequest, SwitchPropertyRequest, TokenResponse, UserSessionResponse
from backend.app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, summary="User Login")
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    ip = get_client_ip(request)
    username = login_data.username_or_email.strip().lower()
    ip_user_key = f"auth:ip_user:{ip}:{username}"
    account_key = f"auth:account:{username}"
    ip_burst_key = f"auth:ip:{ip}"

    # Rate limiting:
    # 1. IP+Username (15 / 5m): ensures shared hotel Wi-Fi doesn't lock out other staff
    # 2. Account lockout (5 / 15m): protects against distributed credential stuffing
    # 3. IP burst ceiling (60 / 5m): stops high-frequency bots on a single IP
    hit(ip_burst_key, limit=60, window_seconds=300)
    hit(ip_user_key, limit=15, window_seconds=300)
    hit(account_key, limit=5, window_seconds=900)

    try:
        res = await AuthService.authenticate_user(db, login_data)
        refund(ip_user_key)
        refund(account_key)
        return res
    except Exception:
        raise


@router.get("/session", response_model=UserSessionResponse, summary="Get Current User Session")
async def get_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await AuthService.get_user_session(db, current_user)


@router.post("/switch-property", response_model=UserSessionResponse, summary="Switch Active Property")
async def switch_property(
    request: SwitchPropertyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Enforce property switching permissions:
    # Only Platform Admin can switch to any tenant property.
    # Hotel Owner and Manager can only switch to properties within their organization.
    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if is_platform_admin:
        pass
    elif current_user.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value] or getattr(current_user, "account_type", None) in ["OWNER", "MANAGER"]:
        prop = await db.scalar(select(Property).where(Property.property_id == request.property_id))
        if not prop or prop.org_id != current_user.org_id:
            raise ForbiddenException("Access to property outside your organization is forbidden.")
    else:
        raise ForbiddenException("Department staff cannot switch properties.")

    current_user.property_id = request.property_id
    await db.commit()
    evict_user_cache(current_user.user_id)
    return await AuthService.get_user_session(db, current_user)
