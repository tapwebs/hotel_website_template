import React from 'react';
import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { BedDouble, CalendarDays, ChefHat, ConciergeBell, Ellipsis, LayoutDashboard, LayoutGrid, Receipt, UtensilsCrossed } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { Permission } from '../../types/auth';

const tab = 'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-burgundy/40';
// In priority order; the bar shows the first four the user may open, then More.
const items: { to: string; label: string; icon: typeof LayoutDashboard; permission?: Permission; end?: boolean }[] = [
  { to: '/app/dashboard', label: 'Home', icon: LayoutDashboard, permission: 'VIEW_DASHBOARD' },
  { to: '/app/reservations', label: 'Bookings', icon: CalendarDays, permission: 'VIEW_RESERVATIONS' },
  { to: '/app/front-desk', label: 'Front desk', icon: ConciergeBell, permission: 'VIEW_FRONT_DESK' },
  { to: '/app/rooms', label: 'Rooms', icon: BedDouble, permission: 'VIEW_DASHBOARD' },
  { to: '/app/fnb/pos', label: 'POS', icon: UtensilsCrossed, permission: 'ACCESS_POS' },
  { to: '/app/fnb/kitchen', label: 'Kitchen', icon: ChefHat, permission: 'VIEW_KDS' },
  { to: '/app/fnb/tables', label: 'Tables', icon: LayoutGrid, permission: 'ACCESS_POS' },
  { to: '/app/folio', label: 'Folios', icon: Receipt, permission: 'VIEW_FOLIO' },
];

/** App-style bottom bar for phones, like the website admin. */
export const MobileTabBar: React.FC = () => {
  const has = useAuthStore((s) => s.hasPermission);
  const shown = items.filter((i) => !i.permission || has(i.permission)).slice(0, 4);
  return createPortal(
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-cream pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-14px_rgb(74_17_27/0.35)] md:hidden">
      <div className="grid px-2 pt-1" style={{ gridTemplateColumns: `repeat(${shown.length + 1}, minmax(0, 1fr))` }}>
        {[...shown, { to: '/app/more', label: 'More', icon: Ellipsis, end: false }].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `${tab} ${isActive ? 'text-burgundy' : 'text-walnut/70'}`}>
            <Icon className="size-5" aria-hidden="true" /> {label}
          </NavLink>
        ))}
      </div>
    </nav>,
    document.body
  );
};
