import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Receipt, Search } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import type { POSOrder } from '../../../types/pms';
import { Button } from '../../../components/ui/Button';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorNote, Segmented, rupees, titleCase } from './fnbUi';
import { fullKot, printKotSlice } from './kotDevice';
import { printReceipt } from './printing';
import { textMatch } from './search';

type Range = 'today' | '7d' | 'all';
type Show = 'all' | 'paid' | 'cancelled';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * Past orders for the POS and the kitchen: search, filter, and reprint the KOT or the bill.
 * Reads the latest 500 orders (ceiling; older ones need a date-range endpoint).
 */
export const FnbHistoryPage: React.FC = () => {
  const hasPerm = useAuthStore((s) => s.hasPermission);
  const propertyName = useAuthStore((s) => s.session?.activePropertyName) ?? 'Dream Heavens';
  const cfg = useQuery({ queryKey: ['fnb', 'config'], queryFn: fnbService.config, staleTime: 60_000 });
  const orders = useQuery({ queryKey: ['fnb', 'orders', 'history'], queryFn: () => fnbService.orders('all', undefined, 500) });
  const [range, setRange] = useState<Range>('today');
  const [show, setShow] = useState<Show>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const from = range === 'today' ? startOfToday() : range === '7d' ? Date.now() - 7 * 864e5 : 0;
    return (orders.data ?? [])
      .filter((o) => new Date(o.createdAt).getTime() >= from)
      .filter((o) => show === 'all' || (show === 'paid' ? !!o.paidAt : o.status === 'CANCELLED'))
      .filter((o) => !search.trim() || textMatch([o.orderNumber, o.tableNumber, o.roomNumber, o.guestName, o.customerPhone, o.items.map((i) => i.name).join(' ')], search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders.data, range, show, search]);

  const guard = (fn: () => Promise<unknown>) => { setError(null); fn().catch((e) => setError((e as Error).message)); };
  const canBill = hasPerm('ACCESS_POS');

  const place = (o: POSOrder) => (o.roomNumber ? `Room ${o.roomNumber}` : o.tableNumber ? `Table ${o.tableNumber}` : titleCase(o.orderType));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Period" value={range} onChange={setRange}
          options={[{ id: 'today', label: 'Today' }, { id: '7d', label: '7 days' }, { id: 'all', label: 'All' }]} />
        <Segmented label="Show" value={show} onChange={setShow}
          options={[{ id: 'all', label: 'All' }, { id: 'paid', label: 'Paid' }, { id: 'cancelled', label: 'Cancelled' }]} />
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-walnut" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no., table, room, guest, dish…"
            aria-label="Search past orders" className="min-h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-ink" />
        </label>
      </div>

      <ErrorNote error={orders.error ?? (error ? new Error(error) : null)} />
      {orders.isLoading ? (
        <LoadingState message="Loading past orders…" subtext="" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-walnut">No orders match.</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((o) => (
            <li key={o.id} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-mono text-sm font-semibold text-ink">#{o.orderNumber}</span>
                  <span className="text-sm text-ink">{place(o)}</span>
                  <span className="text-xs text-walnut">{when(o.createdAt)}</span>
                  <span className={`text-xs font-semibold ${o.status === 'CANCELLED' ? 'text-rose-700' : 'text-walnut'}`}>{titleCase(o.status)}</span>
                  {o.paymentMethod && <span className="text-xs text-walnut">{o.paymentMethod}</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-walnut">
                  {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                </p>
                {o.guestName && <p className="text-xs text-walnut">{o.guestName}</p>}
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="mr-1 font-mono text-sm font-semibold text-ink">{rupees(o.totalPaise)}</span>
                <Button variant="outline" size="sm" onClick={() => guard(() => printKotSlice(fullKot(o), cfg.data, propertyName))}>
                  <Printer className="mr-1 h-4 w-4" />KOT
                </Button>
                {canBill && o.paidAt && (
                  <Button variant="outline" size="sm" onClick={() => guard(() => printReceipt(o, cfg.data ?? {}, propertyName))}>
                    <Receipt className="mr-1 h-4 w-4" />Bill
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!orders.isLoading && (orders.data?.length ?? 0) >= 500 && (
        <p className="text-center text-xs text-walnut">Showing the latest 500 orders.</p>
      )}
    </div>
  );
};
