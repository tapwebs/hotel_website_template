import React from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, Calendar, LogOut, Plus, Search } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { useAppDate } from '../../hooks/useAppDate';
import { Button } from '../ui/Button';
import { titleFor } from './navConfig';
import { roleLabel } from '../../pages/staff/staff-components/StaffConstants';

const formatRoleName = (roleCode?: string) => roleLabel(roleCode);
/** Top bar, the same layout as the website admin: title and date, search, main action, user and log out. */
export const StaffTopNavbar: React.FC = () => {
  const { pathname } = useLocation();
  const session = useAuthStore((s) => s.session);
  const switchProperty = useAuthStore((s) => s.switchProperty);
  const logout = useAuthStore((s) => s.logout);
  const canCheckIn = useAuthStore((s) => s.hasPermission('PERFORM_CHECK_IN'));
  const openModal = usePmsUIStore((s) => s.openModal);
  const setCommandPaletteOpen = usePmsUIStore((s) => s.setCommandPaletteOpen);
  const multi = (session?.availableProperties?.length ?? 0) > 1;

  const {
    businessDate,
    calendarDateFormatted,
    isAuditPending
  } = useAppDate();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-cream">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-badge.webp" alt="" width={36} height={36} className="size-9 rounded-full md:hidden" />
          <div className="min-w-0 shrink-0">
            <h1 className="topbar-title truncate">{titleFor(pathname)}</h1>
            <p className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground lg:flex">
              <Calendar className="size-3" aria-hidden="true" /> {calendarDateFormatted}
              <span
                className={`ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                  isAuditPending
                    ? 'bg-amber-50 text-amber-800 border-amber-200/60'
                    : 'bg-emerald-50/70 text-emerald-800 border-emerald-200/60'
                }`}
                title={`Hotel Business Date: ${businessDate} (${isAuditPending ? 'Night Audit Rollover Pending' : 'Audited & Current'})`}
              >
                Biz: {businessDate}
              </span>
              {multi ? (
                <select
                  aria-label="Property"
                  value={session?.activePropertyId}
                  onChange={(e) => void switchProperty(e.target.value)}
                  className="ml-2 hidden max-w-48 cursor-pointer bg-transparent 2xl:block text-xs font-semibold text-walnut focus:outline-none"
                >
                  {session?.availableProperties.map((p) => (
                    <option key={p.propertyId} value={p.propertyId}>{p.propertyName}</option>
                  ))}
                </select>
              ) : (
                <span className="ml-2 hidden items-center gap-1 font-semibold text-walnut 2xl:inline-flex"><Building2 className="size-3" aria-hidden="true" />{session?.activePropertyName}</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden h-10 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-ivory px-3 text-left text-sm text-muted-foreground outline-none hover:border-burgundy focus-visible:ring-[3px] focus-visible:ring-burgundy/40 lg:flex xl:max-w-sm cursor-pointer"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Search room, guest, booking…</span>
          <kbd className="ml-auto rounded border border-border bg-cream px-1.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8 pointer-coarse:size-10 lg:hidden" onClick={() => setCommandPaletteOpen(true)} aria-label="Search">
            <Search className="size-4" />
          </Button>
          {canCheckIn && (
            <Button size="sm" onClick={() => openModal('WALK_IN_CHECKIN')} className="max-sm:hidden">
              <Plus className="size-4" aria-hidden="true" /> Walk-in check-in
            </Button>
          )}
          <div className="hidden items-center gap-2 text-right xl:flex">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-walnut">{session?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{formatRoleName(session?.role)}</p>
            </div>
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-burgundy text-sm font-semibold text-ivory uppercase">
              {session?.fullName?.charAt(0) || 'U'}
            </span>
          </div>
          <Button variant="outline" size="icon" className="size-8 pointer-coarse:size-10" onClick={() => logout()} aria-label="Log out" title="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
