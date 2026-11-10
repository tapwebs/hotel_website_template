from datetime import timedelta
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.errors import NotFoundException, UnauthorizedException
from backend.app.core.rbac import AccountType, Role, get_user_permissions, map_legacy_role_to_account_and_job
from backend.app.core.security import create_access_token, verify_password
from backend.app.models.base import utc_now
from backend.app.models.organization import Organization, Property
from backend.app.models.user import User
from backend.app.schemas.auth import LoginRequest, PropertyBrief, TokenResponse, UserSessionResponse


import time

_org_name_cache: dict[str, tuple[str, float]] = {}
_props_cache: dict[str, tuple[List[PropertyBrief], float]] = {}
SESSION_CACHE_TTL = 60.0


class AuthService:
    @staticmethod
    def invalidate_cache():
        _org_name_cache.clear()
        _props_cache.clear()

    @staticmethod
    async def authenticate_user(db: AsyncSession, login_data: LoginRequest) -> TokenResponse:
        raw_identifier = (login_data.username_or_email or "").strip()
        if not raw_identifier:
            raise UnauthorizedException("Invalid username or password.")

        stmt = select(User).where(
            or_(
                func.lower(User.username) == raw_identifier.lower(),
                func.lower(User.email) == raw_identifier.lower(),
            )
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise UnauthorizedException("Invalid username or password.")

        if not user.is_active:
            raise UnauthorizedException("Your staff account has been deactivated. Please contact an administrator.")

        if not verify_password(login_data.password, user.password_hash):
            raise UnauthorizedException("Invalid username or password.")

        # Update last login timestamp
        user.last_login_at = utc_now()
        await db.commit()

        account_type = getattr(user, "account_type", None)
        job_role = getattr(user, "job_role", None)
        if not account_type and user.role_code:
            account_type, job_role = map_legacy_role_to_account_and_job(user.role_code)

        access_token = create_access_token(
            subject=user.user_id,
            claims={
                "username": user.username,
                "role": user.role_code,
                "account_type": account_type,
                "job_role": job_role,
                "property_id": user.property_id or settings.DEFAULT_PROPERTY_ID,
                "ver": user.token_version or 1
            },
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )

        return TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    @staticmethod
    async def get_user_session(db: AsyncSession, user: User) -> UserSessionResponse:
        now = time.time()

        # Fetch organization (cached with TTL)
        org_name = None
        if user.org_id and user.org_id in _org_name_cache:
            cached_org, exp = _org_name_cache[user.org_id]
            if now < exp:
                org_name = cached_org

        if org_name is None:
            org_stmt = select(Organization).where(Organization.org_id == user.org_id)
            org_result = await db.execute(org_stmt)
            org = org_result.scalar_one_or_none()
            org_name = org.name if org else "TapMenu Luxury Hospitality Group"
            if user.org_id:
                _org_name_cache[user.org_id] = (org_name, now + SESSION_CACHE_TTL)

        # Determine available properties based on role hierarchy (cached with TTL)
        prop_cache_key = f"{user.role_code}:{user.org_id}:{user.property_id}"
        available_props: Optional[List[PropertyBrief]] = None
        if prop_cache_key in _props_cache:
            cached_props, exp = _props_cache[prop_cache_key]
            if now < exp:
                available_props = cached_props

        if available_props is None:
            is_platform_admin = (
                user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
                getattr(user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
            )
            if is_platform_admin:
                prop_stmt = select(Property)
            elif user.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value] or getattr(user, "account_type", None) in ["OWNER", "MANAGER"]:
                prop_stmt = select(Property).where(Property.org_id == user.org_id)
            else:
                prop_stmt = select(Property).where(Property.property_id == user.property_id)

            prop_res = await db.execute(prop_stmt)
            properties = prop_res.scalars().all()

            available_props = []
            for p in properties:
                available_props.append(PropertyBrief(
                    propertyId=p.property_id,
                    propertyName=p.name,
                    city=p.city,
                    currency=p.currency
                ))
            _props_cache[prop_cache_key] = (available_props, now + SESSION_CACHE_TTL)

        active_prop_id = user.property_id or (available_props[0].propertyId if available_props else settings.DEFAULT_PROPERTY_ID)
        active_prop = next((p for p in available_props if p.propertyId == active_prop_id), available_props[0] if available_props else None)
        active_prop_name = active_prop.propertyName if active_prop else ""

        # Authoritative permissions derived from centralized RBAC engine
        resolved_permissions = sorted(list(get_user_permissions(user)))

        account_type = getattr(user, "account_type", None)
        job_role = getattr(user, "job_role", None)
        if not account_type and user.role_code:
            account_type, job_role = map_legacy_role_to_account_and_job(user.role_code)

        return UserSessionResponse(
            userId=user.user_id,
            fullName=user.full_name,
            email=user.email,
            avatarUrl=user.avatar_url,
            role=user.role_code,
            accountType=account_type,
            jobRole=job_role,
            permissions=resolved_permissions,
            organizationId=user.org_id,
            organizationName=org_name,
            activePropertyId=active_prop_id,
            activePropertyName=active_prop_name,
            availableProperties=available_props,
            managementScope=user.management_scope or []
        )
