/** Which device prints KOTs, and how. Stored per device (localStorage), because only the kitchen tablet has the printer. */
import { useEffect, useState } from 'react';
import type { POSOrder, VoidedItem } from '../../../types/pms';
import type { FnbConfig } from '../../../types/fnb';
import { type KotKind, kotTitle, onPrinterChange, printKotBluetooth, printerConnected, reconnectPrinter } from './btPrinter';
import { printKot, playReceiptPrintSound } from './printing';

export interface KotDevice {
  /** This device prints KOTs automatically as orders reach the kitchen. */
  isKitchenPrinter: boolean;
  /** Bluetooth thermal printer, or the browser's print dialog (USB / network printers, or Chrome --kiosk-printing). */
  method: 'bluetooth' | 'browser';
}
const KEY = 'dh_kot_device';
const DEFAULT: KotDevice = { isKitchenPrinter: false, method: 'bluetooth' };
const subs = new Set<() => void>();

export function getKotDevice(): KotDevice {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT; }
}
export function setKotDevice(patch: Partial<KotDevice>) {
  localStorage.setItem(KEY, JSON.stringify({ ...getKotDevice(), ...patch }));
  subs.forEach((f) => f());
}

/** Live device settings plus whether the Bluetooth printer is connected right now. */
export function useKotDevice() {
  const [dev, setDev] = useState(getKotDevice);
  const [connected, setConnected] = useState(printerConnected);
  useEffect(() => {
    const a = () => setDev(getKotDevice());
    const b = () => setConnected(printerConnected());
    subs.add(a);
    const off = onPrinterChange(b);
    if (getKotDevice().method === 'bluetooth') void reconnectPrinter().then(b);
    return () => { subs.delete(a); off(); };
  }, []);
  return { ...dev, connected };
}

export interface KotSlice { order: POSOrder; voids: VoidedItem[]; kind: KotKind }

/**
 * What to print for KOT rounds fromSeq < seq <= toSeq: the dishes added in those rounds and cancellation lines for
 * dishes the kitchen already had on paper. Round 0 onwards is the full first KOT. Returns null when there is nothing
 * the kitchen needs (for example a dish cancelled before it was ever printed).
 */
export function kotSlice(o: POSOrder, fromSeq: number, toSeq: number): KotSlice | null {
  const inRange = (seq?: number) => (seq ?? 1) > fromSeq && (seq ?? 1) <= toSeq;
  const items = o.items.flatMap((i) => {
    if (i.rounds && i.rounds.length > 0) {
      const qty = i.rounds.filter((r) => inRange(r.seq)).reduce((sum, r) => sum + r.quantity, 0);
      return qty > 0 ? [{ ...i, quantity: qty }] : [];
    }
    return inRange(i.seq) ? [i] : [];
  });
  const voids = (o.voidedItems ?? []).filter((v) => inRange(v.seq) && !v.noSlip);
  if (!items.length && !voids.length) return null;
  const kind: KotKind = !items.length ? 'CANCEL' : fromSeq > 0 || o.additionalKot ? 'ADDITIONAL' : 'NEW';
  return { order: { ...o, items, notes: fromSeq > 0 ? undefined : o.notes }, voids, kind };
}

/** The full current KOT (all dishes still on the order), for a reprint. */
export const fullKot = (o: POSOrder): KotSlice => ({ order: o, voids: [], kind: 'REPRINT' });

/** Print one KOT slice the way this device is set up. Throws if the Bluetooth printer is unreachable. */
export async function printKotSlice(k: KotSlice, cfg: Partial<FnbConfig> | undefined, restaurant: string) {
  if (cfg?.soundEffectsEnabled !== false) {
    playReceiptPrintSound(cfg?.soundVolume ?? 75);
  }
  const width = cfg?.paperWidth ?? '80mm';
  if (getKotDevice().method === 'bluetooth') {
    await printKotBluetooth(k.order, { kind: k.kind, restaurant, width, showPrices: !!cfg?.kotShowPrices, copies: cfg?.kotCopies, voids: k.voids });
  } else {
    // Browser print: cancellations go in as lines marked CANCEL.
    const order = { ...k.order, items: [...k.order.items, ...k.voids.map((v) => ({ menuItemId: v.lineId, name: `CANCEL: ${v.name}${v.reason ? ` (${v.reason})` : ''}`, quantity: v.quantity, pricePaise: 0, station: 'MAIN_KITCHEN' as const }))] };
    await printKot(order, restaurant, undefined, width, kotTitle(k.kind));
  }
}

/** Print whatever this order still owes the kitchen, or a full reprint if everything is on paper. Marks it printed. */
export async function printKotManually(o: POSOrder, cfg: Partial<FnbConfig> | undefined, restaurant: string, markPrinted: (id: string) => Promise<unknown>) {
  const pending = (o.kotPrintedSeq ?? (o.kotPrintedAt ? 1 : 0)) < (o.kotSeq ?? 1);
  const slice = pending ? kotSlice(o, o.kotPrintedSeq ?? 0, o.kotSeq ?? 1) : null;
  await printKotSlice(slice ?? fullKot(o), cfg, restaurant);
  if (pending) await markPrinted(o.id);
}
