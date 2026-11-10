import { describe, expect, it } from 'vitest'
import { formatStay, parseYmd, toYmd } from './dates'
describe('dates', () => {
  it('parses YYYY-MM-DD as a LOCAL date (never the UTC day before)', () => {
    const d = parseYmd('2026-11-01')!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 1])
    expect(toYmd(d)).toBe('2026-11-01')
  })
  it('rejects malformed and impossible dates', () => {
    for (const s of ['', '2026-02-30', '2026-13-01', '01-11-2026', '2026-1-1']) expect(parseYmd(s)).toBeNull()
  })
  it('formats a stay date and falls back to the input', () => {
    expect(formatStay('2026-10-14')).toContain('14 Oct')
    expect(formatStay('nope')).toBe('nope')
  })
})
