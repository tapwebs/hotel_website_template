import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { after, beforeEach, describe, test } from 'node:test'
import type pg from 'pg'
import { buildApp } from '../app.ts'
import { addDays, todayIST } from '../domain/bookings.ts'
import { hashPassword } from '../core/password.ts'
import { csvCell, openState } from '../domain/qr-hub-io.ts'
import { pgQrStore } from '../stores/qr-store.ts'
import { pgStore, type Role } from '../stores/store.ts'
import { resetDb, testPool } from '../stores/test-db.ts'
import { parseUa } from '../core/ua.ts'

const ORIGIN = 'http://localhost:5173'
const PW = 'correct horse'
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const pool: pg.Pool | undefined = await testPool()

if (!pool) {
  test('QR Hub API', { skip: 'TEST_DATABASE_URL not set' }, () => {})
} else {
  const p = pool
  after(() => p.end())

  describe('QR Hub API', () => {
    let clock = new Date('2025-06-10T06:30:00Z') // 12:00 IST, Tuesday
    const store = pgStore(p)
    const qr = pgQrStore(p)
    const app = buildApp({ store, qr, allowedOrigin: ORIGIN, rateLimit: { max: 1000, windowMs: 60_000 }, now: () => clock })
    let admin = ''

    const seedUser = async (email: string, role: Role) => {
      const id = crypto.randomUUID()
      await store.create({ id, name: email.split('@')[0]!, email, phone: null, passwordHash: await hashPassword(PW) })
      if (role !== 'guest') await store.update(id, { role })
    }
    const login = async (email: string) => {
      const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PW } })
      assert.equal(res.statusCode, 200)
      return String(res.headers['set-cookie']).split(';')[0]!
    }
    type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    const call = (method: Method, url: string, cookie?: string, payload?: unknown, origin: string | null = ORIGIN, ua?: string) =>
      app.inject({
        method,
        url,
        payload: payload as object | undefined,
        headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), ...(ua ? { 'user-agent': ua } : {}) },
      })
    const A = '/qr-hub/admin/'
    const api = (method: Method, path: string, payload?: unknown) => call(method, A + path, admin, payload)
    const pub = (method: Method, url: string, payload?: unknown, ua = MOBILE) => call(method, url, undefined, payload, null, ua)
    const mkOrg = async (slug: string, extra: object = {}, links: object[] = []) => {
      const res = await api('POST', 'organizations', { name: `Org ${slug}`, slug, category: 'Hotel', qr_status: 'active', links, ...extra })
      assert.equal(res.statusCode, 201, res.body)
      return res.json()
    }
    const link = (title: string, extra: object = {}) => ({ title, destination_url: `https://example.com/${encodeURIComponent(title)}`, ...extra })
    const hub = async (slug: string, q = '') => (await pub('GET', `/qr-hub/public/hub/${slug}${q}`)).json()
    // IST yesterday..tomorrow: rows stamped by the database clock always fall inside, whatever the time of day.
    const nearToday = () => `from=${addDays(todayIST(), -1)}&to=${addDays(todayIST(), 1)}`
    const count = async (table: string) => Number((await p.query(`SELECT count(*) FROM ${table}`)).rows[0].count)

    beforeEach(async () => {
      await resetDb(p)
      await p.query("UPDATE qr_settings SET value = '\"https://example.com\"' WHERE key = 'baseUrl'")
      clock = new Date('2025-06-10T06:30:00Z')
      await seedUser('admin@x.com', 'admin')
      await seedUser('staff@x.com', 'staff')
      await seedUser('guest@x.com', 'guest')
      admin = await login('admin@x.com')
    })

    test('migration seed: TapMenu Grand Resort with sanitized demo contact data, empty review_url', async () => {
      const sql = await readFile(join(import.meta.dirname, '..', '..', 'migrations', '0003_qr_hub.sql'), 'utf8')
      await p.query(sql.slice(sql.indexOf('-- Seed:')))
      const d = (await api('GET', 'organizations/hotel-dream-heavens')).json()
      assert.equal(d.organization.phone, '+919876543210')
      assert.equal(d.organization.whatsapp, '919876543210')
      assert.equal(d.organization.website_url, 'http://localhost:5173')
      assert.equal(d.organization.review_url, null)
      assert.equal(d.links.length, 9)
      assert.deepEqual(d.placements.map((x: { code: string }) => x.code).sort(), ['banquet-hall', 'lobby', 'reception', 'restaurant'])
    })

    test('admin guard: 401 anonymous, 403 guest and staff, 403 bad origin, on every admin route', async () => {
      const id = crypto.randomUUID()
      const routes: [Method, string, unknown?][] = [
        ['GET', 'organizations'],
        ['POST', 'organizations', { name: 'X' }],
        ['GET', 'organizations/x1'],
        ['PATCH', 'organizations/x1', { name: 'Y' }],
        ['DELETE', 'organizations/x1'],
        ['PATCH', 'organizations/x1/status', { qr_status: 'active' }],
        ['POST', 'organizations/x1/links', link('a')],
        ['PATCH', `links/${id}`, { title: 'b' }],
        ['DELETE', `links/${id}`],
        ['PUT', 'organizations/x1/links/order', { ids: [] }],
        ['POST', 'organizations/x1/links/bulk', { links: [link('a')] }],
        ['POST', 'links/bulk-to-organizations', { slugs: ['x1'], links: [link('a')] }],
        ['POST', 'bulk', { entity: 'links', ids: [id], action: 'disable' }],
        ['GET', 'organizations/x1/placements'],
        ['POST', 'organizations/x1/placements', { code: 'a', label: 'A' }],
        ['POST', 'organizations/x1/placements/bulk', { kind: 'room', prefix: 'room', labelPrefix: 'Room', from: 1, to: 2 }],
        ['PATCH', `placements/${id}`, { label: 'B' }],
        ['DELETE', `placements/${id}`],
        ['GET', 'organizations/x1/offers'],
        ['POST', 'organizations/x1/offers', { text: 'Hi' }],
        ['PATCH', `offers/${id}`, { text: 'Hi' }],
        ['DELETE', `offers/${id}`],
        ['GET', 'organizations/x1/analytics'],
        ['GET', 'analytics'],
        ['GET', 'export.csv?type=visits'],
        ['GET', 'export.json'],
        ['POST', 'import.json', { format: 'dream-heavens-qr-hub', version: 1, organizations: [] }],
        ['GET', 'settings'],
        ['PUT', 'settings', { posterCta: 'Hi' }],
        ['GET', 'organizations/x1/integrations'],
      ]
      const guest = await login('guest@x.com')
      const staff = await login('staff@x.com')
      for (const [m, path, body] of routes) {
        const anon = await call(m, A + path, undefined, body)
        assert.equal(anon.statusCode, 401, `${m} ${path}`)
        for (const c of [guest, staff]) assert.equal((await call(m, A + path, c, body)).statusCode, 403, `${m} ${path}`)
        if (m !== 'GET') {
          const bad = await call(m, A + path, admin, body, 'https://evil.example')
          assert.equal(bad.statusCode, 403, `${m} ${path}`)
          assert.deepEqual(bad.json(), { error: 'forbidden_origin' })
          assert.equal((await call(m, A + path, admin, body, null)).statusCode, 403)
        }
      }
    })

    test('organizations: create, list, get, patch, status toggle, delete', async () => {
      const created = await mkOrg('grand-hall', { wifi_ssid: 'Guest', wifi_password: 'pw123456' }, [link('Book'), link('Call', { destination_url: 'tel:+918739982231' })])
      assert.equal(created.links.length, 2)
      assert.deepEqual(created.links.map((l: { sort_order: number }) => l.sort_order), [0, 1])
      assert.equal((await api('POST', 'organizations', { name: 'Dup', slug: 'grand-hall' })).statusCode, 409)
      assert.equal((await api('POST', 'organizations', { name: 'No slug given' })).json().organization.slug, 'no-slug-given')
      const list = (await api('GET', 'organizations?search=GRAND')).json()
      assert.equal(list.items.length, 1)
      assert.equal(list.items[0].link_count, 2)
      assert.equal('wifi_password' in list.items[0], false)
      assert.equal((await api('GET', 'organizations?category=Events')).json().items.length, 0)
      const one = (await api('GET', 'organizations/grand-hall')).json()
      assert.equal(one.organization.wifi_password, 'pw123456')
      const patched = (await api('PATCH', 'organizations/grand-hall', { name: 'Grand Hall', review_url: 'https://tap-one.example/r/1', description: '' })).json()
      assert.equal(patched.organization.name, 'Grand Hall')
      assert.equal(patched.organization.description, null)
      assert.equal((await api('PATCH', 'organizations/grand-hall', {})).statusCode, 422)
      assert.equal((await api('PATCH', 'organizations/grand-hall', { slug: 'other' })).statusCode, 422)
      assert.equal((await api('PATCH', 'organizations/grand-hall/status', { qr_status: 'inactive' })).json().organization.qr_status, 'inactive')
      assert.equal((await api('PATCH', 'organizations/grand-hall/status', { qr_status: 'bogus' })).statusCode, 422)
      assert.equal((await api('GET', 'organizations/nope-x')).statusCode, 404)
      assert.equal((await api('DELETE', 'organizations/grand-hall')).statusCode, 204)
      assert.equal((await api('GET', 'organizations/grand-hall')).statusCode, 404)
      assert.equal((await api('DELETE', 'organizations/grand-hall')).statusCode, 404)
      assert.equal(await count('qr_links'), 0)
    })

    test('invalid URL schemes and fields are rejected', async () => {
      await mkOrg('urls')
      for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.example/a', 'file:///etc/passwd', 'not a url', '//x.example', 'http://']) {
        const r = await api('POST', 'organizations/urls/links', link('Bad', { destination_url: bad }))
        assert.equal(r.statusCode, 422, bad)
      }
      for (const ok of ['http://a.example', 'https://a.example/x?y=1', 'tel:+918739982231', 'mailto:a@b.example']) {
        assert.equal((await api('POST', 'organizations/urls/links', link(ok, { destination_url: ok }))).statusCode, 201, ok)
      }
      assert.equal((await api('PATCH', 'organizations/urls', { review_url: 'http://insecure.example' })).statusCode, 422)
      assert.equal((await api('PATCH', 'organizations/urls', { review_url: 'javascript:1' })).statusCode, 422)
      assert.equal((await api('PATCH', 'organizations/urls', { maps_url: 'tel:123' })).statusCode, 422)
      assert.equal((await api('PATCH', 'organizations/urls', { logo: '//evil.example/x.png' })).statusCode, 422)
      assert.equal((await api('POST', 'organizations/urls/offers', { text: 'Hi', link_url: 'javascript:1' })).statusCode, 422)
      assert.equal((await api('POST', 'organizations/urls/links', link('x', { show_from: '2025-06-10T00:00:00Z', show_until: '2025-06-09T00:00:00Z' }))).statusCode, 422)
      assert.equal((await api('POST', 'organizations/urls/links', link('x', { hours: { open: '7am', close: '23:00' } }))).statusCode, 422)
      assert.equal((await api('POST', 'organizations', { name: 'Bad slug', slug: 'Bad Slug' })).statusCode, 422)
    })

    test('links: add, patch, delete, reorder', async () => {
      await mkOrg('lk', {}, [link('One'), link('Two'), link('Three')])
      const ids = (await api('GET', 'organizations/lk')).json().links.map((l: { id: string }) => l.id)
      const added = (await api('POST', 'organizations/lk/links', link('Four'))).json().link
      assert.equal(added.sort_order, 3)
      assert.equal((await api('PATCH', `links/${added.id}`, { title: 'Four!', is_featured: true, status: 'disabled' })).json().link.status, 'disabled')
      assert.equal((await api('PATCH', `links/${added.id}`, {})).statusCode, 422)
      assert.equal((await api('PATCH', `links/${crypto.randomUUID()}`, { title: 'x' })).statusCode, 404)
      const order = [ids[2], ids[0], added.id, ids[1]]
      const re = (await api('PUT', 'organizations/lk/links/order', { ids: order })).json().links
      assert.deepEqual(re.map((l: { id: string }) => l.id), order)
      // wrong / partial / duplicated id sets change nothing
      for (const bad of [[ids[0]], [...order, crypto.randomUUID()], [ids[0], ids[0], ids[1], ids[2]]]) {
        assert.equal((await api('PUT', 'organizations/lk/links/order', { ids: bad })).statusCode, 409)
      }
      assert.deepEqual((await api('GET', 'organizations/lk')).json().links.map((l: { id: string }) => l.id), order)
      assert.equal((await api('DELETE', `links/${added.id}`)).statusCode, 204)
      assert.equal((await api('DELETE', `links/${added.id}`)).statusCode, 404)
    })

    test('bulk links are all-or-nothing, with per-row errors', async () => {
      await mkOrg('bk', {}, [link('Existing')])
      const bad = await api('POST', 'organizations/bk/links/bulk', { links: [link('A'), link('B', { destination_url: 'javascript:1' }), { title: '' }] })
      assert.equal(bad.statusCode, 400)
      const rows = bad.json().errors.map((e: { row: number }) => e.row)
      assert.deepEqual([...new Set(rows)].sort(), [1, 2])
      assert.equal(await count('qr_links'), 1)
      const ok = await api('POST', 'organizations/bk/links/bulk', { links: [link('A'), link('B')] })
      assert.equal(ok.statusCode, 201)
      assert.deepEqual(ok.json().links.map((l: { sort_order: number }) => l.sort_order), [1, 2])
      assert.equal((await api('POST', 'organizations/bk/links/bulk', { links: [] })).statusCode, 400)
      assert.equal((await api('POST', 'organizations/bk/links/bulk', { links: Array.from({ length: 501 }, (_, i) => link(`L${i}`)) })).statusCode, 400)
      assert.equal(await count('qr_links'), 3)
    })

    test('add a link set to many organizations is all-or-nothing', async () => {
      await mkOrg('one-x')
      await mkOrg('two-x')
      const res = await api('POST', 'links/bulk-to-organizations', { slugs: ['one-x', 'two-x'], links: [link('Shared'), link('Shared 2')] })
      assert.equal(res.statusCode, 201)
      assert.deepEqual(res.json(), { organizations: 2, links: 4 })
      const missing = await api('POST', 'links/bulk-to-organizations', { slugs: ['one-x', 'ghost-x'], links: [link('More')] })
      assert.equal(missing.statusCode, 404)
      assert.equal(await count('qr_links'), 4)
      assert.equal((await api('POST', 'links/bulk-to-organizations', { slugs: ['one-x'], links: [link('Ok'), { title: 'x', destination_url: 'ftp://x' }] })).statusCode, 400)
      assert.equal(await count('qr_links'), 4)
    })

    test('placements: add, duplicate, range, conflicts, limits, patch, delete', async () => {
      await mkOrg('pl')
      const one = (await api('POST', 'organizations/pl/placements', { code: 'lobby', label: 'Lobby', kind: 'lobby' })).json().placement
      assert.equal(one.status, 'active')
      assert.equal((await api('POST', 'organizations/pl/placements', { code: 'lobby', label: 'Again' })).statusCode, 409)
      assert.equal((await api('POST', 'organizations/pl/placements', { code: 'Bad Code', label: 'x' })).statusCode, 422)
      const range = await api('POST', 'organizations/pl/placements/bulk', { kind: 'room', prefix: 'room', labelPrefix: 'Room', from: 101, to: 105 })
      assert.equal(range.statusCode, 201)
      assert.deepEqual(range.json().items.map((x: { code: string; label: string }) => [x.code, x.label]).slice(0, 2), [['room-101', 'Room 101'], ['room-102', 'Room 102']])
      assert.equal(range.json().items.length, 5)
      const overlap = await api('POST', 'organizations/pl/placements/bulk', { kind: 'room', prefix: 'room', labelPrefix: 'Room', from: 104, to: 108 })
      assert.equal(overlap.statusCode, 409)
      assert.deepEqual(overlap.json().conflicts.sort(), ['room-104', 'room-105'])
      assert.equal((await api('GET', 'organizations/pl/placements')).json().items.length, 6)
      assert.equal((await api('POST', 'organizations/pl/placements/bulk', { kind: 'room', prefix: 'big', labelPrefix: 'Big', from: 1, to: 501 })).statusCode, 422)
      assert.equal((await api('POST', 'organizations/pl/placements/bulk', { kind: 'room', prefix: 'big', labelPrefix: 'Big', from: 9, to: 1 })).statusCode, 422)
      assert.equal((await api('POST', 'organizations/pl/placements/bulk', { kind: 'room', prefix: 'big', labelPrefix: 'Big', from: 1, to: 500 })).json().items.length, 500)
      assert.equal((await api('PATCH', `placements/${one.id}`, { label: 'Main lobby', status: 'disabled' })).json().placement.label, 'Main lobby')
      assert.equal((await api('DELETE', `placements/${one.id}`)).statusCode, 204)
      assert.equal((await api('DELETE', `placements/${one.id}`)).statusCode, 404)
    })

    test('offers: add, list, patch, delete, date order', async () => {
      await mkOrg('of')
      const o = (await api('POST', 'organizations/of/offers', { text: 'Brunch', text_hi: 'ब्रंच', starts_at: '2025-06-01T00:00:00Z', ends_at: '2025-06-30T00:00:00Z' })).json().offer
      assert.equal((await api('GET', 'organizations/of/offers')).json().items.length, 1)
      assert.equal((await api('POST', 'organizations/of/offers', { text: 'Bad', starts_at: '2025-06-02T00:00:00Z', ends_at: '2025-06-01T00:00:00Z' })).statusCode, 422)
      assert.equal((await api('PATCH', `offers/${o.id}`, { text: 'Brunch 20%' })).json().offer.text, 'Brunch 20%')
      assert.equal((await api('DELETE', `offers/${o.id}`)).statusCode, 204)
      assert.equal((await api('DELETE', `offers/${o.id}`)).statusCode, 404)
    })

    test('bulk enable / disable / delete for links, placements and organizations', async () => {
      const a = await mkOrg('ba', {}, [link('L1'), link('L2')])
      const b = await mkOrg('bb')
      const lids = a.links.map((l: { id: string }) => l.id)
      assert.deepEqual((await api('POST', 'bulk', { entity: 'links', ids: lids, action: 'disable' })).json(), { affected: 2 })
      assert.equal((await api('GET', 'organizations/ba')).json().links.every((l: { status: string }) => l.status === 'disabled'), true)
      await api('POST', 'bulk', { entity: 'links', ids: [lids[0]], action: 'enable' })
      assert.equal((await api('GET', 'organizations/ba')).json().links.filter((l: { status: string }) => l.status === 'active').length, 1)
      const pls = (await api('POST', 'organizations/ba/placements/bulk', { kind: 'table', prefix: 't', labelPrefix: 'Table', from: 1, to: 3 })).json().items.map((x: { id: string }) => x.id)
      await api('POST', 'bulk', { entity: 'placements', ids: pls, action: 'disable' })
      assert.equal((await api('GET', 'organizations/ba/placements')).json().items.every((x: { status: string }) => x.status === 'disabled'), true)
      assert.equal((await api('POST', 'bulk', { entity: 'placements', ids: pls.slice(0, 2), action: 'delete' })).json().affected, 2)
      const orgIds = [a.organization.id, b.organization.id]
      await api('POST', 'bulk', { entity: 'organizations', ids: orgIds, action: 'disable' })
      assert.equal((await api('GET', 'organizations/bb')).json().organization.qr_status, 'inactive')
      await api('POST', 'bulk', { entity: 'organizations', ids: [orgIds[1]], action: 'enable' })
      assert.equal((await api('GET', 'organizations/bb')).json().organization.qr_status, 'active')
      assert.equal((await api('POST', 'bulk', { entity: 'links', ids: lids, action: 'delete' })).json().affected, 2)
      assert.equal((await api('POST', 'bulk', { entity: 'organizations', ids: orgIds, action: 'delete' })).json().affected, 2)
      assert.equal(await count('qr_organizations'), 0)
      assert.equal((await api('POST', 'bulk', { entity: 'links', ids: ['nope'], action: 'delete' })).statusCode, 400)
      assert.equal((await api('POST', 'bulk', { entity: 'users', ids: lids, action: 'delete' })).statusCode, 400)
    })

    test('/r/:slug logs a scan, keeps a valid placement, and redirects to the hub', async () => {
      await mkOrg('scan-me')
      await api('POST', 'organizations/scan-me/placements', { code: 'room-101', label: 'Room 101', kind: 'room' })
      await api('POST', 'organizations/scan-me/placements', { code: 'off', label: 'Off', kind: 'other', status: 'disabled' })
      const plain = await pub('GET', '/r/scan-me')
      assert.equal(plain.statusCode, 302)
      assert.equal(plain.headers.location, `${ORIGIN}/hub/scan-me`)
      const withP = await pub('GET', '/r/scan-me?p=room-101')
      assert.equal(withP.statusCode, 302)
      assert.equal(withP.headers.location, `${ORIGIN}/hub/scan-me?p=room-101`)
      for (const code of ['nope', 'off', 'Bad Code']) {
        assert.equal((await pub('GET', `/r/scan-me?p=${encodeURIComponent(code)}`)).headers.location, `${ORIGIN}/hub/scan-me`)
      }
      const rows = (await p.query("SELECT source, placement_id, device_type, browser, os FROM qr_visits ORDER BY id")).rows
      assert.equal(rows.length, 5)
      assert.deepEqual(rows.map((r) => r.placement_id !== null), [false, true, false, false, false])
      assert.deepEqual([rows[0].source, rows[0].device_type, rows[0].browser, rows[0].os], ['scan', 'mobile', 'Safari', 'iOS'])
      assert.equal((await api('GET', 'organizations/scan-me/analytics?from=2000-01-01&to=2100-01-01')).statusCode, 422) // > 366 days
      clock = new Date()
      const a = (await api('GET', `organizations/scan-me/analytics?${nearToday()}`)).json()
      assert.equal(a.totals.visits, 5)
      assert.equal(a.totals.scans, 5)
      assert.deepEqual(a.byPlacement.map((r: { code: string | null; scans: number }) => [r.code, r.scans]), [[null, 4], ['room-101', 1]])
    })

    test('/r/:slug does not log for inactive, unpublished, unknown or bot requests', async () => {
      await mkOrg('off-1', { qr_status: 'inactive' })
      await mkOrg('off-2', { status: 'unpublished' })
      await mkOrg('off-3', { status: 'archived' })
      await mkOrg('off-4', { qr_status: 'draft' })
      for (const s of ['off-1', 'off-2', 'off-3', 'off-4', 'ghost-x', 'Bad_Slug']) {
        const r = await pub('GET', `/r/${s}`)
        assert.equal(r.statusCode, 302, s)
        assert.equal(r.headers.location, `${ORIGIN}/hub/unavailable`, s)
      }
      await mkOrg('live-x')
      const bot = await pub('GET', '/r/live-x', undefined, 'Mozilla/5.0 (compatible; Googlebot/2.1)')
      assert.equal(bot.headers.location, `${ORIGIN}/hub/live-x`)
      assert.equal(await count('qr_visits'), 0)
    })

    test('hub: published org, hidden disabled and out-of-date links, placement label', async () => {
      await mkOrg('hub-x', { description: 'Hello', description_hi: 'नमस्ते' }, [
        link('Visible', { title_hi: 'दिखता है' }),
        link('Disabled', { status: 'disabled' }),
        link('Future', { show_from: '2025-06-11T00:00:00Z' }),
        link('Past', { show_until: '2025-06-09T00:00:00Z' }),
        link('Window', { show_from: '2025-06-09T00:00:00Z', show_until: '2025-06-11T00:00:00Z' }),
      ])
      await api('POST', 'organizations/hub-x/placements', { code: 'room-9', label: 'Room 9', kind: 'room' })
      const h = await hub('hub-x', '?p=room-9')
      assert.deepEqual(h.links.map((l: { title: string }) => l.title), ['Visible', 'Window'])
      assert.equal(h.links[0].title_hi, 'दिखता है')
      assert.equal(h.links[0].open_now, true)
      assert.equal(h.organization.description_hi, 'नमस्ते')
      assert.deepEqual(h.placement, { code: 'room-9', label: 'Room 9' })
      assert.equal((await hub('hub-x', '?p=ghost')).placement, null)
      assert.equal('wifi_password' in h.organization, false)
      clock = new Date('2025-06-12T06:30:00Z') // both windows are over
      assert.deepEqual((await hub('hub-x')).links.map((l: { title: string }) => l.title), ['Visible', 'Future'])
      assert.equal((await pub('GET', '/qr-hub/public/hub/hub-x?p=Bad%20Code')).statusCode, 422)
    })

    test('hub: 404 when unpublished/archived/unknown, inactive flag, no auth needed', async () => {
      await mkOrg('pub-1', { status: 'unpublished' })
      await mkOrg('pub-2', { status: 'archived' })
      await mkOrg('pub-3', { qr_status: 'inactive' })
      assert.equal((await pub('GET', '/qr-hub/public/hub/pub-1')).statusCode, 404)
      assert.equal((await pub('GET', '/qr-hub/public/hub/pub-2')).statusCode, 404)
      assert.equal((await pub('GET', '/qr-hub/public/hub/ghost-x')).statusCode, 404)
      assert.deepEqual(await hub('pub-3'), { inactive: true })
    })

    test('hub: open_now boundaries in Asia/Kolkata, "Closed now, opens 07:00"', async () => {
      await mkOrg('hrs', {}, [link('Restaurant', { hours: { open: '07:00', close: '23:00' } }), link('Night', { hours: { open: '18:00', close: '02:00' } })])
      const at = async (utc: string) => {
        clock = new Date(utc)
        const l = (await hub('hrs')).links
        return [l[0].open_now, l[0].opens_at, l[1].open_now] as const // [Restaurant open, opens_at, Night open]
      }
      assert.deepEqual(await at('2025-06-09T01:29:00Z'), [false, '07:00', false]) // 06:59 IST
      assert.deepEqual(await at('2025-06-09T01:30:00Z'), [true, null, false]) // 07:00 IST: opens exactly now
      assert.deepEqual(await at('2025-06-09T17:29:00Z'), [true, null, true]) // 22:59 IST
      assert.deepEqual(await at('2025-06-09T17:30:00Z'), [false, '07:00', true]) // 23:00 IST: closed exactly now
      assert.deepEqual(await at('2025-06-09T20:29:00Z'), [false, '07:00', true]) // 01:59 IST: overnight range still open
      assert.deepEqual(await at('2025-06-09T20:30:00Z'), [false, '07:00', false]) // 02:00 IST: overnight range just closed
      assert.deepEqual(await at('2025-06-09T08:00:00Z'), [true, null, false]) // 13:30 IST
      assert.deepEqual(openState(null, clock), { open_now: true, opens_at: null })
    })

    test('hub: expired and future offers hidden, current shown', async () => {
      await mkOrg('off-x')
      for (const [text, starts_at, ends_at] of [
        ['Current', '2025-06-01T00:00:00Z', '2025-06-30T00:00:00Z'],
        ['Expired', '2025-05-01T00:00:00Z', '2025-06-01T00:00:00Z'],
        ['Future', '2025-07-01T00:00:00Z', '2025-07-31T00:00:00Z'],
        ['Open ended', null, null],
      ] as const) {
        assert.equal((await api('POST', 'organizations/off-x/offers', { text, starts_at, ends_at, text_hi: `${text}-hi` })).statusCode, 201)
      }
      const offers = (await hub('off-x')).offers.map((o: { text: string }) => o.text).sort()
      assert.deepEqual(offers, ['Current', 'Open ended'])
      clock = new Date('2025-07-02T00:00:00Z')
      assert.deepEqual((await hub('off-x')).offers.map((o: { text: string }) => o.text).sort(), ['Future', 'Open ended'])
    })

    test('hub: Wi-Fi card only when switched on', async () => {
      await mkOrg('wifi-x', { wifi_ssid: 'Guest', wifi_password: 'secret-pass' })
      assert.equal((await hub('wifi-x')).wifi, null)
      assert.equal(JSON.stringify(await hub('wifi-x')).includes('secret-pass'), false)
      await api('PATCH', 'organizations/wifi-x', { wifi_visible: true })
      assert.deepEqual((await hub('wifi-x')).wifi, { ssid: 'Guest', password: 'secret-pass' })
    })

    test('clicks: counted per link, review needs a review_url, disabled and bad input ignored', async () => {
      const c = await mkOrg('clk', {}, [link('Book'), link('Off', { status: 'disabled' })])
      const [book, off] = c.links.map((l: { id: string }) => l.id)
      await api('POST', 'organizations/clk/placements', { code: 'lobby', label: 'Lobby', kind: 'lobby' })
      const click = (body: unknown, ua?: string) => pub('POST', '/qr-hub/public/click', body, ua)
      assert.equal((await click({ slug: 'clk', linkId: book, placement: 'lobby' })).statusCode, 204)
      assert.equal((await click({ slug: 'clk', linkId: book })).statusCode, 204)
      assert.equal((await click({ slug: 'clk', linkId: off })).statusCode, 204)
      assert.equal((await click({ slug: 'clk', linkId: crypto.randomUUID() })).statusCode, 204)
      assert.equal((await click({ slug: 'clk', linkId: 'review' })).statusCode, 204) // no review_url yet
      assert.equal((await click({ slug: 'clk', linkId: book }, 'Googlebot/2.1')).statusCode, 204)
      assert.equal((await click({ slug: 'clk' })).statusCode, 400)
      assert.equal((await click({ slug: 'clk', linkId: 'x' })).statusCode, 400)
      assert.equal((await pub('POST', '/qr-hub/public/click', { slug: 'clk', linkId: book, pad: 'x'.repeat(2000) })).statusCode, 413)
      let d = (await api('GET', 'organizations/clk')).json()
      assert.deepEqual(d.links.map((l: { click_count: number }) => l.click_count), [2, 0])
      assert.notEqual(d.links[0].last_clicked_at, null)
      assert.equal(await count('qr_clicks'), 2)
      await api('PATCH', 'organizations/clk', { review_url: 'https://tap-one.example/review' })
      assert.equal((await click({ slug: 'clk', linkId: 'review' })).statusCode, 204)
      assert.equal(await count('qr_clicks'), 3)
      d = (await api('GET', 'organizations/clk')).json()
      assert.equal(d.placements[0].clicks, 1)
      clock = new Date()
      const a = (await api('GET', `organizations/clk/analytics?${nearToday()}`)).json()
      assert.equal(a.totals.clicks, 3)
      assert.equal(a.totals.reviewClicks, 1)
      assert.deepEqual(a.topLinks, [{ id: book, title: 'Book', clicks: 2 }])
      await api('PATCH', 'organizations/clk/status', { qr_status: 'inactive' })
      await click({ slug: 'clk', linkId: book })
      assert.equal(await count('qr_clicks'), 3)
    })

    test('direct visit endpoint logs only for live hubs', async () => {
      await mkOrg('dv', {})
      await mkOrg('dv-off', { qr_status: 'inactive' })
      assert.equal((await pub('POST', '/qr-hub/public/visit', { slug: 'dv' })).statusCode, 204)
      assert.equal((await pub('POST', '/qr-hub/public/visit', { slug: 'dv-off' })).statusCode, 204)
      assert.equal((await pub('POST', '/qr-hub/public/visit', { slug: '??' })).statusCode, 400)
      assert.deepEqual((await p.query('SELECT source FROM qr_visits')).rows, [{ source: 'direct' }])
    })

    test('analytics: busiest hours, weekdays, daily and placement ranking in Asia/Kolkata', async () => {
      const c = await mkOrg('an', {}, [link('Book')])
      const lobby = (await api('POST', 'organizations/an/placements', { code: 'lobby', label: 'Lobby', kind: 'lobby' })).json().placement.id
      const room = (await api('POST', 'organizations/an/placements', { code: 'room-1', label: 'Room 1', kind: 'room' })).json().placement.id
      const orgId = c.organization.id
      const visit = (at: string, placement: string | null, source = 'scan') =>
        p.query("INSERT INTO qr_visits (organization_id, placement_id, source, device_type, browser, os, referrer_host, visited_at) VALUES ($1,$2,$3,'mobile','Safari','iOS','insta.example',$4)", [orgId, placement, source, at])
      await visit('2025-06-10T20:30:00Z', lobby) // 02:00 IST Wed 11 Jun
      await visit('2025-06-10T20:45:00Z', lobby) // 02:15 IST Wed
      await visit('2025-06-10T18:29:00Z', room) // 23:59 IST Tue 10 Jun
      await visit('2025-06-10T18:30:00Z', null, 'direct') // 00:00 IST Wed 11 Jun
      await visit('2025-05-01T00:00:00Z', lobby) // out of range
      await p.query("INSERT INTO qr_clicks (organization_id, link_id, placement_id, clicked_at) SELECT $1::uuid, id, $2::uuid, TIMESTAMPTZ '2025-06-10T06:00:00Z' FROM qr_links LIMIT 1", [orgId, lobby])
      const a = (await api('GET', 'organizations/an/analytics?from=2025-06-09&to=2025-06-12')).json()
      assert.deepEqual(a.totals, { visits: 4, scans: 3, clicks: 1, reviewClicks: 0 })
      assert.equal(a.byHour.length, 24)
      assert.equal(a.byHour[2].visits, 2)
      assert.equal(a.byHour[23].visits, 1)
      assert.equal(a.byHour[0].visits, 1)
      assert.equal(a.byWeekday.length, 7)
      assert.equal(a.byWeekday[3].visits, 3) // Wednesday
      assert.equal(a.byWeekday[2].visits, 1) // Tuesday
      assert.deepEqual(a.daily.map((d: { date: string; visits: number; clicks: number }) => [d.date, d.visits, d.clicks]), [['2025-06-09', 0, 0], ['2025-06-10', 1, 1], ['2025-06-11', 3, 0], ['2025-06-12', 0, 0]])
      assert.deepEqual(a.byPlacement.map((r: { code: string | null; scans: number; visits: number; clicks: number }) => [r.code, r.scans, r.visits, r.clicks]), [['lobby', 2, 2, 1], ['room-1', 1, 1, 0], [null, 0, 1, 0]])
      assert.deepEqual(a.devices, [{ name: 'mobile', count: 4 }])
      assert.deepEqual(a.referrers, [{ name: 'insta.example', count: 4 }])
      const all = (await api('GET', 'analytics?from=2025-06-09&to=2025-06-12')).json()
      assert.equal(all.totals.visits, 4)
      assert.equal((await api('GET', 'analytics?from=2025-06-12&to=2025-06-09')).statusCode, 422)
      assert.equal((await api('GET', 'analytics?from=bad')).statusCode, 422)
      assert.equal((await api('GET', 'organizations/ghost-x/analytics')).statusCode, 404)
    })

    test('CSV export: columns, attachment header, formula escaping', async () => {
      assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)")
      assert.equal(csvCell('+1'), "'+1")
      assert.equal(csvCell('-1'), "'-1")
      assert.equal(csvCell('@x'), "'@x")
      assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"')
      assert.equal(csvCell(-5), '-5')
      assert.equal(csvCell(null), '')
      const c = await mkOrg('csv', {}, [link('=HYPERLINK("http://evil.example","x")'), link('Plain')])
      await pub('POST', '/qr-hub/public/click', { slug: 'csv', linkId: c.links[0].id })
      await pub('GET', '/r/csv')
      clock = new Date()
      const clicks = await api('GET', `export.csv?type=clicks&slug=csv&${nearToday()}`)
      assert.equal(clicks.statusCode, 200)
      assert.match(String(clicks.headers['content-type']), /text\/csv/)
      assert.match(String(clicks.headers['content-disposition']), /^attachment; filename="qr-hub-clicks-/)
      const lines = clicks.body.trim().split('\r\n')
      assert.equal(lines[0], 'clicked_at,organization,link_title,destination_url,placement_code,placement_label,device_type,browser,referrer_host')
      assert.equal(lines.length, 2)
      assert.ok(lines[1]!.includes(`"'=HYPERLINK(""http://evil.example"",""x"")"`), lines[1])
      const visits = await api('GET', `export.csv?type=visits&${nearToday()}`)
      assert.equal(visits.body.trim().split('\r\n')[0], 'visited_at,organization,placement_code,placement_label,source,device_type,browser,os,referrer_host')
      assert.equal(visits.body.trim().split('\r\n').length, 2)
      assert.equal((await api('GET', 'export.csv')).statusCode, 422)
      assert.equal((await api('GET', 'export.csv?type=users')).statusCode, 422)
      assert.equal((await api('GET', 'export.csv?type=visits&slug=ghost-x')).statusCode, 404)
    })

    test('JSON export: no Wi-Fi password by default, no ids or analytics, QR urls included', async () => {
      await mkOrg('ex', { wifi_ssid: 'Guest', wifi_password: 'top-secret-pw', wifi_visible: true }, [link('Book')])
      await api('POST', 'organizations/ex/placements', { code: 'lobby', label: 'Lobby', kind: 'lobby' })
      await api('POST', 'organizations/ex/offers', { text: 'Brunch' })
      await mkOrg('ex-2')
      await pub('GET', '/r/ex')
      const res = await api('GET', 'export.json?slugs=ex')
      assert.equal(res.statusCode, 200)
      assert.match(String(res.headers['content-disposition']), /^attachment; filename="qr-hub-export-2025-06-10\.json"$/)
      assert.equal(res.body.includes('top-secret-pw'), false)
      const doc = res.json()
      assert.equal(doc.format, 'tapmenu-qr-hub')
      assert.equal(doc.version, 1)
      assert.equal(doc.organizations.length, 1)
      const o = doc.organizations[0]
      assert.deepEqual(o.wifi, { ssid: 'Guest', visible: true })
      assert.deepEqual(o.qr_urls, [
        { placement: null, label: 'Org ex', url: 'https://example.com/r/ex' },
        { placement: 'lobby', label: 'Lobby', url: 'https://example.com/r/ex?p=lobby' },
      ])
      assert.equal(/"(id|organization_id|click_count|visit_count|created_at)"/.test(res.body), false)
      assert.equal((await api('GET', 'export.json?slugs=ex&includeWifi=1')).json().organizations[0].wifi.password, 'top-secret-pw')
      assert.equal((await api('GET', 'export.json')).json().organizations.length, 2)
      assert.equal((await api('GET', 'export.json?slugs=ex,ghost-x')).statusCode, 404)
      assert.equal((await api('GET', 'export.json?slugs=Bad%20Slug')).statusCode, 422)
    })

    const doc = (organizations: object[]) => ({ format: 'dream-heavens-qr-hub', version: 1, organizations })
    const imp = (body: unknown, q = 'mode=skip&dryRun=0') => api('POST', `import.json?${q}`, body)

    test('import: dry run is a no-op and previews create / update / skip', async () => {
      await mkOrg('exists-x', {}, [link('Old')])
      const file = doc([
        { slug: 'exists-x', name: 'Renamed', links: [link('Old'), link('New')], placements: [{ code: 'a', label: 'A' }] },
        { slug: 'brand-new', name: 'Brand New', category: 'Events', links: [link('X')], offers: [{ text: 'Hi' }] },
      ])
      const before = [await count('qr_organizations'), await count('qr_links'), await count('qr_placements')]
      const dry = await imp(file, 'mode=update&dryRun=1')
      assert.equal(dry.statusCode, 200)
      assert.deepEqual(dry.json().preview, [
        { slug: 'exists-x', action: 'update', links: 2, placements: 1, offers: 0 },
        { slug: 'brand-new', action: 'create', links: 1, placements: 0, offers: 1 },
      ])
      assert.equal(dry.json().applied, false)
      assert.deepEqual([await count('qr_organizations'), await count('qr_links'), await count('qr_placements')], before)
      // dryRun defaults to true
      assert.equal((await api('POST', 'import.json?mode=update', file)).json().applied, false)
      assert.deepEqual([await count('qr_organizations'), await count('qr_links')], [before[0], before[1]])
      const skip = await imp(file, 'mode=skip&dryRun=1')
      assert.deepEqual(skip.json().preview.map((x: { action: string }) => x.action), ['skip', 'create'])
    })

    test('import: skip leaves existing organizations alone, update merges by slug / title / code', async () => {
      await mkOrg('merge-x', { description: 'keep me' }, [link('Old', { destination_url: 'https://old.example' })])
      const file = doc([
        {
          slug: 'merge-x',
          name: 'Merged',
          links: [link('Old', { destination_url: 'https://new.example' }), link('Added')],
          placements: [{ code: 'lobby', label: 'Lobby', kind: 'lobby' }],
        },
        { slug: 'fresh-x', name: 'Fresh', links: [link('One'), link('Two')], wifi: { ssid: 'Net', password: 'pw-1234', visible: true }, qr_status: 'active' },
      ])
      const skipped = await imp(file, 'mode=skip&dryRun=0')
      assert.equal(skipped.statusCode, 200)
      assert.equal(skipped.json().applied, true)
      let m = (await api('GET', 'organizations/merge-x')).json()
      assert.equal(m.organization.name, 'Org merge-x')
      assert.equal(m.links.length, 1)
      assert.equal(m.links[0].destination_url, 'https://old.example')
      let f = (await api('GET', 'organizations/fresh-x')).json()
      assert.equal(f.links.length, 2)
      assert.equal(f.organization.wifi_password, 'pw-1234')
      assert.equal(f.organization.qr_status, 'active')
      await api('DELETE', 'organizations/fresh-x')
      const updated = await imp(file, 'mode=update&dryRun=0')
      assert.deepEqual(updated.json().preview.map((x: { action: string }) => x.action), ['update', 'create'])
      m = (await api('GET', 'organizations/merge-x')).json()
      assert.equal(m.organization.name, 'Merged')
      assert.equal(m.organization.description, 'keep me') // not in the file: untouched
      assert.deepEqual(m.links.map((l: { title: string; destination_url: string }) => [l.title, l.destination_url]), [['Old', 'https://new.example'], ['Added', 'https://example.com/Added']])
      assert.deepEqual(m.placements.map((x: { code: string }) => x.code), ['lobby'])
      f = (await api('GET', 'organizations/fresh-x')).json()
      assert.equal(f.links.length, 2)
      // second update is idempotent
      await imp(file, 'mode=update&dryRun=0')
      assert.equal((await api('GET', 'organizations/merge-x')).json().links.length, 2)
    })

    test('import: any invalid entry rolls everything back, errors list every problem', async () => {
      await mkOrg('safe-x', {}, [link('Keep')])
      const bad = doc([
        { slug: 'good-one', name: 'Good', links: [link('A')] },
        { slug: 'safe-x', name: 'Changed', links: [link('Keep', { destination_url: 'javascript:alert(1)' })] },
        { slug: 'good-two', name: 'Also good' },
        { slug: 'good-one', name: 'Duplicate slug' },
        { slug: 'Bad Slug', name: 'x' },
        { slug: 'dup-links', name: 'D', links: [link('Same'), link('Same')] },
      ])
      const res = await imp(bad, 'mode=update&dryRun=0')
      assert.equal(res.statusCode, 400)
      const errs = res.json().errors as { org: string | number; path: string }[]
      assert.ok(errs.some((e) => e.org === 'safe-x' && e.path.startsWith('links.0.destination_url')))
      assert.ok(errs.some((e) => e.org === 'good-one' && e.path === 'slug'))
      assert.ok(errs.some((e) => e.org === 'dup-links' && e.path === 'links'))
      assert.equal(await count('qr_organizations'), 1)
      assert.equal((await api('GET', 'organizations/safe-x')).json().organization.name, 'Org safe-x')
      const dry = await imp(bad, 'mode=update&dryRun=1')
      assert.equal(dry.statusCode, 200)
      assert.equal(dry.json().errors.length, errs.length)
      for (const wrong of [{}, { format: 'other', version: 1, organizations: [] }, { format: 'dream-heavens-qr-hub', version: 2, organizations: [] }, doc([{ slug: 'x-y', name: 'N', surprise: 1 }])]) {
        assert.equal((await imp(wrong)).statusCode, 400)
      }
      assert.equal((await api('POST', 'import.json?mode=merge', doc([]))).statusCode, 422)
    })

    test('import limits: 200 organizations, 500 links / placements per organization, 1 MB', async () => {
      const orgs = Array.from({ length: 201 }, (_, i) => ({ slug: `o-${i}`, name: `O ${i}` }))
      const tooMany = await imp(doc(orgs))
      assert.equal(tooMany.statusCode, 400)
      assert.match(tooMany.json().errors[0].message, /200/)
      assert.equal((await imp(doc(orgs.slice(0, 200)))).statusCode, 200)
      assert.equal(await count('qr_organizations'), 200)
      await p.query('DELETE FROM qr_organizations')
      const links = Array.from({ length: 501 }, (_, i) => link(`L${i}`))
      assert.equal((await imp(doc([{ slug: 'big-x', name: 'Big', links }]))).statusCode, 400)
      const places = Array.from({ length: 501 }, (_, i) => ({ code: `p-${i}`, label: `P${i}` }))
      assert.equal((await imp(doc([{ slug: 'big-x', name: 'Big', placements: places }]))).statusCode, 400)
      assert.equal(await count('qr_organizations'), 0)
      const ok = await imp(doc([{ slug: 'big-x', name: 'Big', links: links.slice(0, 500), placements: places.slice(0, 500) }]))
      assert.equal(ok.statusCode, 200, ok.body.slice(0, 300))
      assert.equal(await count('qr_links'), 500)
      const huge = JSON.stringify(doc([{ slug: 'huge-x', name: 'H', description: 'x'.repeat(1_100_000) }]))
      const res = await app.inject({ method: 'POST', url: `${A}import.json?dryRun=0`, payload: huge, headers: { cookie: admin, origin: ORIGIN, 'content-type': 'application/json' } })
      assert.equal(res.statusCode, 413)
      assert.equal(await count('qr_organizations'), 1)
      // other admin routes keep the 10 kB body limit
      assert.equal((await api('POST', 'organizations', { name: 'N', description: 'x'.repeat(11_000) })).statusCode, 413)
    })

    test('export then import restores a deleted organization, placements and offers', async () => {
      await mkOrg('rt', { wifi_ssid: 'Net', wifi_visible: true, theme: { accent: '#800020' } }, [link('A', { hours: { open: '07:00', close: '23:00' }, show_until: '2030-01-01T00:00:00Z' }), link('B', { title_hi: 'बी' })])
      await api('POST', 'organizations/rt/placements/bulk', { kind: 'room', prefix: 'room', labelPrefix: 'Room', from: 1, to: 3 })
      await api('POST', 'organizations/rt/offers', { text: 'Deal', ends_at: '2030-01-01T00:00:00Z' })
      const exported = (await api('GET', 'export.json?slugs=rt&includeWifi=1')).body
      const before = (await api('GET', 'organizations/rt')).json()
      await api('DELETE', 'organizations/rt')
      const dry = await imp(JSON.parse(exported), 'mode=skip&dryRun=1')
      assert.deepEqual(dry.json().preview, [{ slug: 'rt', action: 'create', links: 2, placements: 3, offers: 1 }])
      assert.equal((await imp(JSON.parse(exported))).statusCode, 200)
      const after = (await api('GET', 'organizations/rt')).json()
      const strip = (d: typeof before) => ({
        org: { ...d.organization, id: 0, created_at: 0, updated_at: 0 },
        links: d.links.map((l: object) => ({ ...l, id: 0, organization_id: 0, created_at: 0, updated_at: 0 })),
        placements: d.placements.map((x: object) => ({ ...x, id: 0, organization_id: 0, created_at: 0 })),
        offers: d.offers.map((x: object) => ({ ...x, id: 0, organization_id: 0, created_at: 0 })),
      })
      assert.deepEqual(strip(after), strip(before))
    })

    test('settings: defaults, update, validation', async () => {
      assert.equal((await api('GET', 'settings')).json().settings.timezone, 'Asia/Kolkata')
      const put = await api('PUT', 'settings', { baseUrl: 'https://example.org/', posterCta: 'Scan me' })
      assert.equal(put.json().settings.baseUrl, 'https://example.org')
      assert.equal(put.json().settings.posterCta, 'Scan me')
      assert.equal((await api('PUT', 'settings', { baseUrl: 'http://insecure.example' })).statusCode, 422)
      assert.equal((await api('PUT', 'settings', { timezone: 'UTC' })).statusCode, 422)
      assert.equal((await api('PUT', 'settings', {})).statusCode, 422)
      await mkOrg('st')
      assert.equal((await api('GET', 'export.json?slugs=st')).json().organizations[0].qr_urls[0].url, 'https://example.org/r/st')
    })

    test('integrations: not connected without env keys', async () => {
      await mkOrg('ig')
      for (const k of ['GA4_PROPERTY_ID', 'GA4_CLIENT_EMAIL', 'GA4_PRIVATE_KEY', 'GSC_SITE_URL', 'GSC_CLIENT_EMAIL', 'GSC_PRIVATE_KEY']) delete process.env[k]
      const r = (await api('GET', 'organizations/ig/integrations')).json()
      assert.equal(r.connected, false)
      assert.equal(r.ga4.status, 'not_connected')
      assert.equal(r.gsc.status, 'not_connected')
      assert.equal((await api('GET', 'organizations/ghost-x/integrations')).statusCode, 404)
      assert.equal((await api('GET', 'organizations/ig/integrations?days=500')).statusCode, 422)
    })

    test('public endpoints are rate limited per IP; /r still redirects', async () => {
      const limited = buildApp({ store, qr, allowedOrigin: ORIGIN, publicRateLimit: { max: 3, windowMs: 60_000 } })
      await mkOrg('rl')
      const get = (url: string) => limited.inject({ method: 'GET', url, headers: { 'user-agent': MOBILE } })
      for (let i = 0; i < 3; i++) assert.equal((await get('/qr-hub/public/hub/rl')).statusCode, 200)
      const blocked = await get('/qr-hub/public/hub/rl')
      assert.equal(blocked.statusCode, 429)
      assert.ok(Number(blocked.headers['retry-after']) > 0)
      const r = await get('/r/rl')
      assert.equal(r.statusCode, 302)
      assert.equal(await count('qr_visits'), 0)
    })

    test('user agent parsing', () => {
      assert.deepEqual(parseUa(MOBILE), { device: 'mobile', browser: 'Safari', os: 'iOS', bot: false })
      const chrome = parseUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36')
      assert.deepEqual([chrome.device, chrome.browser, chrome.os], ['desktop', 'Chrome', 'Windows'])
      assert.equal(parseUa('Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile Safari/537.36').device, 'mobile')
      assert.equal(parseUa('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1').device, 'tablet')
      assert.equal(parseUa('WhatsApp/2.23').bot, true)
      assert.equal(parseUa(undefined).device, 'unknown')
    })
  })
}
