import { describe, expect, it } from 'vitest'
import { addDays } from 'date-fns'
import { estimateTotal } from '@/components/booking/buildWhatsAppUrl'
import { parseYmd, toYmd } from '@/features/account/dates'
import { DEFAULT_DRAFT, draftEstimate, draftToSearch, parseDraft, validateDraft, type BookingDraft } from './draft'
const today = new Date(2026, 9, 14)
const ok: BookingDraft = { ...DEFAULT_DRAFT, checkIn: '2026-11-01', checkOut: '2026-11-03', notes: 'Late arrival' }
describe('draft URL', () => {
  it('round-trips', () => {
    const d: BookingDraft = { ...ok, roomId: 'super-deluxe', rooms: 2, adults: 3, children: 1, extraBed: true }
    expect(parseDraft(new URLSearchParams(draftToSearch(d)))).toEqual(d)
  })
  it('falls back on bad values and never throws', () => {
    const d = parseDraft(new URLSearchParams('room=x&in=2026-02-30&out=zz&rooms=99&adults=0&children=-1&bed=2&notes=' + 'n'.repeat(600)))
    expect(d).toMatchObject({ roomId: 'deluxe', checkIn: '', checkOut: '', rooms: 1, adults: 2, children: 0, extraBed: false })
    expect(d.notes).toHaveLength(500)
  })
})
describe('validateDraft', () => {
  it('accepts a good stay', () => expect(validateDraft(ok, today)).toEqual({}))
  it.each([
    [{ checkIn: '' }, 'checkIn'],
    [{ checkIn: '2026-10-13' }, 'checkIn'],
    [{ checkIn: '2027-11-01', checkOut: '2027-11-02' }, 'checkIn'],
    [{ checkOut: '2026-11-01' }, 'checkOut'],
    [{ checkOut: '2026-12-15' }, 'checkOut'],
    [{ rooms: 2, adults: 1 }, 'adults'],
    [{ rooms: 1, adults: 3 }, 'adults'],
  ] as [Partial<BookingDraft>, string][])('rejects %j', (patch, field) => {
    expect(validateDraft({ ...ok, ...patch }, today)).toHaveProperty(field)
  })
  it('allows today and exactly 30 nights', () => {
    expect(validateDraft({ ...ok, checkIn: '2026-10-14', checkOut: '2026-11-13' }, today)).toEqual({})
    expect(toYmd(addDays(parseYmd('2026-10-14')!, 30))).toBe('2026-11-13')
  })
})
describe('draftEstimate', () => {
  it('equals nights × rate × rooms', () => {
    expect(draftEstimate({ ...ok, rooms: 2 })).toEqual({ nights: 2, total: estimateTotal(2, 2000, 2) })
    expect(draftEstimate(DEFAULT_DRAFT)).toEqual({ nights: 0, total: 0 })
  })
})
