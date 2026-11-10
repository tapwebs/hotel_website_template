import type { Hours } from './types'

const TZ = 'Asia/Kolkata'

const toMinutes = (hhmm: string) => {
  const [h = '0', m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

/** Minutes since midnight in Asia/Kolkata. */
export function minutesInIst(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

/** No hours means always open. Windows that cross midnight (open 18:00, close 02:00) are supported. */
export function isOpenNow(hours: Hours | null, now: Date = new Date()): boolean {
  if (!hours) return true
  const cur = minutesInIst(now)
  const open = toMinutes(hours.open)
  const close = toMinutes(hours.close)
  if (open === close) return true
  return open < close ? cur >= open && cur < close : cur >= open || cur < close
}

/** "07:00" -> "7:00". */
export const shortTime = (hhmm: string) => hhmm.replace(/^0(\d:)/, '$1')

/** "Closed now, opens 7:00" when outside hours, otherwise null. */
export function closedLabel(
  hours: Hours | null,
  now: Date = new Date(),
  text: { closed: string; opens: string } = { closed: 'Closed now', opens: 'opens' },
): string | null {
  if (!hours || isOpenNow(hours, now)) return null
  return `${text.closed}, ${text.opens} ${shortTime(hours.open)}`
}
