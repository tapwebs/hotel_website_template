// Admin tools API: staff accounts, guest search, reports, activity log, room rates, CSV downloads.
import { z } from 'zod4'
import { apiCall, type ApiCallOptions } from '@/site/lib/apiClient'
import { authBaseUrl, authHeaders } from '@/site/features/auth/authService'
import { errorFor } from '@/site/features/account/accountApi'
import { adminUserSchema, type AdminError, type ApiResult } from './adminTypes'

type Opts = Pick<ApiCallOptions, 'signal' | 'baseUrl' | 'fetchImpl' | 'timeoutMs'>
const call = <S extends z.ZodType>(path: string, schema: S, o: Omit<ApiCallOptions, 'mapError'> = {}) =>
  apiCall(path, schema, { ...o, mapError: (s, b) => (s === 409 ? friendly(s, b) : errorFor(s, b)) })
const friendly = (status: number, body: unknown): AdminError => {
  const code = (body as { error?: string } | null)?.error
  const base = errorFor(status, body)
  return code === 'email_taken' ? { ...base, message: 'That email already has an account.' } : base
}

export interface NewStaff {
  name: string
  email: string
  phone?: string
  password: string
  role: 'staff' | 'guest'
}
export const createUser = async (body: NewStaff, o?: Opts) => {
  const r = await call('/admin/users', z.object({ user: adminUserSchema }), { ...o, method: 'POST', body })
  return r.ok ? { ok: true as const, data: r.data.user } : r
}

const guestSchema = z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), phone: z.string().nullable() })) })
export type GuestHit = z.infer<typeof guestSchema>['items'][number]
export const searchGuests = (q: string, o?: Opts): Promise<ApiResult<z.infer<typeof guestSchema>>> =>
  call(`/admin/guest-search?q=${encodeURIComponent(q)}`, guestSchema, o)

const nameCount = z.object({ name: z.string(), count: z.number() })
export const reportSchema = z.object({
  generatedAt: z.string(),
  totals: z.object({ bookings: z.number(), cancelled: z.number(), revenue: z.number(), roomNights: z.number(), avgStay: z.number() }),
  months: z.array(z.object({ month: z.string(), bookings: z.number(), cancelled: z.number(), revenue: z.number(), nights: z.number() })),
  rooms: z.array(nameCount),
  payments: z.array(nameCount),
  statuses: z.array(nameCount),
})
export type Report = z.infer<typeof reportSchema>
export const getReport = (o?: Opts): Promise<ApiResult<Report>> => call('/admin/reports', reportSchema, o)

export const activitySchema = z.object({
  items: z.array(z.object({ id: z.string(), at: z.string(), actorName: z.string(), action: z.string(), target: z.string(), detail: z.string() })),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
})
export type ActivityList = z.infer<typeof activitySchema>
export const listActivity = (page: number, o?: Opts): Promise<ApiResult<ActivityList>> => call(`/admin/activity?page=${page}&pageSize=30`, activitySchema, o)

const roomsSchema = z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), rate: z.number(), defaultRate: z.number(), maxAdults: z.number() })) })
export type RoomRate = z.infer<typeof roomsSchema>['items'][number]
export const listRooms = (o?: Opts): Promise<ApiResult<z.infer<typeof roomsSchema>>> => call('/admin/rooms', roomsSchema, o)
export const setRoomRate = (id: string, rate: number, o?: Opts) =>
  call(`/admin/rooms/${encodeURIComponent(id)}`, z.object({ id: z.string(), name: z.string(), rate: z.number() }), { ...o, method: 'PUT', body: { rate } })

/** Downloads a CSV from the API (cookie session) and saves it. Returns an error message, or '' on success. */
export async function downloadCsv(path: string, fallbackName: string): Promise<string> {
  const base = authBaseUrl()
  if (!base) return 'The accounts server is not configured.'
  try {
    const res = await fetch(`${base}${path}`, { credentials: 'omit', headers: { Accept: 'text/csv', ...authHeaders() } })
    if (!res.ok) return res.status === 403 ? 'You do not have access to this export.' : 'Could not export. Please try again.'
    const name = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return ''
  } catch {
    return 'We could not reach the server. Check your connection and try again.'
  }
}
