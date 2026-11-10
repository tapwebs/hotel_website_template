import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Banknote, BedDouble, CreditCard, Printer, Smartphone, Split } from 'lucide-react';
import { fnbService } from '../../../../services/fnbService';
import { useAuthStore } from '../../../../stores/authStore';
import type { FnbConfig, PaymentMethod } from '../../../../types/fnb';
import type { POSOrder } from '../../../../types/pms';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { ErrorNote, rupees, where } from '../fnbUi';
import { printReceipt, playOrderCompleteSound } from '../printing';
import { taxBreakdown, totalTax } from '../../../../utils/tax';
import { buildUpiUri, publishDisplay } from '../../../../utils/customerDisplay';

const field = 'min-h-10 rounded-lg border border-input bg-card px-3 text-sm font-normal text-ink';
const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: 'CASH', label: 'Cash', icon: <Banknote className="size-4" /> },
  { id: 'UPI', label: 'UPI', icon: <Smartphone className="size-4" /> },
  { id: 'CARD', label: 'Card', icon: <CreditCard className="size-4" /> },
  { id: 'SPLIT', label: 'Split', icon: <Split className="size-4" /> },
  { id: 'ROOM', label: 'Charge to room', icon: <BedDouble className="size-4" /> },
];
const toPaise = (s: string) => Math.round((Number(s) || 0) * 100);

/** Take payment for a dine-in, takeaway or counter bill: cash with change, UPI, card, split, or charge to an in-house room. */
export const SettleModal: React.FC<{ order: POSOrder | null; cfg?: FnbConfig; onClose: () => void; onDone: (o: POSOrder) => void }> = ({ order, cfg, onClose, onDone }) => {
  const propertyName = useAuthStore((s) => s.session?.activePropertyName) ?? 'Dream Heavens';
  // Captains and admins (APPLY_DISCOUNT) discount up to the no-PIN limit; waiters need the manager PIN for any discount.
  const canDiscount = useAuthStore((s) => s.hasPermission('APPLY_DISCOUNT'));
  const isAdmin = useAuthStore((s) => s.hasPermission('MANAGE_SETTINGS'));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tendered, setTendered] = useState('');
  const [cash, setCash] = useState('');
  const [mode, setMode] = useState<'none' | 'amount' | 'percent' | 'coupon'>('none');
  const [discount, setDiscount] = useState('');
  const [coupon, setCoupon] = useState('');
  const [pin, setPin] = useState('');
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const rooms = useQuery({ queryKey: ['fnb', 'roomQr'], queryFn: fnbService.roomQr, enabled: !!order && method === 'ROOM' });

  const sub = order?.subtotalPaise ?? 0;
  const pct = order?.taxPercent ?? cfg?.gstPercent ?? 5;
  const disc = useMemo(() => {
    if (mode === 'amount') return Math.min(sub, toPaise(discount));
    if (mode === 'percent') return Math.min(sub, Math.round((sub * (Number(discount) || 0)) / 100));
    return order?.discountPaise ?? 0;
  }, [mode, discount, sub, order]);
  const taxRows = useMemo(() => taxBreakdown(order?.items ?? [], disc, pct), [order, disc, pct]);
  const tax = totalTax(taxRows);
  const raw = sub - disc + tax;
  // Same rule as the server: round to the nearest rupee, except when the bill goes on a room folio.
  const roundOff = cfg?.roundOffTotal && method !== 'ROOM' ? Math.floor((raw + 50) / 100) * 100 - raw : 0;
  const total = mode === 'coupon' ? null : raw + roundOff; // a coupon is priced by the server
  const manual = (mode === 'amount' || mode === 'percent') && disc > 0;
  const needsPin = manual && !isAdmin && (!canDiscount || disc * 100 > sub * (cfg?.maxDiscountPercentWithoutPin ?? 10));
  const change = total != null && method === 'CASH' && tendered ? toPaise(tendered) - total : null;

  const settle = useMutation({
    mutationFn: () => fnbService.settle(order!.id, {
      method,
      tenderedPaise: method === 'CASH' && tendered ? toPaise(tendered) : undefined,
      split: method === 'SPLIT' && total != null ? { cash: toPaise(cash), digital: total - toPaise(cash) } : undefined,
      discountPaise: mode === 'amount' || mode === 'percent' ? disc : undefined,
      couponCode: mode === 'coupon' ? coupon.trim() : undefined,
      managerPin: pin || undefined,
      roomNumber: method === 'ROOM' ? room : undefined,
      customerName: name.trim() || undefined,
      customerPhone: phone.trim() || undefined,
    }),
    onSuccess: (o) => {
      playOrderCompleteSound(cfg?.soundVolume);
      onDone(o);
    },
  });

  if (!order) return null;
  const ready = method !== 'ROOM' || !!room;
  return (
    <Modal isOpen={!!order} onClose={onClose} title={`Settle ${order.orderNumber} · ${where(order)}`} maxWidth="lg">
      <div className="grid gap-4">
        <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
          {order.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-2 px-3 py-1.5">
              <span>{i.quantity} × {i.name}{i.variantName ? ` (${i.variantName})` : ''}{i.addOns?.length ? <small className="block text-muted-foreground">+ {i.addOns.join(', ')}</small> : null}</span>
              <span className="tabular-nums">{rupees(i.pricePaise * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <fieldset className="grid gap-2">
          <legend className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Discount</legend>
          <div className="flex flex-wrap gap-2">
            {(['none', 'amount', 'percent', 'coupon'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${mode === m ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut'}`}>
                {m === 'none' ? (order.couponCode ? `Keep ${order.couponCode}` : 'None') : m === 'amount' ? '₹ off' : m === 'percent' ? '% off' : 'Coupon'}
              </button>
            ))}
          </div>
          {(mode === 'amount' || mode === 'percent') && (
            <input aria-label="Discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={mode === 'amount' ? 'Amount in ₹' : 'Percent'} className={field} />
          )}
          {mode === 'coupon' && <input aria-label="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className={`${field} font-mono uppercase`} />}
          {needsPin && (
            <label className="grid gap-1 text-xs font-semibold text-walnut">{canDiscount ? `Manager PIN (above ${cfg?.maxDiscountPercentWithoutPin ?? 10}%)` : 'Manager PIN (only captains and admins can give discounts)'}
              <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} className={field} />
            </label>
          )}
        </fieldset>

        <dl className="grid gap-1 rounded-lg bg-gold-soft/25 p-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{rupees(sub)}</dd></div>
          {mode !== 'coupon' && disc > 0 && <div className="flex justify-between text-emerald-800"><dt>Discount</dt><dd className="tabular-nums">−{rupees(disc)}</dd></div>}
          {mode !== 'coupon' && taxRows.map((r) => (
            <div key={r.percent} className="flex justify-between text-muted-foreground"><dt>CGST {r.percent / 2}% + SGST {r.percent / 2}%</dt><dd className="tabular-nums">{rupees(r.taxPaise)}</dd></div>
          ))}
          {mode !== 'coupon' && roundOff !== 0 && (
            <div className="flex justify-between text-muted-foreground"><dt>Round off</dt><dd className="tabular-nums">{roundOff > 0 ? '+' : '−'}{rupees(Math.abs(roundOff))}</dd></div>
          )}
          <div className="flex justify-between text-base font-bold text-ink"><dt>Total</dt><dd className="tabular-nums">{total == null ? 'Applied on confirm' : rupees(total)}</dd></div>
        </dl>

        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${method === m.id ? 'border-burgundy bg-burgundy/10 text-burgundy ring-2 ring-burgundy' : 'border-border bg-ivory text-walnut'}`}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>
        {method === 'CASH' && (
          <label className="grid gap-1 text-sm font-semibold text-walnut">Cash received (₹)
            <input inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} className={field} placeholder="Optional" />
            {change != null && <span className={`text-sm ${change < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{change < 0 ? `Short by ${rupees(-change)}` : `Change ${rupees(change)}`}</span>}
          </label>
        )}
        {method === 'SPLIT' && total != null && (
          <label className="grid gap-1 text-sm font-semibold text-walnut">Cash part (₹); the rest is UPI or card
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} className={field} />
            <span className="text-xs font-normal text-muted-foreground">Digital: {rupees(Math.max(0, total - toPaise(cash)))}</span>
          </label>
        )}
        {method === 'ROOM' && (
          <label className="grid gap-1 text-sm font-semibold text-walnut">In-house room
            <select value={room} onChange={(e) => setRoom(e.target.value)} className={field}>
              <option value="">Choose a room</option>
              {(rooms.data ?? []).map((r) => <option key={r.stayId} value={r.roomNumber}>{r.roomNumber} · {r.guestName}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Customer name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name (optional)" className={field} />
          <input aria-label="Customer phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={field} />
        </div>
        <ErrorNote error={settle.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => printReceipt({ ...order, discountPaise: disc, taxPaise: tax, totalPaise: total ?? order.totalPaise, roundOffPaise: total == null ? order.roundOffPaise : roundOff }, cfg ?? {}, propertyName)}>
            <Printer className="size-4" /> Print bill
          </Button>
          <Button type="button" disabled={!ready} isLoading={settle.isPending} onClick={() => settle.mutate()}>Confirm payment</Button>
        </div>
      </div>
    </Modal>
  );
};
