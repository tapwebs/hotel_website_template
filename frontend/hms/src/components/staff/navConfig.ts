import type React from 'react';
import {
  BarChart3, BedDouble, CalendarDays, ConciergeBell, CreditCard, LayoutDashboard, Moon, QrCode,
  Receipt, Settings, Sparkles, UserCheck, Users, UtensilsCrossed, Wrench
} from 'lucide-react';
import type { Permission } from '../../types/auth';

type Icon = React.ComponentType<{ className?: string }>;
export interface NavChild { label: string; path: string }
export interface NavItem {
  label: string;
  path: string;
  icon: Icon;
  permission?: Permission;
  /** Shown when the user has any one of these (instead of `permission`). */
  anyOf?: Permission[];
  /** Match by prefix (items with sub-pages). */
  prefix?: string;
  children?: NavChild[];
}
export interface NavSection { title: string; items: NavItem[] }

/** The whole staff console: the HMS pages plus the website admin screens (under /app/admin). One list drives the sidebar, the phone menu and the page titles. */
export const navSections: NavSection[] = [
  {
    title: 'Front office',
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, permission: 'VIEW_DASHBOARD' },
      { label: 'Bookings', path: '/app/reservations', icon: CalendarDays, permission: 'VIEW_RESERVATIONS' },
      { label: 'Front desk', path: '/app/front-desk', icon: ConciergeBell, permission: 'VIEW_FRONT_DESK' },
      { label: 'Guest 360', path: '/app/guests', icon: Users, permission: 'VIEW_GUEST_PROFILES' },
    ],
  },
  {
    title: 'Operations & rooms',
    items: [
      { label: 'Rooms & rates', path: '/app/rooms', icon: BedDouble, permission: 'VIEW_DASHBOARD' },
      { label: 'Housekeeping', path: '/app/housekeeping', icon: Sparkles, permission: 'MANAGE_HOUSEKEEPING' },
      { label: 'Maintenance', path: '/app/maintenance', icon: Wrench, permission: 'MANAGE_MAINTENANCE' },
    ],
  },
  {
    title: 'Food & beverage',
    items: [{ label: 'Restaurant & kitchen', path: '/app/fnb', prefix: '/app/fnb', icon: UtensilsCrossed, anyOf: ['ACCESS_POS', 'VIEW_KDS'] }],
  },
  {
    title: 'Finance & audit',
    items: [
      { label: 'Folio & billing', path: '/app/folio', icon: Receipt, permission: 'VIEW_FOLIO' },
      { label: 'Payments', path: '/app/payments', icon: CreditCard, permission: 'PROCESS_PAYMENTS' },
      { label: 'Night audit', path: '/app/night-audit', icon: Moon, permission: 'EXECUTE_NIGHT_AUDIT' },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Reports & BI', path: '/app/reports', icon: BarChart3, permission: 'VIEW_FINANCIAL_REPORTS' },
      { label: 'Staff & roles', path: '/app/staff', icon: UserCheck, permission: 'MANAGE_STAFF' },
      { label: 'QR codes', path: '/app/qr/library', prefix: '/app/qr', icon: QrCode, permission: 'MANAGE_SETTINGS' },
      { label: 'Settings', path: '/app/settings', icon: Settings, permission: 'MANAGE_SETTINGS' },
    ],
  },
];

/** Title shown in the top bar for a path ("Dashboard", "QR library", ...). */
export function titleFor(pathname: string): string {
  const path = pathname.replace(/\/$/, '');
  if (path === '/app/more') return 'More';
  for (const s of navSections) {
    for (const i of s.items) {
      const base = i.prefix ?? i.path;
      if (path === i.path || path.startsWith(`${base}/`)) return i.label;
    }
  }
  return 'TapMenu';
}

/** True when the user may see a nav item. */
export const canSee = (i: Pick<NavItem, 'permission' | 'anyOf'>, has: (p: Permission) => boolean): boolean =>
  i.anyOf ? i.anyOf.some(has) : !i.permission || has(i.permission);
