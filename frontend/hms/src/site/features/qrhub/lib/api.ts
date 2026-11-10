// Typed client for the QR Hub API (plan section 5). Calls go through the /api/v1/website gateway with the HMS bearer token.
import { authBaseUrl, authHeaders } from '@/site/features/auth/authService'
import type {
  Analytics,
  BulkAction,
  BulkEntity,
  ImportPreviewRow,
  ImportResult,
  IntegrationSummary,
  Link,
  LinkInput,
  Offer,
  OfferInput,
  OrgInput,
  OrgWithStats,
  Organization,
  Placement,
  PlacementRange,
  PublicHub,
  QrSettings,
  RowError,
  SessionUser,
  Workspace,
} from './types'

// The API sends null for unset text fields; the hub types and components expect ''. Convert at the boundary.
const KEEP_NULL = new Set(['hours', 'placement', 'wifi', 'opens_at', 'theme'])
function emptyStrings<T>(v: T): T {
  if (Array.isArray(v)) return v.map(emptyStrings) as T
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null && !KEEP_NULL.has(k) ? '' : emptyStrings(x)])) as T
  return v
}

export class ApiError extends Error {
  readonly status: number
  readonly rows: RowError[]
  constructor(status: number, message: string, rows: RowError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.rows = rows
  }
}

export interface ApiOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

const ADMIN = '/qr-hub/admin'
const PUBLIC = '/qr-hub/public'

const q = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}
const enc = encodeURIComponent

function readRows(body: unknown): RowError[] {
  const raw = (body as { rows?: unknown; errors?: unknown } | null)?.rows ?? (body as { errors?: unknown } | null)?.errors
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r, i): RowError[] => {
    if (typeof r === 'string') return [{ index: i, message: r }]
    if (r && typeof r === 'object') {
      const o = r as { index?: unknown; row?: unknown; message?: unknown; error?: unknown }
      const message = typeof o.message === 'string' ? o.message : typeof o.error === 'string' ? o.error : ''
      const idx = typeof o.index === 'number' ? o.index : typeof o.row === 'number' ? o.row : i
      if (message) return [{ index: idx, message }]
    }
    return []
  })
}

function errorFrom(status: number, body: unknown): ApiError {
  const b = body as { error?: unknown; message?: unknown } | null
  const text = typeof b?.error === 'string' ? b.error : typeof b?.message === 'string' ? b.message : ''
  const fallback =
    status === 401
      ? 'Please sign in again.'
      : status === 403
        ? 'You do not have access to this.'
        : status === 404
          ? 'Not found.'
          : 'Something went wrong.'
  return new ApiError(status, text || fallback, readRows(body))
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const series = (v: unknown, n: number): number[] => {
  const out = Array<number>(n).fill(0)
  if (!Array.isArray(v)) return out
  v.forEach((x, i) => {
    if (typeof x === 'number') {
      if (i < n) out[i] = x
    } else if (x && typeof x === 'object') {
      const o = x as { hour?: number; weekday?: number; count?: number; total?: number; visits?: number }
      const idx = o.hour ?? o.weekday ?? i
      if (idx >= 0 && idx < n) out[idx] = num(o.visits ?? o.count ?? o.total)
    }
  })
  return out
}

/** Fills gaps so a slightly different server shape cannot crash the analytics screens. */
export function normalizeAnalytics(raw: unknown): Analytics {
  const a = (raw ?? {}) as Record<string, unknown>
  const t = (a.totals ?? {}) as Record<string, unknown>
  return {
    totals: { visits: num(t.visits), scans: num(t.scans ?? t.visits), clicks: num(t.clicks) },
    daily: list(a.daily),
    devices: list(a.devices),
    browsers: list(a.browsers),
    referrers: list(a.referrers),
    topLinks: list(a.topLinks),
    byPlacement: list(a.byPlacement),
    byHour: series(a.byHour, 24),
    byWeekday: series(a.byWeekday, 7),
  }
}

function normalizeWorkspace(raw: unknown): Workspace {
  const d = (raw ?? {}) as Record<string, unknown>
  return {
    organization: (d.organization ?? d) as Organization,
    links: list<Link>(d.links),
    placements: list<Placement>(d.placements),
    offers: list<Offer>(d.offers),
  }
}

export function createApi(opts: ApiOptions = {}) {
  const base = () => authBaseUrl({ baseUrl: opts.baseUrl })

  async function send(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Response> {
    const root = base()
    if (!root) throw new ApiError(0, 'The API is not configured (VITE_AUTH_API_URL).')
    const hasBody = init.body !== undefined
    let res: Response
    try {
      res = await (opts.fetchImpl ?? fetch)(`${root}${path}`, {
        method: init.method ?? 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json', ...authHeaders(), ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
        body: hasBody ? JSON.stringify(init.body) : undefined,
      })
    } catch {
      throw new ApiError(0, 'We could not reach the server. Check your connection and try again.')
    }
    if (!res.ok) throw errorFrom(res.status, await res.json().catch(() => null))
    return res
  }

  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await send(path, { method, body })
    if (res.status === 204) return undefined as T
    return (await res.json().catch(() => undefined)) as T
  }

  async function download(path: string, fallbackName: string): Promise<{ blob: Blob; filename: string }> {
    const res = await send(path, { headers: { Accept: '*/*' } })
    const cd = res.headers.get('Content-Disposition') ?? ''
    const filename = /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? fallbackName
    return { blob: await res.blob(), filename }
  }

  const org = (slug: string) => `${ADMIN}/organizations/${enc(slug)}`

  return {
    // session
    me: async (): Promise<SessionUser | null> => {
      try {
        const d = await call<{ user?: SessionUser | null }>('/auth/me')
        return d?.user ?? null
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null
        throw e
      }
    },
    logout: () => call<void>('/auth/logout', 'POST'),

    // organizations
    listOrganizations: async (f: { search?: string; category?: string; status?: string } = {}) =>
      list<OrgWithStats & { visit_count?: number }>((await call<{ items?: unknown }>(`${ADMIN}/organizations${q(f)}`))?.items).map((o) => ({ ...o, visits: o.visits ?? o.visit_count ?? 0 })),
    createOrganization: (o: Partial<OrgInput> & { name: string; slug: string }, links: LinkInput[] = []) =>
      call<unknown>(`${ADMIN}/organizations`, 'POST', { ...o, links }).then(normalizeWorkspace),
    getWorkspace: (slug: string) => call<unknown>(org(slug)).then(normalizeWorkspace),
    updateOrganization: (slug: string, patch: Partial<OrgInput>) => call<unknown>(org(slug), 'PATCH', patch),
    deleteOrganization: (slug: string) => call<void>(org(slug), 'DELETE'),
    setQrStatus: (slug: string, qr_status: string) => call<unknown>(`${org(slug)}/status`, 'PATCH', { qr_status }),

    // links
    addLink: (slug: string, l: LinkInput) => call<Link>(`${org(slug)}/links`, 'POST', l),
    updateLink: (id: string, patch: Partial<LinkInput>) => call<Link>(`${ADMIN}/links/${enc(id)}`, 'PATCH', patch),
    deleteLink: (id: string) => call<void>(`${ADMIN}/links/${enc(id)}`, 'DELETE'),
    reorderLinks: (slug: string, ids: string[]) => call<void>(`${org(slug)}/links/order`, 'PUT', { ids }),
    bulkLinks: (slug: string, links: LinkInput[]) => call<unknown>(`${org(slug)}/links/bulk`, 'POST', { links }),
    bulkLinksToOrganizations: (slugs: string[], links: LinkInput[]) =>
      call<unknown>(`${ADMIN}/links/bulk-to-organizations`, 'POST', { slugs, links }),
    bulk: (entity: BulkEntity, ids: string[], action: BulkAction) => call<unknown>(`${ADMIN}/bulk`, 'POST', { entity, ids, action }),

    // placements
    listPlacements: async (slug: string) => list<Placement>((await call<{ items?: unknown }>(`${org(slug)}/placements`))?.items),
    addPlacement: (slug: string, p: Pick<Placement, 'code' | 'label' | 'kind'>) => call<Placement>(`${org(slug)}/placements`, 'POST', p),
    syncRoomPlacements: (slug: string, dryRun = false) =>
      call<{ created: Placement[]; wouldCreate?: string[]; existing: number }>(`${org(slug)}/placements/rooms${dryRun ? '?dry_run=true' : ''}`, 'POST'),
    bulkPlacements: (slug: string, r: PlacementRange) => call<unknown>(`${org(slug)}/placements/bulk`, 'POST', r),
    updatePlacement: (id: string, patch: Partial<Placement>) => call<Placement>(`${ADMIN}/placements/${enc(id)}`, 'PATCH', patch),
    deletePlacement: (id: string) => call<void>(`${ADMIN}/placements/${enc(id)}`, 'DELETE'),

    // offers
    listOffers: async (slug: string) => list<Offer>((await call<{ items?: unknown }>(`${org(slug)}/offers`))?.items),
    addOffer: (slug: string, o: OfferInput) => call<Offer>(`${org(slug)}/offers`, 'POST', o),
    updateOffer: (id: string, patch: Partial<OfferInput>) => call<Offer>(`${ADMIN}/offers/${enc(id)}`, 'PATCH', patch),
    deleteOffer: (id: string) => call<void>(`${ADMIN}/offers/${enc(id)}`, 'DELETE'),

    // analytics, exports
    analytics: (range: { from?: string; to?: string }, slug?: string) =>
      call<unknown>(`${slug ? org(slug) + '/analytics' : ADMIN + '/analytics'}${q(range)}`).then(normalizeAnalytics),
    exportCsv: (f: { type: 'visits' | 'clicks'; slug?: string; from?: string; to?: string }) =>
      download(`${ADMIN}/export.csv${q(f)}`, `${f.type}.csv`),
    exportJson: (slugs: string[] | 'all', includeWifi: boolean) =>
      download(
        `${ADMIN}/export.json${q({ slugs: slugs === 'all' ? 'all' : slugs.join(','), includeWifi: includeWifi ? 1 : 0 })}`,
        'qr-hub-export.json',
      ),
    importJson: (data: unknown, mode: 'skip' | 'update', dryRun: boolean) =>
      call<ImportResult>(`${ADMIN}/import.json${q({ mode, dryRun: dryRun ? 1 : 0 })}`, 'POST', data).then((r) => ({
        preview: list<ImportPreviewRow>(r?.preview),
        errors: list<string | { org?: string; path?: string; message?: string }>(r?.errors).map((e) =>
          typeof e === 'string' ? e : [e.org, e.path, e.message].filter(Boolean).join(': '),
        ),
      })),

    // settings, integrations
    getSettings: async () => ((await call<{ settings?: QrSettings }>(`${ADMIN}/settings`))?.settings ?? {}) as QrSettings,
    saveSettings: (s: QrSettings) => call<unknown>(`${ADMIN}/settings`, 'PUT', s),
    integrations: (slug: string) => call<IntegrationSummary>(`${org(slug)}/integrations`),

    // public hub (no auth needed, same client)
    publicHub: async (slug: string, placement?: string) => {
      const raw = await call<PublicHub & { wifi?: { ssid?: string; password?: string } | null }>(`${PUBLIC}/hub/${enc(slug)}${q({ p: placement })}`)
      // The API sends the Wi-Fi card as a top-level `wifi` object (only when enabled); the hub reads it from the organization.
      if (raw && !raw.inactive && raw.organization) {
        raw.organization.wifi_ssid = raw.wifi?.ssid ?? null
        raw.organization.wifi_password = raw.wifi?.password ?? null
      }
      return emptyStrings(raw)
    },
    publicVisit: (slug: string) => call<void>(`${PUBLIC}/visit`, 'POST', { slug }),
    /** Fire-and-forget click beacon. Uses sendBeacon so it survives navigation. */
    publicClick(slug: string, linkId: string, placement?: string) {
      const url = `${base()}${PUBLIC}/click`
      const body = JSON.stringify({ slug, linkId, ...(placement ? { placement } : {}) })
      if (
        typeof navigator !== 'undefined' &&
        'sendBeacon' in navigator &&
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      )
        return
      void (opts.fetchImpl ?? fetch)(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined)
    },
  }
}

export const api = createApi()
