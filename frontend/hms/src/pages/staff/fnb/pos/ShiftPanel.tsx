import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { fnbService } from '../../../../services/fnbService';
import type { Shift } from '../../../../types/fnb';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { ErrorNote, rupees } from '../fnbUi';

const field = 'min-h-10 rounded-lg border border-input bg-card px-3 text-sm font-normal text-ink';

/** Cash drawer shift: opening float, expected cash (float + cash sales), counted cash and variance at close. */
export const ShiftPanel: React.FC = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [closed, setClosed] = useState<Shift | null>(null);
  const active = useQuery({ queryKey: ['fnb', 'shift'], queryFn: fnbService.activeShift, refetchInterval: 60_000 });
  const history = useQuery({ queryKey: ['fnb', 'shifts'], queryFn: fnbService.shifts, enabled: open });
  const shift = active.data?.shift ?? null;
  const done = () => { setAmount(''); qc.invalidateQueries({ queryKey: ['fnb'] }); };
  const start = useMutation({ mutationFn: () => fnbService.openShift(Math.round(Number(amount) * 100)), onSuccess: done });
  const end = useMutation({ mutationFn: () => fnbService.closeShift(Math.round(Number(amount) * 100)), onSuccess: (s) => { setClosed(s); done(); } });

  return (
    <>
      <button type="button" onClick={() => { setClosed(null); setOpen(true); }}
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${shift ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
        <Wallet className="size-4" /> {shift ? <>Drawer <span className="tabular-nums">{rupees(shift.expectedCashPaise)}</span></> : 'Open cash shift'}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Cash shift" maxWidth="md">
        <div className="grid gap-4">
          {closed && (
            <div role="status" className={`rounded-lg border p-3 text-sm ${closed.variancePaise === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
              <p className="font-semibold">Shift closed</p>
              <p>Expected {rupees(closed.expectedCashPaise)} · Counted {rupees(closed.closingCashPaise ?? 0)}</p>
              <p className="font-bold">Variance {closed.variancePaise! >= 0 ? '+' : '−'}{rupees(Math.abs(closed.variancePaise ?? 0))}{closed.variancePaise === 0 ? ' (balanced)' : ''}</p>
            </div>
          )}
          {shift ? (
            <>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-gold-soft/25 p-2"><dt className="text-xs text-muted-foreground">Opening float</dt><dd className="font-semibold">{rupees(shift.openingFloatPaise)}</dd></div>
                <div className="rounded-lg bg-gold-soft/25 p-2"><dt className="text-xs text-muted-foreground">Cash sales</dt><dd className="font-semibold">{rupees(shift.cashSalesPaise)}</dd></div>
                <div className="rounded-lg bg-gold-soft/25 p-2"><dt className="text-xs text-muted-foreground">Expected</dt><dd className="font-semibold">{rupees(shift.expectedCashPaise)}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">Opened {new Date(shift.openedAt).toLocaleString('en-IN')}</p>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Cash counted in the drawer (₹)
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
              </label>
              <ErrorNote error={end.error} />
              <Button disabled={amount === ''} isLoading={end.isPending} onClick={() => end.mutate()}>Close shift</Button>
            </>
          ) : (
            <>
              <label className="grid gap-1 text-sm font-semibold text-walnut">Opening float (₹)
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
              </label>
              <ErrorNote error={start.error} />
              <Button disabled={amount === ''} isLoading={start.isPending} onClick={() => start.mutate()}>Open shift</Button>
            </>
          )}
          {!!history.data?.length && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-walnut">Recent shifts</summary>
              <ul className="mt-2 divide-y divide-border text-xs">
                {history.data.filter((s) => s.status === 'CLOSED').map((s) => (
                  <li key={s.id} className="flex justify-between py-1.5">
                    <span>{new Date(s.openedAt).toLocaleDateString('en-IN')} · expected {rupees(s.expectedCashPaise)}</span>
                    <span className={s.variancePaise ? 'font-semibold text-amber-800' : 'text-emerald-800'}>{(s.variancePaise ?? 0) >= 0 ? '+' : '−'}{rupees(Math.abs(s.variancePaise ?? 0))}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Modal>
    </>
  );
};
