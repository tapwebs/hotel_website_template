import type { FastifyRequest } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { AdminBooking, SessionUser, UserStore } from '../stores/store.ts'
import type { IntegrationEndpoint } from './config.ts'
import type { BookingSyncHooks } from './types.ts'

// HMS = TapMenu HMS (FastAPI). Contract: backend/app/api/routes/integrations.py in the HMS repo.
const API = '/api/v1'

export interface HmsReservation {
  reservation_id: string
  booking_reference: string
  status: string
  total_amount_minor: number
  payment_status: string
  stay_status: string | null
}

async function call<T>(hms: IntegrationEndpoint, path: string, init: RequestInit = {}, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${hms.baseUrl.replace(/\/+$/, '')}${API}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'X-HMS-Integration-Key': hms.apiKey, ...init.headers },
        signal: AbortSignal.timeout(5000),
      })
      // 4xx is a real answer (bad mapping, no availability): don't retry it.
      if (res.status < 500) {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw Object.assign(new Error(`HMS ${res.status}: ${JSON.stringify(body).slice(0, 300)}`), { final: true })
        return body as T
      }
      throw new Error(`HMS ${res.status}`)
    } catch (err) {
      if ((err as { final?: boolean }).final || attempt >= tries) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
}

/** Pushes one website booking to the HMS (idempotent on booking.reference) and stores the HMS reservation id. */
export async function syncBookingToHms(hms: IntegrationEndpoint, store: UserStore, b: AdminBooking): Promise<AdminBooking> {
  // completed is driven by the HMS (check-out); deleted accounts have no guest to send.
  if (b.status === 'completed' || !b.guest) return b
  if (b.status === 'cancelled' && !b.externalHmsBookingId) return b
  const r = await call<HmsReservation>(hms, '/integrations/website-bookings', {
    method: 'POST',
    body: JSON.stringify({
      external_booking_ref: b.reference,
      website_room_id: b.room.id,
      guest_name: b.guest.name,
      guest_email: b.guest.email,
      guest_phone: b.guest.phone,
      checkin_date: b.checkIn,
      checkout_date: b.checkOut,
      rooms_count: b.roomCount,
      adults: b.adults,
      children: b.children,
      special_requests: b.specialRequests,
      status: b.status,
    }),
  })
  if (r.reservation_id === b.externalHmsBookingId) return b
  const upd = await store.updateAdminBooking(b.id, { externalHmsBookingId: r.reservation_id })
  return upd.ok ? upd.booking : b
}

export const getHmsReservation = (hms: IntegrationEndpoint, reference: string) =>
  call<HmsReservation>(hms, `/integrations/website-bookings/${encodeURIComponent(reference)}`, {}, 1)

export function hmsSyncHooks(hms: IntegrationEndpoint, store: UserStore): BookingSyncHooks {
  const sync = async (b: AdminBooking) => void (await syncBookingToHms(hms, store, b))
  return { onBookingCreated: sync, onBookingChanged: sync }
}

// ---- Staff gateway: the HMS (FastAPI /api/v1/website/*) authenticates staff, then forwards with the shared key ----
// The identity headers are trusted only together with a matching integration key; a browser never holds the key.
export function hmsStaffFromGateway(hms: IntegrationEndpoint | undefined, req: FastifyRequest): SessionUser | undefined {
  const h = req.headers
  const sent = h['x-hms-integration-key']
  if (!hms || typeof sent !== 'string') return undefined
  const a = createHash('sha256').update(sent).digest()
  const b = createHash('sha256').update(hms.apiKey).digest()
  if (!timingSafeEqual(a, b)) return undefined
  const [id, name, email, role] = ['id', 'name', 'email', 'role'].map((k) => h[`x-hms-user-${k}`])
  if (typeof id !== 'string' || typeof name !== 'string' || typeof email !== 'string' || (role !== 'admin' && role !== 'staff')) return undefined
  return { id: `hms:${id}`, name: `${name} (HMS)`, email, role }
}

/** activity_log.actor_id references users(id); HMS bridge users are not website users. */
export const actorId = (me: { id: string }) => (me.id.startsWith('hms:') ? null : me.id)
