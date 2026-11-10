from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.dependencies import evict_user_cache, get_current_user, require_permission
from backend.app.core.errors import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ValidationException
)
from backend.app.core.rbac import (
    ALL_MANAGEMENT_DEPARTMENTS,
    DEFAULT_GM_MANAGEMENT_SCOPE,
    AccountType,
    JobRole,
    Permission,
    Role,
    can_manage_account,
    can_manage_role,
    get_role_permissions,
    get_user_permissions,
    map_account_and_job_to_role,
    map_legacy_role_to_account_and_job
)
from backend.app.core.security import hash_password
from backend.app.models.audit import AuditLog
from backend.app.models.organization import Property
from backend.app.models.user import User

router = APIRouter(prefix="/staff", tags=["Staff Management"])


# ==========================================
# SCHEMAS
# ==========================================

class StaffMemberResponse(BaseModel):
    user_id: str
    username: str
    email: str
    full_name: str
    phone_number: Optional[str] = None
    role_code: str
    account_type: Optional[str] = None
    job_role: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    avatar_url: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    management_scope: List[str] = Field(default_factory=list)
    is_active: bool
    last_login_at: Optional[str] = None
    created_at: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class CreateStaffRequest(BaseModel):
    username: str
    email: str
    full_name: str
    phone_number: Optional[str] = None
    password: str
    role_code: Optional[str] = None
    account_type: Optional[str] = None
    job_role: Optional[str] = None
    property_id: Optional[str] = None
    permissions: Optional[List[str]] = None
    management_scope: Optional[List[str]] = None


class UpdateStaffRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    role_code: Optional[str] = None
    account_type: Optional[str] = None
    job_role: Optional[str] = None
    property_id: Optional[str] = None
    permissions: Optional[List[str]] = None
    management_scope: Optional[List[str]] = None


class UpdateRoleRequest(BaseModel):
    role_code: Optional[str] = None
    account_type: Optional[str] = None
    job_role: Optional[str] = None


class UpdatePermissionsRequest(BaseModel):
    permissions: List[str]


class UpdatePropertiesRequest(BaseModel):
    property_id: str


class UpdateManagementScopeRequest(BaseModel):
    management_scope: List[str]


class UpdateStatusRequest(BaseModel):
    is_active: bool


class ResetPasswordRequest(BaseModel):
    new_password: str


class AuditLogResponse(BaseModel):
    audit_id: str
    actor_username: str
    action: str
    entity_id: str
    recorded_at: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    justification_reason: Optional[str] = None


# ==========================================
# AUDIT LOG HELPER
# ==========================================

async def log_staff_audit(
    db: AsyncSession,
    actor: User,
    action: str,
    target_user_id: str,
    property_id: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    reason: Optional[str] = None
):
    audit = AuditLog(
        property_id=property_id or actor.property_id or settings.DEFAULT_PROPERTY_ID,
        actor_user_id=actor.user_id,
        actor_username=actor.username,
        action=action,
        entity_table="users",
        entity_id=target_user_id,
        old_values=old_values,
        new_values=new_values,
        justification_reason=reason,
        ip_address="127.0.0.1"
    )
    db.add(audit)


async def build_staff_response(db: AsyncSession, user: User) -> StaffMemberResponse:
    property_name = None
    if user.property_id:
        p = await db.scalar(select(Property).where(Property.property_id == user.property_id))
        if p:
            property_name = p.name

    resolved_perms = sorted(list(get_user_permissions(user)))

    account_type = getattr(user, "account_type", None)
    job_role = getattr(user, "job_role", None)
    if not account_type and getattr(user, "role_code", None):
        account_type, job_role = map_legacy_role_to_account_and_job(user.role_code)

    return StaffMemberResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        phone_number=user.phone_number,
        role_code=user.role_code,
        account_type=account_type,
        job_role=job_role,
        property_id=user.property_id,
        property_name=property_name,
        avatar_url=user.avatar_url,
        permissions=resolved_perms,
        management_scope=user.management_scope or [],
        is_active=user.is_active,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        created_at=user.created_at.isoformat() if user.created_at else ""
    )


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("", response_model=List[StaffMemberResponse], summary="List Staff Users")
async def list_staff(
    property_id: Optional[str] = None,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if is_platform_admin:
        query = select(User)
        if property_id:
            query = query.where(User.property_id == property_id)
    else:
        # Hotel Owner & Manager: strictly isolated to their own organization
        query = select(User).where(User.org_id == current_user.org_id)
        if property_id:
            prop = await db.scalar(select(Property).where(Property.property_id == property_id))
            if not prop or prop.org_id != current_user.org_id:
                raise ForbiddenException("Access to property outside your organization is forbidden.")
            query = query.where(User.property_id == property_id)

    query = query.order_by(User.full_name.asc())
    res = await db.execute(query)
    users = res.scalars().all()

    return [await build_staff_response(db, u) for u in users]


@router.get("/audit-history", response_model=List[AuditLogResponse], summary="Get Staff Audit History")
async def get_audit_history(
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    query = (
        select(AuditLog)
        .where(AuditLog.entity_table == "users")
        .order_by(desc(AuditLog.recorded_at))
        .limit(limit)
    )
    if not is_platform_admin:
        # Strictly scope audit records to properties belonging to the user's organization
        query = query.where(
            AuditLog.property_id.in_(
                select(Property.property_id).where(Property.org_id == current_user.org_id)
            )
        )

    res = await db.execute(query)
    audits = res.scalars().all()

    return [
        AuditLogResponse(
            audit_id=a.audit_id,
            actor_username=a.actor_username,
            action=a.action,
            entity_id=a.entity_id,
            recorded_at=a.recorded_at.isoformat() if a.recorded_at else "",
            old_values=a.old_values,
            new_values=a.new_values,
            justification_reason=a.justification_reason
        )
        for a in audits
    ]


@router.get("/{user_id}", response_model=StaffMemberResponse, summary="Get Staff Details")
async def get_staff_details(
    user_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    target = await db.scalar(select(User).where(User.user_id == user_id))
    if not target:
        raise NotFoundException("Staff member not found.")

    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if not is_platform_admin and target.org_id != current_user.org_id:
        raise ForbiddenException("Access to staff member from another organization is forbidden.")

    return await build_staff_response(db, target)


@router.post("", response_model=StaffMemberResponse, summary="Create New Staff Member")
async def create_staff(
    request: CreateStaffRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    # Resolve account_type, job_role, role_code
    account_type = request.account_type
    job_role = request.job_role
    role_code = request.role_code

    if account_type:
        valid_account_types = [a.value for a in AccountType]
        if account_type not in valid_account_types:
            raise ValidationException(f"Invalid account_type. Must be one of: {valid_account_types}")
        if account_type == AccountType.PLATFORM_ADMIN.value:
            raise ForbiddenException("Platform Super Admin accounts cannot be created from hotel staff administration.")

        if account_type == AccountType.STAFF.value:
            valid_job_roles = [j.value for j in JobRole]
            if not job_role or job_role not in valid_job_roles:
                raise ValidationException(f"Staff accounts require a valid job_role. Must be one of: {valid_job_roles}")
        else:
            job_role = None  # Owner and Manager do not use job presets

        computed_role = map_account_and_job_to_role(account_type, job_role)
        if not role_code:
            role_code = computed_role
    elif role_code:
        if role_code == "ROLE_PLATFORM_SUPER_ADMIN":
            raise ForbiddenException("Platform Super Admin accounts cannot be created from hotel staff administration.")
        valid_roles = [r.value for r in Role]
        if role_code not in valid_roles:
            raise ValidationException(f"Invalid role_code. Must be one of: {valid_roles}")
        account_type, job_role = map_legacy_role_to_account_and_job(role_code)
    else:
        raise ValidationException("Either account_type (and job_role for Staff) or role_code must be provided.")

    # Guard: Only SUPERADMIN / OWNER can create another SUPERADMIN / OWNER
    actor_account_type = getattr(current_user, "account_type", None)
    if not actor_account_type:
        actor_account_type, _ = map_legacy_role_to_account_and_job(current_user.role_code)

    if (account_type == AccountType.OWNER.value or role_code == Role.ROLE_SUPER_ADMIN.value) and current_user.role_code != Role.ROLE_SUPER_ADMIN.value and actor_account_type != AccountType.OWNER.value:
        raise ForbiddenException("Only SUPERADMIN can create another SUPERADMIN.")

    # Guard: GENERAL_MANAGER hierarchy checks
    if current_user.role_code == Role.ROLE_GENERAL_MANAGER.value or actor_account_type == AccountType.MANAGER.value:
        if account_type != AccountType.STAFF.value or role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value]:
            raise ForbiddenException("General Managers cannot create other General Manager accounts.")

        # Delegated management scope check
        if not can_manage_role(current_user.role_code, current_user.management_scope, role_code):
            raise ForbiddenException(f"Role '{role_code}' is outside your delegated management scope.")

        # Permission Delegation Rule: GRANTED_PERMISSION ⊆ ADMINISTRATOR_AUTHORIZED_PERMISSIONS
        actor_perms = get_user_permissions(current_user)
        requested_perms = request.permissions or list(get_role_permissions(role_code))
        for p in requested_perms:
            if p not in actor_perms:
                raise ForbiddenException(f"Cannot grant permission '{p}' which exceeds your own administrative authority.")

        # Cannot assign management scope
        if request.management_scope and len(request.management_scope) > 0:
            raise ForbiddenException("Only SUPERADMIN can configure delegated management scopes.")

        # Property scope check
        target_prop_id = request.property_id or current_user.property_id
        if target_prop_id:
            prop = await db.scalar(select(Property).where(Property.property_id == target_prop_id))
            if prop and prop.org_id != current_user.org_id:
                raise ForbiddenException("Cannot assign property outside your authorized organization.")
    else:
        target_prop_id = request.property_id or current_user.property_id
        if target_prop_id and current_user.org_id:
            prop = await db.scalar(select(Property).where(Property.property_id == target_prop_id))
            if prop and prop.org_id != current_user.org_id:
                raise ForbiddenException("Cannot assign property outside your authorized organization.")

    # Check duplicate username / email
    stmt = select(User).where((User.username == request.username) | (User.email == request.email))
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise ConflictException("Username or email is already registered.")

    final_perms = request.permissions if request.permissions is not None else sorted(list(get_role_permissions(role_code)))
    final_scope = request.management_scope if (request.management_scope is not None and current_user.role_code == Role.ROLE_SUPER_ADMIN.value) else (
        DEFAULT_GM_MANAGEMENT_SCOPE if role_code == Role.ROLE_GENERAL_MANAGER.value else []
    )

    new_user = User(
        org_id=current_user.org_id,
        property_id=target_prop_id,
        username=request.username,
        email=request.email,
        full_name=request.full_name,
        phone_number=request.phone_number,
        password_hash=hash_password(request.password),
        role_code=role_code,
        account_type=account_type,
        job_role=job_role,
        permissions=final_perms,
        management_scope=final_scope,
        is_active=True,
        token_version=1
    )
    db.add(new_user)
    await db.flush()

    await log_staff_audit(
        db,
        actor=current_user,
        action="STAFF_CREATED",
        target_user_id=new_user.user_id,
        property_id=target_prop_id,
        new_values={
            "username": new_user.username,
            "role": new_user.role_code,
            "account_type": new_user.account_type,
            "job_role": new_user.job_role,
            "property_id": target_prop_id
        }
    )

    await db.commit()
    await db.refresh(new_user)
    return await build_staff_response(db, new_user)


@router.patch("/{user_id}", response_model=StaffMemberResponse, summary="Edit Staff Member Profile")
async def update_staff(
    user_id: str,
    request: UpdateStaffRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    target = await db.scalar(select(User).where(User.user_id == user_id))
    if not target:
        raise NotFoundException("Staff member not found.")

    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if not is_platform_admin and target.org_id != current_user.org_id:
        raise ForbiddenException("Modification of staff member from another organization is forbidden.")

    # Guard: Self-modification protection
    if current_user.user_id == user_id:
        if request.role_code is not None and request.role_code != current_user.role_code:
            raise ForbiddenException("Staff members cannot alter their own assigned role.")
        if request.account_type is not None or request.job_role is not None:
            raise ForbiddenException("Staff members cannot alter their own assigned role.")
        if request.permissions is not None:
            raise ForbiddenException("Staff members cannot modify their own permissions.")
        if request.management_scope is not None:
            raise ForbiddenException("Staff members cannot modify their own management scope.")
        if request.property_id is not None and request.property_id != current_user.property_id:
            raise ForbiddenException("Staff members cannot alter their own property scope.")

    old_values = {
        "role_code": target.role_code,
        "account_type": target.account_type,
        "job_role": target.job_role,
        "permissions": target.permissions,
        "management_scope": target.management_scope,
        "property_id": target.property_id
    }

    # Disallow promoting to PLATFORM_ADMIN
    if request.account_type == AccountType.PLATFORM_ADMIN.value or request.role_code == "ROLE_PLATFORM_SUPER_ADMIN":
        raise ForbiddenException("Cannot assign or promote to Platform Super Admin from hotel staff administration.")

    actor_account_type = getattr(current_user, "account_type", None)
    if not actor_account_type:
        actor_account_type, _ = map_legacy_role_to_account_and_job(current_user.role_code)

    target_account_type = getattr(target, "account_type", None)
    if not target_account_type:
        target_account_type, _ = map_legacy_role_to_account_and_job(target.role_code)

    # Resolve requested role/account changes if any
    requested_account_type = request.account_type
    requested_job_role = request.job_role
    requested_role_code = request.role_code

    if requested_account_type:
        valid_account_types = [a.value for a in AccountType]
        if requested_account_type not in valid_account_types:
            raise ValidationException(f"Invalid account_type: {requested_account_type}")
        if requested_account_type == AccountType.STAFF.value:
            if requested_job_role is None:
                requested_job_role = target.job_role or JobRole.WAITER.value
            valid_job_roles = [j.value for j in JobRole]
            if requested_job_role not in valid_job_roles:
                raise ValidationException(f"Invalid job_role: {requested_job_role}")
        else:
            requested_job_role = None
        requested_role_code = map_account_and_job_to_role(requested_account_type, requested_job_role)
    elif requested_job_role and not requested_account_type:
        if (target_account_type or AccountType.STAFF.value) == AccountType.STAFF.value:
            requested_account_type = AccountType.STAFF.value
            valid_job_roles = [j.value for j in JobRole]
            if requested_job_role not in valid_job_roles:
                raise ValidationException(f"Invalid job_role: {requested_job_role}")
            requested_role_code = map_account_and_job_to_role(requested_account_type, requested_job_role)
    elif requested_role_code:
        valid_roles = [r.value for r in Role]
        if requested_role_code not in valid_roles:
            raise ValidationException(f"Invalid role_code. Must be one of: {valid_roles}")
        requested_account_type, requested_job_role = map_legacy_role_to_account_and_job(requested_role_code)

    # Guard: GENERAL_MANAGER hierarchy checks
    if current_user.role_code == Role.ROLE_GENERAL_MANAGER.value or actor_account_type == AccountType.MANAGER.value:
        if target.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value] or target_account_type in [AccountType.OWNER.value, AccountType.MANAGER.value]:
            raise ForbiddenException("General Managers cannot modify administrators or SuperAdmins.")

        if not can_manage_role(current_user.role_code, current_user.management_scope, target.role_code):
            raise ForbiddenException(f"Staff member with role '{target.role_code}' is outside your delegated management scope.")

        if requested_role_code is not None:
            if requested_role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value] or requested_account_type in [AccountType.OWNER.value, AccountType.MANAGER.value]:
                raise ForbiddenException("General Managers cannot elevate staff to Admin or SuperAdmin.")
            if not can_manage_role(current_user.role_code, current_user.management_scope, requested_role_code):
                raise ForbiddenException(f"Target role '{requested_role_code}' is outside your delegated management scope.")

        if request.permissions is not None:
            actor_perms = get_user_permissions(current_user)
            for p in request.permissions:
                if p not in actor_perms:
                    raise ForbiddenException(f"Cannot grant permission '{p}' exceeding your own administrative authority.")

        if request.management_scope is not None:
            raise ForbiddenException("Only SUPERADMIN can configure delegated management scopes.")

        if request.property_id is not None:
            prop = await db.scalar(select(Property).where(Property.property_id == request.property_id))
            if prop and prop.org_id != current_user.org_id:
                raise ForbiddenException("Cannot assign property outside your authorized organization.")
    elif current_user.role_code != Role.ROLE_SUPER_ADMIN.value and actor_account_type != AccountType.OWNER.value:
        raise ForbiddenException("Insufficient privileges to modify staff.")

    # Guard: Only SUPERADMIN can grant SUPERADMIN role
    if (requested_role_code == Role.ROLE_SUPER_ADMIN.value or requested_account_type == AccountType.OWNER.value) and current_user.role_code != Role.ROLE_SUPER_ADMIN.value and actor_account_type != AccountType.OWNER.value:
        raise ForbiddenException("Only SUPERADMIN can assign the SUPERADMIN role.")

    # Apply updates
    if request.full_name is not None:
        target.full_name = request.full_name
    if request.email is not None:
        target.email = request.email
    if request.phone_number is not None:
        target.phone_number = request.phone_number
    if request.property_id is not None:
        target.property_id = request.property_id

    revocation_needed = False
    if requested_role_code is not None and requested_role_code != target.role_code:
        target.role_code = requested_role_code
        target.account_type = requested_account_type
        target.job_role = requested_job_role
        revocation_needed = True
        if request.permissions is None:
            target.permissions = sorted(list(get_role_permissions(requested_role_code)))
    elif requested_account_type is not None or requested_job_role is not None:
        if requested_account_type is not None:
            target.account_type = requested_account_type
        if requested_job_role is not None:
            target.job_role = requested_job_role
        revocation_needed = True

    if request.permissions is not None:
        target.permissions = sorted(list(set(request.permissions)))
        revocation_needed = True

    if request.management_scope is not None and (current_user.role_code == Role.ROLE_SUPER_ADMIN.value or actor_account_type == AccountType.OWNER.value):
        target.management_scope = request.management_scope
        revocation_needed = True

    # If role or permissions changed, revoke existing active JWT sessions immediately
    if revocation_needed:
        target.token_version = (target.token_version or 1) + 1

    await log_staff_audit(
        db,
        actor=current_user,
        action="STAFF_UPDATED",
        target_user_id=target.user_id,
        property_id=target.property_id,
        old_values=old_values,
        new_values={
            "role_code": target.role_code,
            "account_type": target.account_type,
            "job_role": target.job_role,
            "permissions": target.permissions,
            "management_scope": target.management_scope,
            "property_id": target.property_id
        }
    )

    await db.commit()
    evict_user_cache(target.user_id)
    await db.refresh(target)
    return await build_staff_response(db, target)


@router.patch("/{user_id}/role", response_model=StaffMemberResponse, summary="Update Staff Member Role")
async def update_staff_role(
    user_id: str,
    request: UpdateRoleRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    return await update_staff(
        user_id=user_id,
        request=UpdateStaffRequest(
            role_code=request.role_code,
            account_type=request.account_type,
            job_role=request.job_role
        ),
        current_user=current_user,
        db=db
    )


@router.patch("/{user_id}/permissions", response_model=StaffMemberResponse, summary="Update Staff Member Permissions")
async def update_staff_permissions(
    user_id: str,
    request: UpdatePermissionsRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    return await update_staff(
        user_id=user_id,
        request=UpdateStaffRequest(permissions=request.permissions),
        current_user=current_user,
        db=db
    )


@router.patch("/{user_id}/properties", response_model=StaffMemberResponse, summary="Update Staff Member Property")
async def update_staff_properties(
    user_id: str,
    request: UpdatePropertiesRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    return await update_staff(
        user_id=user_id,
        request=UpdateStaffRequest(property_id=request.property_id),
        current_user=current_user,
        db=db
    )


@router.patch("/{user_id}/management-scope", response_model=StaffMemberResponse, summary="Update Admin Delegated Scope")
async def update_staff_management_scope(
    user_id: str,
    request: UpdateManagementScopeRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    return await update_staff(
        user_id=user_id,
        request=UpdateStaffRequest(management_scope=request.management_scope),
        current_user=current_user,
        db=db
    )


@router.patch("/{user_id}/status", response_model=StaffMemberResponse, summary="Activate or Deactivate Staff Account")
async def update_staff_status(
    user_id: str,
    request: UpdateStatusRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    target = await db.scalar(select(User).where(User.user_id == user_id))
    if not target:
        raise NotFoundException("Staff member not found.")

    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if not is_platform_admin and target.org_id != current_user.org_id:
        raise ForbiddenException("Modifying status of staff member from another organization is forbidden.")

    # Guard: SUPERADMIN protection (prevent lockout of the last active SuperAdmin)
    if target.role_code == Role.ROLE_SUPER_ADMIN.value and not request.is_active:
        active_super_count = await db.scalar(
            select(func.count(User.user_id)).where(
                User.role_code == Role.ROLE_SUPER_ADMIN.value,
                User.is_active == True
            )
        )
        if (active_super_count or 0) <= 1:
            raise ConflictException("Cannot deactivate the system's last active SUPERADMIN.")

    # Guard: Self-deactivation protection
    if current_user.user_id == user_id:
        raise ForbiddenException("Administrators cannot deactivate their own account.")

    if target.role_code == Role.ROLE_SUPER_ADMIN.value:
        if current_user.role_code != Role.ROLE_SUPER_ADMIN.value:
            raise ForbiddenException("Only SUPERADMIN can modify SUPERADMIN account status.")

    # Guard: GENERAL_MANAGER scope checks
    if current_user.role_code == Role.ROLE_GENERAL_MANAGER.value:
        if target.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value]:
            raise ForbiddenException("General Managers cannot alter status of Admins or SuperAdmins.")

        if not can_manage_role(current_user.role_code, current_user.management_scope, target.role_code):
            raise ForbiddenException(f"Staff member with role '{target.role_code}' is outside your delegated management scope.")

    target.is_active = request.is_active

    # When deactivating an account, force revoke all active JWT tokens immediately
    if not request.is_active:
        target.token_version = (target.token_version or 1) + 1

    action_label = "STAFF_ACTIVATED" if request.is_active else "STAFF_DEACTIVATED"
    await log_staff_audit(
        db,
        actor=current_user,
        action=action_label,
        target_user_id=target.user_id,
        property_id=target.property_id,
        new_values={"is_active": target.is_active}
    )

    await db.commit()
    evict_user_cache(target.user_id)
    await db.refresh(target)
    return await build_staff_response(db, target)


@router.post("/{user_id}/reset-password", summary="Reset Staff Password")
async def reset_password(
    user_id: str,
    request: ResetPasswordRequest,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    target = await db.scalar(select(User).where(User.user_id == user_id))
    if not target:
        raise NotFoundException("Staff member not found.")

    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if not is_platform_admin and target.org_id != current_user.org_id:
        raise ForbiddenException("Resetting password for staff member from another organization is forbidden.")

    if current_user.role_code == Role.ROLE_GENERAL_MANAGER.value:
        if target.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value]:
            raise ForbiddenException("General Managers cannot reset passwords for Admins or SuperAdmins.")
        if not can_manage_role(current_user.role_code, current_user.management_scope, target.role_code):
            raise ForbiddenException(f"Staff member with role '{target.role_code}' is outside your delegated management scope.")

    if len(request.new_password) < 6:
        raise ValidationException("Password must be at least 6 characters.")

    target.password_hash = hash_password(request.new_password)
    # Revoke all existing sessions so old credentials can no longer be used
    target.token_version = (target.token_version or 1) + 1

    await log_staff_audit(
        db,
        actor=current_user,
        action="STAFF_PASSWORD_RESET",
        target_user_id=target.user_id,
        property_id=target.property_id
    )

    await db.commit()
    evict_user_cache(target.user_id)
    return {"status": "SUCCESS", "message": "Password reset successfully. Active sessions revoked."}


@router.post("/{user_id}/force-logout", summary="Force Logout / Revoke Active Sessions")
async def force_logout(
    user_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_STAFF.value)),
    db: AsyncSession = Depends(get_db)
):
    target = await db.scalar(select(User).where(User.user_id == user_id))
    if not target:
        raise NotFoundException("Staff member not found.")

    is_platform_admin = (
        current_user.role_code == "ROLE_PLATFORM_SUPER_ADMIN" or
        getattr(current_user, "account_type", None) == AccountType.PLATFORM_ADMIN.value
    )
    if not is_platform_admin and target.org_id != current_user.org_id:
        raise ForbiddenException("Force logout for staff member from another organization is forbidden.")

    if current_user.role_code == Role.ROLE_GENERAL_MANAGER.value:
        if target.role_code in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value]:
            raise ForbiddenException("General Managers cannot force logout Admins or SuperAdmins.")
        if not can_manage_role(current_user.role_code, current_user.management_scope, target.role_code):
            raise ForbiddenException(f"Staff member with role '{target.role_code}' is outside your delegated management scope.")

    # Increment token version: immediately invalidates all active JWT tokens for this user
    target.token_version = (target.token_version or 1) + 1

    await log_staff_audit(
        db,
        actor=current_user,
        action="STAFF_FORCE_LOGOUT",
        target_user_id=target.user_id,
        property_id=target.property_id
    )

    await db.commit()
    evict_user_cache(target.user_id)
    return {"status": "SUCCESS", "message": "Active sessions revoked. User has been forced out."}
