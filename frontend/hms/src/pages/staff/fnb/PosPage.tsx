import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { ArrowRightLeft, ChevronDown, CloudOff, Hash, ListMinus, Minus, Plus, PlusCircle, Printer, Search, Send, ShoppingBag, StickyNote, Trash2, UserRound, X, Zap } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import type { NewOrder, OrderStatus, OrderType } from '../../../types/fnb';
import type { MenuItem, POSOrder } from '../../../types/pms';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/common/EmptyState';
import { LoadingState } from '../../../components/common/LoadingState';
import { DietDot, ErrorNote, MenuAction, MoreMenu, NEXT, ORDER_TYPES, STATUS_LABEL, Segmented, rupees, titleCase, typeLabel, where } from './fnbUi';
import { smartSearch, textMatch } from './search';
import { printReceipt, playOrderAcceptSound, playOrderCompleteSound } from './printing';
import { printKotManually } from './kotDevice';
import { SettleModal } from './pos/SettleModal';
import { CancelDishesModal, MoveTableModal } from './pos/OrderChangeModals';
import { taxBreakdown, totalTax } from '../../../utils/tax';
import { publishDisplay } from '../../../utils/customerDisplay';
import { ShiftPanel } from './pos/ShiftPanel';
import { cacheOfflineMenu, getCachedOfflineMenu, getNextOfflineOrderNumber, getQueuedOrders, removeQueuedOrder, saveQueuedOrder } from '../../../tapmenu/lib/offlineStore';

const chip = (on: boolean) =>
  `min-h-10 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-burgundy/40 ${
    on ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut hover:bg-gold-soft/40'
  }`;
const field = 'min-h-10 rounded-lg border border-input bg-card px-3 text-sm font-normal text-ink';
const TABLE_TONE: Record<string, string> = {
  AVAILABLE: 'border-border bg-ivory text-walnut',
  SEATED: 'border-amber-300 bg-amber-50 text-amber-900',
  ORDERED: 'border-burgundy/40 bg-burgundy/10 text-burgundy',
  BILLED: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  CLEANING: 'border-sky-300 bg-sky-50 text-sky-900',
  MAINTENANCE: 'border-slate-300 bg-slate-100 text-slate-500',
};

interface Line { key: string; item: MenuItem; quantity: number; variantId?: string; addOnIds: string[]; notes: string }
const unitPrice = (l: Pick<Line, 'item' | 'variantId' | 'addOnIds'>) =>
  (l.item.variants?.find((v) => v.id === l.variantId)?.pricePaise ?? l.item.pricePaise) +
  l.addOnIds.reduce((n, id) => n + (l.item.addOns?.find((a) => a.id === id)?.pricePaise ?? 0), 0);
const isNetworkError = (e: unknown) => !navigator.onLine || e instanceof TypeError || (e as Error)?.name === 'AbortError' || /fetch|network|aborted/i.test((e as Error)?.message ?? '');

export const PosPage: React.FC = () => {
  const qc = useQueryClient();
  const propertyName = useAuthStore((s) => s.session?.activePropertyName) ?? 'Dream Heavens';
  const canCancel = useAuthStore((s) => s.hasPermission('CANCEL_FNB_ORDERS'));
  const canAccept = useAuthStore((s) => s.hasPermission('ACCEPT_GUEST_ORDERS'));
  const canMove = useAuthStore((s) => s.hasPermission('MOVE_FNB_TABLES'));
  // "Add items" mode: the ticket adds dishes to an order already sent instead of starting a new one.
  const location = useLocation();
  const isLiveRoute = location.pathname.includes('/live-orders') || location.pathname.includes('/orders');
  const [addingTo, setAddingTo] = useState<POSOrder | null>(null);
  const [cancelling, setCancelling] = useState<POSOrder | null>(null);
  const [moving, setMoving] = useState<POSOrder | null>(null);
  const [view, setView] = useState<'new' | 'live'>(isLiveRoute ? 'live' : 'new');

  useEffect(() => {
    setView(isLiveRoute ? 'live' : 'new');
  }, [isLiveRoute]);
  const [type, setType] = useState<OrderType>('DINE_IN');
  const [tableId, setTableId] = useState('');
  const [room, setRoom] = useState('');
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [rush, setRush] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [settling, setSettling] = useState<POSOrder | null>(null);
  const [liveSearch, setLiveSearch] = useState('');
  const [code, setCode] = useState('');
  const [queued, setQueued] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const ticketRef = useRef<HTMLElement>(null);

  const cfg = useQuery({ queryKey: ['fnb', 'config'], queryFn: fnbService.config, staleTime: 60_000 });
  const menu = useQuery({
    queryKey: ['fnb', 'menu'],
    staleTime: 60_000,
    // Offline: fall back to the last menu we cached in IndexedDB.
    queryFn: async () => {
      try { const m = await fnbService.menu(); void cacheOfflineMenu(m); return m; }
      catch (e) { const cached = await getCachedOfflineMenu(); if (cached && isNetworkError(e)) return cached as MenuItem[]; throw e; }
    },
  });
  const tables = useQuery({
    queryKey: ['fnb', 'tables'],
    queryFn: fnbService.tables,
    refetchInterval: () => (typeof document !== 'undefined' && document.hidden ? 45_000 : 8_000),
    refetchIntervalInBackground: false,
  });
  const rooms = useQuery({ queryKey: ['fnb', 'roomQr'], queryFn: fnbService.roomQr, enabled: type === 'ROOM_SERVICE', staleTime: 60_000 });
  const live = useQuery({
    queryKey: ['fnb', 'orders', 'all'],
    queryFn: () => fnbService.orders('all'),
    refetchInterval: (q) => (typeof document !== 'undefined' && document.hidden ? 30_000 : q.state.error ? 10_000 : 5_000),
    refetchIntervalInBackground: false,
  });

  // ── offline queue ────────────────────────────────────────────────────────
  const refreshQueued = useCallback(() => getQueuedOrders().then((q) => setQueued(q.length)).catch(() => setQueued(0)), []);
  const syncQueue = useCallback(async () => {
    const q = await getQueuedOrders().catch(() => []);
    for (const entry of q) {
      try { await fnbService.createOrder(entry.payload as NewOrder); await removeQueuedOrder(entry.id); }
      catch (e) { if (isNetworkError(e)) break; await removeQueuedOrder(entry.id); setSent(`Queued order ${entry.offlineNumber} was rejected: ${(e as Error).message}`); }
    }
    await refreshQueued();
    qc.invalidateQueries({ queryKey: ['fnb'] });
  }, [qc, refreshQueued]);
  useEffect(() => {
    void refreshQueued();
    const on = () => void syncQueue();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [refreshQueued, syncQueue]);

  const items = menu.data ?? [];
  const categories = useMemo(() => ['ALL', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const shown = useMemo(() => smartSearch(items.filter((i) => category === 'ALL' || i.category === category), deferredSearch), [items, category, deferredSearch]);
  const subtotal = lines.reduce((n, l) => n + unitPrice(l) * l.quantity, 0);
  const pct = cfg.data?.gstPercent ?? 5;
  const tax = totalTax(taxBreakdown(lines.map((l) => ({ pricePaise: unitPrice(l), quantity: l.quantity, taxPercent: l.item.taxPercent })), 0, pct));
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  // Mirror the cart being rung up to the customer-facing screen (/customer-display); the settle dialog takes over while it is open.
  useEffect(() => {
    if (settling) return;
    if (!lines.length) { publishDisplay({ kind: 'idle' }); return; }
    publishDisplay({
      kind: 'cart', subtotalPaise: subtotal, taxPaise: tax, totalPaise: subtotal + tax,
      lines: lines.map((l) => ({ name: [l.item.name, l.item.variants?.find((v) => v.id === l.variantId)?.name].filter(Boolean).join(' · '), quantity: l.quantity, totalPaise: unitPrice(l) * l.quantity })),
    });
  }, [lines, subtotal, tax, settling]);
  const target = addingTo ? 'ok' : type === 'DINE_IN' ? tableId : type === 'ROOM_SERVICE' ? room : 'ok';

  const addLine = (item: MenuItem, variantId?: string, addOnIds: string[] = []) => {
    const key = `${item.id}|${variantId ?? ''}|${[...addOnIds].sort().join(',')}`;
    setLines((ls) => ls.some((l) => l.key === key)
      ? ls.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l))
      : [...ls, { key, item, quantity: 1, variantId, addOnIds, notes: '' }]);
  };
  const tap = (item: MenuItem) => (item.variants?.length || item.addOns?.length ? setPicking(item) : addLine(item));
  const bump = (key: string, by: number) => setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : l.quantity + by <= 0 ? [] : [{ ...l, quantity: Math.min(20, l.quantity + by) }])));
  const noteLine = (key: string) => {
    const l = lines.find((x) => x.key === key);
    const n = window.prompt(`Note for ${l?.item.name}`, l?.notes ?? '');
    if (n !== null) setLines((ls) => ls.map((x) => (x.key === key ? { ...x, notes: n.slice(0, 200) } : x)));
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ['fnb'] });

  const payload = (): NewOrder => ({
    order_type: type,
    table_id: type === 'DINE_IN' ? tableId : undefined,
    room_number: type === 'ROOM_SERVICE' ? room : undefined,
    guest_name: guestName.trim() || undefined,
    customer_phone: guestPhone.trim() || undefined,
    notes: notes.trim() || undefined,
    is_rush: rush,
    items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity, variantId: l.variantId, addOnIds: l.addOnIds, notes: l.notes || undefined })),
  });
  const clear = () => { setLines([]); setNotes(''); setRush(false); setGuestName(''); setGuestPhone(''); setShowDetails(false); setAddingTo(null); };
  const send = useMutation({
    mutationFn: async (): Promise<{ order?: POSOrder; offlineNumber?: string; added?: boolean }> => {
      if (addingTo) {
        const body = payload();
        return { order: await fnbService.addItems(addingTo.id, body.items, body.notes), added: true };
      }
      const body = payload();
      try { return { order: await fnbService.createOrder(body) }; }
      catch (e) {
        if (!isNetworkError(e) || type === 'ROOM_SERVICE') throw e; // room charges need the folio, so never queue them
        const offlineNumber = await getNextOfflineOrderNumber();
        await saveQueuedOrder({ id: crypto.randomUUID(), offlineNumber, payload: body, printableOrder: null, createdAt: new Date().toISOString(), attempts: 0 });
        return { offlineNumber };
      }
    },
    onSuccess: (r) => {
      playOrderAcceptSound(cfg.data?.soundVolume);
      setSent(r.added && r.order ? `Added to ${r.order.orderNumber}. The kitchen gets an additional KOT for the new dishes.`
        : r.order ? `${r.order.orderNumber} sent to the kitchen` : `Offline: saved as ${r.offlineNumber}. It will be sent when the connection is back.`);
      clear();
      if (isLiveRoute) setView('live');
      void refreshQueued();
      refresh();
    },
  });
  const move = useMutation({
    mutationFn: (v: { id: string; status: OrderStatus; reason?: string }) => fnbService.setStatus(v.id, v.status, v.reason),
    onSuccess: (_data, variables) => {
      if (variables.status === 'READY' || variables.status === 'DELIVERED') {
        playOrderCompleteSound(cfg.data?.soundVolume);
      }
      refresh();
    },
  });
  const lookup = useMutation({ mutationFn: () => fnbService.counterCode(code.trim()), onSuccess: (o) => { setSettling(o); setCode(''); } });

  // Room-service orders are done once delivered (they sit on the folio); everything else waits for payment.
  const openOrders = (live.data ?? [])
    .filter((o) => !['BILLED', 'CANCELLED'].includes(o.status) && !(o.status === 'DELIVERED' && o.orderType === 'ROOM_SERVICE'))
    .filter((o) => !liveSearch || textMatch([o.orderNumber, where(o), o.guestName, o.counterCode, ...o.items.map((i) => i.name)], liveSearch))
    .sort((a, b) => Number(!!b.isRush) - Number(!!a.isRush) || a.createdAt.localeCompare(b.createdAt));

  const selectedTable = tables.data?.find((t) => t.id === tableId);
  const detailsSummary = [guestName.trim(), notes.trim() && 'note added'].filter(Boolean).join(' · ');
  const ticket = (
    <aside ref={ticketRef} aria-label="Current order" className="flex scroll-mt-20 flex-col overflow-hidden rounded-xl border border-border bg-ivory lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
      {/* 1 · Who is it for */}
      {addingTo ? (
        <div className="flex items-start gap-2 border-b border-sky-200 bg-sky-50 p-3 text-sky-900">
          <PlusCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">Adding to {where(addingTo)} · <span className="font-mono">{addingTo.orderNumber}</span></span>
            <span className="text-xs">{addingTo.items.reduce((n, i) => n + i.quantity, 0)} dishes already sent. Only the new dishes print on the additional KOT.</span>
          </p>
          <button type="button" onClick={() => { setAddingTo(null); setLines([]); if (isLiveRoute) setView('live'); }} className="min-h-8 rounded-md px-2 text-xs font-semibold hover:bg-sky-100">Stop adding</button>
        </div>
      ) : (
      <div className="grid gap-3 border-b border-border p-3">
        <Segmented role="radio" label="Order type" className="w-full" value={type} onChange={(t) => { setType(t); send.reset(); }}
          options={ORDER_TYPES.map((t) => ({ id: t.id, label: t.id === 'ROOM_SERVICE' ? 'Room' : t.label }))} />
        {type === 'DINE_IN' && (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 flex w-full items-center justify-between text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Table <span className="font-semibold tracking-normal normal-case">{selectedTable ? `${selectedTable.tableNumber} · ${selectedTable.capacity} seats` : 'Pick one'}</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {(tables.data ?? []).map((t) => (
                <button key={t.id} type="button" aria-pressed={tableId === t.id} disabled={t.status === 'MAINTENANCE'} onClick={() => setTableId(t.id)}
                  aria-label={`Table ${t.tableNumber}, ${titleCase(t.status)}`} title={`${titleCase(t.section)} · seats ${t.capacity} · ${titleCase(t.status)}`}
                  className={`min-h-10 min-w-12 rounded-lg border px-2 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-burgundy/40 disabled:opacity-40 ${tableId === t.id ? 'border-burgundy bg-burgundy text-ivory' : TABLE_TONE[t.status] ?? TABLE_TONE.AVAILABLE}`}>
                  {t.tableNumber}
                </button>
              ))}
            </div>
            <p className="flex flex-wrap gap-x-3 text-2xs text-muted-foreground" aria-hidden>
              <span><i className="mr-1 inline-block size-2 rounded-full border border-border bg-ivory" />Free</span>
              <span><i className="mr-1 inline-block size-2 rounded-full bg-amber-300" />Seated</span>
              <span><i className="mr-1 inline-block size-2 rounded-full bg-burgundy/50" />Ordered</span>
              <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-300" />Billed</span>
            </p>
          </fieldset>
        )}
        {type === 'ROOM_SERVICE' && (
          <label className="grid gap-1 text-sm font-semibold text-walnut">Room
            <select value={room} onChange={(e) => setRoom(e.target.value)} className={field}>
              <option value="">Choose an occupied room</option>
              {(rooms.data ?? []).map((r) => <option key={r.stayId} value={r.roomNumber}>{r.roomNumber} · {r.guestName}</option>)}
            </select>
            {rooms.isSuccess && !rooms.data.length && <span className="text-xs font-normal text-muted-foreground">No guests are checked in right now.</span>}
          </label>
        )}
      </div>
      )}

      {/* 2 · What they ordered (scrolls) */}
      <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Order{count ? ` · ${count} item${count > 1 ? 's' : ''}` : ''}</h3>
          <span className="flex items-center gap-1">
            {!addingTo && <button type="button" aria-pressed={rush} onClick={() => setRush((r) => !r)}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold ${rush ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-border text-walnut hover:bg-gold-soft/30'}`}>
              <Zap className="size-3.5" /> Rush
            </button>}
            {lines.length > 0 && (
              <button type="button" aria-label="Clear order" title="Clear order" onClick={() => window.confirm('Clear this order?') && clear()}
                className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-700"><Trash2 className="size-3.5" /></button>
            )}
          </span>
        </div>
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Tap dishes on the left to add them.</p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((l) => (
              <li key={l.key} className="grid gap-1 py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    <span className="block truncate font-medium">{l.item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[l.item.variants?.find((v) => v.id === l.variantId)?.name, ...l.addOnIds.map((id) => `+ ${l.item.addOns?.find((a) => a.id === id)?.name}`)].filter(Boolean).join(' · ') || rupees(unitPrice(l))}
                    </span>
                  </span>
                  <button aria-label={`Note for ${l.item.name}`} title="Kitchen note for this dish" className={`grid size-8 place-items-center rounded-md ${l.notes ? 'bg-amber-100 text-amber-800' : 'text-muted-foreground hover:bg-gold-soft/40'}`} onClick={() => noteLine(l.key)}><StickyNote className="size-3.5" /></button>
                  <span className="inline-flex items-center rounded-lg border border-border">
                    <button aria-label={`Remove one ${l.item.name}`} className="grid size-8 place-items-center" onClick={() => bump(l.key, -1)}><Minus className="size-3.5" /></button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{l.quantity}</span>
                    <button aria-label={`Add one ${l.item.name}`} className="grid size-8 place-items-center" onClick={() => bump(l.key, 1)}><Plus className="size-3.5" /></button>
                  </span>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums">{rupees(unitPrice(l) * l.quantity)}</span>
                </div>
                {l.notes && <em className="text-xs text-amber-800">⚠ {l.notes}</em>}
              </li>
            ))}
          </ul>
        )}

        {/* Optional extras stay folded away until needed */}
        <div className="rounded-lg border border-border">
          <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}
            className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-walnut">
            <UserRound className="size-4" />
            <span className="flex-1">{type === 'ROOM_SERVICE' ? 'Kitchen note' : 'Guest & kitchen note'}</span>
            {detailsSummary && !showDetails && <span className="max-w-32 truncate text-xs font-normal text-muted-foreground">{detailsSummary}</span>}
            <ChevronDown className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
          </button>
          {showDetails && (
            <div className="grid gap-2 border-t border-border p-3">
              {type !== 'ROOM_SERVICE' && (
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Guest name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name" className={field} />
                  <input aria-label="Guest phone" inputMode="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Phone" className={field} />
                </div>
              )}
              <input aria-label="Kitchen note" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Kitchen note: allergies, serve together…" className={field} />
            </div>
          )}
        </div>
      </div>

      {/* 3 · Pay / send: always visible */}
      <div className="grid gap-2 border-t border-border bg-gold-soft/15 p-3">
        <dl className="grid gap-0.5 text-sm">
          <div className="flex justify-between text-xs text-muted-foreground"><dt>Subtotal · GST {pct}%</dt><dd className="tabular-nums">{rupees(subtotal)} + {rupees(tax)}</dd></div>
          <div className="flex justify-between text-base font-bold text-ink"><dt>Total</dt><dd className="tabular-nums">{rupees(subtotal + tax)}</dd></div>
          {type === 'ROOM_SERVICE' && <p className="text-xs text-muted-foreground">Charged to the room folio.</p>}
        </dl>
        <ErrorNote error={send.error} />
        {sent && !send.isPending && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sent}</p>}
        <Button size="lg" disabled={!count || !target || send.isPending} isLoading={send.isPending} onClick={() => { setSent(null); send.mutate(); }}>
          <Send className="size-4" /> {addingTo ? `Add to ${addingTo.orderNumber}${count ? ` · ${count}` : ''}` : !target && count ? (type === 'DINE_IN' ? 'Pick a table' : 'Pick a room') : `Send to kitchen${count ? ` · ${count}` : ''}`}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">{view === 'live' ? 'Live Orders' : 'New Order'}</h2>
        <ShiftPanel />
      </div>
      {queued > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex items-center gap-2"><CloudOff className="size-4" /> {queued} order{queued > 1 ? 's' : ''} saved offline, waiting to be sent.</span>
          <Button size="sm" variant="outline" onClick={() => void syncQueue()}>Send now</Button>
        </div>
      )}

      {view === 'new' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Menu" className="@container grid min-w-0 gap-3">
            {/* Search and categories stay in reach while scrolling a long menu */}
            <div className="sticky top-14 z-10 -mx-1 grid gap-2 bg-cream px-1 py-2 md:top-16">
              <label className="relative">
                <span className="sr-only">Search the menu</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search: paneer, something sweet, cold drinks…" className="min-h-10 w-full rounded-full border border-input bg-card pr-3 pl-9 text-sm" />
              </label>
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Categories">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    className={chip(category === c)}
                    onClick={() => setCategory(c)}
                  >
                    {c === 'ALL' ? 'All' : titleCase(c)}
                  </button>
                ))}
              </div>
            </div>
            {menu.isLoading ? <LoadingState message="Loading menu…" subtext="" /> : menu.error ? <ErrorNote error={menu.error} /> : (
              <ul className="grid grid-cols-1 gap-2 @sm:grid-cols-2 @3xl:grid-cols-3">
                {shown.map((i) => {
                  const qty = lines.filter((l) => l.item.id === i.id).reduce((n, l) => n + l.quantity, 0);
                  return (
                    <li key={i.id}>
                      <button disabled={!i.isAvailable} onClick={() => tap(i)}
                        className="flex h-full w-full flex-col gap-1 rounded-xl border border-border bg-ivory p-3 text-left outline-none transition-colors hover:bg-gold-soft/30 focus-visible:ring-[3px] focus-visible:ring-burgundy/40 disabled:cursor-not-allowed disabled:opacity-50">
                        <span className="flex items-start gap-2"><DietDot type={i.dietaryType} veg={i.isVeg} /><span className="flex-1 font-semibold text-ink">{i.name}</span>{qty > 0 && <Badge variant="gold" size="sm">{qty}</Badge>}</span>
                        <span className="line-clamp-2 min-h-8 text-xs text-muted-foreground">{i.description}</span>
                        <span className="mt-auto flex items-center justify-between pt-1 text-sm">
                          <span className="font-semibold tabular-nums text-burgundy">{rupees(i.pricePaise)}{i.variants?.length ? '+' : ''}</span>
                          {!i.isAvailable ? <Badge variant="destructive" size="sm">Sold out</Badge> : i.variants?.length || i.addOns?.length ? <span className="text-xs text-muted-foreground">Options</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!shown.length && <li className="col-span-full"><EmptyState icon={<Search className="size-6" />} title="No dishes found" description="Try another word or category." /></li>}
              </ul>
            )}
            {/* Tablet portrait / phone: the order sits below the menu, so keep a shortcut to it on screen */}
            {count > 0 && (
              <button type="button" onClick={() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="sticky bottom-24 z-10 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-burgundy px-4 text-sm font-semibold text-ivory shadow-lg md:bottom-4 lg:hidden">
                <span>{count} item{count > 1 ? 's' : ''} · {rupees(subtotal + tax)}</span>
                <span className="inline-flex items-center gap-1">Review order <ChevronDown className="size-4" /></span>
              </button>
            )}
          </section>
          {ticket}
        </div>
      ) : (
        <section aria-label="Live orders" className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Search orders</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={liveSearch} onChange={(e) => setLiveSearch(e.target.value)} placeholder="Search order, table, guest or dish" className="min-h-10 w-full rounded-full border border-input bg-card pr-3 pl-9 text-sm" />
            </label>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (/^\d{6}$/.test(code)) lookup.mutate(); }}>
              <label className="relative">
                <span className="sr-only">Counter code</span>
                <Hash className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Counter code" className="min-h-10 w-40 rounded-full border border-input bg-card pr-3 pl-9 font-mono text-sm" />
              </label>
              <Button type="submit" variant="outline" disabled={code.length !== 6} isLoading={lookup.isPending}>Find bill</Button>
            </form>
          </div>
          <ErrorNote error={move.error ?? lookup.error} />
          {live.isLoading ? <LoadingState message="Loading orders…" subtext="" /> : !openOrders.length ? (
            <EmptyState icon={<ShoppingBag className="size-6" />} title="No open orders" description="New orders show up here until they are delivered and paid." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {openOrders.map((o) => (
                <LiveCard key={o.id} o={o} busy={move.isPending} canCancel={canCancel} canAccept={canAccept} canMove={canMove}
                  onAddItems={() => { setAddingTo(o); setLines([]); setSent(null); send.reset(); setView('new'); }}
                  onCancelDishes={() => setCancelling(o)}
                  onMoveTable={() => setMoving(o)}
                  onMove={(status, reason) => move.mutate({ id: o.id, status, reason })}
                  onAccept={() => fnbService.acceptOrder(o.id).then(refresh, (e) => alert((e as Error).message))}
                  onSettle={() => setSettling(o)}
                  onKot={() => {
                    printKotManually(o, cfg.data, propertyName, (id) => fnbService.markKot(id)).then(refresh, (e) => alert((e as Error).message));
                  }}
                  onBill={() => printReceipt(o, cfg.data ?? {}, propertyName)} />
              ))}
            </ul>
          )}
        </section>
      )}

      <ItemPicker item={picking} onClose={() => setPicking(null)} onAdd={(v, a) => { if (picking) addLine(picking, v, a); setPicking(null); }} />
      <SettleModal order={settling} cfg={cfg.data} onClose={() => setSettling(null)}
        onDone={(o) => { setSettling(null); refresh(); if (cfg.data?.autoPrint || window.confirm(`${o.orderNumber} paid. Print the receipt?`)) void printReceipt(o, cfg.data ?? {}, propertyName); }} />
      {cancelling && <CancelDishesModal order={cancelling} onClose={() => setCancelling(null)} onDone={refresh} />}
      {moving && <MoveTableModal order={moving} tables={tables.data ?? []} onClose={() => setMoving(null)} onDone={refresh} />}
    </div>
  );
};

/** Size and add-on picker for dishes that have options (TapMenu's staff modifier modal). */
const ItemPicker: React.FC<{ item: MenuItem | null; onClose: () => void; onAdd: (variantId: string | undefined, addOnIds: string[]) => void }> = ({ item, onClose, onAdd }) => {
  const [variant, setVariant] = useState<string | undefined>();
  const [addOns, setAddOns] = useState<string[]>([]);
  useEffect(() => { setVariant(item?.variants?.find((v) => v.isDefault)?.id ?? item?.variants?.[0]?.id); setAddOns([]); }, [item]);
  if (!item) return null;
  const price = unitPrice({ item, variantId: variant, addOnIds: addOns });
  return (
    <Modal isOpen={!!item} onClose={onClose} title={item.name} maxWidth="md">
      <div className="grid gap-4">
        {!!item.variants?.length && (
          <fieldset className="grid gap-2">
            <legend className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Size</legend>
            {item.variants.map((v) => (
              <label key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><input type="radio" name="variant" checked={variant === v.id} onChange={() => setVariant(v.id)} /> {v.name}</span>
                <span className="tabular-nums">{rupees(v.pricePaise)}</span>
              </label>
            ))}
          </fieldset>
        )}
        {!!item.addOns?.length && (
          <fieldset className="grid gap-2">
            <legend className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Add-ons</legend>
            {item.addOns.map((a) => (
              <label key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><input type="checkbox" checked={addOns.includes(a.id)} onChange={(e) => setAddOns((x) => (e.target.checked ? [...x, a.id] : x.filter((y) => y !== a.id)))} /> {a.name}</span>
                <span className="tabular-nums">+{rupees(a.pricePaise)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <Button onClick={() => onAdd(variant, addOns)}>Add · {rupees(price)}</Button>
      </div>
    </Modal>
  );
};

const LiveCard: React.FC<{
  o: POSOrder; busy: boolean; canCancel: boolean; canAccept: boolean; canMove: boolean;
  onMove: (s: OrderStatus, reason?: string) => void; onAccept: () => void; onSettle: () => void; onKot: () => void; onBill: () => void;
  onAddItems: () => void; onCancelDishes: () => void; onMoveTable: () => void;
}> = ({ o, busy, canCancel, canAccept, canMove, onMove, onAccept, onSettle, onKot, onBill, onAddItems, onCancelDishes, onMoveTable }) => {
  const pending = o.status === 'PENDING_ACCEPTANCE';
  // Paid or online-paying orders keep a fixed amount, so dishes cannot be added or cancelled.
  const editable = !o.paidAt && ['PENDING_ACCEPTANCE', 'QUEUED', 'PREPARING', 'READY', 'DELIVERED'].includes(o.status);
  const next = NEXT[o.status];
  const canPay = o.orderType !== 'ROOM_SERVICE' && !o.paidAt;
  return (
    <li className={`grid content-start gap-2 rounded-xl border bg-ivory p-4 ${o.isRush ? 'border-amber-400 ring-1 ring-amber-300' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{o.isRush && <Zap className="mr-1 inline size-4 text-amber-600" />}{where(o)} <span className="font-mono text-xs font-normal text-muted-foreground">{o.orderNumber}</span></p>
          <p className="text-xs text-muted-foreground">{typeLabel(o.orderType)} · {o.elapsedMinutes} min{o.source === 'GUEST_QR' ? ' · room app' : o.source === 'TABLE_QR' ? ' · table QR' : ''}{o.guestName ? ` · ${o.guestName}` : ''}</p>
          {o.counterCode && !o.paidAt && <p className="text-xs text-muted-foreground">Counter code <span className="font-mono font-semibold text-ink">{o.counterCode}</span></p>}
        </div>
        <span className="grid justify-items-end gap-1">
          <Badge variant={o.status === 'READY' ? 'success' : ['QUEUED', 'AWAITING_PAYMENT', 'PENDING_ACCEPTANCE'].includes(o.status) ? 'warning' : 'info'} size="sm">{STATUS_LABEL[o.status]}</Badge>
          {o.additionalKot && <Badge variant="info" size="sm">Additional KOT</Badge>}
          {o.paidAt && <Badge variant="success" size="sm">Paid · {o.paymentMethod}</Badge>}
        </span>
      </div>
      <ul className="text-sm text-ink">
        {o.items.map((it, n) => (
          <li key={n}>{it.quantity} × {it.name}{it.variantName ? ` (${it.variantName})` : ''}{it.addOns?.length ? <span className="text-muted-foreground"> + {it.addOns.join(', ')}</span> : null}{it.notes ? <em className="text-muted-foreground"> — {it.notes}</em> : null}</li>
        ))}
      </ul>
      {o.notes && <p className="rounded-md bg-gold-soft/40 px-2 py-1 text-xs text-walnut">{o.notes}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="font-semibold tabular-nums">{rupees(o.totalPaise)}</span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <MoreMenu label={`More actions for ${o.orderNumber}`}>
            {editable && <MenuAction icon={<PlusCircle className="size-4" />} onClick={onAddItems}>Add items</MenuAction>}
            {editable && canCancel && o.items.length > 0 && <MenuAction icon={<ListMinus className="size-4" />} onClick={onCancelDishes}>Cancel dishes</MenuAction>}
            {canMove && o.orderType === 'DINE_IN' && <MenuAction icon={<ArrowRightLeft className="size-4" />} onClick={onMoveTable}>Move table</MenuAction>}
            {!pending && <MenuAction icon={<Printer className="size-4" />} onClick={onKot}>{o.kotPrintedAt ? 'Reprint KOT' : o.additionalKot ? 'Print additional KOT' : 'Print KOT'}</MenuAction>}
            {canPay && <MenuAction icon={<Printer className="size-4" />} onClick={onBill}>Print bill</MenuAction>}
            {canCancel && ['AWAITING_PAYMENT', 'PENDING_ACCEPTANCE', 'QUEUED', 'PREPARING', 'READY'].includes(o.status) && (
              <MenuAction danger disabled={busy} icon={<X className="size-4" />} onClick={() => {
                const reason = window.prompt(`Cancel ${o.orderNumber}?${o.orderType === 'ROOM_SERVICE' ? ' The room charge will be reversed.' : ''} Reason:`);
                if (reason !== null) onMove('CANCELLED', reason || undefined);
              }}>Cancel order</MenuAction>
            )}
          </MoreMenu>
          {pending && canAccept && <Button size="sm" disabled={busy} onClick={onAccept}>Accept</Button>}
          {next && <Button size="sm" variant={canPay ? 'outline' : 'primary'} disabled={busy} onClick={() => onMove(next.to)}>{next.label}</Button>}
          {canPay && <Button size="sm" variant="gold" disabled={busy} onClick={onSettle}>Settle</Button>}
        </span>
      </div>
    </li>
  );
};
