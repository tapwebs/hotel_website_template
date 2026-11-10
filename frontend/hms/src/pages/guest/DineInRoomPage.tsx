import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChefHat, Minus, Plus, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
import { diningApi } from '../../services/fnbService';
import type { GuestOrder } from '../../types/fnb';
import { ErrorNote, VegDot, rupees, titleCase } from '../staff/fnb/fnbUi';

const STEPS: Record<string, { label: string; hint: string; done: number }> = {
  QUEUED: { label: 'Order received', hint: 'The kitchen will start soon.', done: 1 },
  PREPARING: { label: 'Being prepared', hint: 'Your food is on the stove.', done: 2 },
  READY: { label: 'On its way', hint: 'Coming to your door.', done: 3 },
  DELIVERED: { label: 'Delivered', hint: 'Enjoy your meal.', done: 4 },
  BILLED: { label: 'Delivered', hint: 'Enjoy your meal.', done: 4 },
  CANCELLED: { label: 'Cancelled', hint: 'This order was cancelled and will not be charged.', done: 0 },
};
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-burgundy/40 ${on ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut'}`;

/** Public, phone-first page a guest opens from the QR card in their room. The token in the URL is the only credential. */
export const DineInRoomPage: React.FC = () => {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState('ALL');
  const [review, setReview] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => { document.title = 'In-room dining'; }, []);
  const info = useQuery({ queryKey: ['dine', token], queryFn: () => diningApi.info(token), retry: false, refetchInterval: 60_000 });
  const orders = useQuery({ queryKey: ['dine', token, 'orders'], queryFn: () => diningApi.orders(token), enabled: info.isSuccess, refetchInterval: 8_000 });

  const menu = info.data?.menu ?? [];
  const categories = useMemo(() => ['ALL', ...Array.from(new Set(menu.map((i) => i.category)))], [menu]);
  const shown = menu.filter((i) => category === 'ALL' || i.category === category);
  const lines = Object.entries(cart).flatMap(([id, quantity]) => { const item = menu.find((i) => i.id === id); return item && quantity > 0 ? [{ item, quantity }] : []; });
  const subtotal = lines.reduce((n, l) => n + l.item.pricePaise * l.quantity, 0);
  const rate = info.data?.taxRatePercent ?? 5;
  const tax = Math.floor((subtotal * rate + 50) / 100);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const bump = (id: string, by: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] ?? 0) + by)) }));

  const place = useMutation({
    mutationFn: () => diningApi.place(token, lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })), notes.trim()),
    onSuccess: () => { setCart({}); setNotes(''); setReview(false); qc.invalidateQueries({ queryKey: ['dine', token] }); },
  });
  const cancel = useMutation({ mutationFn: (no: string) => diningApi.cancel(token, no), onSuccess: () => qc.invalidateQueries({ queryKey: ['dine', token, 'orders'] }) });

  if (info.isLoading) return <Shell><p className="py-24 text-center text-walnut" role="status">Loading the menu…</p></Shell>;
  if (info.error || !info.data) {
    const gone = (info.error as { status?: number } | null)?.status === 404;
    return (
      <Shell>
        <div className="mx-auto max-w-sm py-20 text-center">
          <UtensilsCrossed className="mx-auto mb-4 size-8 text-burgundy" />
          <h1 className="font-serif text-2xl text-ink">{gone ? 'This link has expired' : 'We could not load the menu'}</h1>
          <p className="mt-2 text-sm text-walnut">{gone ? 'Please ask the front desk for a new ordering card for your room.' : (info.error as Error)?.message}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="pt-6 pb-4">
        <p className="text-xs font-bold tracking-[0.18em] text-burgundy uppercase">{info.data.propertyName}</p>
        <h1 className="font-serif text-3xl text-ink">In-room dining</h1>
        <p className="text-sm text-walnut">Room {info.data.roomNumber} · Hello, {info.data.guestFirstName}. Food is charged to your room.</p>
      </header>

      {!!orders.data?.length && (
        <section aria-label="Your orders" className="mb-6 grid gap-3">
          <h2 className="text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">Your orders</h2>
          {orders.data.map((o) => <OrderCard key={o.orderNumber} o={o} busy={cancel.isPending} onCancel={() => window.confirm('Cancel this order?') && cancel.mutate(o.orderNumber)} />)}
          <ErrorNote error={cancel.error} />
        </section>
      )}

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Menu categories">
        {categories.map((c) => <button key={c} aria-pressed={category === c} className={chip(category === c)} onClick={() => setCategory(c)}>{c === 'ALL' ? 'All' : titleCase(c)}</button>)}
      </div>
      <ul className="grid gap-2 pb-28">
        {shown.map((i) => {
          const qty = cart[i.id] ?? 0;
          return (
            <li key={i.id} className="flex items-start gap-3 rounded-xl border border-border bg-ivory p-3">
              <span className="mt-1"><VegDot veg={i.isVeg} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{i.name}</p>
                <p className="text-xs text-walnut">{i.description}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-burgundy">{rupees(i.pricePaise)}</p>
              </div>
              {qty === 0 ? (
                <button onClick={() => bump(i.id, 1)} aria-label={`Add ${i.name}`} className="grid size-11 place-items-center rounded-full border border-burgundy text-burgundy outline-none focus-visible:ring-[3px] focus-visible:ring-burgundy/40"><Plus className="size-5" /></button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-burgundy text-ivory">
                  <button aria-label={`Remove one ${i.name}`} onClick={() => bump(i.id, -1)} className="grid size-11 place-items-center"><Minus className="size-4" /></button>
                  <span className="w-5 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
                  <button aria-label={`Add one ${i.name}`} onClick={() => bump(i.id, 1)} className="grid size-11 place-items-center"><Plus className="size-4" /></button>
                </span>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="py-10 text-center text-sm text-walnut">Nothing available in this category right now.</li>}
      </ul>

      {count > 0 && !review && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-ivory/95 p-3 backdrop-blur">
          <button onClick={() => setReview(true)} className="mx-auto flex min-h-12 w-full max-w-xl items-center justify-between rounded-xl bg-burgundy px-5 font-semibold text-ivory outline-none focus-visible:ring-[3px] focus-visible:ring-gold">
            <span className="flex items-center gap-2"><ShoppingBag className="size-5" /> View order · {count}</span>
            <span className="tabular-nums">{rupees(subtotal + tax)}</span>
          </button>
        </div>
      )}

      {review && (
        <div role="dialog" aria-modal="true" aria-label="Review your order" className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-ivory p-5 sm:max-w-lg sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-ink">Your order</h2>
              <button aria-label="Close" onClick={() => setReview(false)} className="grid size-10 place-items-center rounded-full hover:bg-gold-soft/40"><X className="size-5" /></button>
            </div>
            <ul className="divide-y divide-border">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-sm text-ink">{item.name}</span>
                  <button aria-label={`Remove one ${item.name}`} onClick={() => bump(item.id, -1)} className="grid size-9 place-items-center rounded-full border border-border"><Minus className="size-4" /></button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                  <button aria-label={`Add one ${item.name}`} onClick={() => bump(item.id, 1)} className="grid size-9 place-items-center rounded-full border border-border"><Plus className="size-4" /></button>
                  <span className="w-16 text-right text-sm tabular-nums">{rupees(item.pricePaise * quantity)}</span>
                </li>
              ))}
            </ul>
            <label className="mt-3 grid gap-1 text-sm font-semibold text-walnut">Note for the kitchen (optional)
              <textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, spice level…" className="rounded-lg border border-input bg-card px-3 py-2 font-normal" />
            </label>
            <dl className="mt-3 grid gap-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-walnut">Subtotal</dt><dd className="tabular-nums">{rupees(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-walnut">GST {rate}%</dt><dd className="tabular-nums">{rupees(tax)}</dd></div>
              <div className="flex justify-between text-base font-bold text-ink"><dt>Total, charged to room {info.data.roomNumber}</dt><dd className="tabular-nums">{rupees(subtotal + tax)}</dd></div>
            </dl>
            <div className="mt-3"><ErrorNote error={place.error} /></div>
            <button disabled={place.isPending || !count} onClick={() => place.mutate()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-burgundy font-semibold text-ivory outline-none focus-visible:ring-[3px] focus-visible:ring-gold disabled:opacity-50">
              <ChefHat className="size-5" /> {place.isPending ? 'Placing order…' : 'Place order'}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-background">
    <main className="mx-auto w-full max-w-xl px-4">{children}</main>
  </div>
);

const OrderCard: React.FC<{ o: GuestOrder; busy: boolean; onCancel: () => void }> = ({ o, busy, onCancel }) => {
  const s = STEPS[o.status] ?? STEPS.QUEUED;
  return (
    <article className="grid gap-2 rounded-xl border border-border bg-ivory p-3">
      <header className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{s.label}</p>
        <span className="font-mono text-xs text-muted-foreground">{o.orderNumber}</span>
      </header>
      {s.done > 0 && (
        <ol className="flex gap-1" aria-label="Progress">
          {[1, 2, 3, 4].map((n) => <li key={n} className={`h-1.5 flex-1 rounded-full ${n <= s.done ? 'bg-burgundy' : 'bg-border'}`} />)}
        </ol>
      )}
      <p className="text-xs text-walnut">{s.hint}</p>
      <ul className="text-sm text-ink">{o.items.map((it, n) => <li key={n}>{it.quantity} × {it.name}</li>)}</ul>
      <footer className="flex items-center justify-between">
        <span className="text-sm font-semibold tabular-nums">{rupees(o.totalPaise)}</span>
        {o.canCancel ? <button disabled={busy} onClick={onCancel} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">Cancel order</button> : o.status === 'DELIVERED' || o.status === 'BILLED' ? <Check className="size-4 text-emerald-700" aria-hidden /> : null}
      </footer>
    </article>
  );
};
