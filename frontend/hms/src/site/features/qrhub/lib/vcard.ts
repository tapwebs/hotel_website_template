export interface VCardInput {
  name: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  website_url?: string
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const tel = (s: string) => s.replace(/[^\d+]/g, '')

/** vCard 3.0 built in the browser. CRLF line endings as the spec requires. */
export function buildVCard(o: VCardInput): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(o.name)}`, `ORG:${esc(o.name)}`]
  if (o.phone) lines.push(`TEL;TYPE=WORK,VOICE:${tel(o.phone)}`)
  if (o.whatsapp && tel(o.whatsapp) !== tel(o.phone ?? '')) lines.push(`TEL;TYPE=CELL:${tel(o.whatsapp)}`)
  if (o.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(o.email)}`)
  if (o.address) lines.push(`ADR;TYPE=WORK:;;${esc(o.address)};;;;`)
  if (o.website_url) lines.push(`URL:${esc(o.website_url)}`)
  lines.push('END:VCARD')
  return lines.join('\r\n') + '\r\n'
}
