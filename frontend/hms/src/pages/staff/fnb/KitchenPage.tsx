import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, BellRing, Bluetooth, Printer, RefreshCw, Settings2, WifiOff, X, Zap } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import { useAuthStore } from '../../../stores/authStore';
import type { FnbConfig, OrderStatus } from '../../../types/fnb';
import type { POSOrder } from '../../../types/pms';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorNote, Segmented, typeLabel } from './fnbUi';
import { KDSHeader } from './kds/KDSHeader';
import { KDSTicketCard, type KDSTicket } from './kds/KDSTicketCard';
import { audioBlocked, playTone, playOrderCompleteSound, unlockAudio } from './printing';
import { pairPrinter } from './btPrinter';
import { kotSlice, printKotManually, printKotSlice, useKotDevice } from './kotDevice';

type Lane = 'pending' | 'in_preparation' | 'ready';
const LANE_OF: Partial<Record<OrderStatus, Lane>> = { QUEUED: 'pending', PREPARING: 'in_preparation', READY: 'ready' };
const NEXT_OF: Record<Lane, OrderStatus> = { pending: 'PREPARING', in_preparation: 'READY', ready: 'DELIVERED' };
const SOUND_KEY = 'dh_kds_sound';
const TONE_KEY = 'dh_kds_tone';
const REPEAT_MS = 6000; // a new, unstarted order rings again every 6 s until it is started or the alert is stopped

/** Our order, in the shape TapMenu's KDS ticket card expects. */
function toTicket(o: POSOrder): KDSTicket {
  const items = o.items;
  return {
    id: o.id, order_id: o.id, ticket_number: o.orderNumber, prep_station: items[0]?.station ?? 'MAIN_KITCHEN',
    status: LANE_OF[o.status] ?? 'bumped',
    items_snapshot: [
      ...items.map((i, n) => ({
        orderItemId: `${o.id}-${n}`, name: i.name, quantity: i.quantity, notes: i.notes ?? undefined, prep_station: i.station, added: (i.seq ?? 1) > 1,
        modifiers: [...(i.variantName ? [{ optionName: i.variantName }] : []), ...(i.addOns ?? []).map((a) => ({ optionName: `+ ${a}` }))],
      })),
      // Cancelled dishes the kitchen already had on paper stay visible, struck through.
      ...(o.voidedItems ?? []).filter((v) => !v.noSlip).map((v, n) => ({
        orderItemId: `${o.id}-v${n}`, name: v.name, quantity: v.quantity, notes: v.reason, cancelled: true,
        modifiers: v.variantName ? [{ optionName: v.variantName }] : [],
      })),
    ],
    special_instructions: o.notes ?? undefined, created_at: o.createdAt, room_number: o.roomNumber ?? undefined, is_rush_priority: !!o.isRush,
    estimated_prep_minutes: o.estimatedPrepMinutes ?? 15,
    // "Reprint" only once every round is on paper; otherwise the button prints what the kitchen is still missing.
    kot_printed_at: (o.kotPrintedSeq ?? 0) >= (o.kotSeq ?? 1) ? o.kotPrintedAt ?? undefined : undefined,
    additional_kot: !!o.additionalKot || ((o.kotPrintedSeq ?? 0) > 0 && (o.kotPrintedSeq ?? 0) < (o.kotSeq ?? 1)),
    orders: { order_number: o.orderNumber, order_type: typeLabel(o.orderType), tables: o.tableNumber ? { label: `Table ${o.tableNumber}` } : undefined, room_number: o.roomNumber ?? undefined },
    customer_name: o.guestName ?? undefined, customer_phone: o.customerPhone ?? undefined, isBackendOrder: true, backendOrderStatus: o.status,
  };
}

/** Kitchen display, ported from TapMenu: rush first, SLA bars, KOT print, bump to served, fullscreen, lanes, sound and live status. */
export const KitchenPage: React.FC = () => {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCancel = hasPermission('CANCEL_FNB_ORDERS'); // captains and admins cancel; cooks start, finish and bump
  const cfg = useQuery({ queryKey: ['fnb', 'config'], queryFn: fnbService.config, staleTime: 60_000 });
  const restaurant = session?.activePropertyName ?? 'TapMenu';
  const device = useKotDevice();
  const [printError, setPrintError] = useState<string | null>(null);

  const [muted, setMuted] = useState(() => localStorage.getItem(SOUND_KEY) === 'off'); // sound is on unless this screen was muted
  const [tone, setTone] = useState<{ tone: FnbConfig['soundTone']; volume: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem(TONE_KEY) ?? 'null'); } catch { return null; }
  });
  const sound = tone ?? { tone: cfg.data?.soundTone ?? 'bell', volume: cfg.data?.soundVolume ?? 80 };
  const [showSound, setShowSound] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [lane, setLane] = useState<Lane>('pending');
  const [silenced, setSilenced] = useState<Set<string>>(new Set()); // orders whose alert was stopped by hand
  const [blocked, setBlocked] = useState(audioBlocked());

  const board = useQuery({
    queryKey: ['fnb', 'board'],
    queryFn: () => fnbService.orders('active'),
    // ETag polling: unchanged boards cost a 304. Keeps going when the tab is in the background (a kitchen screen is often
    // behind another window), just slower; backs off on errors.
    refetchInterval: (q) => (q.state.error ? 8_000 : typeof document !== 'undefined' && document.hidden ? 20_000 : 3_000),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    placeholderData: (prev) => prev,
    retry: 1,
  });
  const done = () => qc.invalidateQueries({ queryKey: ['fnb'] });
  const move = useMutation({
    mutationFn: (v: { id: string; status: OrderStatus }) => fnbService.setStatus(v.id, v.status),
    onSuccess: (_data, variables) => {
      if (variables.status === 'READY' || variables.status === 'DELIVERED') {
        playOrderCompleteSound(sound.volume);
      }
    },
    onSettled: done,
  });
  const rush = useMutation({ mutationFn: (v: { id: string; on: boolean }) => fnbService.setRush(v.id, v.on), onSettled: done });
  const kot = useMutation({ mutationFn: (id: string) => fnbService.markKot(id), onSettled: done });

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  // Browsers keep sound blocked until the page gets a tap or key press; the first one unlocks it.
  useEffect(() => {
    const unlock = () => { void unlockAudio().then((ok) => setBlocked(!ok)); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => { const t = setInterval(() => setBlocked(audioBlocked()), 2000); return () => clearInterval(t); }, []);
  const orders = board.data ?? [];

  // Kitchen printer device: print each new KOT once. The server claim makes sure only one device prints it, even with
  // two kitchen screens open; a failed print gives the claim back so it is retried.
  const printing = useRef(new Set<string>());
  // An order owes the kitchen a KOT while some round (first order, added dishes, cancellations) is not printed yet.
  const owesKitchen = (o: POSOrder) => (o.kotPrintedSeq ?? 0) < (o.kotSeq ?? 1) && ['QUEUED', 'PREPARING', 'READY'].includes(o.status);
  const autoPrint = device.isKitchenPrinter && (cfg.data?.autoPrintKot ?? true) && (device.method === 'browser' || device.connected);
  useEffect(() => {
    if (!autoPrint) return;
    for (const o of orders) {
      if (!owesKitchen(o) || printing.current.has(o.id)) continue;
      printing.current.add(o.id);
      void (async () => {
        try {
          const c = await fnbService.claimKot(o.id);
          if (!c.claimed) return;
          // Only the rounds this claim covers: a first KOT, the dishes added since, or a cancellation slip.
          const slice = kotSlice(o, c.fromSeq, c.toSeq);
          if (!slice) return;
          try {
            await printKotSlice(slice, cfg.data, restaurant);
            setPrintError(null);
          } catch (e) {
            await fnbService.releaseKot(o.id, c.fromSeq, c.toSeq).catch(() => {});
            setPrintError(`${o.orderNumber}: ${(e as Error).message}`);
          }
        } finally {
          printing.current.delete(o.id);
          done();
        }
      })();
    }
  }, [autoPrint, orders.map((o) => `${o.id}:${o.kotPrintedSeq ?? 0}/${o.kotSeq ?? 1}`).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const waitingKots = device.isKitchenPrinter ? orders.filter(owesKitchen).length : 0;

  const sort = (a: POSOrder, b: POSOrder) => Number(!!b.isRush) - Number(!!a.isRush) || a.createdAt.localeCompare(b.createdAt);
  const lanes: { key: Lane; label: string; color: string; badgeColor: string; list: POSOrder[] }[] = [
    { key: 'pending', label: 'New', color: 'border-amber-500/30 bg-amber-500/5', badgeColor: 'bg-amber-500 text-white', list: orders.filter((o) => o.status === 'QUEUED').sort(sort) },
    { key: 'in_preparation', label: 'Preparing', color: 'border-blue-500/30 bg-blue-500/5', badgeColor: 'bg-blue-500 text-white', list: orders.filter((o) => o.status === 'PREPARING').sort(sort) },
    { key: 'ready', label: 'Ready to serve', color: 'border-emerald-500/30 bg-emerald-500/5', badgeColor: 'bg-emerald-500 text-white', list: orders.filter((o) => o.status === 'READY').sort(sort) },
  ];
  // Alarm: while any order in the New lane has not been started, ring now and again every REPEAT_MS. It stops when the order is
  // started (or cancelled), or when someone presses "Stop alert" (an order that arrives later rings again).
  const pending = orders.filter((o) => o.status === 'QUEUED');
  const ringing = pending.filter((o) => !silenced.has(o.id));
  const ringKey = ringing.length > 0 && !muted;
  const urgent = ringing.some((o) => o.isRush);
  const prevRinging = useRef(0);
  useEffect(() => {
    if (!ringKey) return;
    const ring = () => playTone(sound.tone, sound.volume, urgent);
    ring();
    const t = setInterval(ring, REPEAT_MS);
    return () => clearInterval(t);
  }, [ringKey, urgent, sound.tone, sound.volume]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // a newly arrived order rings straight away instead of waiting for the next repeat
    if (ringKey && ringing.length > prevRinging.current && prevRinging.current > 0) playTone(sound.tone, sound.volume, urgent);
    prevRinging.current = ringing.length;
  }, [ringing.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const base = 'Kitchen';
    document.title = pending.length ? `(${pending.length}) New order${pending.length > 1 ? 's' : ''} · ${base}` : base;
    return () => { document.title = base; };
  }, [pending.length]);
  const stopAlert = () => setSilenced(new Set([...silenced, ...pending.map((o) => o.id)]));
  const byId = new Map(orders.map((o) => [o.id, o]));

  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* not allowed */ }
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(SOUND_KEY, next ? 'off' : 'on');
    if (!next) playTone(sound.tone, sound.volume);
  };
  const saveTone = (t: typeof sound) => { setTone(t); localStorage.setItem(TONE_KEY, JSON.stringify(t)); };
  const offline = !!board.error && !!(board.error as { offline?: boolean }).offline;

  if (board.isLoading) return <LoadingState message="Loading the board…" subtext="" />;
  return (
    <div className="@container grid gap-4">
      <KDSHeader
        availableStations={[{ id: 'all', label: 'Kitchen' }]}
        selectedStation="all"
        setSelectedStation={() => {}}
        isAudioMuted={muted}
        onToggleAudio={toggleMute}
        isFullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      >
        <div className="relative">
          <button type="button" onClick={() => setShowSound((v) => !v)} aria-expanded={showSound} aria-label="Sound settings"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-input bg-ivory px-2.5 text-xs font-semibold text-walnut hover:bg-gold-soft/30">
            <Settings2 className="size-4" /> Tone
          </button>
          {showSound && (
            <div className="absolute right-0 z-20 mt-2 grid w-60 gap-3 rounded-xl border border-border bg-ivory p-3 shadow-lg">
              <label className="grid gap-1 text-xs font-semibold text-walnut">Tone
                <select value={sound.tone} onChange={(e) => saveTone({ ...sound, tone: e.target.value as FnbConfig['soundTone'] })} className="min-h-9 rounded-md border border-input bg-card px-2 font-normal">
                  {(['phone', 'bell', 'chime', 'siren', 'buzzer', 'synth'] as const).map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-walnut">Volume {sound.volume}%
                <input type="range" min={0} max={100} value={sound.volume} onChange={(e) => saveTone({ ...sound, volume: Number(e.target.value) })} />
              </label>
              <button type="button" onClick={() => playTone(sound.tone, sound.volume)} className="min-h-9 rounded-md bg-burgundy text-xs font-semibold text-ivory">Test sound</button>
            </div>
          )}
        </div>
      </KDSHeader>

      {ringKey && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-amber-950">
          <span className="flex items-center gap-2 text-base font-bold"><BellRing className="size-5 animate-pulse" aria-hidden="true" />
            {ringing.length} new order{ringing.length > 1 ? 's' : ''} waiting. The alert repeats until you start {ringing.length > 1 ? 'them' : 'it'}.</span>
          <button type="button" onClick={stopAlert} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700">
            <BellOff className="size-4" aria-hidden="true" /> Stop alert
          </button>
        </div>
      )}
      {!muted && blocked && (
        <button type="button" onClick={() => { void unlockAudio().then((ok) => setBlocked(!ok)); }}
          className="min-h-11 rounded-xl border border-dashed border-rose-400 bg-rose-50 px-4 text-sm font-semibold text-rose-800">
          Sound is blocked by the browser. Tap here once to turn on order alerts.
        </button>
      )}
      {board.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
          <span className="flex items-center gap-2">{offline ? <WifiOff className="size-4" /> : null}
            {offline ? 'Connection lost. Tickets may be out of date; retrying automatically.' : (board.error as Error).message}</span>
          <button type="button" onClick={() => board.refetch()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-100 px-3 font-semibold hover:bg-rose-200">
            <RefreshCw className="size-4" /> Retry now
          </button>
        </div>
      )}
      {device.isKitchenPrinter && device.method === 'bluetooth' && !device.connected && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-3 text-rose-900">
          <span className="flex items-center gap-2 text-sm font-bold"><Printer className="size-5" aria-hidden="true" />
            Kitchen printer is not connected.{waitingKots ? ` ${waitingKots} KOT${waitingKots > 1 ? 's' : ''} waiting to print.` : ''}</span>
          <button type="button" onClick={() => pairPrinter().then(() => setPrintError(null), (e) => setPrintError(e.message))}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800">
            <Bluetooth className="size-4" aria-hidden="true" /> Connect printer
          </button>
        </div>
      )}
      {printError && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">Printing failed: {printError}</p>}
      <ErrorNote error={move.error ?? rush.error ?? kot.error} />

      {/* One lane at a time on narrow screens */}
      <Segmented label="Ticket lane" className="w-full @3xl:hidden" value={lane} onChange={setLane}
        options={lanes.map((l) => ({ id: l.key, label: l.label, count: l.list.length }))} />

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
        {lanes.map((l) => (
          <section key={l.key} aria-label={l.label} className={`${lane === l.key ? 'flex' : 'hidden'} min-h-80 min-w-0 flex-col rounded-2xl border p-4 @3xl:flex ${l.color}`}>
            <h2 className="mb-3 flex items-center justify-between border-b border-border pb-3 text-sm font-extrabold text-ink">
              {l.label}<span className={`grid size-6 place-items-center rounded-full font-mono text-xs ${l.badgeColor}`}>{l.list.length}</span>
            </h2>
            <div className="grid flex-1 content-start gap-3">
              {!l.list.length && <p className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">No tickets</p>}
              {l.list.map((o) => (
                <KDSTicketCard
                  key={o.id}
                  ticket={toTicket(o)}
                  laneKey={l.key}
                  onAdvance={(t) => move.mutate({ id: t.order_id, status: NEXT_OF[l.key] })}
                  onBump={(t) => move.mutate({ id: t.order_id, status: 'DELIVERED' })}
                  onTogglePriority={(t) => rush.mutate({ id: t.order_id, on: !t.is_rush_priority })}
                  onPrintKOT={async (t) => {
                    const order = byId.get(t.order_id);
                    if (!order) return;
                    try {
                      await printKotManually(order, cfg.data, restaurant, (id) => kot.mutateAsync(id));
                    } catch (e) { setPrintError(`${order.orderNumber}: ${(e as Error).message}`); }
                  }}
                  extraActions={canCancel && l.key !== 'ready' ? (
                    <button type="button" onClick={() => {
                      const reason = window.prompt(`Cancel ${o.orderNumber}? Reason:`);
                      if (reason !== null) fnbService.setStatus(o.id, 'CANCELLED', reason || undefined).then(done, (e) => alert(e.message));
                    }} className="flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium text-rose-700 hover:bg-rose-50">
                      <X className="size-3" /> Cancel
                    </button>
                  ) : null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      {!orders.length && <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Zap className="size-4" /> All clear. New orders appear here by themselves.</p>}
    </div>
  );
};
