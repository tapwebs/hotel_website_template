import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, ChevronDown, ChevronUp, Volume2, VolumeX, X, Radio } from 'lucide-react';
import { fnbService } from '../../services/fnbService';
import { useAuthStore } from '../../stores/authStore';
import type { POSOrder } from '../../types/pms';
import { audioBlocked, playTone, playLoudOrderRing, playOrderAcceptSound, unlockAudio } from '../../pages/staff/fnb/printing';
import { rupees, where } from '../../pages/staff/fnb/fnbUi';
import { ringsFor } from '../../pages/staff/fnb/guestAlertRules';

/** When the order started waiting: online-paid orders only wait once the payment came in. */
const waitingSince = (o: POSOrder) => new Date(o.paidAt ?? o.createdAt).getTime();

const minutes = (ms: number) => (ms < 60_000 ? 'just now' : `${Math.floor(ms / 60_000)} min`);

/** Floating panel on every staff screen: guest orders from /menu waiting to be accepted, with a repeating alert. */
export const GuestOrderAlerts: React.FC = () => {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const can = useAuthStore((s) => s.hasPermission);
  const allowed = can('ACCEPT_GUEST_ORDERS');
  const canReject = can('CANCEL_FNB_ORDERS');
  const cfg = useQuery({ queryKey: ['fnb', 'config'], queryFn: fnbService.config, staleTime: 60_000, enabled: allowed });
  const pending = useQuery({
    queryKey: ['fnb', 'pending'],
    queryFn: fnbService.pendingGuestOrders,
    enabled: allowed && cfg.data?.guestOrderAcceptance !== false,
    refetchInterval: () => (typeof document !== 'undefined' && document.hidden ? 15_000 : 5_000),
    refetchIntervalInBackground: true,
    placeholderData: (p) => p,
    retry: 1,
  });
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(audioBlocked());
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [keepRingingOverride, setKeepRingingOverride] = useState<boolean | null>(null);

  const conf = {
    ringWaitersForGuestOrders: true,
    acceptanceEscalationMinutes: 2,
    alertRepeatSeconds: 3,
    soundTone: 'phone' as const,
    soundVolume: 90,
    keepRinging: true,
    ...cfg.data,
    ...(keepRingingOverride !== null ? { keepRinging: keepRingingOverride } : {}),
  };

  const done = () => { void qc.invalidateQueries({ queryKey: ['fnb'] }); };
  const accept = useMutation({
    mutationFn: (id: string) => fnbService.acceptOrder(id),
    onSuccess: () => {
      playOrderAcceptSound(conf.soundVolume);
    },
    onSettled: done,
  });
  const reject = useMutation({ mutationFn: (v: { id: string; reason: string }) => fnbService.setStatus(v.id, 'CANCELLED', v.reason), onSettled: done });

  const orders = pending.data ?? [];
  const hasOrders = orders.length > 0;
  useEffect(() => {
    if (!hasOrders) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, [hasOrders]);

  const rows = useMemo(() => orders.map((o) => ({ o, waited: now - waitingSince(o), ...ringsFor(session?.role, conf, now - waitingSince(o)) })),
    [orders, now, session?.role, conf.ringWaitersForGuestOrders, conf.acceptanceEscalationMinutes]); // eslint-disable-line react-hooks/exhaustive-deps
  const ringing = rows.filter((r) => r.ring && !snoozed.has(r.o.id));
  const urgent = ringing.some((r) => r.escalated);
  // Opens by itself when something starts ringing for this user; otherwise it stays a small bar out of the way.
  const ringKey = ringing.map((r) => `${r.o.id}:${r.escalated}`).join();
  useEffect(() => { if (ringKey) setOpen(true); }, [ringKey]);

  // Repeat the tone while something is ringing; keep ringing repeats every 2.8s until accepted or silenced.
  useEffect(() => {
    if (!ringing.length) return;
    const ring = () => {
      if (conf.soundTone === 'phone' || conf.keepRinging) {
        playLoudOrderRing(conf.soundVolume, urgent);
      } else {
        playTone(conf.soundTone, conf.soundVolume, urgent);
      }
      // Browsers only allow vibration after the user has touched the page once.
      if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) {
        navigator.vibrate?.(urgent ? [350, 150, 350, 150, 350] : [250, 120, 250]);
      }
    };
    ring();
    const intervalSec = conf.keepRinging ? 2.8 : Math.max(3, conf.alertRepeatSeconds);
    const t = setInterval(ring, intervalSec * 1000);
    return () => clearInterval(t);
  }, [ringing.length, urgent, conf.soundTone, conf.soundVolume, conf.alertRepeatSeconds, conf.keepRinging]); // eslint-disable-line react-hooks/exhaustive-deps

  // A pop-up notification when this tab is in the background (needs the browser to stay open).
  const notified = useRef(new Set<string>());
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    for (const r of ringing) {
      const key = `${r.o.id}:${r.escalated}`;
      if (notified.current.has(key)) continue;
      notified.current.add(key);
      new Notification(r.escalated ? `Not accepted for ${minutes(r.waited)}: ${r.o.orderNumber}` : `New guest order ${r.o.orderNumber}`, {
        body: `${where(r.o)} · ${r.o.items.length} item${r.o.items.length > 1 ? 's' : ''} · ${rupees(r.o.totalPaise)}`,
        tag: r.o.id,
        requireInteraction: true,
      });
    }
  }, [ringing.map((r) => `${r.o.id}:${r.escalated}`).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unlock = () => { void unlockAudio().then((ok) => setBlocked(!ok)); };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (!allowed || !orders.length) return null;
  const err = (accept.error ?? reject.error) as Error | null;

  return (
    <aside
      aria-label="Guest orders waiting to be accepted"
      className={`fixed top-[4.5rem] right-3 z-40 w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-2 bg-ivory shadow-2xl md:right-6 ${urgent ? 'border-rose-500' : 'border-amber-500'}`}
    >
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-white transition-colors ${urgent ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <BellRing className={`size-5 shrink-0 ${ringing.length ? 'animate-pulse' : ''}`} aria-hidden="true" />
          <div className="truncate">
            <span role="status" aria-live="assertive">
              {orders.length} guest order{orders.length > 1 ? 's' : ''} waiting
            </span>
            <span className="block text-[11px] font-medium opacity-90">
              {urgent ? '🚨 Escalated (> 2m) · Ringing Admins & Captains' : '🔔 Ringing Captains & Waiters'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
        </div>
      </button>
      {open && (
        <div className="max-h-[min(60vh,32rem)] space-y-2.5 overflow-y-auto p-3">
          {/* Quick controls bar: Keep ringing toggle & Silence all */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-gold-soft/20 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => setKeepRingingOverride(!conf.keepRinging)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                conf.keepRinging ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-ivory text-muted-foreground border border-border'
              }`}
              title="When enabled, orders keep ringing continuously every 3 seconds until accepted or silenced"
            >
              <Radio className="size-3.5" /> Keep ringing: {conf.keepRinging ? 'ON' : 'OFF'}
            </button>
            {ringing.length > 0 && (
              <button
                type="button"
                onClick={() => setSnoozed(new Set([...snoozed, ...orders.map((o) => o.id)]))}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-ivory px-2.5 py-1 text-xs font-medium text-walnut hover:bg-gold-soft/40"
              >
                <VolumeX className="size-3.5 text-rose-600" /> Silence all
              </button>
            )}
          </div>

          {blocked && ringing.length > 0 && (
            <button type="button" onClick={() => { void unlockAudio().then((ok) => setBlocked(!ok)); }}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-rose-400 bg-rose-50 text-xs font-semibold text-rose-800 animate-pulse">
              <Volume2 className="size-4" aria-hidden="true" /> Tap once to turn on loud order ringing
            </button>
          )}
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
            <button type="button" onClick={() => void Notification.requestPermission()}
              className="min-h-9 w-full rounded-lg border border-border text-xs font-semibold text-walnut hover:bg-gold-soft/30">
              Also alert me when this tab is in the background
            </button>
          )}
          {err && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{err.message}</p>}
          {rows.map(({ o, waited, escalated }) => (
            <article key={o.id} className={`space-y-2 rounded-xl border p-3 ${escalated ? 'border-rose-300 bg-rose-50' : 'border-border bg-cream/40'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{where(o)} · <span className="font-mono">{o.orderNumber}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {o.guestName && o.guestName !== 'Guest' ? `${o.guestName} · ` : ''}{rupees(o.totalPaise)}{o.paidAt ? ' · paid online' : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${escalated ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-900'}`}>
                  {minutes(waited)}
                </span>
              </div>
              <ul className="text-xs text-ink">
                {o.items.map((i, n) => <li key={n}>{i.quantity} × {i.name}{i.variantName ? ` (${i.variantName})` : ''}</li>)}
              </ul>
              {o.notes && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Note: {o.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={accept.isPending} onClick={() => accept.mutate(o.id)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
                  <Check className="size-4" aria-hidden="true" /> Accept & send to kitchen
                </button>
                {canReject && (
                  <button type="button" onClick={() => {
                    const reason = window.prompt(`Reject ${o.orderNumber}? Tell the guest why:`, 'Item not available');
                    if (reason !== null) reject.mutate({ id: o.id, reason: reason || 'Rejected' });
                  }} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                    <X className="size-4" aria-hidden="true" /> Reject
                  </button>
                )}
                {!snoozed.has(o.id) && ringsFor(session?.role, conf, waited).ring && (
                  <button type="button" onClick={() => setSnoozed(new Set([...snoozed, o.id]))}
                    className="min-h-11 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-ink">Silence</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
};
