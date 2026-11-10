/**
 * Bluetooth thermal printer (ESC/POS over Bluetooth Low Energy) for the kitchen KOT.
 *
 * Works in Chrome or Edge on Android, Windows, macOS and ChromeOS. iPhone/iPad browsers have no Web Bluetooth.
 * Only BLE printers can be reached from a browser; "Classic" (SPP-only) printers cannot.
 * Pairing needs one tap (browser rule). After that the printer reconnects by itself when the browser allows
 * navigator.bluetooth.getDevices(); otherwise staff tap "Connect printer" once per session.
 */
import type { POSOrder, VoidedItem } from '../../../types/pms';

// GATT services used by common BLE thermal printers (generic 18F0, ISSC/Microchip, Nordic-style, and two vendor blocks).
const SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];
const STORE = 'dh_kot_printer'; // { id, name } of the paired printer on this device

// Minimal Web Bluetooth typings (lib.dom does not ship them).
interface BtChar { properties: { write: boolean; writeWithoutResponse: boolean }; writeValue(v: BufferSource): Promise<void>; writeValueWithoutResponse?(v: BufferSource): Promise<void> }
interface BtService { getCharacteristics(): Promise<BtChar[]> }
interface BtServer { connected: boolean; connect(): Promise<BtServer>; disconnect(): void; getPrimaryServices(): Promise<BtService[]> }
interface BtDevice { id: string; name?: string; gatt?: BtServer; addEventListener(t: 'gattserverdisconnected', f: () => void): void }
interface Bt { requestDevice(o: unknown): Promise<BtDevice>; getDevices?(): Promise<BtDevice[]> }
const bt = (): Bt | undefined => (typeof navigator !== 'undefined' ? (navigator as unknown as { bluetooth?: Bt }).bluetooth : undefined);

export const bluetoothSupported = () => !!bt();

let device: BtDevice | null = null;
let char: BtChar | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
export const onPrinterChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export const savedPrinter = (): { id: string; name: string } | null => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? 'null'); } catch { return null; }
};
export const printerConnected = () => !!(device?.gatt?.connected && char);
export const printerName = () => device?.name || savedPrinter()?.name || '';

async function open(d: BtDevice): Promise<void> {
  const server = await d.gatt!.connect();
  for (const s of await server.getPrimaryServices()) {
    for (const c of await s.getCharacteristics()) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        device = d;
        char = c;
        d.addEventListener('gattserverdisconnected', () => { char = null; notify(); });
        notify();
        return;
      }
    }
  }
  server.disconnect();
  throw new Error('This Bluetooth device does not accept print data. Choose the thermal printer.');
}

/** Pick and pair a printer. Must be called from a tap or click. */
export async function pairPrinter(): Promise<string> {
  const b = bt();
  if (!b) throw new Error('This browser cannot use Bluetooth. Use Chrome on the Android tablet.');
  const d = await b.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
  await open(d);
  localStorage.setItem(STORE, JSON.stringify({ id: d.id, name: d.name ?? 'Printer' }));
  return d.name ?? 'Printer';
}

/** Reconnect to the saved printer without a tap, where the browser allows it. Resolves false if a tap is needed. */
export async function reconnectPrinter(): Promise<boolean> {
  if (printerConnected()) return true;
  const saved = savedPrinter();
  const b = bt();
  if (!saved || !b) return false;
  try {
    if (device && device.id === saved.id) { await open(device); return true; }
    const d = (await b.getDevices?.())?.find((x) => x.id === saved.id);
    if (!d) return false;
    await open(d);
    return true;
  } catch {
    return false;
  }
}

export function forgetPrinter() {
  try { device?.gatt?.disconnect(); } catch { /* already gone */ }
  device = null;
  char = null;
  localStorage.removeItem(STORE);
  notify();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function send(bytes: Uint8Array) {
  if (!printerConnected() && !(await reconnectPrinter())) throw new Error('Kitchen printer is not connected.');
  const c = char!;
  // Small chunks: many cheap printers only take 20-byte writes; 100 works on most and is much faster.
  const size = c.properties.writeWithoutResponse ? 100 : 20;
  for (let i = 0; i < bytes.length; i += size) {
    const part = bytes.slice(i, i + size);
    if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(part);
    else await c.writeValue(part);
    await sleep(c.properties.writeWithoutResponse ? 15 : 5);
  }
}

// ── ESC/POS ticket ──────────────────────────────────────────────────────────
const ESC = 0x1b, GS = 0x1d;
/** Thermal printers use a single-byte code page; keep to plain ASCII. */
const ascii = (s: string) => s.replace(/₹/g, 'Rs').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').normalize('NFKD').replace(/[^\x20-\x7e\n]/g, '');

class Ticket {
  private out: number[] = [ESC, 0x40]; // initialise
  constructor(private cols: number) {}
  raw(...b: number[]) { this.out.push(...b); return this; }
  align(a: 'left' | 'center') { return this.raw(ESC, 0x61, a === 'center' ? 1 : 0); }
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  big(on: boolean) { return this.raw(GS, 0x21, on ? 0x11 : 0x00); }
  text(s: string) { for (const ch of ascii(s)) this.out.push(ch.charCodeAt(0)); return this.raw(0x0a); }
  line(ch = '-') { return this.text(ch.repeat(this.cols)); }
  /** Left and right text on one line. */
  pair(l: string, r: string) { const w = Math.max(1, this.cols - ascii(r).length - 1); return this.text(`${ascii(l).slice(0, w).padEnd(w)} ${ascii(r)}`); }
  /** Wrap long text over several lines, each indented by `indent` spaces. */
  wrap(s: string, indent = 0) {
    const width = this.cols - indent;
    let rest = ascii(s);
    while (rest.length > width) {
      const cut = rest.lastIndexOf(' ', width) > 0 ? rest.lastIndexOf(' ', width) : width;
      this.text(' '.repeat(indent) + rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    return rest ? this.text(' '.repeat(indent) + rest) : this;
  }
  bytes() { return new Uint8Array([...this.out, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00]); } // feed and cut
}

export type KotKind = 'NEW' | 'ADDITIONAL' | 'REPRINT' | 'CANCEL';
export const kotTitle = (k: KotKind) =>
  k === 'ADDITIONAL' ? 'ADDITIONAL KOT' : k === 'REPRINT' ? 'KOT - REPRINT' : k === 'CANCEL' ? 'CANCELLED ITEMS' : 'KOT';

const destination = (o: POSOrder) =>
  o.orderType === 'ROOM_SERVICE' ? `ROOM ${o.roomNumber ?? ''}` : o.orderType === 'DINE_IN' ? `TABLE ${o.tableNumber ?? ''}` : o.orderType === 'TAKEAWAY' ? 'TAKEAWAY' : 'COUNTER';

/** ESC/POS bytes for one KOT. Exported for the self-check. */
export function kotBytes(o: POSOrder, opts: { kind: KotKind; restaurant: string; width: '58mm' | '80mm'; showPrices: boolean; voids?: VoidedItem[] }): Uint8Array {
  const t = new Ticket(opts.width === '58mm' ? 32 : 48);
  const at = new Date(o.createdAt);
  t.align('center').bold(true).big(true).text(kotTitle(opts.kind)).big(false).text(opts.restaurant).bold(false);
  if (o.isRush) t.bold(true).text('*** RUSH ***').bold(false);
  t.align('left').line();
  t.bold(true).big(true).text(destination(o)).big(false).bold(false);
  t.pair(o.orderNumber, at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  if (o.guestName && o.guestName !== 'Guest') t.text(o.guestName);
  t.line();
  for (const i of o.items) {
    t.bold(true);
    if (opts.showPrices) t.pair(`${i.quantity} x ${i.name}`, `Rs ${Math.round((i.pricePaise * i.quantity) / 100)}`);
    else t.wrap(`${i.quantity} x ${i.name}`);
    t.bold(false);
    const extras = [i.variantName, ...(i.addOns ?? []).map((a) => `+ ${a}`)].filter(Boolean).join(', ');
    if (extras) t.wrap(extras, 4);
    if (i.notes) t.wrap(`Note: ${i.notes}`, 4);
  }
  if (opts.voids?.length) {
    if (o.items.length) t.line();
    t.bold(true).text('*** CANCEL - DO NOT MAKE ***').bold(false);
    for (const v of opts.voids) {
      t.bold(true).wrap(`${v.quantity} x ${v.name}${v.variantName ? ` (${v.variantName})` : ''}`).bold(false);
      if (v.reason) t.wrap(`Reason: ${v.reason}`, 4);
    }
  }
  t.line();
  if (o.notes) t.bold(true).wrap(`ORDER NOTE: ${o.notes}`).bold(false).line();
  t.pair(`Items: ${o.items.reduce((n, i) => n + i.quantity, 0)}`, at.toLocaleDateString('en-IN'));
  return t.bytes();
}

export async function printKotBluetooth(o: POSOrder, opts: Parameters<typeof kotBytes>[1] & { copies?: number }) {
  const bytes = kotBytes(o, opts);
  for (let n = 0; n < Math.max(1, Math.min(3, opts.copies ?? 1)); n++) await send(bytes);
}

/** A one-line test page, for the settings screen. */
export async function printTestPage(restaurant: string, width: '58mm' | '80mm') {
  const t = new Ticket(width === '58mm' ? 32 : 48);
  t.align('center').bold(true).text('PRINTER TEST').bold(false).text(restaurant).text(new Date().toLocaleString('en-IN')).text('KOT printing works.');
  await send(t.bytes());
}
