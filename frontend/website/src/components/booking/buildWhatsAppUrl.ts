// Booking and enquiry logic (DESIGN-PLAN §4). No backend: every request becomes a prefilled
// WhatsApp message (primary) or email (secondary). Input is only URL-encoded, never parsed as HTML.

import { differenceInCalendarDays } from 'date-fns'
import { hotel } from '@/data/hotel'
import { formatDate, formatINR } from '@/lib/format'

export const ESTIMATE_LABEL = 'Estimated, excluding extra bed and taxes'

/** Whole nights between two dates (0 if check-out is not after check-in). */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(0, differenceInCalendarDays(checkOut, checkIn))
}

/** nights × rate × rooms. Extra bed and taxes are deliberately excluded. */
export function estimateTotal(nights: number, rate: number, rooms: number): number {
  if (nights <= 0 || rooms <= 0) return 0
  return nights * rate * rooms
}

/** Indian mobile number as 10 digits, stripping spaces, dashes, +91, 91 or a leading 0. */
export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export const isIndianMobile = (input: string) => /^[6-9]\d{9}$/.test(normalizeIndianPhone(input))
export const PHONE_ERROR = 'Enter a 10-digit Indian mobile number, for example 98765 43210.'

export function buildWhatsAppUrl(message: string, number: string = hotel.whatsappNumber): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function buildMailtoUrl(subject: string, body: string, to: string = hotel.email): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export interface BookingRequest {
  checkIn: Date
  checkOut: Date
  roomName: string
  rate: number
  rooms: number
  adults: number
  extraBed: boolean
  name: string
  phone: string
  email?: string
  notes?: string
}

export function buildBookingMessage(r: BookingRequest): string {
  const nights = nightsBetween(r.checkIn, r.checkOut)
  const total = estimateTotal(nights, r.rate, r.rooms)
  const lines = [
    `Hello ${hotel.name}, I would like to request a room.`,
    '',
    `Room: ${r.roomName} (${formatINR(r.rate)} per night)`,
    `Check-in: ${formatDate(r.checkIn)}`,
    `Check-out: ${formatDate(r.checkOut)}`,
    `Nights: ${nights}`,
    `Rooms: ${r.rooms}`,
    `Adults: ${r.adults}`,
    `Extra bed: ${r.extraBed ? 'Yes, please share the charge' : 'No'}`,
    `Estimated total: ${formatINR(total)} (${ESTIMATE_LABEL.toLowerCase()})`,
    '',
    `Name: ${r.name.trim()}`,
    `Phone: +91 ${normalizeIndianPhone(r.phone)}`,
  ]
  if (r.email?.trim()) lines.push(`Email: ${r.email.trim()}`)
  if (r.notes?.trim()) lines.push(`Notes: ${r.notes.trim()}`)
  lines.push('', 'Please confirm availability. Thank you.')
  return lines.join('\n')
}

export interface EventEnquiry {
  eventType: string
  date: Date
  guests: number
  venue: string
  catering: boolean
  name: string
  phone: string
  notes?: string
}

export function buildEventMessage(e: EventEnquiry): string {
  const lines = [
    `Hello ${hotel.name}, I would like to enquire about an event.`,
    '',
    `Event: ${e.eventType}`,
    `Date: ${formatDate(e.date)}`,
    `Guests: ${e.guests}`,
    `Venue: ${e.venue}`,
    `Catering: ${e.catering ? 'Yes' : 'No'}`,
    '',
    `Name: ${e.name.trim()}`,
    `Phone: +91 ${normalizeIndianPhone(e.phone)}`,
  ]
  if (e.notes?.trim()) lines.push(`Notes: ${e.notes.trim()}`)
  lines.push('', 'Please share availability and package details. Thank you.')
  return lines.join('\n')
}

export interface GeneralEnquiry {
  name: string
  phone: string
  message: string
}

export function buildGeneralMessage(g: GeneralEnquiry): string {
  return [`Hello ${hotel.name},`, '', g.message.trim(), '', `Name: ${g.name.trim()}`, `Phone: +91 ${normalizeIndianPhone(g.phone)}`].join(
    '\n',
  )
}
