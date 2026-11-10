/** Kitchen alert tones, KOT tickets and customer receipts for the F&B screens. */
import type { POSOrder } from '../../../types/pms';
import type { FnbConfig } from '../../../types/fnb';
import { printKOTTicket } from '../../../tapmenu/services/kotPrinter';
import { where } from './fnbUi';
import QRCode from 'qrcode';
import { taxBreakdown } from '../../../utils/tax';

// ── sound ────────────────────────────────────────────────────────────────────
const TONES: Record<FnbConfig['soundTone'], { type: OscillatorType; notes: number[]; gap: number }> = {
  phone: { type: 'triangle', notes: [853, 960, 853, 960], gap: 0.1 },
  bell: { type: 'triangle', notes: [880, 880, 1046], gap: 0.15 },
  chime: { type: 'sine', notes: [1046, 1318, 1568], gap: 0.12 },
  siren: { type: 'sawtooth', notes: [650, 950, 650, 950], gap: 0.11 },
  buzzer: { type: 'square', notes: [220, 220, 220], gap: 0.14 },
  synth: { type: 'sawtooth', notes: [523, 659, 784, 1046], gap: 0.09 },
};

// One shared AudioContext: a new one per beep starts suspended and stays silent until the browser sees a click or tap.
let shared: AudioContext | null = null;
function audio(): AudioContext | null {
  try { shared ??= new AudioContext(); return shared; } catch { return null; }
}
/** True while the browser is still blocking sound (nobody has tapped the page yet). */
export const audioBlocked = () => (audio()?.state ?? 'suspended') !== 'running';
/** Call from a click, tap or key press to allow sound on this page. Resolves true once sound is allowed. */
export async function unlockAudio(): Promise<boolean> {
  const c = audio();
  if (!c) return false;
  try { if (c.state !== 'running') await c.resume(); } catch { /* still blocked */ }
  return c.state === 'running';
}

/** Standard alert tone. */
export function playTone(tone: FnbConfig['soundTone'] = 'phone', volume = 90, urgent = false) {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const t = TONES[tone] ?? TONES.phone ?? TONES.bell;
  const notes = urgent ? [...t.notes, ...t.notes] : t.notes;
  const peak = Math.max(0.001, (volume / 100) * 0.7);
  notes.forEach((f, i) => {
    const at = ctx.currentTime + i * t.gap;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = t.type;
    o.frequency.value = f;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + t.gap * 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + t.gap);
  });
}

/** Loud order telephone / service bell ring cadence (ring-ring with dual resonant harmonics). */
export function playLoudOrderRing(volume = 90, urgent = false) {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const peak = Math.max(0.001, (volume / 100) * 0.85);
  const bursts = urgent ? [0, 0.35, 0.7] : [0, 0.4];

  bursts.forEach((bOffset) => {
    const tStart = now + bOffset;
    const dur = urgent ? 0.28 : 0.32;
    // Dual frequency phone ring tones (classic standard 853Hz & 960Hz)
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.type = urgent ? 'sawtooth' : 'triangle';
    o2.type = urgent ? 'square' : 'sine';
    o1.frequency.setValueAtTime(urgent ? 950 : 853, tStart);
    o2.frequency.setValueAtTime(urgent ? 1180 : 960, tStart);
    g.gain.setValueAtTime(peak, tStart);
    g.gain.exponentialRampToValueAtTime(0.0001, tStart + dur);
    o1.connect(g);
    o2.connect(g);
    g.connect(ctx.destination);
    o1.start(tStart);
    o2.start(tStart);
    o1.stop(tStart + dur);
    o2.stop(tStart + dur);
  });
}

/** Sound effect: receipt / KOT printer feed & mechanical ticket cutter. */
export function playReceiptPrintSound(volume = 75) {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const peak = Math.max(0.001, (volume / 100) * 0.45);
  // Fast micro-pulses simulating stepper motor paper advance
  const clicks = [2200, 2800, 2400, 3100, 2600, 3000, 1800];
  clicks.forEach((f, i) => {
    const at = now + i * 0.032;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(peak * 0.6, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.022);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.022);
  });
  // Mechanical blade cut snap
  const cutTime = now + clicks.length * 0.032 + 0.04;
  const cutOsc = ctx.createOscillator();
  const cutGain = ctx.createGain();
  cutOsc.type = 'triangle';
  cutOsc.frequency.setValueAtTime(1400, cutTime);
  cutGain.gain.setValueAtTime(peak * 0.8, cutTime);
  cutGain.gain.exponentialRampToValueAtTime(0.0001, cutTime + 0.06);
  cutOsc.connect(cutGain).connect(ctx.destination);
  cutOsc.start(cutTime);
  cutOsc.stop(cutTime + 0.06);
}

/** Sound effect: order accepted & sent to kitchen (bright confirmation chime). */
export function playOrderAcceptSound(volume = 85) {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const peak = Math.max(0.001, (volume / 100) * 0.6);
  // Ascending 4-tone confirmation arpeggio (D5 -> F#5 -> A5 -> D6)
  const notes = [587.33, 739.99, 880, 1174.66];
  notes.forEach((f, i) => {
    const at = now + i * 0.075;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.35);
  });
}

/** Sound effect: order completed / ready / settled (double brass kitchen bell). */
export function playOrderCompleteSound(volume = 90) {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const peak = Math.max(0.001, (volume / 100) * 0.7);
  // 2 resonant bell strikes (ding... ding!)
  [0, 0.2].forEach((offset) => {
    const at = now + offset;
    // Primary resonant bell (C6)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(1046.5, at);
    g1.gain.setValueAtTime(peak, at);
    g1.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
    o1.connect(g1).connect(ctx.destination);
    o1.start(at);
    o1.stop(at + 0.65);

    // Harmonic overtone (G6)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(1567.98, at);
    g2.gain.setValueAtTime(peak * 0.45, at);
    g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    o2.connect(g2).connect(ctx.destination);
    o2.start(at);
    o2.stop(at + 0.5);
  });
}
// ── KOT ──────────────────────────────────────────────────────────────────────
/** Browser-print KOT (USB/network printers). `title` is printed in the badge: KOT, ADDITIONAL KOT or KOT - REPRINT. */
export function printKot(o: POSOrder, propertyName: string, _station?: string, width: '80mm' | '58mm' = '80mm', title = 'KOT') {
  playReceiptPrintSound(75);
  const items = o.items;
  return printKOTTicket({
    orderNumber: o.orderNumber,
    tableName: o.orderType === 'DINE_IN' ? `Table ${o.tableNumber}` : undefined,
    roomNumber: o.roomNumber ?? undefined,
    orderType: o.orderType.toLowerCase(),
    createdAt: o.createdAt,
    station: title,
    isRushPriority: o.isRush,
    specialInstructions: o.notes ?? undefined,
    restaurantName: propertyName,
    items: items.map((i) => ({
      name: i.name, quantity: i.quantity,
      variantName: [i.variantName, ...(i.addOns ?? [])].filter(Boolean).join(', ') || undefined, notes: i.notes ?? undefined,
    })),
    subtotalPaise: o.subtotalPaise,
    taxPaise: o.taxPaise,
    totalPaise: o.totalPaise,
  }, width);
}

// ── receipt ──────────────────────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const inr = (p: number) => Math.round(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const FONT_PX: Record<string, Record<'small' | 'normal' | 'large', number>> = {
  '58mm': { small: 9, normal: 10, large: 12 },
  '80mm': { small: 11, normal: 12, large: 14 },
};
/** The link a printed receipt QR opens: the review/feedback link if set, otherwise the store's own site. */
import { resolveSiteUrl } from '../../../site/features/qrhub/lib/qrUrl';

export const receiptQrTarget = (cfg: Partial<FnbConfig>) => cfg.reviewUrl || resolveSiteUrl();

/** One receipt. Every section after the bill number is optional (cfg.show*); undefined settings count as "on" so older saved settings keep printing as before. */
function receiptBody(o: POSOrder, cfg: Partial<FnbConfig>, propertyName: string, qr?: string) {
  const on = (v: boolean | undefined, dflt = true) => v ?? dflt;
  // One CGST + SGST pair per GST rate on the bill (dishes can carry their own rate).
  const rows = taxBreakdown(o.items, o.discountPaise ?? 0, o.taxPercent ?? cfg.gstPercent ?? 5);
  const taxRows = on(cfg.showTaxBreakup)
    ? rows.map((r) => `<tr><td>CGST ${r.percent / 2}%</td><td class="r">${inr(Math.floor(r.taxPaise / 2))}</td></tr><tr><td>SGST ${r.percent / 2}%</td><td class="r">${inr(r.taxPaise - Math.floor(r.taxPaise / 2))}</td></tr>`).join('')
    : `<tr><td>GST</td><td class="r">${inr(o.taxPaise)}</td></tr>`;
  const lines = o.items.map((i) => `<tr><td>${esc(i.quantity)} × ${esc(i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ''}${i.addOns?.length ? `<br><small>+ ${esc(i.addOns.join(', '))}</small>` : ''}${on(cfg.showUnitPrice) && i.quantity > 1 ? `<br><small>@ ${inr(i.pricePaise)} each</small>` : ''}</td><td class="r">${inr(i.pricePaise * i.quantity)}</td></tr>`).join('');
  const paid = o.paymentMethod
    ? (on(cfg.showPaymentMethod)
        ? `<tr><td>Paid by ${esc(o.paymentMethod === 'ROOM' ? `room ${o.roomNumber}` : o.paymentMethod)}</td><td class="r">${inr(o.paymentMethod === 'CASH' && o.tenderedPaise ? o.tenderedPaise : o.totalPaise)}</td></tr>`
          + (o.paymentMethod === 'CASH' && o.tenderedPaise ? `<tr><td>Change</td><td class="r">${inr(o.tenderedPaise - o.totalPaise)}</td></tr>` : '')
          + (o.paymentMethod === 'SPLIT' && o.splitAmounts ? `<tr><td><small>Cash ${inr(o.splitAmounts.cash ?? 0)} · Digital ${inr(o.splitAmounts.digital ?? 0)}</small></td><td></td></tr>` : '')
        : '')
    : '<tr><td colspan="2"><b>UNPAID</b></td></tr>';
  const when = new Date(o.paidAt ?? o.createdAt).toLocaleString('en-IN');
  const head = [
    cfg.receiptHeader && `<p>${esc(cfg.receiptHeader)}</p>`,
    on(cfg.showAddress) && cfg.receiptAddress && `<p>${esc(cfg.receiptAddress)}</p>`,
    on(cfg.showPhone) && cfg.receiptPhone && `<p>Ph: ${esc(cfg.receiptPhone)}</p>`,
    on(cfg.showGstin) && cfg.gstin && `<p>GSTIN ${esc(cfg.gstin)}</p>`,
    on(cfg.showFssai) && cfg.fssai && `<p>FSSAI ${esc(cfg.fssai)}</p>`,
  ].filter(Boolean).join('');
  const meta = [
    `<p>Bill ${esc(o.orderNumber)} · ${esc(where(o))}</p>`,
    on(cfg.showOrderTime) && `<p>${when}</p>`,
    on(cfg.showCustomerName) && o.guestName && `<p>${esc(o.guestName)}</p>`,
  ].filter(Boolean).join('');
  const qrBlock = on(cfg.showQr, false) && qr
    ? `<div class="qr"><img src="${qr}" alt="QR code" width="110" height="110">${cfg.qrCaption ? `<p>${esc(cfg.qrCaption)}</p>` : ''}</div>`
    : '';
  return `<section class="rc"><h1>${esc(propertyName)}</h1>${head}<hr>${meta}<hr>
<table>${lines}</table><hr><table>
<tr><td>Subtotal</td><td class="r">${inr(o.subtotalPaise)}</td></tr>
${o.discountPaise ? `<tr><td>Discount${o.couponCode ? ` (${esc(o.couponCode)})` : ''}</td><td class="r">-${inr(o.discountPaise)}</td></tr>` : ''}
${taxRows}
${o.roundOffPaise ? `<tr><td>Round off</td><td class="r">${o.roundOffPaise > 0 ? '+' : '-'}${inr(Math.abs(o.roundOffPaise))}</td></tr>` : ''}
<tr class="t"><td>Total ₹</td><td class="r">${inr(o.totalPaise)}</td></tr>${paid}</table><hr>
<p>SAC 996331</p><p>${esc(cfg.receiptFooter || 'Thank you for dining with us')}</p>${cfg.extraFooter ? `<p>${esc(cfg.extraFooter)}</p>` : ''}${qrBlock}</section>`;
}

export function receiptHtml(o: POSOrder, cfg: Partial<FnbConfig>, propertyName: string, qr?: string) {
  const width = cfg.paperWidth === '58mm' ? '58mm' : '80mm';
  const px = FONT_PX[width][cfg.fontSize ?? 'normal'];
  const copies = Math.min(5, Math.max(1, Math.round(cfg.copies ?? 1)));
  const body = receiptBody(o, cfg, propertyName, qr);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.orderNumber)}</title><style>
@page{size:${width} auto;margin:3mm}body{font-family:ui-monospace,Menlo,monospace;font-size:${px}px;margin:0;color:#000}
h1{font-size:1.3em;text-align:center;margin:0}p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
.r{text-align:right;white-space:nowrap}hr{border:0;border-top:1px dashed #000;margin:6px 0}.t td{font-weight:700;font-size:1.15em}
.qr{text-align:center;margin-top:6px}.qr img{display:block;margin:0 auto}.rc{break-after:page}.rc:last-child{break-after:auto}</style></head><body>${Array.from({ length: copies }, () => body).join('')}</body></html>`;
}

export async function receiptQrDataUrl(cfg: Partial<FnbConfig>): Promise<string | undefined> {
  const target = receiptQrTarget(cfg);
  if (!cfg.showQr || !target) return undefined;
  try { return await QRCode.toDataURL(target, { width: 220, margin: 1, errorCorrectionLevel: 'M' }); } catch { return undefined; }
}

/** Prints through a hidden frame, so it also works for auto-print after payment (a pop-up window would be blocked there). */
export async function printReceipt(o: POSOrder, cfg: Partial<FnbConfig>, propertyName: string) {
  if (cfg.soundEffectsEnabled !== false) {
    playReceiptPrintSound(cfg.soundVolume ?? 75);
  }
  const qr = await receiptQrDataUrl(cfg);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  frame.srcdoc = receiptHtml(o, cfg, propertyName, qr);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
