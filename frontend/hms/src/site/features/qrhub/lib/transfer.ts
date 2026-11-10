import { HOTEL_SLUG } from './paths'
import type { Workspace } from './types'

/** Parts of the hotel hub that can be exported or imported on their own. */
export const SECTIONS = ['details', 'wifi', 'links', 'offers', 'placements'] as const
export type Section = (typeof SECTIONS)[number]
export const SECTION_LABEL: Record<Section, string> = {
  details: 'Hotel details',
  wifi: 'Wi-Fi',
  links: 'Links',
  offers: 'Offers',
  placements: 'QR codes (rooms and places)',
}
const DETAIL_KEYS = [
  'category', 'description', 'description_hi', 'phone', 'whatsapp', 'email', 'address', 'maps_url', 'website_url', 'review_url',
  'profile_image', 'logo', 'theme', 'qr_status', 'status',
] as const

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])

/** The hotel's entry in an export document: the matching slug, else the first organization. */
export function hotelEntry(doc: unknown): { entry: Obj | null; others: number } {
  const orgs = isObj(doc) ? arr(doc.organizations) : []
  const entry = orgs.find((o) => o.slug === HOTEL_SLUG) ?? orgs[0] ?? null
  return { entry, others: Math.max(0, orgs.length - (entry ? 1 : 0)) }
}

/** Keeps only the chosen sections of a full export (name and slug always stay, the importer needs them). */
export function pickSections(doc: unknown, sections: ReadonlySet<Section>): Obj {
  const d = isObj(doc) ? doc : {}
  const { entry } = hotelEntry(doc)
  const e = entry ?? {}
  const out: Obj = { slug: e.slug ?? HOTEL_SLUG, name: e.name ?? '' }
  if (sections.has('details')) for (const k of DETAIL_KEYS) if (k in e) out[k] = e[k]
  if (sections.has('wifi') && isObj(e.wifi)) out.wifi = e.wifi
  if (sections.has('links')) out.links = e.links ?? []
  if (sections.has('offers')) out.offers = e.offers ?? []
  if (sections.has('placements')) out.placements = e.placements ?? []
  const urls = arr(e.qr_urls)
  out.qr_urls = sections.has('placements') ? urls : urls.filter((u) => u.placement === null)
  return { format: d.format, version: d.version, exported_at: d.exported_at, organizations: [out] }
}

/** QR addresses as CSV (for a printer or a spreadsheet): label, code, address. */
export function qrCsv(doc: unknown): string {
  const cell = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const rows = arr(hotelEntry(doc).entry?.qr_urls).map((u) => [cell(u.label), cell(u.placement ?? 'master'), cell(u.url)].join(','))
  return ['label,code,url', ...rows].join('\r\n') + '\r\n'
}

export type Mode = 'add' | 'update'
export interface SectionSummary {
  present: boolean
  total: number
  add: number
  update: number
}

const keyOf: Record<'links' | 'offers' | 'placements', string> = { links: 'title', offers: 'text', placements: 'code' }
const existing = (cur: Workspace, s: 'links' | 'offers' | 'placements'): Set<string> =>
  new Set(
    (s === 'links' ? cur.links.map((l) => l.title) : s === 'offers' ? cur.offers.map((o) => o.text) : cur.placements.map((p) => p.code)).map((x) => x.trim().toLowerCase()),
  )

/** What importing `doc` would do to the current hotel hub, per section. */
export function summarize(doc: unknown, cur: Workspace): Record<Section, SectionSummary> {
  const e = hotelEntry(doc).entry ?? {}
  const sum = (s: 'links' | 'offers' | 'placements'): SectionSummary => {
    const items = arr(e[s])
    const have = existing(cur, s)
    const update = items.filter((i) => have.has(String(i[keyOf[s]] ?? '').trim().toLowerCase())).length
    return { present: Array.isArray(e[s]), total: items.length, update, add: items.length - update }
  }
  const hasDetails = DETAIL_KEYS.some((k) => k in e)
  return {
    details: { present: hasDetails, total: hasDetails ? 1 : 0, add: 0, update: hasDetails ? 1 : 0 },
    wifi: { present: isObj(e.wifi), total: isObj(e.wifi) ? 1 : 0, add: 0, update: isObj(e.wifi) ? 1 : 0 },
    links: sum('links'),
    offers: sum('offers'),
    placements: sum('placements'),
  }
}

/**
 * The document to send to the API: always for the one hotel hub, only the chosen sections.
 * mode 'add' leaves items that already exist untouched and never edits details or Wi-Fi.
 */
export function buildImport(doc: unknown, sections: ReadonlySet<Section>, mode: Mode, cur: Workspace): Obj {
  const e = hotelEntry(doc).entry ?? {}
  const o = cur.organization
  const out: Obj = { slug: HOTEL_SLUG, name: sections.has('details') && mode === 'update' && typeof e.name === 'string' ? e.name : o.name }
  if (mode === 'update') {
    if (sections.has('details')) for (const k of DETAIL_KEYS) if (k in e) out[k] = e[k]
    if (sections.has('wifi') && isObj(e.wifi)) out.wifi = e.wifi
  }
  for (const s of ['links', 'offers', 'placements'] as const) {
    if (!sections.has(s)) continue
    const have = existing(cur, s)
    const items = arr(e[s])
    out[s] = mode === 'add' ? items.filter((i) => !have.has(String(i[keyOf[s]] ?? '').trim().toLowerCase())) : items
  }
  return { format: isObj(doc) ? doc.format : undefined, version: isObj(doc) ? doc.version : undefined, organizations: [out] }
}
