from enum import Enum
from typing import Dict, List, Optional, Set
from backend.app.models.user import User


class Role(str, Enum):
    """The six hotel roles. ROLE_GENERAL_MANAGER keeps its code for compatibility and is shown as "Admin"."""
    ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN"
    ROLE_GENERAL_MANAGER = "ROLE_GENERAL_MANAGER"  # Admin
    ROLE_ACCOUNTANT = "ROLE_ACCOUNTANT"
    ROLE_KITCHEN_STAFF = "ROLE_KITCHEN_STAFF"
    ROLE_CAPTAIN = "ROLE_CAPTAIN"
    ROLE_WAITER = "ROLE_WAITER"


# Retired role codes. Any user still carrying one is treated as a Waiter until an admin changes them.
LEGACY_ROLE_CODES = {
    "ROLE_FRONT_DESK", "ROLE_RESERVATIONS", "ROLE_HOUSEKEEPING", "ROLE_MAINTENANCE", "ROLE_RESTAURANT_POS",
    "ROLE_NIGHT_AUDITOR", "ROLE_CHANNEL_MANAGER", "ROLE_POS_CASHIER",
}


class AccountType(str, Enum):
    OWNER = "OWNER"                    # Super Admin
    MANAGER = "MANAGER"                # Admin
    STAFF = "STAFF"                    # Staff member with a job role
    PLATFORM_ADMIN = "PLATFORM_ADMIN"  # Internal Dream Heavens Platform Super Admin (hidden from hotel UI)


class JobRole(str, Enum):
    CAPTAIN = "CAPTAIN"                # Restaurant floor lead: orders, cancellations, discounts
    WAITER = "WAITER"                  # Takes and accepts orders
    KITCHEN_STAFF = "KITCHEN_STAFF"    # Kitchen screen
    ACCOUNTANT = "ACCOUNTANT"          # Folios, payments and financial reports


_JOB_TO_ROLE = {
    JobRole.CAPTAIN.value: Role.ROLE_CAPTAIN.value,
    JobRole.WAITER.value: Role.ROLE_WAITER.value,
    JobRole.KITCHEN_STAFF.value: Role.ROLE_KITCHEN_STAFF.value,
    JobRole.ACCOUNTANT.value: Role.ROLE_ACCOUNTANT.value,
}
_ROLE_TO_JOB = {v: k for k, v in _JOB_TO_ROLE.items()}


def map_account_and_job_to_role(account_type: str, job_role: Optional[str] = None) -> str:
    """Map account_type and job_role to the role_code stored on the user."""
    if account_type == AccountType.PLATFORM_ADMIN.value:
        return "ROLE_PLATFORM_SUPER_ADMIN"
    if account_type == AccountType.OWNER.value:
        return Role.ROLE_SUPER_ADMIN.value
    if account_type == AccountType.MANAGER.value:
        return Role.ROLE_GENERAL_MANAGER.value
    return _JOB_TO_ROLE.get(job_role or "", Role.ROLE_WAITER.value)


def map_legacy_role_to_account_and_job(role_code: str) -> tuple[str, Optional[str]]:
    """Map a role_code (current or retired) to (account_type, job_role)."""
    if role_code in [Role.ROLE_SUPER_ADMIN.value, "ROLE_OWNER"]:
        return (AccountType.OWNER.value, None)
    if role_code in [Role.ROLE_GENERAL_MANAGER.value, "ROLE_MANAGER"]:
        return (AccountType.MANAGER.value, None)
    if role_code == "ROLE_PLATFORM_SUPER_ADMIN":
        return (AccountType.PLATFORM_ADMIN.value, None)
    return (AccountType.STAFF.value, _ROLE_TO_JOB.get(role_code, JobRole.WAITER.value))


def normalize_role_code(role_code: Optional[str]) -> str:
    """Retired role codes become Waiter."""
    if not role_code or role_code in LEGACY_ROLE_CODES:
        return Role.ROLE_WAITER.value
    return role_code


class Permission(str, Enum):
    # Front Office & Dashboards
    VIEW_DASHBOARD = "VIEW_DASHBOARD"
    VIEW_RESERVATIONS = "VIEW_RESERVATIONS"
    CREATE_RESERVATIONS = "CREATE_RESERVATIONS"
    MODIFY_RESERVATIONS = "MODIFY_RESERVATIONS"
    CANCEL_RESERVATIONS = "CANCEL_RESERVATIONS"
    MANAGE_RESERVATIONS = "MANAGE_RESERVATIONS"
    VIEW_FRONT_DESK = "VIEW_FRONT_DESK"
    PERFORM_CHECK_IN = "PERFORM_CHECK_IN"
    PERFORM_CHECK_OUT = "PERFORM_CHECK_OUT"
    ASSIGN_ROOMS = "ASSIGN_ROOMS"
    MOVE_ROOMS = "MOVE_ROOMS"
    OVERRIDE_ROOM_STATUS = "OVERRIDE_ROOM_STATUS"
    VIEW_GUEST_PROFILES = "VIEW_GUEST_PROFILES"
    VIEW_GUEST_KYC = "VIEW_GUEST_KYC"

    # Operations
    MANAGE_HOUSEKEEPING = "MANAGE_HOUSEKEEPING"
    UPDATE_CLEANING_STATUS = "UPDATE_CLEANING_STATUS"
    MANAGE_MAINTENANCE = "MANAGE_MAINTENANCE"

    # Food & Beverage
    ACCESS_POS = "ACCESS_POS"
    VIEW_KDS = "VIEW_KDS"
    ACCEPT_GUEST_ORDERS = "ACCEPT_GUEST_ORDERS"  # accept or pass on orders guests place from their phones
    CANCEL_FNB_ORDERS = "CANCEL_FNB_ORDERS"      # cancel orders or single items, and reject guest orders
    MOVE_FNB_TABLES = "MOVE_FNB_TABLES"          # move an order (or a whole party) to another table

    # Finance & Audit
    VIEW_FOLIO = "VIEW_FOLIO"
    POST_CHARGES = "POST_CHARGES"
    APPLY_DISCOUNT = "APPLY_DISCOUNT"
    PROCESS_PAYMENTS = "PROCESS_PAYMENTS"
    AUTHORIZE_REFUND = "AUTHORIZE_REFUND"
    EXECUTE_NIGHT_AUDIT = "EXECUTE_NIGHT_AUDIT"
    VIEW_FINANCIAL_REPORTS = "VIEW_FINANCIAL_REPORTS"
    EXPORT_TAX_REPORTS = "EXPORT_TAX_REPORTS"

    # Management & Admin
    MANAGE_RATES = "MANAGE_RATES"
    MANAGE_STAFF = "MANAGE_STAFF"
    MANAGE_SETTINGS = "MANAGE_SETTINGS"
    MANAGE_SYSTEM = "MANAGE_SYSTEM"


_ALL = {p.value for p in Permission}

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    Role.ROLE_SUPER_ADMIN.value: set(_ALL),
    # Admin: everything except organization / owner-level system settings.
    Role.ROLE_GENERAL_MANAGER.value: _ALL - {Permission.MANAGE_SYSTEM.value},
    Role.ROLE_ACCOUNTANT.value: {
        Permission.VIEW_DASHBOARD.value,
        Permission.VIEW_FOLIO.value,
        Permission.PROCESS_PAYMENTS.value,
        Permission.VIEW_FINANCIAL_REPORTS.value,
        Permission.EXPORT_TAX_REPORTS.value,
    },
    Role.ROLE_KITCHEN_STAFF.value: {
        Permission.VIEW_KDS.value,
    },
    Role.ROLE_CAPTAIN.value: {
        Permission.ACCESS_POS.value,
        Permission.VIEW_KDS.value,
        Permission.POST_CHARGES.value,
        Permission.APPLY_DISCOUNT.value,
        Permission.ACCEPT_GUEST_ORDERS.value,
        Permission.CANCEL_FNB_ORDERS.value,
        Permission.MOVE_FNB_TABLES.value,
    },
    Role.ROLE_WAITER.value: {
        Permission.ACCESS_POS.value,
        Permission.POST_CHARGES.value,
        Permission.ACCEPT_GUEST_ORDERS.value,
    },
}


def get_role_permissions(role: str) -> Set[str]:
    """Get the set of default permissions assigned to a role (retired roles get Waiter permissions)."""
    return set(ROLE_PERMISSIONS.get(normalize_role_code(role), set()))


def get_user_permissions(user: User) -> Set[str]:
    """Resolve effective permissions for a user based on canonical account_type/job_role or legacy role."""
    if not user:
        return set()

    account_type = getattr(user, "account_type", None)
    job_role = getattr(user, "job_role", None)

    # If canonical fields not populated or job_role is missing, derive from legacy role_code
    if (not account_type or (account_type == AccountType.STAFF.value and not job_role)) and getattr(user, "role_code", None):
        derived_account_type, derived_job_role = map_legacy_role_to_account_and_job(user.role_code)
        if not account_type:
            account_type = derived_account_type
        if not job_role:
            job_role = derived_job_role

    if account_type in [AccountType.PLATFORM_ADMIN.value, AccountType.OWNER.value] or getattr(user, "role_code", None) == Role.ROLE_SUPER_ADMIN.value:
        return set(ROLE_PERMISSIONS[Role.ROLE_SUPER_ADMIN.value])

    if account_type == AccountType.MANAGER.value:
        base = set(ROLE_PERMISSIONS[Role.ROLE_GENERAL_MANAGER.value])
    elif account_type == AccountType.STAFF.value:
        mapped_role = map_account_and_job_to_role(AccountType.STAFF.value, job_role)
        base = get_role_permissions(mapped_role)
    else:
        base = get_role_permissions(getattr(user, "role_code", Role.ROLE_WAITER.value))

    # Include explicit custom permissions stored on user record
    if user.permissions and isinstance(user.permissions, list):
        base = base.union(set(user.permissions))
    return base


def user_has_permission(user: User, permission: str) -> bool:
    """Check if the user possesses the required permission."""
    if not user:
        return False
    if getattr(user, "account_type", None) in [AccountType.PLATFORM_ADMIN.value, AccountType.OWNER.value]:
        return True
    if getattr(user, "role_code", None) == Role.ROLE_SUPER_ADMIN.value:
        return True
    perms = get_user_permissions(user)
    return permission in perms


def can_manage_account(
    actor_account_type: str,
    target_account_type: str,
    target_job_role: Optional[str] = None
) -> bool:
    """
    Simplified account management hierarchy:
    - OWNER / PLATFORM_ADMIN can manage OWNER, MANAGER, STAFF. (Cannot create PLATFORM_ADMIN from hotel UI).
    - MANAGER can only manage STAFF (cannot manage OWNER or other MANAGERs).
    - STAFF cannot manage any accounts.
    """
    if actor_account_type in [AccountType.PLATFORM_ADMIN.value, AccountType.OWNER.value]:
        return target_account_type != AccountType.PLATFORM_ADMIN.value
    if actor_account_type == AccountType.MANAGER.value:
        return target_account_type == AccountType.STAFF.value
    return False


ROLE_TO_DEPARTMENT: Dict[str, str] = {
    Role.ROLE_CAPTAIN.value: "RESTAURANT_POS",
    Role.ROLE_WAITER.value: "RESTAURANT_POS",
    Role.ROLE_KITCHEN_STAFF.value: "RESTAURANT_POS",
    Role.ROLE_ACCOUNTANT.value: "ACCOUNTANT",
    Role.ROLE_GENERAL_MANAGER.value: "MANAGEMENT",
    Role.ROLE_SUPER_ADMIN.value: "SYSTEM",
}

ALL_MANAGEMENT_DEPARTMENTS: List[str] = ["RESTAURANT_POS", "ACCOUNTANT"]

DEFAULT_GM_MANAGEMENT_SCOPE: List[str] = ["RESTAURANT_POS", "ACCOUNTANT"]


def can_manage_role(actor_role: str, actor_scope: List[str], target_role: str) -> bool:
    """
    Evaluates whether an actor with a given role and delegated management_scope
    has administrative authority to manage users of target_role.
    """
    if actor_role == Role.ROLE_SUPER_ADMIN.value:
        return True

    if actor_role == Role.ROLE_GENERAL_MANAGER.value:
        # General Manager cannot manage SuperAdmin or other General Managers
        if target_role in [Role.ROLE_SUPER_ADMIN.value, Role.ROLE_GENERAL_MANAGER.value]:
            return False

        # Department must be within the GM's delegated management_scope
        dept = ROLE_TO_DEPARTMENT.get(normalize_role_code(target_role))
        effective_scope = actor_scope if (actor_scope and len(actor_scope) > 0) else DEFAULT_GM_MANAGEMENT_SCOPE
        return dept in effective_scope

    return False

