import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { Permission } from '../../types/auth';

export interface SectionTab {
  to: string;
  label: string;
  /** Tab is hidden when the user lacks this permission. */
  permission?: Permission;
  /** Match exactly (the first tab of a section usually lives at the section's own path). */
  end?: boolean;
  /** Tabs with different groups get a thin divider between them. */
  group?: string;
  badge?: number;
}

/** One page area with several related screens as tabs (the same pill style as the website admin). Child routes render below. */
export const SectionTabs: React.FC<{ tabs: SectionTab[] }> = ({ tabs }) => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const visible = tabs.filter((t) => !t.permission || hasPermission(t.permission));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {visible.length > 1 && (
        <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-1 rounded-xl border border-border bg-ivory p-1">
            {visible.map((t, n) => (
              <li key={t.to} className={n > 0 && t.group !== visible[n - 1].group ? 'ml-1 border-l border-border pl-2' : undefined}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-burgundy/40 ${
                      isActive ? 'bg-burgundy text-ivory' : 'text-walnut hover:bg-gold-soft/40'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {t.label}
                      {typeof t.badge === 'number' && t.badge > 0 ? (
                        <span className={`ml-2 rounded-full px-1.5 font-mono text-2xs leading-5 ${
                          isActive ? 'bg-ivory text-burgundy' : 'bg-burgundy text-ivory'
                        }`}>
                          {t.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
};
