import React, { useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { OrderStatus, OrderType, Station } from '../../../types/fnb';

/** Compact segmented switch used for in-page views (lighter than the section tabs so it does not read as another nav row). */
export function Segmented<T extends string>({ label, value, options, onChange, role = 'tab', className = '' }: {
  label: string; value: T; options: { id: T; label: React.ReactNode; count?: number }[]; onChange: (v: T) => void; role?: 'tab' | 'radio'; className?: string;
}) {
  return (
    <div role={role === 'tab' ? 'tablist' : 'radiogroup'} aria-label={label} className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-gold-soft/20 p-1 ${className}`}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role={role} {...(role === 'tab' ? { 'aria-selected': on } : { 'aria-checked': on })} onClick={() => onChange(o.id)}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-burgundy/40 ${on ? 'bg-ivory text-ink shadow-sm' : 'text-walnut hover:text-ink'}`}>
            {o.label}
            {!!o.count && <span className="rounded-full bg-burgundy px-1.5 font-mono text-2xs leading-5 text-ivory">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** "More" overflow menu for secondary actions, so cards and toolbars show only the main action. */
export const MoreMenu: React.FC<{ label: string; children: React.ReactNode; align?: 'left' | 'right'; button?: React.ReactNode }> = ({ label, children, align = 'right', button }) => {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent | KeyboardEvent) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary aria-label={label} title={label}
        className="inline-flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center gap-1.5 rounded-md border border-input bg-ivory px-2 text-sm font-medium text-walnut outline-none hover:bg-gold-soft/30 focus-visible:ring-[3px] focus-visible:ring-burgundy/40 [&::-webkit-details-marker]:hidden">
        {button ?? <MoreHorizontal className="size-4" />}
      </summary>
      <div role="menu" onClick={() => { if (ref.current) ref.current.open = false; }}
        className={`absolute z-30 mt-1 grid min-w-48 gap-0.5 rounded-xl border border-border bg-ivory p-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}>
        {children}
      </div>
    </details>
  );
};
export const MenuAction: React.FC<{ onClick?: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean; href?: string; children: React.ReactNode }> = ({ onClick, icon, danger, disabled, href, children }) => {
  const cls = `flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium outline-none hover:bg-gold-soft/40 focus-visible:bg-gold-soft/40 disabled:opacity-50 ${danger ? 'text-rose-700' : 'text-walnut'}`;
  return href
    ? <a role="menuitem" href={href} target="_blank" rel="noreferrer" className={cls}>{icon}{children}</a>
    : <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={cls}>{icon}{children}</button>;
};

export const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'DINE_IN', label: 'Dine-in' },
  { id: 'ROOM_SERVICE', label: 'Room service' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'COUNTER', label: 'Counter' },
];
export const typeLabel = (t: string) => ORDER_TYPES.find((x) => x.id === t)?.label ?? t;

/** The one next step a ticket can take, and the label for it. */
export const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  QUEUED: { to: 'PREPARING', label: 'Start' },
  PREPARING: { to: 'READY', label: 'Ready' },
  READY: { to: 'DELIVERED', label: 'Delivered' },
};
export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting online payment', PENDING_ACCEPTANCE: 'Waiting to accept', QUEUED: 'Waiting', PREPARING: 'Preparing', READY: 'Ready', DELIVERED: 'Delivered', BILLED: 'Billed', CANCELLED: 'Cancelled',
};

export const where = (o: { orderType: string; tableNumber?: string | null; roomNumber?: string | null }) =>
  o.orderType === 'DINE_IN' ? `Table ${o.tableNumber}` : o.orderType === 'ROOM_SERVICE' ? `Room ${o.roomNumber}` : o.orderType === 'COUNTER' ? 'Counter' : 'Takeaway';

export const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

const DIET = { veg: ['Vegetarian', 'emerald'], vegan: ['Vegan', 'emerald'], egg: ['Contains egg', 'amber'], 'non-veg': ['Non-vegetarian', 'rose'] } as const;
export const DietDot: React.FC<{ type?: string; veg?: boolean }> = ({ type, veg }) => {
  const [label, tone] = DIET[(type as keyof typeof DIET) ?? (veg ? 'veg' : 'non-veg')] ?? DIET.veg;
  const c = tone === 'emerald' ? 'border-emerald-700 bg-emerald-700' : tone === 'amber' ? 'border-amber-600 bg-amber-600' : 'border-rose-700 bg-rose-700';
  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 bg-transparent ${c.split(' ')[0]}`}>
      <span className={`size-1.5 rounded-full ${c.split(' ')[1]}`} />
    </span>
  );
};

export const VegDot: React.FC<{ veg: boolean }> = ({ veg }) => (
  <span
    role="img"
    aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
    className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${veg ? 'border-emerald-700' : 'border-rose-700'}`}
  >
    <span className={`size-1.5 rounded-full ${veg ? 'bg-emerald-700' : 'bg-rose-700'}`} />
  </span>
);

export const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(paise / 100));

export const ErrorNote: React.FC<{ error: unknown }> = ({ error }) =>
  error ? (
    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </p>
  ) : null;
