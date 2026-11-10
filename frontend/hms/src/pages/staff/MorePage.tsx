import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { canSee, navSections } from '../../components/staff/navConfig';

/** Phone menu: everything that does not fit in the bottom bar. */
export const MorePage: React.FC = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useAuthStore((s) => s.logout);
  const row = 'flex min-h-12 w-full items-center gap-3 px-4 text-left text-walnut outline-none active:bg-gold-soft/40 focus-visible:ring-[3px] focus-visible:ring-burgundy/40';
  return (
    <div className="grid gap-5">
      {navSections.map((section) => {
        const items = section.items.flatMap((i) => (i.children ? i.children.map((c) => ({ label: `${i.label}: ${c.label}`, path: c.path, icon: i.icon, permission: i.permission })) : [i])).filter((i) => canSee(i, hasPermission));
        if (!items.length) return null;
        return (
          <section key={section.title} className="grid gap-2">
            <h2 className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">{section.title}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-ivory">
              {items.map(({ label, path, icon: Icon }) => (
                <li key={path}>
                  <Link to={path} className={row}>
                    <Icon className="size-4 text-burgundy" />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <button type="button" onClick={() => logout()} className={`${row} rounded-xl border border-border bg-ivory text-rose-700`}>
        <LogOut className="size-4" /> Log out
      </button>
    </div>
  );
};
