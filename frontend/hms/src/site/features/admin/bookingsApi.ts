// Typed client for the admin bookings API (/admin/bookings). Never throws: every call resolves to { ok, data } or { ok:false, error }.
import { apiCall, type ApiCallOptions } from '@/site/lib/apiClient'
import { errorFor as accountErrorFor } from '@/site/features/account/accountApi'
import { bookingStatuses, paymentStatuses, type BookingStatus } from '@/site/features/account/accountTypes'
import {
  adminBookingEnvelopeSchema,
  adminBookingListSchema,
  type AdminBooking,
  type AdminBookingList,
  type AdminError,
  type ApiResult,
  type BookingListParams,
  type BookingPatch,
  type DeskView,
} from './adminTypes'

export const DEFAULT_BOOKING_PARAMS: BookingListParams = { page: 1, q: '', status: '', paymentStatus: '' }
export const BOOKINGS_PAGE_SIZE = 10
export const hasBookingFilters = (p: BookingListParams) => Boolean(p.q.trim() || p.status || p.paymentStatus || p.desk)
export const DESK_VIEWS: readonly { id: DeskView; label: string }[] = [
  { id: 'arrivals_today', label: 'Arriving today' },
  { id: 'arrivals_tomorrow', label: 'Arriving tomorrow' },
  { id: 'inhouse', label: 'In house' },
  { id: 'departures_today', label: 'Departing today' },
]
/** YYYY-MM-DD in India time (the hotel's day), `offset` days from today. */
export const istDate = (offset = 0) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10)
const deskQuery = (d: DeskView) => ({
  view: d.startsWith('arrivals') ? 'arrivals' : d.startsWith('departures') ? 'departures' : 'inhouse',
  day: istDate(d === 'arrivals_tomorrow' ? 1 : 0),
})

/** Legal next states, mirroring the backend transition table (same value = no-op). cancelled and completed are final. */
export const nextStatuses: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['pending', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'completed', 'cancelled'],
  cancelled: ['cancelled'],
  completed: ['completed'],
}

const friendly: Record<string, string> = {
  invalid_transition: 'That status change is not allowed from the current status.',
  external_id_taken: 'That HMS or POS id is already linked to another booking.',
}
export function errorFor(status: number, body: unknown): AdminError {
  const base = accountErrorFor(status, body)
  if (status === 404) return { ...base, message: 'That booking no longer exists.' }
  if (status === 409) return { ...base, message: (base.code && friendly[base.code]) || base.message }
  return base
}

/** Query string for GET /admin/bookings: empty values are left out. */
export function buildBookingsQuery(p: BookingListParams): string {
  const sp = new URLSearchParams({ page: String(p.page), pageSize: String(BOOKINGS_PAGE_SIZE) })
  if (p.q.trim()) sp.set('q', p.q.trim())
  if (p.status && bookingStatuses.includes(p.status)) sp.set('status', p.status)
  if (p.paymentStatus && paymentStatuses.includes(p.paymentStatus)) sp.set('paymentStatus', p.paymentStatus)
  if (p.range) {
    sp.set('from', p.range.from)
    sp.set('to', p.range.to)
    sp.set('pageSize', '100')
  }
  if (p.desk) {
    const { view, day } = deskQuery(p.desk)
    sp.set('view', view)
    sp.set('day', day)
    sp.set('sort', 'checkIn')
    sp.set('order', 'asc')
  }
  return sp.toString()
}

type Opts = Pick<ApiCallOptions, 'signal' | 'baseUrl' | 'fetchImpl' | 'timeoutMs'>

export const listAdminBookings = (p: BookingListParams, o?: Opts): Promise<ApiResult<AdminBookingList>> =>
  apiCall(`/admin/bookings?${buildBookingsQuery(p)}`, adminBookingListSchema, { ...o, mapError: errorFor })

export async function updateAdminBooking(id: string, body: BookingPatch, o?: Opts): Promise<ApiResult<AdminBooking>> {
  const r = await apiCall(`/admin/bookings/${encodeURIComponent(id)}`, adminBookingEnvelopeSchema, {
    ...o,
    method: 'PATCH',
    body,
    mapError: errorFor,
  })
  return r.ok ? { ok: true, data: r.data.booking } : r
}

export interface NewBookingBody {
  userId?: string
  guest?: { name: string; email: string; phone?: string }
  booking: { roomId: string; checkIn: string; checkOut: string; rooms: number; adults: number; children: number; extraBed: boolean; specialRequests: string | null }
  status: 'pending' | 'confirmed'
  paymentStatus?: 'unpaid' | 'pay_at_hotel' | 'paid'
}
/** Booking taken at the desk or by phone. */
export async function createAdminBooking(body: NewBookingBody, o?: Opts): Promise<ApiResult<AdminBooking>> {
  const r = await apiCall('/admin/bookings', adminBookingEnvelopeSchema, { ...o, method: 'POST', body, mapError: errorFor })
  return r.ok ? { ok: true, data: r.data.booking } : r
}
