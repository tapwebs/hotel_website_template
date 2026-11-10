import { randomInt } from 'node:crypto'
import type pg from 'pg'
import { addDays } from '../domain/bookings.ts'
import type { ImportMode, ImportOrg } from '../domain/qr-hub-io.ts'
import type { UaInfo } from '../core/ua.ts'

// ---- Row types (snake_case, as sent to the admin UI) ------------------------------------------------------------
export interface QrOrg {
  id: string
  slug: string
  name: string
  category: string
  description: string | null
  description_hi: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  maps_url: string | null
  website_url: string | null
  review_url: string | null
  profile_image: string | null
  logo: string | null
  theme: Record<string, unknown>
  wifi_ssid: string | null
  wifi_password: string | null
  wifi_visible: boolean
  qr_status: 'active' | 'inactive' | 'draft'
  status: 'published' | 'unpublished' | 'archived'
  created_at: Date
  updated_at: Date
}
export type OrgWithStats = Omit<QrOrg, 'wifi_password'> & {
  link_count: number
  placement_count: number
  visit_count: number
  click_count: number
  last_visit_at: Date | null
}
export interface QrLink {
  id: string
  organization_id: string
  title: string
  title_hi: string | null
  destination_url: string
  category: string
  icon: string | null
  description: string | null
  description_hi: string | null
  sort_order: number
  is_featured: boolean
  status: 'active' | 'disabled'
  show_from: Date | null
  show_until: Date | null
  hours: { open: string; close: string } | null
  click_count: number
  last_clicked_at: Date | null
  created_at: Date
  updated_at: Date
}
export interface QrPlacement {
  id: string
  organization_id: string
  code: string
  label: string
  kind: 'room' | 'table' | 'lobby' | 'hall' | 'desk' | 'other'
  status: 'active' | 'disabled'
  created_at: Date
  visits?: number
  clicks?: number
}
export interface QrOffer {
  id: string
  organization_id: string
  text: string
  text_hi: string | null
  link_url: string | null
  starts_at: Date | null
  ends_at: Date | null
  created_at: Date
}
export interface OrgDetail {
  organization: QrOrg
  links: QrLink[]
  placements: QrPlacement[]
  offers: QrOffer[]
}
/** Loose writable shapes: the routes hand in zod-validated objects. */
export type Data = Record<string, unknown>
export interface HubData {
  organization: Omit<QrOrg, 'id' | 'wifi_ssid' | 'wifi_password' | 'wifi_visible' | 'qr_status' | 'status' | 'created_at' | 'updated_at'>
  links: Pick<QrLink, 'id' | 'title' | 'title_hi' | 'destination_url' | 'category' | 'icon' | 'description' | 'description_hi' | 'is_featured' | 'hours'>[]
  offers: Pick<QrOffer, 'id' | 'text' | 'text_hi' | 'link_url'>[]
  placement: { code: string; label: string } | null
  wifi: { ssid: string; password: string | null } | null
}
export type HubResult = { kind: 'not_found' } | { kind: 'inactive' } | { kind: 'ok'; data: HubData }
export interface Analytics {
  range: { from: string; to: string }
  totals: { visits: number; scans: number; clicks: number; reviewClicks: number }
  daily: { date: string; visits: number; clicks: number }[]
  devices: { name: string; count: number }[]
  browsers: { name: string; count: number }[]
  referrers: { name: string; count: number }[]
  topLinks: { id: string; title: string; clicks: number }[]
  byPlacement: { placementId: string | null; code: string | null; label: string | null; scans: number; visits: number; clicks: number }[]
  byHour: { hour: number; visits: number }[]
  byWeekday: { weekday: number; visits: number }[] // 0 = Sunday
}
export interface ImportPreviewItem {
  slug: string
  action: 'create' | 'update' | 'skip'
  links: number
  placements: number
  offers: number
}
export interface ExportOrgData {
  organization: QrOrg
  links: QrLink[]
  placements: QrPlacement[]
  offers: QrOffer[]
}
export type BulkEntity = 'links' | 'placements' | 'organizations'
export type BulkAction = 'enable' | 'disable' | 'delete'

/** Domain failure; routes map `code` to an HTTP status. */
export class QrError extends Error {
  readonly code: 'not_found' | 'slug_taken' | 'code_taken' | 'ids_mismatch' | 'invalid'
  readonly detail?: unknown
  constructor(code: QrError['code'], detail?: unknown) {
    super(code)
    this.code = code
    this.detail = detail
  }
}

export interface QrStore {
  listOrgs(q: { search?: string; category?: string; status?: string }): Promise<OrgWithStats[]>
  getOrgDetail(slug: string): Promise<OrgDetail | undefined>
  createOrg(input: Data, links: Data[]): Promise<OrgDetail>
  updateOrg(slug: string, patch: Data): Promise<QrOrg>
  deleteOrg(slug: string): Promise<void>
  addLink(slug: string, input: Data): Promise<QrLink>
  updateLink(id: string, patch: Data): Promise<QrLink>
  deleteLink(id: string): Promise<void>
  reorderLinks(slug: string, ids: string[]): Promise<QrLink[]>
  addLinks(slug: string, links: Data[]): Promise<QrLink[]>
  addLinksToOrgs(slugs: string[], links: Data[]): Promise<{ organizations: number; links: number }>
  bulkAction(entity: BulkEntity, ids: string[], action: BulkAction): Promise<number>
  listPlacements(slug: string): Promise<QrPlacement[]>
  addPlacement(slug: string, input: Data): Promise<QrPlacement>
  addPlacementRange(slug: string, r: { kind: string; prefix: string; labelPrefix: string; from: number; to: number; random?: boolean }): Promise<QrPlacement[]>
  updatePlacement(id: string, patch: Data): Promise<QrPlacement>
  deletePlacement(id: string): Promise<void>
  listOffers(slug: string): Promise<QrOffer[]>
  addOffer(slug: string, input: Data): Promise<QrOffer>
  updateOffer(id: string, patch: Data): Promise<QrOffer>
  deleteOffer(id: string): Promise<void>
  analytics(slug: string | undefined, from: string, to: string): Promise<Analytics>
  csvRows(type: 'visits' | 'clicks', slug: string | undefined, from: string, to: string): Promise<Record<string, unknown>[]>
  getSettings(): Promise<Record<string, unknown>>
  putSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>>
  hub(slug: string, code: string | undefined, now: Date): Promise<HubResult>
  /** Logs a visit when the hub is published and active. `code` is returned only when it names an active placement. */
  recordVisit(slug: string, code: string | undefined, source: 'scan' | 'direct', ua: UaInfo, referrerHost: string | null): Promise<{ available: boolean; code: string | null }>
  recordClick(slug: string, target: string, code: string | undefined, ua: UaInfo, referrerHost: string | null, now: Date): Promise<void>
  exportOrgs(slugs: string[] | 'all'): Promise<ExportOrgData[]>
  importOrgs(orgs: ImportOrg[], mode: ImportMode, dryRun: boolean): Promise<ImportPreviewItem[]>
}

const SUFFIX_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (i, l, o, 0, 1)
/** 7 random characters (about 35 bits) for unguessable placement codes. */
const randomSuffix = () => Array.from({ length: 7 }, () => SUFFIX_CHARS[randomInt(SUFFIX_CHARS.length)]).join('')

// ---- Column whitelists (only these are ever written; values are always bound parameters) -------------------------
const ORG_COLS = [
  'name', 'category', 'description', 'description_hi', 'phone', 'whatsapp', 'email', 'address', 'maps_url', 'website_url', 'review_url',
  'profile_image', 'logo', 'theme', 'wifi_ssid', 'wifi_password', 'wifi_visible', 'qr_status', 'status',
]
const LINK_COLS = [
  'title', 'title_hi', 'destination_url', 'category', 'icon', 'description', 'description_hi', 'is_featured', 'status', 'show_from', 'show_until', 'hours',
]
const PLACEMENT_COLS = ['code', 'label', 'kind', 'status']
const OFFER_COLS = ['text', 'text_hi', 'link_url', 'starts_at', 'ends_at']
const JSONB = new Set(['theme', 'hours'])
const ser = (col: string, v: unknown) => (JSONB.has(col) && v !== null ? JSON.stringify(v) : v)

type Q = pg.Pool | pg.PoolClient
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')
const IST = 'Asia/Kolkata'

async function insertRow<T extends pg.QueryResultRow>(q: Q, table: string, cols: string[], data: Data, extra: Data = {}): Promise<T> {
  const obj: Data = { ...extra }
  for (const c of cols) if (data[c] !== undefined) obj[c] = ser(c, data[c])
  const keys = Object.keys(obj)
  const res = await q.query<T>(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, Object.values(obj))
  return res.rows[0]!
}
async function updateRow<T extends pg.QueryResultRow>(q: Q, table: string, cols: string[], data: Data, where: [string, unknown], touch: boolean): Promise<T | undefined> {
  const sets: string[] = []
  const params: unknown[] = []
  for (const c of cols) if (data[c] !== undefined) sets.push(`${c} = $${params.push(ser(c, data[c]))}`)
  if (touch) sets.push('updated_at = now()')
  if (!sets.length) return (await q.query<T>(`SELECT * FROM ${table} WHERE ${where[0]} = $1`, [where[1]])).rows[0]
  const res = await q.query<T>(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${where[0]} = $${params.push(where[1])} RETURNING *`, params)
  return res.rows[0]
}
const must = <T>(row: T | undefined): T => {
  if (!row) throw new QrError('not_found')
  return row
}

export function pgQrStore(pool: pg.Pool): QrStore {
  const orgBySlug = async (q: Q, slug: string) => (await q.query<QrOrg>('SELECT * FROM qr_organizations WHERE slug = $1', [slug])).rows[0]
  const needOrg = async (q: Q, slug: string) => must(await orgBySlug(q, slug))
  const nextSort = async (q: Q, orgId: string) =>
    (await q.query<{ n: number }>('SELECT COALESCE(max(sort_order) + 1, 0)::int AS n FROM qr_links WHERE organization_id = $1', [orgId])).rows[0]!.n
  const linksOf = async (q: Q, orgId: string) =>
    (await q.query<QrLink>('SELECT * FROM qr_links WHERE organization_id = $1 ORDER BY sort_order, created_at, id', [orgId])).rows
  const placementsOf = async (q: Q, orgId: string) =>
    (
      await q.query<QrPlacement>(
        `SELECT p.*,
           (SELECT count(*)::int FROM qr_visits v WHERE v.placement_id = p.id) AS visits,
           (SELECT count(*)::int FROM qr_clicks c WHERE c.placement_id = p.id) AS clicks
         FROM qr_placements p WHERE p.organization_id = $1 ORDER BY p.created_at, p.code`,
        [orgId],
      )
    ).rows
  const offersOf = async (q: Q, orgId: string) =>
    (await q.query<QrOffer>('SELECT * FROM qr_offers WHERE organization_id = $1 ORDER BY created_at DESC, id', [orgId])).rows

  /** Maps database constraint failures to domain errors; anything else propagates (the app answers 500). */
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn()
    } catch (err) {
      const e = err as { code?: string; constraint?: string }
      if (e.code === '23505') throw new QrError(e.constraint === 'qr_placements_org_code_key' ? 'code_taken' : 'slug_taken')
      if (e.code === '23514' || e.code === '22P02') throw new QrError('invalid')
      throw err
    }
  }
  const tx = <T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> =>
    wrap(async () => {
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        const r = await fn(c)
        await c.query('COMMIT')
        return r
      } catch (err) {
        await c.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        c.release()
      }
    })
  const detail = async (q: Q, org: QrOrg): Promise<OrgDetail> => ({
    organization: org,
    links: await linksOf(q, org.id),
    placements: await placementsOf(q, org.id),
    offers: await offersOf(q, org.id),
  })
  const placementByCode = async (q: Q, orgId: string, code: string | undefined) =>
    code ? (await q.query<QrPlacement>("SELECT * FROM qr_placements WHERE organization_id = $1 AND code = $2 AND status = 'active'", [orgId, code])).rows[0] : undefined
  const availableOrg = async (q: Q, slug: string) => {
    const o = await orgBySlug(q, slug)
    return o && o.status === 'published' && o.qr_status === 'active' ? o : undefined
  }
  const countRows = async (sql: string, params: unknown[]) => (await pool.query<{ name: string; count: number }>(sql, params)).rows

  return {
    listOrgs: async (f) => {
      const where: string[] = []
      const params: unknown[] = []
      if (f.search) where.push(`(o.name ILIKE $${params.push(`%${escapeLike(f.search)}%`)} OR o.slug ILIKE $${params.length})`)
      if (f.category) where.push(`o.category = $${params.push(f.category)}`)
      if (f.status) where.push(`o.status = $${params.push(f.status)}`)
      const rows = (
        await pool.query<QrOrg & Omit<OrgWithStats, keyof QrOrg>>(
          `SELECT o.*,
             (SELECT count(*)::int FROM qr_links x WHERE x.organization_id = o.id) AS link_count,
             (SELECT count(*)::int FROM qr_placements x WHERE x.organization_id = o.id) AS placement_count,
             (SELECT count(*)::int FROM qr_visits x WHERE x.organization_id = o.id) AS visit_count,
             (SELECT count(*)::int FROM qr_clicks x WHERE x.organization_id = o.id) AS click_count,
             (SELECT max(x.visited_at) FROM qr_visits x WHERE x.organization_id = o.id) AS last_visit_at
           FROM qr_organizations o ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.name, o.id`,
          params,
        )
      ).rows
      return rows.map(({ wifi_password: _w, ...rest }) => rest)
    },
    getOrgDetail: async (slug) => {
      const org = await orgBySlug(pool, slug)
      return org && (await detail(pool, org))
    },
    createOrg: (input, links) =>
      tx(async (c) => {
        const slug = input.slug as string
        const org = await insertRow<QrOrg>(c, 'qr_organizations', ORG_COLS, input, { slug })
        for (const [i, l] of links.entries()) await insertRow(c, 'qr_links', LINK_COLS, l, { organization_id: org.id, sort_order: i })
        return detail(c, org)
      }),
    updateOrg: (slug, patch) => wrap(async () => must(await updateRow<QrOrg>(pool, 'qr_organizations', ORG_COLS, patch, ['slug', slug], true))),
    deleteOrg: async (slug) => {
      must((await pool.query('DELETE FROM qr_organizations WHERE slug = $1 RETURNING id', [slug])).rows[0])
    },
    addLink: (slug, input) =>
      tx(async (c) => {
        const org = await needOrg(c, slug)
        return insertRow<QrLink>(c, 'qr_links', LINK_COLS, input, { organization_id: org.id, sort_order: await nextSort(c, org.id) })
      }),
    updateLink: (id, patch) => wrap(async () => must(await updateRow<QrLink>(pool, 'qr_links', LINK_COLS, patch, ['id', id], true))),
    deleteLink: async (id) => {
      must((await pool.query('DELETE FROM qr_links WHERE id = $1 RETURNING id', [id])).rows[0])
    },
    reorderLinks: (slug, ids) =>
      tx(async (c) => {
        const org = await needOrg(c, slug)
        const have = (await linksOf(c, org.id)).map((l) => l.id)
        if (ids.length !== have.length || new Set(ids).size !== ids.length || !ids.every((i) => have.includes(i))) throw new QrError('ids_mismatch')
        await c.query(
          'UPDATE qr_links SET sort_order = v.ord, updated_at = now() FROM unnest($1::uuid[], $2::int[]) AS v(id, ord) WHERE qr_links.id = v.id',
          [ids, ids.map((_, i) => i)],
        )
        return linksOf(c, org.id)
      }),
    addLinks: (slug, links) =>
      tx(async (c) => {
        const org = await needOrg(c, slug)
        let sort = await nextSort(c, org.id)
        const out: QrLink[] = []
        for (const l of links) out.push(await insertRow<QrLink>(c, 'qr_links', LINK_COLS, l, { organization_id: org.id, sort_order: sort++ }))
        return out
      }),
    addLinksToOrgs: (slugs, links) =>
      tx(async (c) => {
        const orgs = (await c.query<QrOrg>('SELECT * FROM qr_organizations WHERE slug = ANY($1::text[])', [slugs])).rows
        const missing = slugs.filter((s) => !orgs.some((o) => o.slug === s))
        if (missing.length) throw new QrError('not_found', { slugs: missing })
        for (const org of orgs) {
          let sort = await nextSort(c, org.id)
          for (const l of links) await insertRow(c, 'qr_links', LINK_COLS, l, { organization_id: org.id, sort_order: sort++ })
        }
        return { organizations: orgs.length, links: orgs.length * links.length }
      }),
    bulkAction: async (entity, ids, action) => {
      const table = entity === 'links' ? 'qr_links' : entity === 'placements' ? 'qr_placements' : 'qr_organizations'
      if (action === 'delete') return (await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [ids])).rowCount ?? 0
      const on = action === 'enable'
      const set =
        entity === 'organizations'
          ? `qr_status = '${on ? 'active' : 'inactive'}', updated_at = now()`
          : `status = '${on ? 'active' : 'disabled'}'${entity === 'links' ? ', updated_at = now()' : ''}`
      return (await pool.query(`UPDATE ${table} SET ${set} WHERE id = ANY($1::uuid[])`, [ids])).rowCount ?? 0
    },
    listPlacements: async (slug) => placementsOf(pool, (await needOrg(pool, slug)).id),
    addPlacement: (slug, input) =>
      wrap(async () => insertRow<QrPlacement>(pool, 'qr_placements', PLACEMENT_COLS, input, { organization_id: (await needOrg(pool, slug)).id })),
    addPlacementRange: (slug, r) =>
      tx(async (c) => {
        const org = await needOrg(c, slug)
        const items = Array.from({ length: r.to - r.from + 1 }, (_, i) => ({ code: r.random ? `${r.prefix.slice(0, 26).replace(/-+$/, '')}-${r.from + i}-${randomSuffix()}` : `${r.prefix}-${r.from + i}`, label: `${r.labelPrefix} ${r.from + i}`, kind: r.kind }))
        const taken = (
          await c.query<{ code: string }>('SELECT code FROM qr_placements WHERE organization_id = $1 AND code = ANY($2::text[])', [org.id, items.map((i) => i.code)])
        ).rows
        if (taken.length) throw new QrError('code_taken', { conflicts: taken.map((t) => t.code) })
        const out: QrPlacement[] = []
        for (const it of items) out.push(await insertRow<QrPlacement>(c, 'qr_placements', PLACEMENT_COLS, it, { organization_id: org.id }))
        return out
      }),
    updatePlacement: (id, patch) => wrap(async () => must(await updateRow<QrPlacement>(pool, 'qr_placements', PLACEMENT_COLS, patch, ['id', id], false))),
    deletePlacement: async (id) => {
      must((await pool.query('DELETE FROM qr_placements WHERE id = $1 RETURNING id', [id])).rows[0])
    },
    listOffers: async (slug) => offersOf(pool, (await needOrg(pool, slug)).id),
    addOffer: (slug, input) =>
      wrap(async () => insertRow<QrOffer>(pool, 'qr_offers', OFFER_COLS, input, { organization_id: (await needOrg(pool, slug)).id })),
    updateOffer: (id, patch) => wrap(async () => must(await updateRow<QrOffer>(pool, 'qr_offers', OFFER_COLS, patch, ['id', id], false))),
    deleteOffer: async (id) => {
      must((await pool.query('DELETE FROM qr_offers WHERE id = $1 RETURNING id', [id])).rows[0])
    },

    analytics: async (slug, from, to) => {
      const orgId = slug ? (await needOrg(pool, slug)).id : null
      const params = [orgId, new Date(`${from}T00:00:00+05:30`), new Date(`${addDays(to, 1)}T00:00:00+05:30`)]
      const vw = '($1::uuid IS NULL OR v.organization_id = $1) AND v.visited_at >= $2 AND v.visited_at < $3'
      const cw = '($1::uuid IS NULL OR c.organization_id = $1) AND c.clicked_at >= $2 AND c.clicked_at < $3'
      const local = (col: string) => `(${col} AT TIME ZONE '${IST}')`
      const [totals, dailyV, dailyC, devices, browsers, referrers, topLinks, byPlacement, placementClicks, hours, weekdays] = await Promise.all([
        pool.query<{ visits: number; scans: number; clicks: number; review: number }>(
          `SELECT (SELECT count(*)::int FROM qr_visits v WHERE ${vw}) AS visits,
                  (SELECT count(*)::int FROM qr_visits v WHERE ${vw} AND v.source = 'scan') AS scans,
                  (SELECT count(*)::int FROM qr_clicks c WHERE ${cw}) AS clicks,
                  (SELECT count(*)::int FROM qr_clicks c WHERE ${cw} AND c.is_review) AS review`,
          params,
        ),
        pool.query<{ d: string; n: number }>(`SELECT to_char(${local('v.visited_at')}, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM qr_visits v WHERE ${vw} GROUP BY 1`, params),
        pool.query<{ d: string; n: number }>(`SELECT to_char(${local('c.clicked_at')}, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM qr_clicks c WHERE ${cw} GROUP BY 1`, params),
        countRows(`SELECT v.device_type AS name, count(*)::int AS count FROM qr_visits v WHERE ${vw} GROUP BY 1 ORDER BY 2 DESC, 1`, params),
        countRows(`SELECT v.browser AS name, count(*)::int AS count FROM qr_visits v WHERE ${vw} GROUP BY 1 ORDER BY 2 DESC, 1`, params),
        countRows(`SELECT v.referrer_host AS name, count(*)::int AS count FROM qr_visits v WHERE ${vw} AND v.referrer_host IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`, params),
        pool.query<{ id: string; title: string; clicks: number }>(
          `SELECT l.id, l.title, count(*)::int AS clicks FROM qr_clicks c JOIN qr_links l ON l.id = c.link_id WHERE ${cw} GROUP BY l.id, l.title ORDER BY 3 DESC, l.title LIMIT 10`,
          params,
        ),
        pool.query<{ placementId: string | null; code: string | null; label: string | null; scans: number; visits: number }>(
          `SELECT p.id AS "placementId", p.code, p.label, (count(*) FILTER (WHERE v.source = 'scan'))::int AS scans, count(*)::int AS visits
           FROM qr_visits v LEFT JOIN qr_placements p ON p.id = v.placement_id WHERE ${vw} GROUP BY p.id, p.code, p.label ORDER BY 4 DESC, 5 DESC, p.code`,
          params,
        ),
        pool.query<{ id: string | null; n: number }>(`SELECT c.placement_id AS id, count(*)::int AS n FROM qr_clicks c WHERE ${cw} GROUP BY 1`, params),
        pool.query<{ k: number; n: number }>(`SELECT extract(hour FROM ${local('v.visited_at')})::int AS k, count(*)::int AS n FROM qr_visits v WHERE ${vw} GROUP BY 1`, params),
        pool.query<{ k: number; n: number }>(`SELECT extract(dow FROM ${local('v.visited_at')})::int AS k, count(*)::int AS n FROM qr_visits v WHERE ${vw} GROUP BY 1`, params),
      ])
      const t = totals.rows[0]!
      const dv = new Map(dailyV.rows.map((r) => [r.d, r.n]))
      const dc = new Map(dailyC.rows.map((r) => [r.d, r.n]))
      const daily: Analytics['daily'] = []
      for (let d = from; d <= to; d = addDays(d, 1)) daily.push({ date: d, visits: dv.get(d) ?? 0, clicks: dc.get(d) ?? 0 })
      const pc = new Map(placementClicks.rows.map((r) => [r.id, r.n]))
      const fill = (rows: { k: number; n: number }[], size: number) => {
        const m = new Map(rows.map((r) => [r.k, r.n]))
        return Array.from({ length: size }, (_, i) => m.get(i) ?? 0)
      }
      return {
        range: { from, to },
        totals: { visits: t.visits, scans: t.scans, clicks: t.clicks, reviewClicks: t.review },
        daily,
        devices,
        browsers,
        referrers,
        topLinks: topLinks.rows,
        byPlacement: byPlacement.rows.map((r) => ({ ...r, clicks: pc.get(r.placementId) ?? 0 })),
        byHour: fill(hours.rows, 24).map((visits, hour) => ({ hour, visits })),
        byWeekday: fill(weekdays.rows, 7).map((visits, weekday) => ({ weekday, visits })),
      }
    },
    csvRows: async (type, slug, from, to) => {
      const orgId = slug ? (await needOrg(pool, slug)).id : null
      const params = [orgId, new Date(`${from}T00:00:00+05:30`), new Date(`${addDays(to, 1)}T00:00:00+05:30`)]
      const sql =
        type === 'visits'
          ? `SELECT v.visited_at, o.slug AS organization, p.code AS placement_code, p.label AS placement_label, v.source, v.device_type, v.browser, v.os, v.referrer_host
             FROM qr_visits v JOIN qr_organizations o ON o.id = v.organization_id LEFT JOIN qr_placements p ON p.id = v.placement_id
             WHERE ($1::uuid IS NULL OR v.organization_id = $1) AND v.visited_at >= $2 AND v.visited_at < $3 ORDER BY v.visited_at DESC, v.id DESC LIMIT 50000`
          : `SELECT c.clicked_at, o.slug AS organization, COALESCE(l.title, 'Review') AS link_title, l.destination_url, p.code AS placement_code, p.label AS placement_label, c.device_type, c.browser, c.referrer_host
             FROM qr_clicks c JOIN qr_organizations o ON o.id = c.organization_id LEFT JOIN qr_links l ON l.id = c.link_id LEFT JOIN qr_placements p ON p.id = c.placement_id
             WHERE ($1::uuid IS NULL OR c.organization_id = $1) AND c.clicked_at >= $2 AND c.clicked_at < $3 ORDER BY c.clicked_at DESC, c.id DESC LIMIT 50000`
      return (await pool.query(sql, params)).rows
    },
    getSettings: async () => Object.fromEntries((await pool.query<{ key: string; value: unknown }>('SELECT key, value FROM qr_settings ORDER BY key')).rows.map((r) => [r.key, r.value])),
    putSettings: async (patch) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue
        await pool.query('INSERT INTO qr_settings (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify(v)])
      }
      return Object.fromEntries((await pool.query<{ key: string; value: unknown }>('SELECT key, value FROM qr_settings ORDER BY key')).rows.map((r) => [r.key, r.value]))
    },

    hub: async (slug, code, now) => {
      const o = await orgBySlug(pool, slug)
      if (!o || o.status !== 'published') return { kind: 'not_found' }
      if (o.qr_status !== 'active') return { kind: 'inactive' }
      const [links, offers, placement] = await Promise.all([
        pool.query<QrLink>(
          `SELECT * FROM qr_links WHERE organization_id = $1 AND status = 'active' AND (show_from IS NULL OR show_from <= $2) AND (show_until IS NULL OR show_until > $2)
           ORDER BY sort_order, created_at, id`,
          [o.id, now],
        ),
        pool.query<QrOffer>(
          `SELECT * FROM qr_offers WHERE organization_id = $1 AND (starts_at IS NULL OR starts_at <= $2) AND (ends_at IS NULL OR ends_at > $2) ORDER BY created_at DESC, id`,
          [o.id, now],
        ),
        placementByCode(pool, o.id, code),
      ])
      return {
        kind: 'ok',
        data: {
          organization: {
            slug: o.slug, name: o.name, category: o.category, description: o.description, description_hi: o.description_hi, phone: o.phone,
            whatsapp: o.whatsapp, email: o.email, address: o.address, maps_url: o.maps_url, website_url: o.website_url, review_url: o.review_url,
            profile_image: o.profile_image, logo: o.logo, theme: o.theme,
          },
          links: links.rows.map((l) => ({
            id: l.id, title: l.title, title_hi: l.title_hi, destination_url: l.destination_url, category: l.category, icon: l.icon,
            description: l.description, description_hi: l.description_hi, is_featured: l.is_featured, hours: l.hours,
          })),
          offers: offers.rows.map((f) => ({ id: f.id, text: f.text, text_hi: f.text_hi, link_url: f.link_url })),
          placement: placement ? { code: placement.code, label: placement.label } : null,
          wifi: o.wifi_visible && o.wifi_ssid ? { ssid: o.wifi_ssid, password: o.wifi_password } : null,
        },
      }
    },
    recordVisit: async (slug, code, source, ua, referrerHost) => {
      const o = await availableOrg(pool, slug)
      if (!o) return { available: false, code: null }
      const p = await placementByCode(pool, o.id, code)
      await pool.query(
        'INSERT INTO qr_visits (organization_id, placement_id, source, device_type, browser, os, referrer_host) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [o.id, p?.id ?? null, source, ua.device, ua.browser, ua.os, referrerHost],
      )
      return { available: true, code: p?.code ?? null }
    },
    recordClick: (slug, target, code, ua, referrerHost, now) =>
      tx(async (c) => {
        const o = await availableOrg(c, slug)
        if (!o) return
        const p = await placementByCode(c, o.id, code)
        const insert = (linkId: string | null) =>
          c.query(
            'INSERT INTO qr_clicks (organization_id, link_id, is_review, placement_id, device_type, browser, referrer_host) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [o.id, linkId, linkId === null, p?.id ?? null, ua.device, ua.browser, referrerHost],
          )
        if (target === 'review') {
          if (o.review_url) await insert(null)
          return
        }
        const hit = await c.query(
          'UPDATE qr_links SET click_count = click_count + 1, last_clicked_at = $3 WHERE id = $1 AND organization_id = $2 AND status = \'active\' RETURNING id',
          [target, o.id, now],
        )
        if (hit.rowCount) await insert(target)
      }),

    exportOrgs: async (slugs) => {
      const orgs =
        slugs === 'all'
          ? (await pool.query<QrOrg>('SELECT * FROM qr_organizations ORDER BY name, id')).rows
          : (await pool.query<QrOrg>('SELECT * FROM qr_organizations WHERE slug = ANY($1::text[]) ORDER BY name, id', [slugs])).rows
      if (slugs !== 'all') {
        const missing = slugs.filter((s) => !orgs.some((o) => o.slug === s))
        if (missing.length) throw new QrError('not_found', { slugs: missing })
      }
      return Promise.all(orgs.map((o) => detail(pool, o)))
    },
    importOrgs: (orgs, mode, dryRun) => {
      const run = async (q: Q, apply: boolean): Promise<ImportPreviewItem[]> => {
        const preview: ImportPreviewItem[] = []
        for (const o of orgs) {
          const existing = await orgBySlug(q, o.slug)
          const action = !existing ? 'create' : mode === 'skip' ? 'skip' : 'update'
          preview.push({ slug: o.slug, action, links: o.links.length, placements: o.placements.length, offers: o.offers.length })
          if (!apply || action === 'skip') continue
          let org: QrOrg
          if (existing) org = must(await updateRow<QrOrg>(q, 'qr_organizations', ORG_COLS, o.fields, ['id', existing.id], true))
          else org = await insertRow<QrOrg>(q, 'qr_organizations', ORG_COLS, o.fields, { slug: o.slug })
          const oldLinks = existing ? await linksOf(q, org.id) : []
          let sort = existing ? await nextSort(q, org.id) : 0
          for (const l of o.links) {
            const match = oldLinks.find((x) => x.title === l.title)
            if (match) await updateRow(q, 'qr_links', LINK_COLS, l, ['id', match.id], true)
            else await insertRow(q, 'qr_links', LINK_COLS, l, { organization_id: org.id, sort_order: sort++ })
          }
          const oldPlacements = existing ? await placementsOf(q, org.id) : []
          for (const p of o.placements) {
            const match = oldPlacements.find((x) => x.code === p.code)
            if (match) await updateRow(q, 'qr_placements', PLACEMENT_COLS, p, ['id', match.id], false)
            else await insertRow(q, 'qr_placements', PLACEMENT_COLS, p, { organization_id: org.id })
          }
          const oldOffers = existing ? await offersOf(q, org.id) : []
          for (const f of o.offers) {
            const match = oldOffers.find((x) => x.text === f.text)
            if (match) await updateRow(q, 'qr_offers', OFFER_COLS, f, ['id', match.id], false)
            else await insertRow(q, 'qr_offers', OFFER_COLS, f, { organization_id: org.id })
          }
        }
        return preview
      }
      return dryRun ? wrap(() => run(pool, false)) : tx((c) => run(c, true))
    },
  }
}
