import { describe, expect, it } from 'vitest'
import { buildVCard } from './vcard'

describe('buildVCard', () => {
  const v = buildVCard({
    name: 'Hotel Dream Heaven’s',
    phone: '+91 87399 82231',
    whatsapp: '918739982231',
    email: 'contact@hoteldreamheavens.in',
    address: 'Agra Road, Bassi, Jaipur',
    website_url: 'https://hoteldreamheavens.in',
  })
  it('is a CRLF vCard 3.0', () => {
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true)
    expect(v.endsWith('END:VCARD\r\n')).toBe(true)
  })
  it('carries name, phones, email, address and website', () => {
    expect(v).toContain('FN:Hotel Dream Heaven’s')
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+918739982231')
    expect(v).toContain('TEL;TYPE=CELL:918739982231')
    expect(v).toContain('EMAIL;TYPE=INTERNET:contact@hoteldreamheavens.in')
    expect(v).toContain('ADR;TYPE=WORK:;;Agra Road\\, Bassi\\, Jaipur;;;;')
    expect(v).toContain('URL:https')
  })
  it('does not repeat the same number as WhatsApp and omits empty fields', () => {
    const w = buildVCard({ name: 'X', phone: '+918739982231', whatsapp: '+91 87399 82231' })
    expect(w.match(/TEL/g)).toHaveLength(1)
    expect(w).not.toContain('EMAIL')
  })
})
