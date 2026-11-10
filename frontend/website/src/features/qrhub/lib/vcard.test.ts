import { describe, expect, it } from 'vitest'
import { buildVCard } from './vcard'

describe('buildVCard', () => {
  const v = buildVCard({
    name: 'TapMenu Grand Resort',
    phone: '+91 00000 00000',
    whatsapp: '910000000000',
    email: 'contact@example.com',
    address: '100 Hospitality Boulevard, Metropolis',
    website_url: 'http://localhost:5173',
  })
  it('is a CRLF vCard 3.0', () => {
    expect(v.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true)
    expect(v.endsWith('END:VCARD\r\n')).toBe(true)
  })
  it('carries name, phones, email, address and website', () => {
    expect(v).toContain('FN:TapMenu Grand Resort')
    expect(v).toContain('TEL;TYPE=WORK,VOICE:+910000000000')
    expect(v).toContain('TEL;TYPE=CELL:910000000000')
    expect(v).toContain('EMAIL;TYPE=INTERNET:contact@example.com')
    expect(v).toContain('ADR;TYPE=WORK:;;100 Hospitality Boulevard\\, Metropolis;;;;')
    expect(v).toContain('URL:http')
  })
  it('does not repeat the same number as WhatsApp and omits empty fields', () => {
    const w = buildVCard({ name: 'X', phone: '+910000000000', whatsapp: '+91 00000 00000' })
    expect(w.match(/TEL/g)).toHaveLength(1)
    expect(w).not.toContain('EMAIL')
  })
})
