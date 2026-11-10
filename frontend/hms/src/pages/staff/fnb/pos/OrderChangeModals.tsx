import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { fnbService } from '../../../../services/fnbService';
import type { POSOrder, POSTable } from '../../../../types/pms';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { ErrorNote, rupees, titleCase, where } from '../fnbUi';

const field = 'min-h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink';
const REASONS = ['Guest changed mind', 'Out of stock', 'Wrong dish ordered', 'Taking too long', 'Quality issue'];

/** Cancel some dishes on an order (captains and admins). Cancelling every dish cancels the order. */
export const CancelDishesModal: React.FC<{ order: POSOrder; onClose: () => void; onDone: () => void }> = ({ order, onClose, onDone }) => {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]);
  const [other, setOther] = useState('');
  const lines = order.items.filter((i) => i.lineId);
  const picked = lines.filter((l) => (qty[l.lineId!] ?? 0) > 0);
  const why = reason === 'Other' ? other.trim() : reason;
  const save = useMutation({
    mutationFn: async () => {
      // One call per dish; the server reprices and, for room service, corrects the folio each time.
      for (const l of picked) await fnbService.voidItem(order.id, l.lineId!, qty[l.lineId!], why);
    },
    onSuccess: () => { onDone(); onClose(); },
    onError: () => onDone(), // some dishes may have gone through; refresh either way
  });
  const all = picked.length === lines.length && picked.every((l) => qty[l.lineId!] === l.quantity);
  const set = (id: string, n: number, max: number) => setQty({ ...qty, [id]: Math.max(0, Math.min(max, n)) });

  return (
    <Modal isOpen onClose={onClose} title={`Cancel dishes · ${where(order)}`} subtitle={order.orderNumber} maxWidth="md">
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (picked.length && why) save.mutate(); }}>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lines.map((l) => {
            const n = qty[l.lineId!] ?? 0;
            return (
              <li key={l.lineId} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium text-ink">{l.quantity} × {l.name}{l.variantName ? ` (${l.variantName})` : ''}</span>
                  <span className="text-xs text-muted-foreground">{rupees(l.pricePaise)} each</span>
                </span>
                <span className="inline-flex items-center rounded-lg border border-border">
                  <button type="button" aria-label={`Cancel one fewer ${l.name}`} className="grid size-9 place-items-center" onClick={() => set(l.lineId!, n - 1, l.quantity)}><Minus className="size-3.5" /></button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{n}</span>
                  <button type="button" aria-label={`Cancel one more ${l.name}`} className="grid size-9 place-items-center" onClick={() => set(l.lineId!, n + 1, l.quantity)}><Plus className="size-3.5" /></button>
                </span>
              </li>
            );
          })}
        </ul>
        <label className="grid gap-1 text-sm font-semibold text-walnut">Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
            {[...REASONS, 'Other'].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        {reason === 'Other' && <input aria-label="Reason" required maxLength={200} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Why are these cancelled?" className={field} />}
        {all && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">Every dish is selected, so the whole order will be cancelled{order.orderType === 'ROOM_SERVICE' ? ' and the room charge reversed' : ''}.</p>}
        <p className="text-xs text-muted-foreground">If the kitchen already has these dishes on paper, the kitchen printer prints a cancellation slip.</p>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Keep dishes</Button>
          <Button type="submit" variant="destructive" disabled={!picked.length || !why} isLoading={save.isPending}>
            Cancel {picked.reduce((n, l) => n + qty[l.lineId!], 0) || ''} dish{picked.reduce((n, l) => n + qty[l.lineId!], 0) === 1 ? '' : 'es'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/** Move a dine-in order, or the whole party, to another table (captains and admins). */
export const MoveTableModal: React.FC<{ order: POSOrder; tables: POSTable[]; onClose: () => void; onDone: () => void }> = ({ order, tables, onClose, onDone }) => {
  const [target, setTarget] = useState('');
  const [all, setAll] = useState(true);
  const others = tables.filter((t) => t.tableNumber !== order.tableNumber && t.status !== 'MAINTENANCE' && t.isActive !== false);
  const save = useMutation({ mutationFn: () => fnbService.moveOrder(order.id, target, all), onSuccess: () => { onDone(); onClose(); } });
  return (
    <Modal isOpen onClose={onClose} title={`Move from table ${order.tableNumber}`} subtitle={order.orderNumber} maxWidth="md">
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (target) save.mutate(); }}>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-walnut">New table</legend>
          <div className="flex flex-wrap gap-2">
            {others.map((t) => (
              <button key={t.id} type="button" aria-pressed={target === t.id} onClick={() => setTarget(t.id)}
                title={`${titleCase(t.section)} · seats ${t.capacity} · ${titleCase(t.status)}`}
                className={`min-h-11 min-w-14 rounded-lg border px-3 text-sm font-semibold ${target === t.id ? 'border-burgundy bg-burgundy text-ivory' : t.status === 'AVAILABLE' ? 'border-border bg-ivory text-walnut' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                {t.tableNumber}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Amber tables already have guests; moving there joins the bills on one table.</p>
        </fieldset>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="mt-1 size-4 accent-burgundy" />
          <span>Move every open order on table {order.tableNumber} <span className="block text-xs text-muted-foreground">Leave on when the whole party changes tables.</span></span>
        </label>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="submit" disabled={!target} isLoading={save.isPending}>Move</Button>
        </div>
      </form>
    </Modal>
  );
};
