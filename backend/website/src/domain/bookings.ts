import { randomBytes } from 'node:crypto'
import type { AdminBooking, Booking } from '../stores/store.ts'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type PaymentStatus = 'unpaid' | 'pay_at_hotel' | 'paid' | 'refunded'

// ponytail: duplicated on purpose from frontend/src/data/rooms.ts so the server can price. The HMS becomes the
// source of rates and availability later; there is no inventory table and no availability check.
export const ROOMS = {
  deluxe: { name: 'Deluxe Room', ratePerNight: 1500, maxAdults: 2 },
  'super-deluxe': { name: 'Super Deluxe Room', ratePerNight: 2300, maxAdults: 2 },
} as const
export type RoomId = keyof typeof ROOMS
export const ROOM_IDS = Object.keys(ROOMS) as [RoomId, ...RoomId[]]

const IST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
/** Today's date at the hotel (Asia/Kolkata) as YYYY-MM-DD. */
export const todayIST = (now: Date = new Date()): string => IST.format(now)

const DAY_MS = 86_400_000
const utc = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return new Date(utc(s)).toISOString().slice(0, 10) === s
}
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / DAY_MS)
export const addDays = (ymd: string, n: number): string => new Date(utc(ymd) + n * DAY_MS).toISOString().slice(0, 10)

// Admin-edited nightly rates (loaded from the store at start and after every change). Bookings already made keep their snapshot.
let rateOverrides: Record<string, number> = {}
export const applyRoomRates = (rates: Record<string, number>) => {
  rateOverrides = { ...rates }
}
export const currentRate = (roomId: RoomId): number => rateOverrides[roomId] ?? ROOMS[roomId].ratePerNight
export function quote(roomId: RoomId, checkIn: string, checkOut: string, rooms: number) {
  const room = ROOMS[roomId]
  const rate = currentRate(roomId)
  const nights = daysBetween(checkIn, checkOut)
  return { nights, ratePerNight: rate, roomName: room.name, totalAmount: nights * rate * rooms }
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 chars, no 0/O/1/I
export function newReference(): string {
  const bytes = randomBytes(6)
  let s = 'HDH-'
  for (const b of bytes) s += REF_ALPHABET[b & 31]
  return s
}

export const isActive = (status: BookingStatus) => status === 'pending' || status === 'confirmed'
export const canCancel = (b: { status: BookingStatus; checkIn: string }, today: string) => isActive(b.status) && b.checkIn >= today
/** Upcoming or in progress: still blocks account deletion and counts toward the booking limit. */
export const isUpcoming = (b: { status: BookingStatus; checkOut: string }, today: string) => isActive(b.status) && b.checkOut >= today
export const isPast = (b: { status: BookingStatus; checkOut: string }, today: string) => b.status !== 'cancelled' && b.checkOut < today
export const MAX_ACTIVE_BOOKINGS = 10

/** Admin status transitions; same value is a no-op. cancelled and completed are terminal. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: [],
  completed: [],
}
export const canTransition = (from: BookingStatus, to: BookingStatus) => from === to || TRANSITIONS[from].includes(to)

/** Explicit field pick: the guest and external ids never reach the owner's response by accident. */
export function toBooking(b: AdminBooking): Booking {
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    paymentStatus: b.paymentStatus,
    room: b.room,
    roomCount: b.roomCount,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    adults: b.adults,
    children: b.children,
    extraBed: b.extraBed,
    specialRequests: b.specialRequests,
    ratePerNight: b.ratePerNight,
    totalAmount: b.totalAmount,
    currency: b.currency,
    canCancel: b.canCancel,
    cancelledAt: b.cancelledAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }
}
