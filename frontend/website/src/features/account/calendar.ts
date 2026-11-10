import { hotel } from '@/data/hotel'
import { parseYmd } from './dates'
import type { Booking } from './accountTypes'

const ymdCompact = (s: string) => s.replaceAll('-', '')
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

/** All-day .ics event (check-in to check-out day; DTEND is exclusive in iCalendar, which matches check-out). */
export function bookingIcs(b: Booking): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TapMenu Hospitality//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${b.id}@${hotel.domain}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymdCompact(b.checkIn)}`,
    `DTEND;VALUE=DATE:${ymdCompact(b.checkOut)}`,
    `SUMMARY:${esc(`Stay at ${hotel.name}`)}`,
    `DESCRIPTION:${esc(`Booking ${b.reference}. ${b.room.name} x ${b.roomCount}. Check-in ${hotel.checkIn}, check-out ${hotel.checkOut}.`)}`,
    `LOCATION:${esc(`${hotel.address.street}, ${hotel.address.city}, ${hotel.address.region}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(b: Booking) {
  const url = URL.createObjectURL(new Blob([bookingIcs(b)], { type: 'text/calendar' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${b.reference}.ics` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Whole days from today (local) to a YYYY-MM-DD date; negative when past. */
export function daysUntil(ymd: string, now = new Date()): number | null {
  const d = parseYmd(ymd)
  if (!d) return null
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d.getTime() - t.getTime()) / 86_400_000)
}

export function countdownLabel(b: Pick<Booking, 'checkIn' | 'checkOut'>, now = new Date()): string {
  const start = daysUntil(b.checkIn, now)
  const end = daysUntil(b.checkOut, now)
  if (start === null || end === null) return ''
  if (start > 1) return `In ${start} days`
  if (start === 1) return 'Tomorrow'
  if (start === 0) return 'Check-in today'
  if (end >= 0) return 'Staying with us now'
  return 'Stay completed'
}
