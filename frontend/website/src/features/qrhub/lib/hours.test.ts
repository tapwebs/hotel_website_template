import { describe, expect, it } from 'vitest'
import { closedLabel, isOpenNow, shortTime } from './hours'

// 07:00 IST = 01:30 UTC
const ist = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return new Date(Date.UTC(2026, 2, 1, h, m) - 330 * 60_000)
}
const day = { open: '07:00', close: '23:00' }

describe('opening hours', () => {
  it('is open inside the window and closed outside it (India time)', () => {
    expect(isOpenNow(day, ist('07:00'))).toBe(true)
    expect(isOpenNow(day, ist('22:59'))).toBe(true)
    expect(isOpenNow(day, ist('06:59'))).toBe(false)
    expect(isOpenNow(day, ist('23:00'))).toBe(false)
  })
  it('no hours means always open', () => {
    expect(isOpenNow(null, ist('03:00'))).toBe(true)
  })
  it('handles windows that cross midnight', () => {
    const night = { open: '18:00', close: '02:00' }
    expect(isOpenNow(night, ist('23:30'))).toBe(true)
    expect(isOpenNow(night, ist('01:00'))).toBe(true)
    expect(isOpenNow(night, ist('12:00'))).toBe(false)
  })
  it('labels closed links with the opening time', () => {
    expect(closedLabel(day, ist('05:00'))).toBe('Closed now, opens 7:00')
    expect(closedLabel(day, ist('12:00'))).toBeNull()
    expect(closedLabel(null, ist('05:00'))).toBeNull()
    expect(closedLabel(day, ist('05:00'), { closed: 'अभी बंद है', opens: 'खुलेगा' })).toBe('अभी बंद है, खुलेगा 7:00')
  })
  it('shortTime drops one leading zero', () => {
    expect(shortTime('07:00')).toBe('7:00')
    expect(shortTime('19:30')).toBe('19:30')
  })
})
