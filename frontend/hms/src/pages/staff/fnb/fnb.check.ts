// Self-check for the guest-order ring rule and the ESC/POS KOT.
// Run: npx tsx src/pages/staff/fnb/fnb.check.ts
import assert from 'node:assert/strict';
import { ringsFor } from './guestAlertRules';
import { kotBytes } from './btPrinter';
import { kotSlice } from './kotDevice';
import type { POSOrder } from '../../../types/pms';

const cfg = { ringWaitersForGuestOrders: false, acceptanceEscalationMinutes: 2 };
const min = 60_000;
assert.deepEqual(ringsFor('ROLE_CAPTAIN', cfg, 0), { ring: true, escalated: false });
assert.equal(ringsFor('ROLE_WAITER', cfg, 0).ring, false);
assert.equal(ringsFor('ROLE_WAITER', { ...cfg, ringWaitersForGuestOrders: true }, 0).ring, true);
assert.equal(ringsFor('ROLE_GENERAL_MANAGER', cfg, 1.9 * min).ring, false);
assert.deepEqual(ringsFor('ROLE_SUPER_ADMIN', cfg, 2 * min), { ring: true, escalated: true });
assert.equal(ringsFor('ROLE_KITCHEN_STAFF', cfg, 10 * min).ring, false);

const order = {
  id: 'o1', orderNumber: 'KOT-1042', orderType: 'DINE_IN', tableNumber: 'T4', guestName: 'Asha', status: 'QUEUED', elapsedMinutes: 0,
  createdAt: '2026-10-29T10:00:00Z', subtotalPaise: 76000, taxPaise: 3800, totalPaise: 79800, notes: 'No onion — please',
  items: [{ menuItemId: 'm', name: 'Paneer Tikka', quantity: 2, pricePaise: 38000, station: 'MAIN_KITCHEN', variantName: 'Half', addOns: ['Extra mint'] }],
} as POSOrder;
const text = (b: Uint8Array) => String.fromCharCode(...b);
const kot = text(kotBytes(order, { kind: 'ADDITIONAL', restaurant: 'Dream Heaven’s', width: '58mm', showPrices: false }));
assert.ok(kot.startsWith('\x1b@'), 'starts with ESC @ (initialise)');
assert.ok(kot.includes('ADDITIONAL KOT') && kot.includes('TABLE T4') && kot.includes('2 x Paneer Tikka'));
assert.ok(kot.includes('Half, + Extra mint') && kot.includes('No onion - please'), 'extras and ASCII-safe notes');
assert.ok(!/[^\x00-\x7f]/.test(kot), 'only ASCII bytes reach the printer');
assert.ok(!kot.includes('Rs 760.00'), 'no prices unless asked');
assert.ok(kot.endsWith('\x1dVB\x00'), 'ends with feed and cut');
for (const line of kot.split('\n')) assert.ok(line.replace(/\x1b[@]|\x1b[\s\S]{2}|\x1d[\s\S]{2}|[\x00-\x1f]/g, '').length <= 32, `fits 58mm: ${line}`);
assert.ok(text(kotBytes(order, { kind: 'REPRINT', restaurant: 'DH', width: '80mm', showPrices: true })).includes('Rs 760'));

// KOT rounds: round 1 is the first KOT; dishes added later print alone; cancellations print only if the dish was on paper.
const running = {
  ...order, kotSeq: 4, kotPrintedSeq: 1,
  items: [{ ...order.items[0], lineId: 'a', seq: 1 }, { menuItemId: 'n', name: 'Lassi', quantity: 1, pricePaise: 9000, station: 'MAIN_KITCHEN', lineId: 'b', seq: 2 }],
  voidedItems: [
    { lineId: 'a', name: 'Paneer Tikka', quantity: 1, pricePaise: 38000, reason: 'Too spicy', by: 'R', at: '', seq: 3 },
    { lineId: 'c', name: 'Soup', quantity: 1, pricePaise: 9000, reason: 'Changed mind', by: 'R', at: '', seq: 4, noSlip: true },
  ],
} as POSOrder;
const first = kotSlice(running, 0, 1)!;
assert.equal(first.kind, 'NEW');
assert.deepEqual(first.order.items.map((i) => i.lineId), ['a']);
const added = kotSlice(running, 1, 4)!;
assert.equal(added.kind, 'ADDITIONAL');
assert.deepEqual(added.order.items.map((i) => i.name), ['Lassi']);
assert.deepEqual(added.voids.map((v) => v.name), ['Paneer Tikka'], 'never-printed Soup gets no slip');
assert.equal(added.order.notes, undefined, 'order note printed once, on the first KOT');
assert.equal(kotSlice(running, 2, 3)!.kind, 'CANCEL');
assert.equal(kotSlice(running, 3, 4), null, 'nothing for the kitchen');
assert.ok(text(kotBytes(added.order, { kind: 'ADDITIONAL', restaurant: 'DH', width: '80mm', showPrices: false, voids: added.voids })).includes('*** CANCEL - DO NOT MAKE ***'));

console.log('fnb checks passed');
