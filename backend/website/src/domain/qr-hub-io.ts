import { z } from 'zod'
import { linkInputSchema, offerInputSchema, orgShape, partialShape, placementInputSchema, slugField } from './schemas.ts'
import type { Data, ExportOrgData } from '../stores/qr-store.ts'

export type ImportMode = 'skip' | 'update'
export const FORMAT = 'tapmenu-qr-hub'
export const LEGACY_FORMAT = 'dream-heavens-qr-hub'
export const LIMITS = { orgs: 200, perOrg: 500 } as const

// ---- CSV -------------------------------------------------------------------------------------------------------
/** One CSV cell. Text starting with = + - @ (or tab/CR) gets a leading ' so spreadsheets never run it as a formula. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = v instanceof Date ? v.toISOString() : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return `${[columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\r\n')}\r\n`
}

// ---- Opening hours (Asia/Kolkata) ------------------------------------------------------------------------------
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
/** Open at the opening minute, closed from the closing minute. Handles overnight ranges (e.g. 18:00-02:00). */
export function openState(hours: { open: string; close: string } | null, now: Date): { open_now: boolean; opens_at: string | null } {
  if (!hours) return { open_now: true, opens_at: null }
  const m = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440
  const a = toMin(hours.open)
  const b = toMin(hours.close)
  const open = a === b ? true : a < b ? m >= a && m < b : m >= a || m < b
  return { open_now: open, opens_at: open ? null : hours.open }
}

// ---- JSON export -----------------------------------------------------------------------------------------------
const iso = (d: Date | null) => (d ? d.toISOString() : null)
/** Versioned export. No analytics, no internal ids; the Wi-Fi password only when asked for. */
export function buildExport(items: ExportOrgData[], baseUrl: string, includeWifi: boolean, now: Date) {
  return {
    format: FORMAT,
    version: 1,
    exported_at: now.toISOString(),
    organizations: items.map(({ organization: o, links, placements, offers }) => ({
      slug: o.slug,
      name: o.name,
      category: o.category,
      description: o.description,
      description_hi: o.description_hi,
      phone: o.phone,
      whatsapp: o.whatsapp,
      email: o.email,
      address: o.address,
      maps_url: o.maps_url,
      website_url: o.website_url,
      review_url: o.review_url,
      profile_image: o.profile_image,
      logo: o.logo,
      theme: o.theme,
      wifi: { ssid: o.wifi_ssid, visible: o.wifi_visible, ...(includeWifi ? { password: o.wifi_password } : {}) },
      qr_status: o.qr_status,
      status: o.status,
      links: links.map((l) => ({
        title: l.title,
        title_hi: l.title_hi,
        destination_url: l.destination_url,
        category: l.category,
        icon: l.icon,
        description: l.description,
        description_hi: l.description_hi,
        is_featured: l.is_featured,
        status: l.status,
        show_from: iso(l.show_from),
        show_until: iso(l.show_until),
        hours: l.hours,
      })),
      placements: placements.map((p) => ({ code: p.code, label: p.label, kind: p.kind, status: p.status })),
      offers: offers.map((f) => ({ text: f.text, text_hi: f.text_hi, link_url: f.link_url, starts_at: iso(f.starts_at), ends_at: iso(f.ends_at) })),
      qr_urls: [
        { placement: null, label: o.name, url: `${baseUrl}/r/${o.slug}` },
        ...placements.map((p) => ({ placement: p.code, label: p.label, url: `${baseUrl}/r/${o.slug}?p=${p.code}` })),
      ],
    })),
  }
}

// ---- JSON import -----------------------------------------------------------------------------------------------
export interface ImportOrg {
  slug: string
  /** Organization columns that were present in the file (undefined keys are left untouched on update). */
  fields: Data
  links: Data[]
  placements: Data[]
  offers: Data[]
}
export interface ImportError {
  org: string | number | null
  path: string
  message: string
}
const { wifi_ssid, wifi_password, wifi_visible, ...orgRest } = orgShape
const importOrgSchema = z.strictObject({
  ...partialShape(orgRest),
  name: orgShape.name,
  slug: slugField,
  wifi: z.strictObject({ ssid: wifi_ssid, password: wifi_password, visible: wifi_visible.optional() }).optional(),
  links: z.array(linkInputSchema).default([]),
  placements: z.array(placementInputSchema).default([]),
  offers: z.array(offerInputSchema).default([]),
  qr_urls: z.unknown().optional(), // informational; the QR targets are derived from slug and placement codes
})
const docSchema = z.object({ format: z.union([z.literal(FORMAT), z.literal(LEGACY_FORMAT)]), version: z.literal(1), organizations: z.array(z.unknown()) })

/** Validates the whole document. Any error means nothing may be applied. */
export function parseImport(body: unknown): { orgs: ImportOrg[]; errors: ImportError[] } {
  const errors: ImportError[] = []
  const doc = docSchema.safeParse(body)
  if (!doc.success) {
    return { orgs: [], errors: doc.error.issues.map((i) => ({ org: null, path: i.path.join('.'), message: i.message })) }
  }
  const raw = doc.data.organizations
  if (raw.length > LIMITS.orgs) return { orgs: [], errors: [{ org: null, path: 'organizations', message: `At most ${LIMITS.orgs} organizations per import.` }] }
  const orgs: ImportOrg[] = []
  const seen = new Set<string>()
  raw.forEach((item, idx) => {
    const label = (item as { slug?: unknown } | null)?.slug
    const who = typeof label === 'string' ? label : idx
    const add = (path: string, message: string) => errors.push({ org: who, path, message })
    for (const key of ['links', 'placements'] as const) {
      const arr = (item as Record<string, unknown> | null)?.[key]
      if (Array.isArray(arr) && arr.length > LIMITS.perOrg) return add(key, `At most ${LIMITS.perOrg} ${key} per organization.`)
    }
    const r = importOrgSchema.safeParse(item)
    if (!r.success) return r.error.issues.forEach((i) => add(i.path.join('.'), i.message))
    const { slug, wifi, links, placements, offers, qr_urls: _q, ...fields } = r.data
    if (seen.has(slug)) return add('slug', 'Duplicate slug in file.')
    seen.add(slug)
    const dup = (names: string[]) => names.find((n, i) => names.indexOf(n) !== i)
    const dupTitle = dup(links.map((l) => l.title))
    if (dupTitle) add('links', `Duplicate link title "${dupTitle}".`)
    const dupCode = dup(placements.map((p) => p.code))
    if (dupCode) add('placements', `Duplicate placement code "${dupCode}".`)
    const dupOffer = dup(offers.map((f) => f.text))
    if (dupOffer) add('offers', `Duplicate offer text "${dupOffer}".`)
    const cols: Data = { ...fields }
    if (wifi?.ssid !== undefined) cols.wifi_ssid = wifi.ssid
    if (wifi?.password !== undefined) cols.wifi_password = wifi.password
    if (wifi?.visible !== undefined) cols.wifi_visible = wifi.visible
    for (const k of Object.keys(cols)) if (cols[k] === undefined) delete cols[k]
    orgs.push({ slug, fields: cols, links, placements, offers })
  })
  return { orgs, errors }
}
