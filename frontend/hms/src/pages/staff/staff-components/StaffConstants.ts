import { Role, Permission, AccountType, JobRole } from '../../../types/auth';

export const ACCOUNT_TYPES: { id: AccountType; label: string; desc: string }[] = [
  { id: 'OWNER', label: 'Super Admin (Owner)', desc: 'Full administration of hotel properties, staff, settings, finances, and operations' },
  { id: 'MANAGER', label: 'Admin (Manager)', desc: 'Day-to-day hotel operations, front desk, staff onboarding, inventory, and operational reports' },
  { id: 'STAFF', label: 'Staff', desc: 'Operational hotel employee with predefined job-role preset' }
];

export const JOB_ROLES: { id: JobRole; label: string; desc: string }[] = [
  { id: 'CAPTAIN', label: 'Captain', desc: 'Leads the restaurant floor: takes and accepts orders, cancels dishes or orders, moves tables, gives discounts, sees the kitchen screen' },
  { id: 'WAITER', label: 'Waiter', desc: 'Takes orders and accepts guest orders. Discounts need a captain or the manager PIN' },
  { id: 'KITCHEN_STAFF', label: 'Kitchen staff', desc: 'Kitchen screen only: marks orders preparing and ready' },
  { id: 'ACCOUNTANT', label: 'Accountant', desc: 'Folios, payments and financial reports' },
];
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  OWNER: 'Super Admin',
  MANAGER: 'Admin',
  STAFF: 'Staff',
  PLATFORM_ADMIN: 'Platform Admin'
};
export const JOB_ROLE_LABELS: Record<string, string> = {
  CAPTAIN: 'Captain',
  WAITER: 'Waiter',
  KITCHEN_STAFF: 'Kitchen staff',
  ACCOUNTANT: 'Accountant',
};
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  ROLE_SUPER_ADMIN: 'Super Admin',
  ROLE_GENERAL_MANAGER: 'Admin',
  ROLE_ACCOUNTANT: 'Accountant',
  ROLE_KITCHEN_STAFF: 'Kitchen staff',
  ROLE_CAPTAIN: 'Captain',
  ROLE_WAITER: 'Waiter',
};
/** Role label for any stored role code, including retired ones (which the server treats as Waiter). */
export const roleLabel = (code?: string) => (code && (ROLE_DISPLAY_NAMES as Record<string, string>)[code]) || (code ? 'Waiter' : 'Staff');
export const ROLE_DEPARTMENT_MAP: Record<string, string> = {
  ROLE_SUPER_ADMIN: 'SYSTEM',
  ROLE_GENERAL_MANAGER: 'MANAGEMENT',
  ROLE_ACCOUNTANT: 'ACCOUNTANT',
  ROLE_KITCHEN_STAFF: 'RESTAURANT_POS',
  ROLE_CAPTAIN: 'RESTAURANT_POS',
  ROLE_WAITER: 'RESTAURANT_POS',
};
export const ALL_DEPARTMENTS: { id: string; label: string; roles: Role[] }[] = [
  { id: 'RESTAURANT_POS', label: 'Restaurant & kitchen', roles: ['ROLE_CAPTAIN', 'ROLE_WAITER', 'ROLE_KITCHEN_STAFF'] },
  { id: 'ACCOUNTANT', label: 'Accounts', roles: ['ROLE_ACCOUNTANT'] },
];
const ALL_PERMISSIONS = (): Permission[] => PERMISSIONS_CATALOG.map((p) => p.key);
/** Mirrors ROLE_PERMISSIONS in backend/app/core/rbac.py. The server is the authority; this only drives the matrix view. */
export const ROLE_PERMISSIONS: Record<Role, () => Permission[]> = {
  ROLE_SUPER_ADMIN: ALL_PERMISSIONS,
  ROLE_GENERAL_MANAGER: ALL_PERMISSIONS, // everything except organization/owner-level system settings
  ROLE_ACCOUNTANT: () => ['VIEW_DASHBOARD', 'VIEW_FOLIO', 'PROCESS_PAYMENTS', 'VIEW_FINANCIAL_REPORTS', 'EXPORT_TAX_REPORTS'],
  ROLE_KITCHEN_STAFF: () => ['VIEW_KDS'],
  ROLE_CAPTAIN: () => ['ACCESS_POS', 'VIEW_KDS', 'POST_CHARGES', 'APPLY_DISCOUNT', 'ACCEPT_GUEST_ORDERS', 'CANCEL_FNB_ORDERS', 'MOVE_FNB_TABLES'],
  ROLE_WAITER: () => ['ACCESS_POS', 'POST_CHARGES', 'ACCEPT_GUEST_ORDERS'],
};
export const PERMISSIONS_CATALOG: { key: Permission; label: string; desc: string; category: string }[] = [
  { key: 'VIEW_DASHBOARD', label: 'View Dashboard & KPIs', desc: 'Read occupancy, arrivals, departures, revenue metrics', category: 'General' },
  { key: 'VIEW_FRONT_DESK', label: 'Access Front Office', desc: 'View front desk room rack, guest ledger', category: 'Front Office' },
  { key: 'PERFORM_CHECK_IN', label: 'Perform Check-In', desc: 'Issue room keys, verify KYC documents, open stay', category: 'Front Office' },
  { key: 'PERFORM_CHECK_OUT', label: 'Perform Check-Out', desc: 'Review master folio, collect balance, return keys', category: 'Front Office' },
  { key: 'ASSIGN_ROOMS', label: 'Assign & Move Rooms', desc: 'Modify room allocations in daily inventory', category: 'Front Office' },
  { key: 'VIEW_GUEST_KYC', label: 'View Guest KYC Vault', desc: 'Generate 15-minute temporary presigned S3 URLs', category: 'Front Office' },
  { key: 'VIEW_RESERVATIONS', label: 'View Reservations', desc: 'Lookup guest booking manifests and status', category: 'Reservations' },
  { key: 'CREATE_RESERVATIONS', label: 'Create Reservations', desc: 'Book direct, OTA, or corporate reservations', category: 'Reservations' },
  { key: 'MODIFY_RESERVATIONS', label: 'Modify Bookings', desc: 'Alter dates, rate plans, and guest occupants', category: 'Reservations' },
  { key: 'MANAGE_HOUSEKEEPING', label: 'Manage Housekeeping', desc: 'Assign room cleaning duties to attendants', category: 'Operations' },
  { key: 'UPDATE_CLEANING_STATUS', label: 'Update Cleaning Status', desc: 'Mark rooms Clean, Dirty, or Inspected', category: 'Operations' },
  { key: 'MANAGE_MAINTENANCE', label: 'Manage Maintenance', desc: 'Open, assign, and resolve physical repair tickets', category: 'Operations' },
  { key: 'ACCESS_POS', label: 'Access Restaurant POS', desc: 'Open dining tables, take orders, print bills', category: 'F&B' },
  { key: 'VIEW_KDS', label: 'Kitchen screen', desc: 'See kitchen tickets and mark them preparing or ready', category: 'F&B' },
  { key: 'ACCEPT_GUEST_ORDERS', label: 'Accept guest orders', desc: 'Accept orders guests place from their phones and send them to the kitchen', category: 'F&B' },
  { key: 'CANCEL_FNB_ORDERS', label: 'Cancel orders and dishes', desc: 'Cancel whole orders or single dishes, and reject guest orders', category: 'F&B' },
  { key: 'MOVE_FNB_TABLES', label: 'Move tables', desc: 'Move an order, or a whole party, to another table', category: 'F&B' },
  { key: 'VIEW_FOLIO', label: 'View Master Folios', desc: 'Inspect itemized charges, ledger balances', category: 'Finance' },
  { key: 'POST_CHARGES', label: 'Post Folio Charges', desc: 'Post F&B dining or ancillary charges to room folio', category: 'Finance' },
  { key: 'APPLY_DISCOUNT', label: 'Give discounts', desc: 'Discount restaurant bills up to the no-PIN limit, and folio concessions', category: 'Finance' },
  { key: 'PROCESS_PAYMENTS', label: 'Process Payments', desc: 'Accept cash, cards, and UPI settlement transactions', category: 'Finance' },
  { key: 'AUTHORIZE_REFUND', label: 'Authorize Refunds', desc: 'Issue credit notes and refund gateway payments', category: 'Finance' },
  { key: 'EXECUTE_NIGHT_AUDIT', label: 'Execute Night Audit', desc: 'Post room charges and advance business date', category: 'Finance' },
  { key: 'VIEW_FINANCIAL_REPORTS', label: 'Financial Reports', desc: 'Access trial balance, manager flash report', category: 'Reports' },
  { key: 'MANAGE_STAFF', label: 'Staff Management', desc: 'Create, edit, and administer staff accounts', category: 'Admin' },
  { key: 'MANAGE_SETTINGS', label: 'Property Settings', desc: 'Configure taxes, policies, and hotel details', category: 'Admin' }
];
