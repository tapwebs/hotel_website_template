import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { addDays, daysBetween, todayIST } from '../domain/bookings.ts'
import { parse, type Guard } from '../core/http.ts'
import { fetchGa4 } from '../integrations/ga4.ts'
import { fetchGsc } from '../integrations/gsc.ts'
import { buildExport, openState, parseImport, toCsv } from '../domain/qr-hub-io.ts'
import { QrError, type Data, type QrStore } from '../stores/qr-store.ts'
import {
  bulkActionSchema,
  bulkLinksBodySchema,
  bulkToOrgsBodySchema,
  codeField,
  csvQuerySchema,
  exportJsonQuerySchema,
  idParamSchema,
  importQuerySchema,
  integrationsQuerySchema,
  linkInputSchema,
  linkOrderSchema,
  linkPatchSchema,
  offerInputSchema,
  offerPatchSchema,
  orgCreateSchema,
  orgListQuerySchema,
  orgPatchSchema,
  placementInputSchema,
  placementPatchSchema,
  placementRangeSchema,
  publicClickSchema,
  publicHubQuerySchema,
  publicVisitSchema,
  qrStatusBodySchema,
  rangeQuerySchema,
  settingsPutSchema,
  slugField,
  slugParamSchema,
} from '../domain/schemas.ts'
import { parseUa, refererHost } from '../core/ua.ts'

export interface QrHubOptions {
  guard: Guard
  now: () => Date
  /** Origin of the public site; /r/:slug redirects to `${siteUrl}/hub/...`. */
  siteUrl: string
  /** Per-IP budget for the public (unauthenticated) endpoints. */
  publicRateLimit?: { max: number; windowMs: number }
}

const BULK_LIMIT = 1024 * 1024
const STATUS = { not_found: 404, slug_taken: 409, code_taken: 409, ids_mismatch: 409, invalid: 422 } as const
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')

export function registerQrHub(app: FastifyInstance, qr: QrStore, o: QrHubOptions): void {
  const { guard, now, siteUrl } = o
  const limit = o.publicRateLimit ?? { max: 300, windowMs: 60_000 }

  // ---- Admin ---------------------------------------------------------------------------------------------------
  // Check order: session (401), role (403), Origin on unsafe methods (403) in onRequest (so anonymous callers never get
  // their body parsed), then validation (422; 400 for bulk/import), lookup (404), rules (409).
  type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
  const admin = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, handler: Handler, bodyLimit?: number) =>
    app.route({
      method,
      url: `/qr-hub/admin/${path}`,
      ...(bodyLimit ? { bodyLimit } : {}),
      onRequest: async (req, reply) => {
        if (!(await guard(req, reply, method !== 'GET'))) return reply
      },
      handler: async (req, reply) => {
        try {
          return await handler(req, reply)
        } catch (err) {
          if (!(err instanceof QrError)) throw err
          const extra = err.detail && typeof err.detail === 'object' ? err.detail : {}
          return reply.code(STATUS[err.code]).send({ error: err.code === 'invalid' ? 'validation_failed' : err.code, ...extra })
        }
      },
    })
  const noContent = (reply: FastifyReply) => reply.code(204).send()
  const bulkInvalid = (reply: FastifyReply, errors: { row: number | null; path: string; message: string }[]) =>
    void reply.code(400).send({ error: 'validation_failed', errors })
  /** Validates each row of a bulk body; sends 400 with per-row errors and returns undefined if any row is bad. */
  const parseRows = <T>(rows: unknown[], schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, reply: FastifyReply) => {
    const out: T[] = []
    const errors: { row: number | null; path: string; message: string }[] = []
    rows.forEach((r, i) => {
      const p = schema.safeParse(r)
      if (p.success) out.push(p.data)
      else p.error.issues.forEach((is) => errors.push({ row: i, path: is.path.join('.'), message: is.message }))
    })
    if (errors.length) return bulkInvalid(reply, errors)
    return out
  }
  const bodyOr400 = <T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, body: unknown, reply: FastifyReply) => {
    const r = schema.safeParse(body)
    if (r.success) return r.data
    bulkInvalid(reply, r.error.issues.map((i) => ({ row: null, path: i.path.join('.'), message: i.message })))
    return undefined
  }
  const range = (q: { from?: string; to?: string }, reply: FastifyReply) => {
    const to = q.to ?? todayIST(now())
    const from = q.from ?? addDays(to, -29)
    const bad = from > to ? '"from" must not be after "to".' : daysBetween(from, to) > 366 ? 'Range is limited to 366 days.' : ''
    if (!bad) return { from, to }
    reply.code(422).send({ error: 'validation_failed', issues: [{ path: 'from', message: bad }] })
    return undefined
  }
  const slugOf = (req: FastifyRequest, reply: FastifyReply) => parse(slugParamSchema, req.params, reply)?.slug

  admin('GET', 'organizations', async (req, reply) => {
    const q = parse(orgListQuerySchema, req.query, reply)
    if (q) return { items: await qr.listOrgs(q) }
  })
  admin('POST', 'organizations', async (req, reply) => {
    const body = parse(orgCreateSchema, req.body, reply)
    if (!body) return
    const { links = [], slug: given, ...fields } = body
    const slug = given ?? slugify(fields.name)
    if (!slugField.safeParse(slug).success) {
      return reply.code(422).send({ error: 'validation_failed', issues: [{ path: 'slug', message: 'Provide a valid slug.' }] })
    }
    return reply.code(201).send(await qr.createOrg({ ...fields, slug }, links as Data[]))
  })
  admin('GET', 'organizations/:slug', async (req, reply) => {
    const slug = slugOf(req, reply)
    if (!slug) return
    return (await qr.getOrgDetail(slug)) ?? reply.code(404).send({ error: 'not_found' })
  })
  admin('PATCH', 'organizations/:slug', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(orgPatchSchema, req.body, reply)
    if (slug && body) return { organization: await qr.updateOrg(slug, body) }
  })
  admin('DELETE', 'organizations/:slug', async (req, reply) => {
    const slug = slugOf(req, reply)
    if (!slug) return
    await qr.deleteOrg(slug)
    return noContent(reply)
  })
  admin('PATCH', 'organizations/:slug/status', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(qrStatusBodySchema, req.body, reply)
    if (slug && body) return { organization: await qr.updateOrg(slug, body) }
  })

  // Links
  admin('POST', 'organizations/:slug/links', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(linkInputSchema, req.body, reply)
    if (slug && body) return reply.code(201).send({ link: await qr.addLink(slug, body) })
  })
  admin('PATCH', 'links/:id', async (req, reply) => {
    const p = parse(idParamSchema, req.params, reply)
    const body = p && parse(linkPatchSchema, req.body, reply)
    if (p && body) return { link: await qr.updateLink(p.id, body) }
  })
  admin('DELETE', 'links/:id', async (req, reply) => {
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    await qr.deleteLink(p.id)
    return noContent(reply)
  })
  admin('PUT', 'organizations/:slug/links/order', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(linkOrderSchema, req.body, reply)
    if (slug && body) return { links: await qr.reorderLinks(slug, body.ids) }
  })
  admin(
    'POST',
    'organizations/:slug/links/bulk',
    async (req, reply) => {
      const slug = slugOf(req, reply)
      if (!slug) return
      const body = bodyOr400(bulkLinksBodySchema, req.body, reply)
      const links = body && parseRows(body.links, linkInputSchema, reply)
      if (links) return reply.code(201).send({ links: await qr.addLinks(slug, links) })
    },
    BULK_LIMIT,
  )
  admin(
    'POST',
    'links/bulk-to-organizations',
    async (req, reply) => {
      const body = bodyOr400(bulkToOrgsBodySchema, req.body, reply)
      const links = body && parseRows(body.links, linkInputSchema, reply)
      if (body && links) return reply.code(201).send(await qr.addLinksToOrgs(body.slugs, links))
    },
    BULK_LIMIT,
  )
  admin(
    'POST',
    'bulk',
    async (req, reply) => {
      const body = bodyOr400(bulkActionSchema, req.body, reply)
      if (body) return { affected: await qr.bulkAction(body.entity, body.ids, body.action) }
    },
    BULK_LIMIT,
  )

  // Placements
  admin('GET', 'organizations/:slug/placements', async (req, reply) => {
    const slug = slugOf(req, reply)
    if (slug) return { items: await qr.listPlacements(slug) }
  })
  admin('POST', 'organizations/:slug/placements', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(placementInputSchema, req.body, reply)
    if (slug && body) return reply.code(201).send({ placement: await qr.addPlacement(slug, body) })
  })
  admin('POST', 'organizations/:slug/placements/bulk', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(placementRangeSchema, req.body, reply)
    if (slug && body) return reply.code(201).send({ items: await qr.addPlacementRange(slug, body) })
  })
  admin('PATCH', 'placements/:id', async (req, reply) => {
    const p = parse(idParamSchema, req.params, reply)
    const body = p && parse(placementPatchSchema, req.body, reply)
    if (p && body) return { placement: await qr.updatePlacement(p.id, body) }
  })
  admin('DELETE', 'placements/:id', async (req, reply) => {
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    await qr.deletePlacement(p.id)
    return noContent(reply)
  })

  // Offers
  admin('GET', 'organizations/:slug/offers', async (req, reply) => {
    const slug = slugOf(req, reply)
    if (slug) return { items: await qr.listOffers(slug) }
  })
  admin('POST', 'organizations/:slug/offers', async (req, reply) => {
    const slug = slugOf(req, reply)
    const body = slug && parse(offerInputSchema, req.body, reply)
    if (slug && body) return reply.code(201).send({ offer: await qr.addOffer(slug, body) })
  })
  admin('PATCH', 'offers/:id', async (req, reply) => {
    const p = parse(idParamSchema, req.params, reply)
    const body = p && parse(offerPatchSchema, req.body, reply)
    if (p && body) return { offer: await qr.updateOffer(p.id, body) }
  })
  admin('DELETE', 'offers/:id', async (req, reply) => {
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    await qr.deleteOffer(p.id)
    return noContent(reply)
  })

  // Analytics + exports
  admin('GET', 'organizations/:slug/analytics', async (req, reply) => {
    const slug = slugOf(req, reply)
    const q = slug && parse(rangeQuerySchema, req.query, reply)
    const r = q && range(q, reply)
    if (slug && r) return qr.analytics(slug, r.from, r.to)
  })
  admin('GET', 'analytics', async (req, reply) => {
    const q = parse(rangeQuerySchema, req.query, reply)
    const r = q && range(q, reply)
    if (r) return qr.analytics(undefined, r.from, r.to)
  })
  admin('GET', 'export.csv', async (req, reply) => {
    const q = parse(csvQuerySchema, req.query, reply)
    const r = q && range(q, reply)
    if (!q || !r) return
    const rows = await qr.csvRows(q.type, q.slug, r.from, r.to)
    const cols =
      q.type === 'visits'
        ? ['visited_at', 'organization', 'placement_code', 'placement_label', 'source', 'device_type', 'browser', 'os', 'referrer_host']
        : ['clicked_at', 'organization', 'link_title', 'destination_url', 'placement_code', 'placement_label', 'device_type', 'browser', 'referrer_host']
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="qr-hub-${q.type}-${r.from}_${r.to}.csv"`)
      .send(toCsv(cols, rows))
  })
  admin('GET', 'export.json', async (req, reply) => {
    const q = parse(exportJsonQuerySchema, req.query, reply)
    if (!q) return
    const slugs = q.slugs === 'all' ? ('all' as const) : q.slugs.split(',').map((s) => s.trim())
    if (slugs !== 'all' && (slugs.length > 200 || !slugs.every((s) => slugField.safeParse(s).success))) {
      return reply.code(422).send({ error: 'validation_failed', issues: [{ path: 'slugs', message: 'Use "all" or up to 200 comma-separated slugs.' }] })
    }
    const [items, settings] = await Promise.all([qr.exportOrgs(slugs), qr.getSettings()])
    const doc = buildExport(items, String(settings.baseUrl ?? siteUrl), q.includeWifi === '1', now())
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="qr-hub-export-${todayIST(now())}.json"`)
      .send(JSON.stringify(doc, null, 2))
  })
  admin(
    'POST',
    'import.json',
    async (req, reply) => {
      const q = parse(importQuerySchema, req.query, reply)
      if (!q) return
      const dryRun = q.dryRun !== '0'
      const { orgs, errors } = parseImport(req.body)
      // Nothing is applied unless the whole file validates; a dry run still reports every error.
      if (errors.length) return reply.code(dryRun ? 200 : 400).send({ ...(dryRun ? {} : { error: 'validation_failed' }), preview: [], errors })
      return { preview: await qr.importOrgs(orgs, q.mode, dryRun), errors: [], applied: !dryRun }
    },
    BULK_LIMIT,
  )

  // Settings + integrations
  admin('GET', 'settings', async () => ({ settings: await qr.getSettings() }))
  admin('PUT', 'settings', async (req, reply) => {
    const body = parse(settingsPutSchema, req.body, reply)
    if (body) return { settings: await qr.putSettings(body) }
  })
  admin('GET', 'organizations/:slug/integrations', async (req, reply) => {
    const slug = slugOf(req, reply)
    const q = slug && parse(integrationsQuerySchema, req.query, reply)
    if (!slug || !q) return
    if (!(await qr.getOrgDetail(slug))) return reply.code(404).send({ error: 'not_found' })
    const [ga4, gsc] = await Promise.all([fetchGa4(slug, q.days), fetchGsc(slug, q.days)])
    return { connected: ga4.status !== 'not_connected' || gsc.status !== 'not_connected', ga4, gsc }
  })

  // ---- Public (no auth, per-IP in-memory limit) ----------------------------------------------------------------
  // ponytail: per-process counters keyed on req.ip, reset on restart. Behind a proxy TRUST_PROXY=1 is mandatory.
  const hits = new Map<string, { count: number; resetAt: number }>()
  const overLimit = (ip: string) => {
    const t = Date.now()
    for (const [k, c] of hits) if (c.resetAt <= t) hits.delete(k)
    const c = hits.get(ip) ?? { count: 0, resetAt: t + limit.windowMs }
    c.count += 1
    hits.set(ip, c)
    return c.count > limit.max ? Math.ceil((c.resetAt - t) / 1000) : 0
  }
  const throttle = async (req: FastifyRequest, reply: FastifyReply) => {
    const wait = overLimit(req.ip)
    if (wait) {
      reply.header('Retry-After', wait)
      return reply.code(429).send({ error: 'rate_limited' })
    }
  }
  const hubUrl = (slug: string, code?: string | null) => `${siteUrl}/hub/${slug}${code ? `?p=${code}` : ''}`

  app.get('/r/:slug', async (req, reply) => {
    const slug = slugParamSchema.safeParse(req.params)
    if (!slug.success) return reply.redirect(`${siteUrl}/hub/unavailable`, 302)
    const p = codeField.safeParse((req.query as { p?: unknown }).p)
    const ua = parseUa(req.headers['user-agent'])
    // Scans from bots/link previews and from over-limit IPs are not logged; the visitor is still sent on.
    if (ua.bot || overLimit(req.ip)) return reply.redirect(hubUrl(slug.data.slug, p.success ? p.data : null), 302)
    const res = await qr.recordVisit(slug.data.slug, p.success ? p.data : undefined, 'scan', ua, refererHost(req.headers.referer))
    return reply.redirect(res.available ? hubUrl(slug.data.slug, res.code) : `${siteUrl}/hub/unavailable`, 302)
  })
  app.get('/qr-hub/public/hub/:slug', { onRequest: throttle }, async (req, reply) => {
    const s = parse(slugParamSchema, req.params, reply)
    const q = s && parse(publicHubQuerySchema, req.query, reply)
    if (!s || !q) return
    const t = now()
    const res = await qr.hub(s.slug, q.p, t)
    if (res.kind === 'not_found') return reply.code(404).send({ error: 'not_found' })
    if (res.kind === 'inactive') return { inactive: true }
    return { ...res.data, links: res.data.links.map((l) => ({ ...l, ...openState(l.hours, t) })) }
  })
  app.post('/qr-hub/public/visit', { bodyLimit: 1024, onRequest: throttle }, async (req, reply) => {
    const b = publicVisitSchema.safeParse(req.body)
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' })
    const ua = parseUa(req.headers['user-agent'])
    if (!ua.bot) await qr.recordVisit(b.data.slug, undefined, 'direct', ua, refererHost(req.headers.referer))
    return reply.code(204).send()
  })
  app.post('/qr-hub/public/click', { bodyLimit: 1024, onRequest: throttle }, async (req, reply) => {
    const b = publicClickSchema.safeParse(req.body)
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' })
    const ua = parseUa(req.headers['user-agent'])
    if (!ua.bot) await qr.recordClick(b.data.slug, b.data.linkId, b.data.placement, ua, refererHost(req.headers.referer), now())
    return reply.code(204).send()
  })
}
