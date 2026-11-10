import type { FnbConfig } from '../../../types/fnb';

/**
 * Who rings for a waiting guest / KOT order, and when.
 * - Captains and Waiters devices ring loudly upon order receipt.
 * - If not responded under the escalation window (2 minutes), the loud ring escalates to Admin & General Manager accounts.
 * - Everyone with ACCEPT_GUEST_ORDERS sees the orders list and can accept.
 */
export function ringsFor(role: string | undefined, cfg: Pick<FnbConfig, 'ringWaitersForGuestOrders' | 'acceptanceEscalationMinutes'>, waitedMs: number) {
  const escalationMinutes = cfg.acceptanceEscalationMinutes ?? 2;
  const escalated = waitedMs >= escalationMinutes * 60_000;
  if (role === 'ROLE_SUPER_ADMIN' || role === 'ROLE_GENERAL_MANAGER' || role === 'ROLE_ADMIN' || role === 'SUPER_ADMIN' || role === 'GENERAL_MANAGER') {
    return { ring: escalated, escalated };
  }
  if (role === 'ROLE_CAPTAIN' || role === 'CAPTAIN') return { ring: true, escalated };
  if (role === 'ROLE_WAITER' || role === 'WAITER') {
    return { ring: cfg.ringWaitersForGuestOrders !== false, escalated };
  }
  return { ring: !!cfg.ringWaitersForGuestOrders, escalated };
}
