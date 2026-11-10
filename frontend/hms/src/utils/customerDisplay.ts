/** Mirrors the POS cart to a customer-facing second screen open in another window of the same browser.
 *  BroadcastChannel stays inside this browser on this machine: no server, account or network is involved, and nothing
 *  is stored. The display page (/customer-display) only ever shows what the POS publishes. */
export interface DisplayLine { name: string; quantity: number; totalPaise: number }

export type DisplayState =
  | { kind: 'idle' }
  | { kind: 'cart'; lines: DisplayLine[]; subtotalPaise: number; taxPaise: number; totalPaise: number }
  | { kind: 'upi'; totalPaise: number; uri: string; payee: string }
  | { kind: 'paid'; totalPaise: number; method?: string };

const CHANNEL = 'dream-heavens-customer-display';

export function publishDisplay(state: DisplayState): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage(state);
  ch.close();
}

export function subscribeDisplay(onState: (s: DisplayState) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e: MessageEvent<DisplayState>) => onState(e.data);
  return () => ch.close();
}

/** UPI deep link (NPCI linking spec): scanning it opens any UPI app with the payee and exact amount filled in. */
export function buildUpiUri(o: { vpa: string; name?: string; amountPaise: number; note?: string; ref?: string }): string {
  const q = new URLSearchParams({ pa: o.vpa });
  if (o.name) q.set('pn', o.name.slice(0, 60));
  if (o.amountPaise > 0) q.set('am', (o.amountPaise / 100).toFixed(2));
  q.set('cu', 'INR');
  if (o.note) q.set('tn', o.note.slice(0, 60));
  if (o.ref) q.set('tr', o.ref.slice(0, 35));
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`; // UPI apps expect %20, not "+"
}
