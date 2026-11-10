import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import { useAuthStore } from '../../stores/authStore';
import { canSee, navSections, type NavItem } from './navConfig';

const row = 'flex items-center gap-3 rounded-md px-3 min-h-10 pointer-coarse:min-h-11 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-burgundy/40';

/** Light sidebar, the same look as the website admin: logo, grouped links, burgundy active item, expandable QR codes group. */
export const StaffSidebar: React.FC = () => {
  const sidebarOpen = usePmsUIStore((s) => s.sidebarOpen);
  const toggleSidebar = usePmsUIStore((s) => s.toggleSidebar);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { pathname } = useLocation();

  const sections = navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => canSee(i, hasPermission)) }))
    .filter((s) => s.items.length > 0);

  const link = (i: NavItem) => {
    const Icon = i.icon;
    const inGroup = i.prefix ? pathname.startsWith(i.prefix) : false;
    return (
      <div key={i.path} className="grid gap-1">
        <NavLink
          to={i.path}
          end={false}
          title={!sidebarOpen ? i.label : undefined}
          className={({ isActive }) =>
            `${row} ${!sidebarOpen ? 'justify-center px-0' : ''} ${
              (i.prefix ? inGroup : isActive) ? (i.children ? 'bg-burgundy/10 text-burgundy' : 'bg-burgundy text-ivory') : 'text-walnut hover:bg-gold-soft/40'
            }`
          }
        >
          <Icon className="size-4 shrink-0" />
          {sidebarOpen && <span className="truncate">{i.label}</span>}
        </NavLink>
        {sidebarOpen && i.children && inGroup && (
          <ul className="ml-5 grid gap-0.5 border-l border-border pl-2">
            {i.children.map((c) => (
              <li key={c.path}>
                <NavLink
                  to={c.path}
                  className={({ isActive }) =>
                    `flex min-h-9 items-center rounded-md px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-burgundy/40 ${
                      isActive ? 'bg-burgundy text-ivory' : 'text-walnut hover:bg-gold-soft/40'
                    }`
                  }
                >
                  {c.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <aside
      aria-label="Staff navigation"
      className={`fixed top-0 left-0 bottom-0 z-30 hidden md:flex flex-col border-r border-border bg-ivory transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-[4.5rem]'}`}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-badge.webp" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full" />
          {sidebarOpen && (
            <span className="grid min-w-0 leading-none">
              <span className="truncate font-display text-xl font-semibold text-burgundy">Dream Heaven’s</span>
              <span className="mt-1 truncate text-[11px] font-medium text-muted-foreground">Hotel management</span>
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="grid size-8 shrink-0 pointer-coarse:size-10 place-items-center rounded-md text-muted-foreground hover:bg-gold-soft/40 hover:text-burgundy cursor-pointer"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </div>
      <nav aria-label="Sections" className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5 grid gap-1">
            {sidebarOpen ? (
              <h5 className="mb-1 px-3 text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase select-none">{section.title}</h5>
            ) : (
              <div className="mx-2 mb-1 h-px bg-border" aria-hidden="true" />
            )}
            {section.items.map(link)}
          </div>
        ))}
      </nav>
    </aside>
  );
};
