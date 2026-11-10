// A booking selection that lives in the URL (/book?room=…&in=…), so it survives login, signup and a reload.
import { addDays, startOfToday } from 'date-fns'
import { estimateTotal, nightsBetween } from '@/components/booking/buildWhatsAppUrl'
import { getRoom, rooms, type RoomId } from '@/data/rooms'
import { parseYmd, toYmd } from '@/features/account/dates'
export interface BookingDraft {
  roomId: RoomId
  /** YYYY-MM-DD, or '' when not chosen yet. */
  checkIn: string
  checkOut: string
  rooms: number
  adults: number
  children: number
  extraBed: boolean
  notes: string
}
export const MAX_ROOMS = 5
export const MAX_NIGHTS = 30
export const MAX_NOTES = 500
export const DEFAULT_DRAFT: BookingDraft = {
  roomId: 'deluxe',
  checkIn: '',
  checkOut: '',
  rooms: 1,
  adults: 2,
  children: 0,
  extraBed: false,
  notes: '',
}
const int = (v: string | null, min: number, max: number, fallback: number) => {
  const n = Number(v)
  return v !== null && v.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
/** URL params -> draft. Bad values fall back to defaults or are dropped; never throws. */
export function parseDraft(sp: URLSearchParams): BookingDraft {
  const d = DEFAULT_DRAFT
  const date = (k: string) => (parseYmd(sp.get(k) ?? '') ? (sp.get(k) as string) : '')
  return {
    roomId: rooms.find((r) => r.id === sp.get('room'))?.id ?? d.roomId,
    checkIn: date('in'),
    checkOut: date('out'),
    rooms: int(sp.get('rooms'), 1, MAX_ROOMS, d.rooms),
    adults: int(sp.get('adults'), 1, MAX_ROOMS * 2, d.adults),
    children: int(sp.get('children'), 0, 10, d.children),
    extraBed: sp.get('bed') === '1',
    notes: (sp.get('notes') ?? '').slice(0, MAX_NOTES),
  }
}
/** Draft -> URL params (empty values left out). */
export function draftToSearch(d: BookingDraft): string {
  const sp = new URLSearchParams({ room: d.roomId })
  if (d.checkIn) sp.set('in', d.checkIn)
  if (d.checkOut) sp.set('out', d.checkOut)
  sp.set('rooms', String(d.rooms))
  sp.set('adults', String(d.adults))
  if (d.children) sp.set('children', String(d.children))
  if (d.extraBed) sp.set('bed', '1')
  if (d.notes) sp.set('notes', d.notes)
  return sp.toString()
}
export type DraftField = 'checkIn' | 'checkOut' | 'adults' | 'rooms' | 'children' | 'notes'
/** Same rules as the server, in the site's own words. Returns field -> message (empty = valid). */
export function validateDraft(d: BookingDraft, today: Date = startOfToday()): Partial<Record<DraftField, string>> {
  const e: Partial<Record<DraftField, string>> = {}
  const inD = parseYmd(d.checkIn)
  const outD = parseYmd(d.checkOut)
  if (!inD) e.checkIn = 'Choose your check-in date.'
  else if (inD < today) e.checkIn = 'Check-in cannot be in the past.'
  else if (inD > addDays(today, 365)) e.checkIn = 'Choose a date within the next year.'
  if (!outD) e.checkOut = 'Choose your check-out date.'
  else if (inD) {
    const n = nightsBetween(inD, outD)
    if (n < 1) e.checkOut = 'Check-out must be at least 1 night after check-in.'
    else if (n > MAX_NIGHTS) e.checkOut = 'Stays are limited to 30 nights.'
  }
  const maxAdults = getRoom(d.roomId).maxAdults
  if (d.adults < d.rooms) e.adults = 'Each room needs at least 1 adult.'
  else if (d.adults > d.rooms * maxAdults) e.adults = `Each room sleeps up to ${maxAdults} adults. Add a room or reduce adults.`
  if (d.notes.length > MAX_NOTES) e.notes = 'Keep notes under 500 characters.'
  return e
}
/** nights × rate × rooms; the same number the sheet shows. The server recomputes it. */
export function draftEstimate(d: BookingDraft): { nights: number; total: number } {
  const inD = parseYmd(d.checkIn)
  const outD = parseYmd(d.checkOut)
  const nights = inD && outD ? nightsBetween(inD, outD) : 0
  return { nights, total: estimateTotal(nights, getRoom(d.roomId).rate, d.rooms) }
}
export { toYmd }
