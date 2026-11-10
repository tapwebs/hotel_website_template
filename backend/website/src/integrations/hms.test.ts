import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { buildApp } from '../app.ts'
import { addDays, todayIST } from '../domain/bookings.ts'
import { hmsSyncHooks } from './hms.ts'
import { memoryStore, type UserStore } from '../stores/store.ts'

const ORIGIN = 'http://localhost:5173'
const KEY = 'k-test'

// Stand-in for the HMS: records integration calls. Staff reach the website API through the HMS gateway, which sends
// the integration key plus X-HMS-User-* headers (simulated by `bearer` below).
describe('HMS integration', () => {
  let hmsServer: FastifyInstance
  let hmsUrl = ''
  let calls: { path: string; key: unknown; body: any }[] = []
  let failNext = 0
  before(async () => {
    hmsServer = Fastify()
    hmsServer.post('/api/v1/integrations/website-bookings', async (req, reply) => {
      calls.push({ path: req.url, key: req.headers['x-hms-integration-key'], body: req.body })
      if (req.headers['x-hms-integration-key'] !== KEY) return reply.code(401).send({ detail: 'bad key' })
      if (failNext > 0) {
        failNext--
        return reply.code(503).send({ detail: 'down' })
      }
      return { reservation_id: 'res-1', booking_reference: 'DH-1', status: 'PENDING', total_amount_minor: 1, payment_status: 'UNPAID', stay_status: null }
    })
    await hmsServer.listen({ port: 0, host: '127.0.0.1' })
    hmsUrl = `http://127.0.0.1:${(hmsServer.server.address() as { port: number }).port}`
  })
  after(() => hmsServer.close())

  let store: UserStore
  let app: FastifyInstance
  beforeEach(() => {
    calls = []
    failNext = 0
    store = memoryStore()
    const hms = { baseUrl: hmsUrl, apiKey: KEY }
    app = buildApp({ store, allowedOrigin: ORIGIN, hms, bookingSync: hmsSyncHooks(hms, store) })
  })

  const mkBooking = async () => {
    const uid = crypto.randomUUID()
    await store.create({ id: uid, name: 'Asha Verma', email: 'a@x.com', phone: '+919812345678', passwordHash: 'x' })
    const r = await store.createBooking(uid, {
      roomId: 'deluxe', checkIn: addDays(todayIST(), 5), checkOut: addDays(todayIST(), 7),
      rooms: 1, adults: 2, children: 0, extraBed: false, specialRequests: null,
    })
    assert.ok(r.ok)
    return r.booking
  }
  const WHO: Record<string, [string, string, string, string]> = {
    desk: ['u1', 'Desk', 'd@h.in', 'staff'],
    gm: ['u3', 'Manager', 'm@h.in', 'admin'],
    kitchen: ['u2', 'Chef', 'c@h.in', 'cook'], // the gateway never forwards this role; Fastify must still refuse it
  }
  const bearer = (t: string) => {
    const w = WHO[t]
    if (!w) return { 'x-hms-integration-key': 'forged', 'x-hms-user-id': 'u9', 'x-hms-user-name': 'X', 'x-hms-user-email': 'x@h.in', 'x-hms-user-role': 'admin' }
    return { 'x-hms-integration-key': KEY, 'x-hms-user-id': w[0], 'x-hms-user-name': w[1], 'x-hms-user-email': w[2], 'x-hms-user-role': w[3] }
  }

  test('gateway: reservation staff in as staff, others and forged out', async () => {
    assert.equal((await app.inject({ url: '/admin/bookings', headers: bearer('desk') })).statusCode, 200)
    assert.equal((await app.inject({ url: '/admin/bookings', headers: bearer('kitchen') })).statusCode, 401) // no reservation permission
    assert.equal((await app.inject({ url: '/admin/bookings', headers: bearer('forged') })).statusCode, 401)
  })

  test('gateway: reservation staff stay out of admin-only routes, settings managers get in', async () => {
    for (const url of ['/admin/users', '/admin/rooms', '/admin/activity', '/admin/reports']) {
      assert.equal((await app.inject({ url, headers: bearer('desk') })).statusCode, 403, url)
      assert.equal((await app.inject({ url, headers: bearer('forged') })).statusCode, 401, url)
    }
    for (const url of ['/admin/users', '/admin/rooms', '/admin/activity', '/admin/reports']) {
      assert.equal((await app.inject({ url, headers: bearer('gm') })).statusCode, 200, url)
    }
    // a bearer admin has no website account, so the activity log keeps the name but no user id
    const r = await app.inject({ method: 'POST', url: '/admin/users', headers: bearer('gm'), payload: { name: 'New Staff', email: 'n@x.com', password: 'long enough pw' } })
    assert.equal(r.statusCode, 201)
    const acts = (await app.inject({ url: '/admin/activity', headers: bearer('gm') })).json().items
    assert.equal(acts[0].action, 'user.created')
    assert.match(acts[0].actorName, /Manager \(HMS\)/)
  })

  test('gateway trust is off without HMS config', async () => {
    const plain = buildApp({ store, allowedOrigin: ORIGIN })
    assert.equal((await plain.inject({ url: '/admin/bookings', headers: bearer('desk') })).statusCode, 401)
  })

  test('gateway PATCH works without Origin and is attributed without an FK actor', async () => {
    const b = await mkBooking()
    const r = await app.inject({ method: 'PATCH', url: `/admin/bookings/${b.id}`, headers: bearer('desk'), payload: { status: 'confirmed' } })
    assert.equal(r.statusCode, 200)
    assert.equal(r.json().booking.status, 'confirmed')
    const sync = calls.at(-1)!
    assert.equal(sync.body.status, 'confirmed')
    assert.equal(sync.body.external_booking_ref, b.reference)
    assert.equal(sync.body.website_room_id, 'deluxe')
    assert.equal(sync.body.guest_phone, '+919812345678')
    assert.equal(sync.key, KEY)
  })

  test('sync-hms stores the HMS id and retries 5xx once', async () => {
    const b = await mkBooking()
    failNext = 1 // one 503, then success: retried inside the client
    const ok = await app.inject({ method: 'POST', url: `/admin/bookings/${b.id}/sync-hms`, headers: bearer('desk') })
    assert.equal(ok.statusCode, 200)
    assert.equal(ok.json().booking.externalHmsBookingId, 'res-1')
    assert.equal(calls.length, 2)
  })

  test('sync-hms reports 502 when the HMS rejects, and does not link', async () => {
    const b = await mkBooking()
    const bad = buildApp({ store, allowedOrigin: ORIGIN, hms: { baseUrl: hmsUrl, apiKey: 'wrong' } })
    // the gateway trust uses the same endpoint key, so send identity headers carrying the (wrong) key `bad` holds
    const r = await bad.inject({ method: 'POST', url: `/admin/bookings/${b.id}/sync-hms`, headers: { ...bearer('desk'), 'x-hms-integration-key': 'wrong' } })
    assert.equal(r.statusCode, 502)
    assert.equal(calls.length, 1) // 401 is final, not retried
    assert.equal((await store.getAdminBooking(b.id))?.externalHmsBookingId, null)
  })

  test('sync-hms route is unreachable without HMS config', async () => {
    const plain = buildApp({ store, allowedOrigin: ORIGIN })
    const b = await mkBooking()
    const r = await plain.inject({ method: 'POST', url: `/admin/bookings/${b.id}/sync-hms`, headers: bearer('desk') })
    assert.equal(r.statusCode, 401) // no bridge without HMS config, so not even reachable
  })

  test('website rate edits are locked when HMS is connected', async () => {
    const adminId = crypto.randomUUID()
    await store.create({ id: adminId, name: 'Boss', email: 'boss@x.com', phone: null, passwordHash: await (await import('../core/password.ts')).hashPassword('correct horse') })
    await store.update(adminId, { role: 'admin' })
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'boss@x.com', password: 'correct horse' } })
    const cookie = String(login.headers['set-cookie']).split(';')[0]!
    const r = await app.inject({ method: 'PUT', url: '/admin/rooms/deluxe', headers: { cookie, origin: ORIGIN }, payload: { rate: 1800 } })
    assert.equal(r.statusCode, 409)
    assert.deepEqual(r.json(), { error: 'rates_managed_by_hms' })
  })

  test('hook failure never blocks the admin update', async () => {
    const b = await mkBooking()
    failNext = 99
    const r = await app.inject({ method: 'PATCH', url: `/admin/bookings/${b.id}`, headers: bearer('desk'), payload: { status: 'confirmed' } })
    assert.equal(r.statusCode, 200)
    assert.equal(r.json().booking.externalHmsBookingId, null)
  })
})
