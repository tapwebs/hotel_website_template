import { describe, expect, it } from 'vitest'
import { hotel } from '@/data/hotel'
import {
  buildBookingMessage,
  buildMailtoUrl,
  buildWhatsAppUrl,
  estimateTotal,
  isIndianMobile,
  nightsBetween,
  PHONE_ERROR,
} from './buildWhatsAppUrl'
import { phoneSchema } from './phoneSchema'

describe('booking logic', () => {
  it('counts nights and estimates nights × rate × rooms', () => {
    const nights = nightsBetween(new Date(2026, 10, 1), new Date(2026, 10, 4))
    expect(nights).toBe(3)
    expect(estimateTotal(nights, 2300, 2)).toBe(13800)
    expect(estimateTotal(0, 1500, 1)).toBe(0)
    expect(nightsBetween(new Date(2026, 10, 4), new Date(2026, 10, 1))).toBe(0)
  })

  it('accepts Indian 10-digit mobiles in common formats only', () => {
    for (const ok of ['9876543210', '+91 98765 43210', '098765-43210', '919876543210']) expect(isIndianMobile(ok), ok).toBe(true)
    for (const bad of ['12345', '5876543210', '98765432101', 'abc']) expect(isIndianMobile(bad), bad).toBe(false)
  })

  it('builds an encoded wa.me link with the full request and no "booked" wording', () => {
    const msg = buildBookingMessage({
      checkIn: new Date(2026, 10, 1),
      checkOut: new Date(2026, 10, 3),
      roomName: 'Deluxe Room',
      rate: 1500,
      rooms: 1,
      adults: 2,
      extraBed: true,
      name: ' Asha & Ravi ',
      phone: '+91 98765 43210',
      notes: 'Late arrival?',
    })
    expect(msg).toContain('Nights: 2')
    expect(msg).toContain('₹3,000')
    expect(msg).toContain('Phone: +91 9876543210')
    expect(msg).toContain('Name: Asha & Ravi')
    expect(msg).not.toMatch(/booked|reserved/i)

    const url = buildWhatsAppUrl(msg)
    expect(url.startsWith(`https://wa.me/${hotel.whatsappNumber}?text=`)).toBe(true)
    expect(url).not.toMatch(/[ &?]Ravi/) // & and spaces are encoded
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(msg)
    expect(buildMailtoUrl('Room request', msg)).toMatch(new RegExp(`^mailto:${hotel.email}\\?subject=Room%20request&body=`))
  })
})
describe('phoneSchema', () => {
  it('accepts Indian mobiles in common formats', () => {
    for (const ok of ['98765 43210', '+91 98765 43210', '098765 43210']) expect(phoneSchema.safeParse(ok).success, ok).toBe(true)
  })
  it('rejects bad numbers with the shared message', () => {
    for (const bad of ['12345', '5876543210', '']) {
      const r = phoneSchema.safeParse(bad)
      expect(r.success, bad).toBe(false)
      expect(r.error?.issues[0].message).toBe(PHONE_ERROR)
    }
  })
})
