import assert from 'node:assert/strict'
import { after, beforeEach, describe, test } from 'node:test'
import type pg from 'pg'
import { buildApp } from '../app.ts'
import { addDays, todayIST } from '../domain/bookings.ts'
import type { BookingSyncHooks } from '../integrations/types.ts'
import { hashPassword } from '../core/password.ts'
import { memoryStore, pgStore, type Role, type UserStore } from '../stores/store.ts'
import { resetDb, testPool } from '../stores/test-db.ts'

const ORIGIN = 'http://localhost:5173'
const PW = 'correct horse'
const TODAY = todayIST()
const payload = (over: Record<string, unknown> = {}) => ({
  roomId: 'deluxe',
  checkIn: addDays(TODAY, 10),
  checkOut: addDays(TODAY, 12),
  rooms: 1,
  adults: 2,
  ...over,
})

function suite(label: string, make: () => UserStore, reset: () => Promise<void>) {
  describe(`account API: ${label}`, () => {
    let store: UserStore
    let app: ReturnType<typeof buildApp>
    let calls: string[]
    const build = (rateLimit = { max: 1000, windowMs: 60_000 }, bookingSync?: BookingSyncHooks) =>
      buildApp({ store, allowedOrigin: ORIGIN, rateLimit, bookingSync })
    beforeEach(async () => {
      await reset()
      store = make()
      calls = []
      app = build(undefined, {
        onBookingCreated: async (b) => void calls.push(`created:${b.reference}`),
        onBookingChanged: async (b) => void calls.push(`changed:${b.status}`),
      })
    })
    const seed = async (email: string, role: Role = 'guest') => {
      const id = crypto.randomUUID()
      await store.create({ id, name: email.split('@')[0]!, email, phone: null, passwordHash: await hashPassword(PW) })
      if (role !== 'guest') await store.update(id, { role })
      return id
    }
    const login = async (email: string, a = app, password = PW) => {
      const res = await a.inject({ method: 'POST', url: '/auth/login', payload: { email, password } })
      assert.equal(res.statusCode, 200)
      return String(res.headers['set-cookie']).split(';')[0]!
    }
    const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cookie?: string, body?: object, origin: string | null = ORIGIN, a = app) =>
      a.inject({ method, url, payload: body, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } })
    const create = async (c: string, over: Record<string, unknown> = {}) => (await call('POST', '/me/bookings', c, payload(over))).json().booking

    const ID = crypto.randomUUID()
    const routes: ['GET' | 'POST' | 'PATCH' | 'DELETE', string, object?][] = [
      ['GET', '/me/profile'],
      ['PATCH', '/me/profile', { name: 'Zed Zed' }],
      ['POST', '/me/password', { currentPassword: PW, newPassword: 'another one 1' }],
      ['DELETE', '/me', { password: PW }],
      ['GET', '/me/bookings'],
      ['GET', `/me/bookings/${ID}`],
      ['POST', '/me/bookings', payload()],
      ['POST', `/me/bookings/${ID}/cancel`],
    ]

    test('401 anonymous and 403 forbidden_origin on every route', async () => {
      await seed('a@x.com')
      const c = await login('a@x.com')
      for (const [m, u, b] of routes) {
        const anon = await call(m, u, undefined, b)
        assert.equal(anon.statusCode, 401, `${m} ${u}`)
        assert.deepEqual(anon.json(), { error: 'unauthenticated' })
        if (m === 'GET') continue
        for (const origin of [null, 'https://evil.example']) {
          const r = await call(m, u, c, b, origin)
          assert.equal(r.statusCode, 403, `${m} ${u}`)
          assert.deepEqual(r.json(), { error: 'forbidden_origin' })
        }
      }
    })

    test('422 shapes: ids, query, unknown/forbidden keys, rules', async () => {
      await seed('a@x.com')
      const c = await login('a@x.com')
      const bad = async (m: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body: object | undefined, path?: string) => {
        const r = await call(m, url, c, body)
        assert.equal(r.statusCode, 422, `${m} ${url} ${JSON.stringify(body)}`)
        assert.equal(r.json().error, 'validation_failed')
        if (path !== undefined) assert.ok(r.json().issues.some((i: { path: string }) => i.path === path), `${path} in ${r.body}`)
      }
      await bad('GET', '/me/bookings/not-a-uuid', undefined)
      await bad('POST', '/me/bookings/not-a-uuid/cancel', undefined)
      await bad('GET', '/me/bookings?pageSize=999', undefined)
      await bad('GET', '/me/bookings?filter=x', undefined)
      await bad('GET', '/me/bookings?page=0', undefined)
      for (const k of ['totalAmount', 'ratePerNight', 'status', 'paymentStatus']) await bad('POST', '/me/bookings', payload({ [k]: 'paid' }))
      await bad('POST', '/me/bookings', payload({ checkIn: addDays(TODAY, -1), checkOut: addDays(TODAY, 2) }), 'checkIn')
      await bad('POST', '/me/bookings', payload({ checkOut: addDays(TODAY, 10) }), 'checkOut')
      await bad('POST', '/me/bookings', payload({ checkOut: addDays(TODAY, 41) }), 'checkOut') // 31 nights
      await bad('POST', '/me/bookings', payload({ checkIn: addDays(TODAY, 400), checkOut: addDays(TODAY, 401) }), 'checkIn')
      await bad('POST', '/me/bookings', payload({ adults: 5 }), 'adults')
      await bad('POST', '/me/bookings', payload({ rooms: 2, adults: 1 }), 'adults')
      await bad('POST', '/me/bookings', payload({ rooms: 6 }), 'rooms')
      await bad('POST', '/me/bookings', payload({ roomId: 'suite' }), 'roomId')
      await bad('POST', '/me/bookings', payload({ checkIn: '2030-02-30' }), 'checkIn')
      await bad('POST', '/me/bookings', payload({ specialRequests: 'x'.repeat(501) }), 'specialRequests')
      await bad('POST', '/me/bookings', payload({ requestId: 'nope' }), 'requestId')
      await bad('PATCH', '/me/profile', {}, '')
      await bad('PATCH', '/me/profile', { email: 'new@x.com' })
      await bad('PATCH', '/me/profile', { phone: '12345' }, 'phone')
      await bad('PATCH', '/me/profile', { name: 'A' }, 'name')
      await bad('PATCH', '/me/profile', { postcode: '!!' }, 'postcode')
      await bad('PATCH', '/me/profile', { preferences: { bed: 'king' } })
      await bad('POST', '/me/password', { currentPassword: PW, newPassword: PW }, 'newPassword')
      await bad('POST', '/me/password', { currentPassword: PW, newPassword: 'short' }, 'newPassword')
      await bad('DELETE', '/me', {}, 'password')
    })

    test('profile: read, update, clear with empty string', async () => {
      await seed('a@x.com')
      const c = await login('a@x.com')
      const p0 = (await call('GET', '/me/profile', c)).json().profile
      assert.equal(p0.email, 'a@x.com')
      assert.equal(p0.preferences.bed, 'no_preference')
      const r = await call('PATCH', '/me/profile', c, {
        name: '  Asha Rao ', phone: '+919876543210', country: 'India', city: 'Jaipur', postcode: '302 001',
        preferences: { bed: 'twin', dietary: 'vegan', notes: 'high floor' }, marketingOptIn: true,
      })
      assert.equal(r.statusCode, 200)
      const p = r.json().profile
      assert.equal(p.name, 'Asha Rao')
      assert.equal(p.preferences.dietary, 'vegan')
      assert.equal(p.marketingOptIn, true)
      const cleared = (await call('PATCH', '/me/profile', c, { city: '', country: null })).json().profile
      assert.equal(cleared.city, null)
      assert.equal(cleared.country, null)
      assert.equal(cleared.postcode, '302 001')
      assert.equal((await call('GET', '/auth/me', c)).json().user.email, 'a@x.com')
    })

    test('create: server computes the total; replay by requestId; listing, detail, filters', async () => {
      await seed('a@x.com')
      const c = await login('a@x.com')
      const requestId = crypto.randomUUID()
      const r = await call('POST', '/me/bookings', c, payload({ roomId: 'super-deluxe', rooms: 2, adults: 3, checkOut: addDays(TODAY, 13), requestId, specialRequests: '  quiet ' }))
      assert.equal(r.statusCode, 201)
      const b = r.json().booking
      assert.equal(b.status, 'pending')
      assert.equal(b.paymentStatus, 'pay_at_hotel')
      assert.equal(b.nights, 3)
      assert.equal(b.totalAmount, 3 * 2300 * 2)
      assert.equal(b.specialRequests, 'quiet')
      assert.equal(b.currency, 'INR')
      assert.equal(b.canCancel, true)
      assert.deepEqual(b.room, { id: 'super-deluxe', name: 'Super Deluxe Room' })
      assert.ok(!('guest' in b) && !('externalHmsBookingId' in b))
      const replay = await call('POST', '/me/bookings', c, payload({ roomId: 'super-deluxe', rooms: 2, adults: 3, checkOut: addDays(TODAY, 13), requestId }))
      assert.equal(replay.statusCode, 200)
      assert.equal(replay.json().booking.id, b.id)
      assert.equal((await call('GET', `/me/bookings/${b.id}`, c)).json().booking.reference, b.reference)
      const list = (await call('GET', '/me/bookings', c)).json()
      assert.deepEqual({ total: list.total, page: list.page, pageSize: list.pageSize, totalPages: list.totalPages }, { total: 1, page: 1, pageSize: 10, totalPages: 1 })
      assert.deepEqual(list.counts, { all: 1, upcoming: 1, past: 0, cancelled: 0 })
      const up = (await call('GET', '/me/bookings?filter=upcoming&pageSize=1', c)).json()
      assert.equal(up.items.length, 1)
      assert.equal((await call('GET', '/me/bookings?filter=cancelled', c)).json().total, 0)
      assert.equal((await call('GET', '/me/bookings?page=5', c)).json().items.length, 0)
      assert.equal((await call('GET', '/me/bookings?page=5', c)).json().total, 1)
      assert.deepEqual(calls.filter((x) => x.startsWith('created')), [`created:${b.reference}`]) // replay did not re-sync
    })

    test('booking_limit 409 after 10 active upcoming bookings', async () => {
      await seed('a@x.com')
      const c = await login('a@x.com')
      for (let i = 0; i < 10; i++) assert.equal((await call('POST', '/me/bookings', c, payload({ checkIn: addDays(TODAY, 10 + i), checkOut: addDays(TODAY, 11 + i) }))).statusCode, 201)
      const r = await call('POST', '/me/bookings', c, payload())
      assert.equal(r.statusCode, 409)
      assert.deepEqual(r.json(), { error: 'booking_limit' })
    })

    test('ownership: B gets 404 (not 403) for A\'s booking; lists never mix; no leakage', async () => {
      await seed('a@x.com')
      await seed('b@x.com')
      const ca = await login('a@x.com')
      const cb = await login('b@x.com')
      const mine = await create(ca)
      for (const [m, u] of [['GET', `/me/bookings/${mine.id}`], ['POST', `/me/bookings/${mine.id}/cancel`]] as const) {
        const r = await call(m, u, cb)
        assert.equal(r.statusCode, 404)
        assert.deepEqual(r.json(), { error: 'not_found' })
      }
      assert.equal((await call('GET', `/me/bookings/${crypto.randomUUID()}`, cb)).statusCode, 404)
      const bl = await call('GET', '/me/bookings', cb)
      assert.equal(bl.json().total, 0)
      assert.doesNotMatch(bl.body, new RegExp(mine.reference))
      assert.equal((await call('GET', `/me/bookings/${mine.id}`, ca)).json().booking.status, 'pending') // A's booking untouched
      const bodies = [(await call('GET', '/me/profile', ca)).body, (await call('GET', '/me/bookings', ca)).body, (await call('GET', `/me/bookings/${mine.id}`, ca)).body]
      for (const b of bodies) {
        assert.doesNotMatch(b, /passwordHash|password_hash|scrypt\$|token_hash/)
        assert.doesNotMatch(b, /b@x\.com/)
      }
    })

    test('cancel: twice is 200 both times, past is 409, hook fires once and a throwing hook is harmless', async () => {
      const id = await seed('a@x.com')
      const c = await login('a@x.com')
      const b = await create(c)
      const first = await call('POST', `/me/bookings/${b.id}/cancel`, c)
      assert.equal(first.statusCode, 200)
      assert.equal(first.json().booking.status, 'cancelled')
      assert.equal(first.json().booking.canCancel, false)
      const second = await call('POST', `/me/bookings/${b.id}/cancel`, c)
      assert.equal(second.statusCode, 200)
      assert.equal(second.json().booking.cancelledAt, first.json().booking.cancelledAt)
      assert.deepEqual(calls.filter((x) => x.startsWith('changed')), ['changed:cancelled'])
      const old = await store.createBooking(id, { roomId: 'deluxe', checkIn: addDays(TODAY, -5), checkOut: addDays(TODAY, -3), rooms: 1, adults: 1, children: 0, extraBed: false, specialRequests: null })
      assert.ok(old.ok)
      const r = await call('POST', `/me/bookings/${old.ok && old.booking.id}/cancel`, c)
      assert.equal(r.statusCode, 409)
      assert.deepEqual(r.json(), { error: 'not_cancellable' })
      const boom = build(undefined, { onBookingCreated: async () => { throw new Error('hms down') } })
      assert.equal((await call('POST', '/me/bookings', c, payload(), ORIGIN, boom)).statusCode, 201)
    })

    test('password change: wrong current 422, others revoked, new password works, budget 429', async () => {
      await seed('a@x.com')
      const c1 = await login('a@x.com')
      const c2 = await login('a@x.com')
      const wrong = await call('POST', '/me/password', c1, { currentPassword: 'nope nope', newPassword: 'brand new pass' })
      assert.equal(wrong.statusCode, 422)
      assert.deepEqual(wrong.json(), { error: 'validation_failed', issues: [{ path: 'currentPassword', message: 'Current password is incorrect.' }] })
      const ok = await call('POST', '/me/password', c1, { currentPassword: PW, newPassword: 'brand new pass' })
      assert.equal(ok.statusCode, 200)
      assert.deepEqual(ok.json(), { ok: true })
      assert.equal((await call('GET', '/auth/me', c2)).statusCode, 401)
      assert.equal((await call('GET', '/auth/me', c1)).statusCode, 200)
      assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'a@x.com', password: PW } })).statusCode, 401)
      assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'a@x.com', password: 'brand new pass' } })).statusCode, 200)
      const tight = build({ max: 2, windowMs: 60_000 })
      const c3 = await login('a@x.com', tight, 'brand new pass')
      const attempt = () => call('POST', '/me/password', c3, { currentPassword: 'wrong wrong', newPassword: 'whatever 123' }, ORIGIN, tight)
      assert.equal((await attempt()).statusCode, 422)
      assert.equal((await attempt()).statusCode, 422)
      const limited = await attempt()
      assert.equal(limited.statusCode, 429)
      assert.deepEqual(limited.json(), { error: 'rate_limited' })
      assert.ok(limited.headers['retry-after'])
    })

    test('delete account: wrong password 422, blocked 409, then 200 + cookie cleared + anonymised + login fails', async () => {
      const id = await seed('a@x.com')
      const c = await login('a@x.com')
      const b = await create(c, { specialRequests: 'private note' })
      const wrong = await call('DELETE', '/me', c, { password: 'nope nope' })
      assert.equal(wrong.statusCode, 422)
      assert.deepEqual(wrong.json().issues, [{ path: 'password', message: 'Password is incorrect.' }])
      const blocked = await call('DELETE', '/me', c, { password: PW })
      assert.equal(blocked.statusCode, 409)
      assert.deepEqual(blocked.json(), { error: 'upcoming_bookings', count: 1 })
      assert.equal((await call('GET', '/me/profile', c)).statusCode, 200)
      await call('POST', `/me/bookings/${b.id}/cancel`, c)
      const done = await call('DELETE', '/me', c, { password: PW })
      assert.equal(done.statusCode, 200)
      assert.deepEqual(done.json(), { ok: true })
      assert.match(String(done.headers['set-cookie']), /hdh_session=;.*Max-Age=0/)
      assert.equal((await call('GET', '/auth/me', c)).statusCode, 401)
      assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'a@x.com', password: PW } })).statusCode, 401)
      const kept = await store.getAdminBooking(b.id)
      assert.equal(kept?.guest, null)
      assert.equal(kept?.specialRequests, null)
      assert.equal(await store.findById(id), undefined)
    })

    test('delete account: staff and admin are not allowed', async () => {
      await seed('s@x.com', 'staff')
      await seed('ad@x.com', 'admin')
      for (const email of ['s@x.com', 'ad@x.com']) {
        const c = await login(email)
        const r = await call('DELETE', '/me', c, { password: PW })
        assert.equal(r.statusCode, 409)
        assert.deepEqual(r.json(), { error: 'not_allowed_for_role' })
        assert.equal((await call('GET', '/me/profile', c)).statusCode, 200)
      }
    })

    test('delete account: rate limited after the failed-password budget', async () => {
      await seed('a@x.com')
      const tight = build({ max: 2, windowMs: 60_000 })
      const c = await login('a@x.com', tight)
      const attempt = () => call('DELETE', '/me', c, { password: 'wrong wrong' }, ORIGIN, tight)
      assert.equal((await attempt()).statusCode, 422)
      assert.equal((await attempt()).statusCode, 422)
      assert.equal((await attempt()).statusCode, 429)
    })

    test('CORS preflight allows DELETE and PATCH for the allowed origin', async () => {
      const r = await app.inject({ method: 'OPTIONS', url: '/me', headers: { origin: ORIGIN, 'access-control-request-method': 'DELETE' } })
      assert.equal(r.statusCode, 204)
      assert.match(String(r.headers['access-control-allow-methods']), /PATCH/)
      assert.match(String(r.headers['access-control-allow-methods']), /DELETE/)
    })
  })
}
suite('memory', memoryStore, async () => {})
const pool: pg.Pool | undefined = await testPool()
if (pool) {
  const p = pool
  suite('postgres', () => pgStore(p), async () => void (await resetDb(p)))
  after(() => p.end())
} else {
  test('account API: postgres', { skip: 'TEST_DATABASE_URL not set' }, () => {})
}
