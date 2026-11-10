// Mirrors the admin API contract (.agents/tasks/admin-dashboard-plan.md section 3). Keep in sync with the backend.
import { z } from 'zod'
import { bookingSchema, type BookingStatus, type PaymentStatus } from '@/features/account/accountTypes'

export const roles = ['guest', 'staff', 'admin'] as const
export const statuses = ['active', 'disabled'] as const
export const sortKeys = ['createdAt', 'name', 'email', 'lastLoginAt'] as const
export type Role = (typeof roles)[number]
export type Status = (typeof statuses)[number]
export type SortKey = (typeof sortKeys)[number]
export type Order = 'asc' | 'desc'

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(roles),
  status: z.enum(statuses),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().nullable(),
  externalHmsId: z.string().nullable(),
  externalPosId: z.string().nullable(),
})
export type AdminUser = z.infer<typeof adminUserSchema>

export const userListSchema = z.object({
  items: z.array(adminUserSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
})
export type UserList = z.infer<typeof userListSchema>

export const userEnvelopeSchema = z.object({ user: adminUserSchema })

export const statsSchema = z.object({
  generatedAt: z.string(),
  totals: z.object({
    users: z.number(),
    active: z.number(),
    disabled: z.number(),
    guests: z.number(),
    staff: z.number(),
    admins: z.number(),
  }),
  signups: z.object({ last7Days: z.number(), last30Days: z.number() }),
  activeLast30Days: z.number(),
  lifecycle: z.object({
    registered: z.number(),
    everLoggedIn: z.number(),
    everBooked: z.number(),
    linkedHms: z.number(),
    linkedPos: z.number(),
  }),
  bookings: z.object({
    total: z.number(),
    byStatus: z.object({ pending: z.number(), confirmed: z.number(), cancelled: z.number(), completed: z.number() }),
    upcoming: z.number(),
    createdLast7Days: z.number(),
    createdLast30Days: z.number(),
  }),
  signupsByDay: z.array(z.object({ date: z.string(), count: z.number() })),
})
export type AdminStats = z.infer<typeof statsSchema>

// Admin view of a booking (account-dashboard-plan.md section 3.6): the guest booking plus the guest and HMS/POS links.
export const adminBookingSchema = bookingSchema.extend({
  guest: z.object({ id: z.string(), name: z.string(), email: z.string(), phone: z.string().nullable() }).nullable(),
  externalHmsBookingId: z.string().nullable(),
  externalPosFolioId: z.string().nullable(),
})
export type AdminBooking = z.infer<typeof adminBookingSchema>
export const adminBookingListSchema = z.object({
  items: z.array(adminBookingSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
})
export type AdminBookingList = z.infer<typeof adminBookingListSchema>
export const adminBookingEnvelopeSchema = z.object({ booking: adminBookingSchema })
/** Front-desk shortcuts: who is arriving, staying or leaving on a given day (active bookings only). */
export type DeskView = 'arrivals_today' | 'arrivals_tomorrow' | 'inhouse' | 'departures_today'
export interface BookingListParams {
  page: number
  q: string
  status: BookingStatus | ''
  paymentStatus: PaymentStatus | ''
  desk?: DeskView | ''
  /** Check-in range (used by the calendar). */
  range?: { from: string; to: string }
}
export interface BookingPatch {
  status?: BookingStatus
  paymentStatus?: PaymentStatus
  externalHmsBookingId?: string | null
  externalPosFolioId?: string | null
}

export interface ListParams {
  page: number
  pageSize: number
  q: string
  role: Role | ''
  status: Status | ''
  sort: SortKey
  order: Order
}

export type AdminErrorKind = 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'network' | 'server' | 'rate_limited'
export interface AdminError {
  kind: AdminErrorKind
  /** Machine code from the API body, e.g. "last_admin". */
  code?: string
  message: string
  /** Field-level problems from a 422 `validation_failed` body (path is dot-joined, "" = whole body). */
  issues?: { path: string; message: string }[]
}
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: AdminError }
