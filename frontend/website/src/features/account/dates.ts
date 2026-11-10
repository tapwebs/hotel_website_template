import { formatDate } from '@/lib/format'
/** "2026-11-01" -> local Date. Never `new Date('YYYY-MM-DD')`, which is UTC and can land on the previous day. */
export function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null
}
/** Local Date -> "YYYY-MM-DD". */
export const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** "Tue, 14 Oct 2026" (or the input when it is not a date). */
export const formatStay = (ymd: string) => {
  const d = parseYmd(ymd)
  return d ? formatDate(d) : ymd
}
export const nightsLabel = (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`
export const roomsLabel = (n: number) => `${n} ${n === 1 ? 'room' : 'rooms'}`
