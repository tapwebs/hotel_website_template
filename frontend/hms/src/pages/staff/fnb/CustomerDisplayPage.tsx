import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { subscribeDisplay, type DisplayState } from '../../../utils/customerDisplay';
import { rupees } from './fnbUi';

/** The guest-facing screen. Open /customer-display in a window on the second monitor next to the POS; it follows the bill
 *  being rung up, shows a pay-by-UPI QR when the cashier picks UPI, then a thank-you once the bill is paid. */
export const CustomerDisplayPage: React.FC = () => {
  const [state, setState] = useState<DisplayState>({ kind: 'idle' });
  const [qr, setQr] = useState('');
  useEffect(() => subscribeDisplay(setState), []);
  useEffect(() => {
    if (state.kind !== 'paid') return;
    const t = setTimeout(() => setState({ kind: 'idle' }), 8000); // back to the welcome screen for the next guest
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    if (state.kind !== 'upi') { setQr(''); return; }
    let live = true;
    QRCode.toDataURL(state.uri, { width: 320, margin: 1, errorCorrectionLevel: 'M' }).then((u) => live && setQr(u)).catch(() => live && setQr(''));
    return () => { live = false; };
  }, [state]);

  return (
    <main className="flex min-h-dvh flex-col bg-ivory p-10 text-ink" aria-live="polite">
      {state.kind === 'idle' && (
        <div className="m-auto text-center">
          <p className="text-5xl font-semibold tracking-tight">Welcome</p>
          <p className="mt-3 text-xl text-muted-foreground">Your order will appear here</p>
        </div>
      )}
      {state.kind === 'cart' && (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <h1 className="mb-6 text-2xl font-semibold">Your order</h1>
          <ul className="flex flex-1 flex-col divide-y divide-border">
            {state.lines.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-6 py-4 text-3xl">
                <span><span className="mr-4 text-muted-foreground">{l.quantity}×</span>{l.name}</span>
                <span className="tabular-nums">{rupees(l.totalPaise)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 grid gap-2 border-t-2 border-ink pt-6 text-xl text-muted-foreground">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{rupees(state.subtotalPaise)}</dd></div>
            <div className="flex justify-between"><dt>GST</dt><dd className="tabular-nums">{rupees(state.taxPaise)}</dd></div>
            <div className="flex items-baseline justify-between text-5xl font-semibold text-ink"><dt>Total</dt><dd className="tabular-nums">{rupees(state.totalPaise)}</dd></div>
          </dl>
        </div>
      )}
      {state.kind === 'upi' && (
        <div className="m-auto flex flex-col items-center text-center">
          <p className="text-3xl text-muted-foreground">Scan to pay</p>
          <p className="mt-2 text-7xl font-semibold tabular-nums tracking-tight">{rupees(state.totalPaise)}</p>
          <div className="mt-8 grid size-[352px] place-items-center rounded-3xl bg-white p-4 shadow-xl">
            {qr ? <img src={qr} alt={`UPI payment QR for ${rupees(state.totalPaise)}`} width={320} height={320} /> : <span className="text-muted-foreground">Preparing QR…</span>}
          </div>
          <p className="mt-6 text-xl text-muted-foreground">Pay {state.payee ? `to ${state.payee} ` : ''}with GPay, PhonePe, Paytm or any UPI app</p>
        </div>
      )}
      {state.kind === 'paid' && (
        <div className="m-auto text-center">
          <p className="text-6xl font-semibold tracking-tight">Thank you!</p>
          <p className="mt-4 text-3xl text-muted-foreground tabular-nums">{rupees(state.totalPaise)} paid</p>
        </div>
      )}
    </main>
  );
};
