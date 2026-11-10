export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SUFFIX_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (i, l, o, 0, 1)
/** 7 random characters (about 35 bits): makes a placement code unguessable while the label part keeps it readable. */
export function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  return Array.from(bytes, (b) => SUFFIX_CHARS[b % SUFFIX_CHARS.length]).join('')
}
/** "Restaurant Table 5" -> "restaurant-table-5-k7x9q2m" (at most 40 characters, the API limit). */
export const placementCode = (label: string, suffix: string) => `${slugify(label).slice(0, 32).replace(/-+$/, '') || 'qr'}-${suffix}`
