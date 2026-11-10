// Mirrors the account API contract (.agents/tasks/account-dashboard-plan.md section 3). Keep in sync with the backend.
import { z } from 'zod4'
export const bookingStatuses = ['pending', 'confirmed', 'cancelled', 'completed'] as const
export const paymentStatuses = ['unpaid', 'pay_at_hotel', 'paid', 'refunded'] as const
export const bookingFilters = ['all', 'upcoming', 'past', 'cancelled'] as const
export const bedOptions = ['no_preference', 'king', 'twin', 'extra_bed'] as const
export const dietaryOptions = ['no_preference', 'vegetarian', 'vegan', 'jain', 'other'] as const
export type BookingStatus = (typeof bookingStatuses)[number]
export type PaymentStatus = (typeof paymentStatuses)[number]
export type BookingFilter = (typeof bookingFilters)[number]
export const statusLabel: Record<BookingStatus, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Stayed',
}
export const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  pay_at_hotel: 'Pay at hotel',
  paid: 'Paid',
  refunded: 'Refunded',
}
export const filterLabel: Record<BookingFilter, string> = { all: 'All', upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled' }
export const bedLabel: Record<(typeof bedOptions)[number], string> = {
  no_preference: 'No preference',
  king: 'King bed',
  twin: 'Twin beds',
  extra_bed: 'Extra bed',
}
export const dietaryLabel: Record<(typeof dietaryOptions)[number], string> = {
  no_preference: 'No preference',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  jain: 'Jain',
  other: 'Other (tell us in notes)',
}
export const bookingSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(bookingStatuses),
  paymentStatus: z.enum(paymentStatuses),
  room: z.object({ id: z.enum(['deluxe', 'super-deluxe']), name: z.string() }),
  roomCount: z.number(),
  checkIn: z.string(),
  checkOut: z.string(),
  nights: z.number(),
  adults: z.number(),
  children: z.number(),
  extraBed: z.boolean(),
  specialRequests: z.string().nullable(),
  ratePerNight: z.number(),
  totalAmount: z.number(),
  currency: z.literal('INR'),
  canCancel: z.boolean(),
  cancelledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Booking = z.infer<typeof bookingSchema>
export const bookingEnvelopeSchema = z.object({ booking: bookingSchema })
export const bookingListSchema = z.object({
  items: z.array(bookingSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
  counts: z.object({ all: z.number(), upcoming: z.number(), past: z.number(), cancelled: z.number() }),
})
export type BookingList = z.infer<typeof bookingListSchema>
export const preferencesSchema = z.object({
  bed: z.enum(bedOptions),
  dietary: z.enum(dietaryOptions),
  notes: z.string(),
})
export type Preferences = z.infer<typeof preferencesSchema>
export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postcode: z.string().nullable(),
  preferences: preferencesSchema,
  marketingOptIn: z.boolean(),
  role: z.enum(['guest', 'staff', 'admin']),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
})
export type Profile = z.infer<typeof profileSchema>
export const profileEnvelopeSchema = z.object({ profile: profileSchema })
export const okSchema = z.object({ ok: z.literal(true) })
