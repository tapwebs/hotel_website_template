// Typed client for the guest account API (/me/*). Never throws: every call resolves to { ok, data } or { ok:false, error }.
import { apiCall, type ApiCallOptions } from '@/site/lib/apiClient'
import type { AdminError, ApiResult } from '@/site/features/admin/adminTypes'
import {
  bookingEnvelopeSchema,
  bookingFilters,
  bookingListSchema,
  okSchema,
  profileEnvelopeSchema,
  type Booking,
  type BookingFilter,
  type BookingList,
  type Preferences,
  type Profile,
} from './accountTypes'
export interface BookingsParams {
  filter: BookingFilter
  page: number
}
export const DEFAULT_BOOKINGS_PARAMS: BookingsParams = { filter: 'all', page: 1 }
export const BOOKINGS_PAGE_SIZE = 10
const friendly: Record<string, string> = {
  forbidden_origin: 'This request was blocked. Reload the page and try again.',
  not_cancellable: 'This booking can no longer be cancelled online. Please contact the hotel.',
  booking_limit: 'You already have the maximum number of upcoming bookings. Cancel one or contact the hotel.',
  upcoming_bookings: 'You have upcoming stays. Cancel them first or contact the hotel.',
  not_allowed_for_role: 'Staff and admin accounts cannot be deleted here. Please contact the hotel.',
}
const issuesOf = (body: unknown): { path: string; message: string }[] | undefined => {
  const raw = (body as { issues?: unknown } | null)?.issues
  if (!Array.isArray(raw)) return undefined
  const out: { path: string; message: string }[] = []
  for (const item of raw) {
    const { path, message } = (item ?? {}) as { path?: unknown; message?: unknown }
    if (typeof message !== 'string') continue
    out.push({ path: typeof path === 'string' ? path : '', message })
  }
  return out.length ? out : undefined
}
/** Maps an error response of the account API to a user-facing error. */
export function errorFor(status: number, body: unknown): AdminError {
  const code = typeof (body as { error?: unknown } | null)?.error === 'string' ? (body as { error: string }).error : undefined
  const message = (fallback: string) => (code && friendly[code]) || fallback
  if (status === 401) return { kind: 'unauthenticated', code, message: 'Your session has expired. Please log in again.' }
  if (status === 403) return { kind: 'forbidden', code, message: message('You do not have access to this.') }
  if (status === 404) return { kind: 'not_found', code, message: 'We could not find that booking.' }
  if (status === 409) return { kind: 'conflict', code, message: message('That change is not allowed.') }
  if (status === 422)
    return { kind: 'validation', code, issues: issuesOf(body), message: 'Those values are not valid. Please check them and try again.' }
  if (status === 429) return { kind: 'rate_limited', code, message: 'Too many attempts. Please wait a few minutes.' }
  return { kind: 'server', code, message: 'Something went wrong on our side. Please try again.' }
}
/** Field errors from a 422, keyed by the last path segment ("preferences.bed" -> "bed"). Whole-body issues use "". */
export function fieldIssues(error: AdminError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of error.issues ?? []) {
    const key = i.path.split('.').pop() ?? ''
    out[key] ??= i.message
  }
  return out
}
const int = (v: string | null, min: number, max: number, fallback: number) => {
  const n = Number(v)
  return v !== null && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
/** Query string for GET /me/bookings. */
export const buildBookingsQuery = (p: BookingsParams, pageSize = BOOKINGS_PAGE_SIZE) =>
  new URLSearchParams({ page: String(p.page), pageSize: String(pageSize), filter: p.filter }).toString()
/** Page URL params -> validated params (bad values fall back to defaults). */
export function parseBookingsParams(sp: URLSearchParams): BookingsParams {
  return {
    filter: bookingFilters.find((f) => f === sp.get('filter')) ?? DEFAULT_BOOKINGS_PARAMS.filter,
    page: int(sp.get('page'), 1, 100000, 1),
  }
}
/** Params -> page URL params (defaults omitted). */
export function toBookingsSearch(p: BookingsParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (p.filter !== 'all') sp.set('filter', p.filter)
  if (p.page !== 1) sp.set('page', String(p.page))
  return sp
}
type Opts = Pick<ApiCallOptions, 'signal' | 'baseUrl' | 'fetchImpl' | 'timeoutMs'>
const call = <S extends Parameters<typeof apiCall>[1]>(path: string, schema: S, o: Omit<ApiCallOptions, 'mapError'> = {}) =>
  apiCall(path, schema, { ...o, mapError: errorFor })
const unwrap = async <T, U>(p: Promise<ApiResult<T>>, pick: (t: T) => U): Promise<ApiResult<U>> => {
  const r = await p
  return r.ok ? { ok: true, data: pick(r.data) } : r
}
export const getProfile = (o?: Opts): Promise<ApiResult<Profile>> =>
  unwrap(call('/me/profile', profileEnvelopeSchema, o), (d) => d.profile)
export interface ProfilePatch {
  name?: string
  phone?: string
  country?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  preferences?: Preferences
  marketingOptIn?: boolean
}
export const updateProfile = (body: ProfilePatch, o?: Opts): Promise<ApiResult<Profile>> =>
  unwrap(call('/me/profile', profileEnvelopeSchema, { ...o, method: 'PATCH', body }), (d) => d.profile)
export const changePassword = (currentPassword: string, newPassword: string, o?: Opts) =>
  call('/me/password', okSchema, { ...o, method: 'POST', body: { currentPassword, newPassword } })
export const deleteAccount = (password: string, o?: Opts) => call('/me', okSchema, { ...o, method: 'DELETE', body: { password } })
export const listMyBookings = (p: BookingsParams, pageSize = BOOKINGS_PAGE_SIZE, o?: Opts): Promise<ApiResult<BookingList>> =>
  call(`/me/bookings?${buildBookingsQuery(p, pageSize)}`, bookingListSchema, o)
export const getMyBooking = (id: string, o?: Opts): Promise<ApiResult<Booking>> =>
  unwrap(call(`/me/bookings/${encodeURIComponent(id)}`, bookingEnvelopeSchema, o), (d) => d.booking)
/** The ONLY fields a booking request may carry. Totals, rates and status are always computed by the server. */
export interface CreateBookingInput {
  roomId: 'deluxe' | 'super-deluxe'
  checkIn: string
  checkOut: string
  rooms: number
  adults: number
  children: number
  extraBed: boolean
  specialRequests: string | null
}
export const createBooking = (input: CreateBookingInput, requestId: string, o?: Opts): Promise<ApiResult<Booking>> =>
  unwrap(
    call('/me/bookings', bookingEnvelopeSchema, {
      ...o,
      method: 'POST',
      body: {
        requestId,
        roomId: input.roomId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        rooms: input.rooms,
        adults: input.adults,
        children: input.children,
        extraBed: input.extraBed,
        specialRequests: input.specialRequests,
      },
    }),
    (d) => d.booking,
  )
export const cancelBooking = (id: string, o?: Opts): Promise<ApiResult<Booking>> =>
  unwrap(call(`/me/bookings/${encodeURIComponent(id)}/cancel`, bookingEnvelopeSchema, { ...o, method: 'POST' }), (d) => d.booking)
