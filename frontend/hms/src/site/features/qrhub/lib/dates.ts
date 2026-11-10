// Admin date fields are entered in India time (the hotel's timezone) regardless of the browser's zone.
const IST = '+05:30'

/** "2026-03-01T09:30" (datetime-local) -> ISO string at that IST wall time. Empty -> null. */
export function istInputToIso(v: string): string | null {
  if (!v) return null
  const d = new Date(`${v.length === 16 ? v + ':00' : v}${IST}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO string -> "2026-03-01T09:30" in IST for datetime-local inputs. Empty -> ''. */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16)
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : ''

/** YYYY-MM-DD for today in IST, shifted by `daysAgo`. */
export function istDay(daysAgo = 0, now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000 - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

export type Phase = 'scheduled' | 'live' | 'expired'
export function phase(start: string | null | undefined, end: string | null | undefined, now: Date = new Date()): Phase {
  if (start && new Date(start) > now) return 'scheduled'
  if (end && new Date(end) < now) return 'expired'
  return 'live'
}
