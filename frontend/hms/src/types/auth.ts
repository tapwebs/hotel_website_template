/** The six hotel roles. ROLE_GENERAL_MANAGER is shown as "Admin". Retired roles are mapped to Waiter on the server. */
export type Role =
  | 'ROLE_SUPER_ADMIN'
  | 'ROLE_GENERAL_MANAGER'
  | 'ROLE_ACCOUNTANT'
  | 'ROLE_KITCHEN_STAFF'
  | 'ROLE_CAPTAIN'
  | 'ROLE_WAITER';

export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_RESERVATIONS'
  | 'CREATE_RESERVATIONS'
  | 'MODIFY_RESERVATIONS'
  | 'CANCEL_RESERVATIONS'
  | 'VIEW_FRONT_DESK'
  | 'PERFORM_CHECK_IN'
  | 'PERFORM_CHECK_OUT'
  | 'ASSIGN_ROOMS'
  | 'MOVE_ROOMS'
  | 'OVERRIDE_ROOM_STATUS'
  | 'VIEW_GUEST_PROFILES'
  | 'VIEW_GUEST_KYC'
  | 'MANAGE_HOUSEKEEPING'
  | 'UPDATE_CLEANING_STATUS'
  | 'MANAGE_MAINTENANCE'
  | 'ACCESS_POS'
  | 'VIEW_KDS'
  | 'ACCEPT_GUEST_ORDERS'
  | 'CANCEL_FNB_ORDERS'
  | 'MOVE_FNB_TABLES'
  | 'VIEW_FOLIO'
  | 'POST_CHARGES'
  | 'APPLY_DISCOUNT'
  | 'PROCESS_PAYMENTS'
  | 'AUTHORIZE_REFUND'
  | 'EXECUTE_NIGHT_AUDIT'
  | 'VIEW_FINANCIAL_REPORTS'
  | 'EXPORT_TAX_REPORTS'
  | 'MANAGE_RATES'
  | 'MANAGE_STAFF'
  | 'MANAGE_SETTINGS';

export type AccountType = 'OWNER' | 'MANAGER' | 'STAFF' | 'PLATFORM_ADMIN';
export type JobRole = 'CAPTAIN' | 'WAITER' | 'KITCHEN_STAFF' | 'ACCOUNTANT';

export interface UserSession {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  accountType?: AccountType;
  jobRole?: JobRole;
  permissions: Permission[];
  managementScope?: string[];
  organizationId: string;
  organizationName: string;
  activePropertyId: string;
  activePropertyName: string;
  availableProperties: {
    propertyId: string;
    propertyName: string;
    city: string;
    currency: string;
  }[];
}

export interface StaffMember {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  phone_number?: string | null;
  role_code: Role;
  account_type?: AccountType;
  job_role?: JobRole;
  property_id?: string | null;
  property_name?: string | null;
  avatar_url?: string | null;
  permissions: Permission[];
  management_scope: string[];
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface StaffAuditLog {
  audit_id: string;
  actor_username: string;
  action: string;
  entity_id: string;
  recorded_at: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  justification_reason?: string;
}

export interface CreateStaffPayload {
  username: string;
  email: string;
  full_name: string;
  phone_number?: string;
  password: string;
  role_code?: Role;
  account_type?: AccountType;
  job_role?: JobRole;
  property_id?: string;
  permissions?: Permission[];
  management_scope?: string[];
}

export interface UpdateStaffPayload {
  full_name?: string;
  email?: string;
  phone_number?: string;
  role_code?: Role;
  account_type?: AccountType;
  job_role?: JobRole;
  property_id?: string;
  permissions?: Permission[];
  management_scope?: string[];
}

