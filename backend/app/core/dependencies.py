from typing import List, Optional, Set
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.errors import ForbiddenException, NotFoundException, UnauthorizedException
from backend.app.core.security import decode_access_token
from backend.app.core.rbac import (
    Role,
    Permission,
    get_user_permissions,
    user_has_permission
)

import time

security = HTTPBearer(auto_error=False)

# Per-process cache of the authenticated User row, so each request does not re-query users.
# Trade-off: a session revoked or a user disabled/changed on ANOTHER worker stays valid for up to USER_CACHE_TTL_SECONDS
# (the writing worker evicts immediately via evict_user_cache). The cached copy is detached and never handed out directly:
# each request gets its own instance via session.merge(load=False), so routes can still modify and commit current_user.
_user_cache: dict[str, tuple[float, any]] = {}
USER_CACHE_TTL_SECONDS = 15.0
USER_CACHE_MAX_ENTRIES = 1000


def evict_user_cache(user_id: str) -> None:
    """Drop a cached user so role/permission/revocation changes take effect immediately, not after the TTL."""
    _user_cache.pop(user_id, None)


async def _active_user(db: AsyncSession, user_id: str):
    from sqlalchemy.orm import make_transient_to_detached
    from backend.app.models.user import User
    now = time.monotonic()
    hit = _user_cache.get(user_id)
    if hit and hit[0] > now:
        return await db.merge(hit[1], load=False)
    user = (await db.execute(select(User).where(User.user_id == user_id, User.is_active == True))).scalar_one_or_none()
    if user is None:
        _user_cache.pop(user_id, None)
        return None
    snapshot = User(**{c.key: getattr(user, c.key) for c in User.__table__.columns})
    make_transient_to_detached(snapshot)
    if len(_user_cache) >= USER_CACHE_MAX_ENTRIES:
        stale = [k for k, v in _user_cache.items() if v[0] <= now] or list(_user_cache)[: USER_CACHE_MAX_ENTRIES // 10]
        for k in stale:
            _user_cache.pop(k, None)
    _user_cache[user_id] = (now + USER_CACHE_TTL_SECONDS, snapshot)
    return user


_property_org_cache: dict[str, tuple[str, float]] = {}
PROPERTY_CACHE_TTL_SECONDS = 60.0


def evict_property_cache(property_id: Optional[str] = None) -> None:
    """Drop cached property-to-org mappings so database changes reflect immediately."""
    if property_id:
        _property_org_cache.pop(property_id, None)
    else:
        _property_org_cache.clear()


async def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    if not auth or not auth.credentials:
        return None

    try:
        payload = decode_access_token(auth.credentials)
        user_id = payload.get("sub")
        token_ver = payload.get("ver")
        if not user_id:
            return None
    except Exception:
        return None

    user = await _active_user(db, user_id)
    if not user:
        return None
    if token_ver is not None and user.token_version is not None and token_ver != user.token_version:
        return None
    return user


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    if not auth or not auth.credentials:
        raise UnauthorizedException("Authentication token is required.")

    try:
        payload = decode_access_token(auth.credentials)
        user_id = payload.get("sub")
        token_ver = payload.get("ver")
        if not user_id:
            raise UnauthorizedException("Invalid token payload.")
    except Exception as e:
        raise UnauthorizedException(f"Token verification failed: {str(e)}")

    user = await _active_user(db, user_id)
    if not user:
        raise UnauthorizedException("User account not found or has been disabled.")
    if token_ver is not None and user.token_version is not None and token_ver != user.token_version:
        raise UnauthorizedException("Session has been terminated or revoked. Please log in again.")
    return user


def require_roles(allowed_roles: List[str]):
    async def role_checker(current_user = Depends(get_current_user)):
        # Super admin has unrestricted access
        if current_user.role_code == Role.ROLE_SUPER_ADMIN.value:
            return current_user
        if current_user.role_code not in allowed_roles:
            raise ForbiddenException(f"Action requires one of the following roles: {allowed_roles}")
        return current_user
    return role_checker


def require_permission(permission: str):
    async def permission_checker(current_user = Depends(get_current_user)):
        if current_user.role_code == Role.ROLE_SUPER_ADMIN.value:
            return current_user
        if not user_has_permission(current_user, permission):
            raise ForbiddenException(f"User lacks required permission: {permission}")
        return current_user
    return permission_checker


def require_any_permission(permissions: List[str]):
    async def permission_checker(current_user = Depends(get_current_user)):
        if current_user.role_code == Role.ROLE_SUPER_ADMIN.value:
            return current_user
        user_perms = get_user_permissions(current_user)
        if not any(p in user_perms for p in permissions):
            raise ForbiddenException(f"User lacks one of the required permissions: {permissions}")
        return current_user
    return permission_checker


async def get_property_context(
    x_property_id: Optional[str] = Header(None, alias="X-Property-Id"),
    current_user = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
) -> str:
    """
    Enforces strict property and tenant isolation.
    - PLATFORM_ADMIN: Cross-tenant / platform-wide administration.
    - OWNER (Super Admin) & MANAGER (General Manager): Access restricted to properties within their organization.
    - Department Staff: Strictly restricted to their assigned property_id.
    - Unauthenticated (Guest Engine): Contextual property from header or default, verified to exist.
    """
    target_property_id = x_property_id or (
        current_user.property_id if current_user and current_user.property_id else settings.DEFAULT_PROPERTY_ID
    )

    # Resolve property ownership dynamically from authoritative DB records (with TTL cache)
    now = time.time()
    org_id = None
    if target_property_id in _property_org_cache:
        cached_org, exp = _property_org_cache[target_property_id]
        if now < exp:
            org_id = cached_org

    if not org_id:
        from backend.app.models.organization import Property
        prop = await db.scalar(select(Property).where(Property.property_id == target_property_id))
        if not prop:
            raise NotFoundException(f"Property '{target_property_id}' not found.")
        org_id = prop.org_id
        _property_org_cache[target_property_id] = (org_id, now + PROPERTY_CACHE_TTL_SECONDS)

    if current_user:
        # Internal platform super admin retains cross-organization capabilities
        is_platform_admin = (
            current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
            getattr(current_user, "account_type", None) == "PLATFORM_ADMIN"
        )
        if is_platform_admin:
            return target_property_id

        # Hotel Owner & Manager: strictly isolated to their authorized organization
        if org_id != current_user.org_id:
            raise ForbiddenException("Cross-organization property access is strictly forbidden.")

        # Operational staff: strictly restricted to their assigned property
        is_admin_tier = (
            current_user.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value] or
            getattr(current_user, "account_type", None) in ["OWNER", "MANAGER"]
        )
        if not is_admin_tier:
            if not current_user.property_id or target_property_id != current_user.property_id:
                raise ForbiddenException(
                    f"Access to property '{target_property_id}' is forbidden for staff's assigned property '{current_user.property_id}'."
                )
            return current_user.property_id or target_property_id

    return target_property_id
