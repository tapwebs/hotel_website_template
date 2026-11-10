import assert from 'node:assert/strict'
import { after, beforeEach, describe, test } from 'node:test'
import type pg from 'pg'
import { buildApp } from '../app.ts'
import { addDays, todayIST } from '../domain/bookings.ts'
import { hashPassword } from '../core/password.ts'
import { memoryStore, pgStore, type Role, type UserStore } from '../stores/store.ts'
import { resetDb, testPool } from '../stores/test-db.ts'

const ORIGIN = 'http://localhost:5173'
const PW = 'correct horse'

function suite(label: string, make: () => UserStore, reset: () => Promise<void>, isPg: boolean) {
  describe(`admin API: ${label}`, () => {
    let store: UserStore
    let app: ReturnType<typeof buildApp>
    beforeEach(async () => {
      await reset()
      store = make()
      app = buildApp({ store, allowedOrigin: ORIGIN, rateLimit: { max: 1000, windowMs: 60_000 } })
    })
    const seed = async (email: string, role: Role) => {
      const id = crypto.randomUUID()
      await store.create({ id, name: email.split('@')[0]!, email, phone: null, passwordHash: await hashPassword(PW) })
      if (role !== 'guest') await store.update(id, { role })
      return id
    }
    const login = async (email: string) => {
      const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PW } })
      assert.equal(res.statusCode, 200)
      return String(res.headers['set-cookie']).split(';')[0]!
    }
    const call = (method: 'GET' | 'PATCH' | 'POST' | 'PUT', url: string, cookie?: string, payload?: object, origin: string | null = ORIGIN) =>
      app.inject({ method, url, payload, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } })

    test('401 anonymous, 403 guest and staff on every route', async () => {
      const id = await seed('g@x.com', 'guest')
      await seed('s@x.com', 'staff')
      const routes: ['GET' | 'PATCH', string, object?][] = [
        ['GET', '/admin/users'],
        ['GET', `/admin/users/${id}`],
        ['GET', '/admin/users.csv'],
        ['GET', '/admin/reports'],
        ['GET', '/admin/activity'],
        ['GET', '/admin/rooms'],
        ['PATCH', `/admin/users/${id}/role`, { role: 'staff' }],
        ['PATCH', `/admin/users/${id}/status`, { status: 'disabled' }],
      ]
      const guest = await login('g@x.com')
      const staff = await login('s@x.com')
      for (const [m, u, b] of routes) {
        assert.deepEqual((await call(m, u, undefined, b)).json(), { error: 'unauthenticated' })
        assert.equal((await call(m, u, undefined, b)).statusCode, 401)
        for (const c of [guest, staff]) {
          const r = await call(m, u, c, b)
          assert.equal(r.statusCode, 403)
          assert.deepEqual(r.json(), { error: 'forbidden' })
        }
      }
    })

    test('list, get, search, filter, paging, stats', async () => {
      await seed('admin@x.com', 'admin')
      const g = await seed('guest1@x.com', 'guest')
      await seed('guest2@x.com', 'guest')
      const c = await login('admin@x.com')
      const list = (await call('GET', '/admin/users?pageSize=2&sort=email&order=asc', c)).json()
      assert.equal(list.total, 3)
      assert.equal(list.totalPages, 2)
      assert.equal(list.items.length, 2)
      assert.equal((await call('GET', '/admin/users?q=GUEST1', c)).json().total, 1)
      assert.equal((await call('GET', '/admin/users?role=admin', c)).json().total, 1)
      assert.equal((await call('GET', '/admin/users?q=', c)).json().total, 3)
      assert.equal((await call('GET', `/admin/users/${g}`, c)).json().user.email, 'guest1@x.com')
      const stats = (await call('GET', '/admin/stats', c)).json()
      assert.equal(stats.totals.users, 3)
      assert.equal(stats.signupsByDay.length, 30)
      assert.ok(stats.generatedAt)
    })

    test('422 shapes, 404', async () => {
      await seed('admin@x.com', 'admin')
      const c = await login('admin@x.com')
      for (const url of ['/admin/users?pageSize=1000', '/admin/users?role=owner', '/admin/users?page=0', '/admin/users/not-a-uuid']) {
        const r = await call('GET', url, c)
        assert.equal(r.statusCode, 422, url)
        assert.equal(r.json().error, 'validation_failed')
        assert.ok(Array.isArray(r.json().issues))
      }
      const id = crypto.randomUUID()
      assert.equal((await call('PATCH', `/admin/users/${id}/role`, c, { role: 'owner' })).statusCode, 422)
      assert.equal((await call('PATCH', `/admin/users/${id}/role`, c, { role: 'staff', extra: 1 })).statusCode, 422)
      assert.equal((await call('GET', `/admin/users/${id}`, c)).statusCode, 404)
      assert.equal((await call('PATCH', `/admin/users/${id}/role`, c, { role: 'staff' })).statusCode, 404)
    })

    test('PATCH needs the allowed Origin', async () => {
      await seed('admin@x.com', 'admin')
      const g = await seed('g@x.com', 'guest')
      const c = await login('admin@x.com')
      for (const origin of [null, 'https://evil.example']) {
        const r = await call('PATCH', `/admin/users/${g}/role`, c, { role: 'staff' }, origin)
        assert.equal(r.statusCode, 403)
        assert.deepEqual(r.json(), { error: 'forbidden_origin' })
      }
    })

    test('role/status changes apply at once; self and last-admin are protected', async () => {
      const adminId = await seed('admin@x.com', 'admin')
      const g = await seed('g@x.com', 'guest')
      const c = await login('admin@x.com')
      const gc = await login('g@x.com')
      const promoted = await call('PATCH', `/admin/users/${g}/role`, c, { role: 'admin' })
      assert.equal(promoted.json().user.role, 'admin')
      assert.equal((await call('GET', '/admin/stats', gc)).statusCode, 200) // role read live, same cookie
      assert.equal((await call('PATCH', `/admin/users/${g}/role`, c, { role: 'admin' })).statusCode, 200) // no-op
      for (const [path, body] of [['role', { role: 'guest' }], ['status', { status: 'disabled' }]] as const) {
        const r = await call('PATCH', `/admin/users/${adminId}/${path}`, c, body)
        assert.equal(r.statusCode, 409)
        assert.deepEqual(r.json(), { error: 'self_modification_forbidden' })
      }
      assert.equal((await call('PATCH', `/admin/users/${g}/status`, c, { status: 'disabled' })).statusCode, 200)
      assert.equal((await call('GET', '/admin/stats', gc)).statusCode, 401) // disabled user's cookie is dead
      const again = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'g@x.com', password: PW } })
      assert.equal(again.statusCode, 403)
      assert.deepEqual(again.json(), { error: 'account_disabled' })
    })

    test('concurrent mutual demotion leaves exactly one admin', { skip: isPg ? false : 'pg only' }, async () => {
      const a = await seed('a@x.com', 'admin')
      const b = await seed('b@x.com', 'admin')
      const ca = await login('a@x.com')
      const cb = await login('b@x.com')
      const res = await Promise.all([
        call('PATCH', `/admin/users/${b}/role`, ca, { role: 'guest' }),
        call('PATCH', `/admin/users/${a}/role`, cb, { role: 'guest' }),
      ])
      assert.deepEqual(res.map((r) => r.statusCode).sort(), [200, 409])
    })

    test('logout clears the session; /auth/me; no hash leakage', async () => {
      await seed('admin@x.com', 'admin')
      const c = await login('admin@x.com')
      const me = await call('GET', '/auth/me', c)
      assert.equal(me.json().user.role, 'admin')
      const bodies = [me.body, (await call('GET', '/admin/users', c)).body, (await call('GET', '/admin/stats', c)).body]
      for (const b of bodies) assert.doesNotMatch(b, /passwordHash|password_hash|scrypt\$|token_hash/)
      assert.equal((await call('POST', '/auth/logout', c, undefined, 'https://evil.example')).statusCode, 403)
      const out = await call('POST', '/auth/logout', c)
      assert.equal(out.statusCode, 204)
      assert.match(String(out.headers['set-cookie']), /Max-Age=0/)
      assert.equal((await call('GET', '/auth/me', c)).statusCode, 401)
      assert.equal((await call('POST', '/auth/logout')).statusCode, 204) // idempotent
    })

    test('remember sets Max-Age 30 days', async () => {
      await seed('admin@x.com', 'admin')
      const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'admin@x.com', password: PW, remember: true } })
      assert.match(String(r.headers['set-cookie']), /Max-Age=2592000/)
    })
    // ---- bookings ---------------------------------------------------------------------------------------------
    const stayBody = (inDays: number, nights = 2) => ({
      roomId: 'deluxe' as const,
      checkIn: addDays(todayIST(), inDays),
      checkOut: addDays(todayIST(), inDays + nights),
      rooms: 1,
      adults: 2,
      children: 0,
      extraBed: false,
      specialRequests: null,
    })
    const mkBooking = async (userId: string, inDays = 5, nights = 2) => {
      const r = await store.createBooking(userId, stayBody(inDays, nights))
      assert.ok(r.ok)
      return r.booking
    }
    test('front-desk staff: bookings, stats and guest search yes; users, reports, rooms, activity no', async () => {
      const g = await seed('g@x.com', 'guest')
      await seed('s@x.com', 'staff')
      await seed('admin@x.com', 'admin')
      const b = await mkBooking(g)
      const staff = await login('s@x.com')
      assert.equal((await call('GET', '/admin/bookings', staff)).statusCode, 200)
      assert.equal((await call('GET', '/admin/bookings.csv', staff)).statusCode, 200)
      assert.equal((await call('GET', '/admin/stats', staff)).statusCode, 200)
      assert.equal((await call('GET', '/admin/guest-search?q=g@x', staff)).json().items[0].email, 'g@x.com')
      assert.equal((await call('PATCH', `/admin/bookings/${b.id}`, staff, { status: 'confirmed' })).statusCode, 200)
      assert.equal((await call('POST', '/admin/users', staff, { name: 'New Staff', email: 'n@x.com', password: 'long enough pw' })).statusCode, 403)
      // guests never get in, even to guest search
      assert.equal((await call('GET', '/admin/guest-search?q=g@x', await login('g@x.com'))).statusCode, 403)
    })
    test('admin tools: add staff, CSV exports, reports, activity log and room rates', async () => {
      await seed('admin@x.com', 'admin')
      const g = await seed('g@x.com', 'guest')
      const admin = await login('admin@x.com')
      // add a staff account who can then log in
      const made = await call('POST', '/admin/users', admin, { name: 'Front Desk', email: 'Desk@X.com', password: 'long enough pw', role: 'staff' })
      assert.equal(made.statusCode, 201)
      assert.equal(made.json().user.role, 'staff')
      assert.equal((await call('POST', '/admin/users', admin, { name: 'Dup', email: 'desk@x.com', password: 'long enough pw' })).statusCode, 409)
      // exports
      await mkBooking(g)
      const csv = await call('GET', '/admin/bookings.csv', admin)
      assert.match(String(csv.headers['content-type']), /text\/csv/)
      assert.match(csv.body, /^reference,guest,email/)
      assert.match(csv.body, /g@x\.com/)
      assert.match((await call('GET', '/admin/users.csv', admin)).body, /desk@x\.com/)
      // reports
      const rep = (await call('GET', '/admin/reports', admin)).json()
      assert.equal(rep.totals.bookings, 1)
      assert.equal(rep.months.length, 1)
      // rates: change one, new bookings use it, and the change is logged
      const before = (await call('GET', '/admin/rooms', admin)).json().items.find((r: { id: string }) => r.id === 'deluxe')
      assert.equal((await call('PUT', '/admin/rooms/deluxe', admin, { rate: 1800 })).statusCode, 200)
      assert.equal((await call('PUT', '/admin/rooms/deluxe', admin, { rate: 5 })).statusCode, 422)
      const nb = await call('POST', '/admin/bookings', admin, { userId: g, booking: stayBody(20, 2) })
      assert.equal(nb.json().booking.ratePerNight, 1800)
      assert.equal(nb.json().booking.totalAmount, 3600)
      await call('PUT', '/admin/rooms/deluxe', admin, { rate: before.rate }) // restore for other tests
      const acts = (await call('GET', '/admin/activity', admin)).json().items.map((a: { action: string }) => a.action)
      assert.ok(acts.includes('user.created') && acts.includes('room.rate') && acts.includes('booking.created'))
    })
    test('bookings: 401 anonymous, 403 guest, 403 forbidden_origin on PATCH', async () => {
      const g = await seed('g@x.com', 'guest')
      await seed('s@x.com', 'staff')
      await seed('admin@x.com', 'admin')
      const b = await mkBooking(g)
      const routes: ['GET' | 'PATCH', string, object?][] = [['GET', '/admin/bookings'], ['PATCH', `/admin/bookings/${b.id}`, { status: 'confirmed' }]]
      for (const [m, u, body] of routes) {
        assert.equal((await call(m, u, undefined, body)).statusCode, 401)
        const r = await call(m, u, await login('g@x.com'), body)
        assert.equal(r.statusCode, 403)
        assert.deepEqual(r.json(), { error: 'forbidden' })
      }
      const admin = await login('admin@x.com')
      for (const origin of [null, 'https://evil.example']) {
        const r = await call('PATCH', `/admin/bookings/${b.id}`, admin, { status: 'confirmed' }, origin)
        assert.equal(r.statusCode, 403)
        assert.deepEqual(r.json(), { error: 'forbidden_origin' })
      }
      assert.equal((await store.getAdminBooking(b.id))?.status, 'pending')
    })
    test('bookings: admin creates a desk booking for a new guest, and the front-desk views find it', async () => {
      await seed('admin@x.com', 'admin')
      const admin = await login('admin@x.com')
      const today = todayIST()
      const r = await call('POST', '/admin/bookings', admin, { guest: { name: 'Walk In', email: 'Walk@In.com', phone: '+919876543210' }, booking: stayBody(0, 2), status: 'confirmed', paymentStatus: 'paid' })
      assert.equal(r.statusCode, 201)
      assert.equal(r.json().booking.status, 'confirmed')
      assert.equal(r.json().booking.paymentStatus, 'paid')
      assert.equal(r.json().booking.guest.email, 'walk@in.com')
      // The same email reuses the account instead of failing.
      assert.equal((await call('POST', '/admin/bookings', admin, { guest: { name: 'Walk In', email: 'walk@in.com' }, booking: stayBody(10, 1) })).statusCode, 201)
      assert.equal((await call('GET', `/admin/bookings?view=arrivals&day=${today}`, admin)).json().total, 1)
      assert.equal((await call('GET', `/admin/bookings?view=inhouse&day=${addDays(today, 1)}`, admin)).json().total, 1)
      assert.equal((await call('GET', `/admin/bookings?view=departures&day=${addDays(today, 2)}`, admin)).json().total, 1)
      assert.equal((await call('GET', `/admin/bookings?view=arrivals&day=${addDays(today, 3)}`, admin)).json().total, 0)
      assert.equal((await call('GET', '/admin/bookings?view=arrivals', admin)).statusCode, 422)
      // Exactly one of userId / guest, and the stay is validated like a guest booking.
      assert.equal((await call('POST', '/admin/bookings', admin, { booking: stayBody(1, 1) })).statusCode, 422)
      assert.equal((await call('POST', '/admin/bookings', admin, { guest: { name: 'Bad Dates', email: 'b@x.com' }, booking: { ...stayBody(1, 1), checkOut: today } })).statusCode, 422)
    })
    test('bookings: list search/filter/sort/paging and no hash leakage', async () => {
      await seed('admin@x.com', 'admin')
      const a = await seed('asha@x.com', 'guest')
      const b = await seed('bob@x.com', 'guest')
      const b1 = await mkBooking(a, 5)
      await mkBooking(a, 20, 4)
      await mkBooking(b, 8, 1)
      const c = await login('admin@x.com')
      const list = (await call('GET', '/admin/bookings?pageSize=2', c)).json()
      assert.equal(list.total, 3)
      assert.equal(list.totalPages, 2)
      assert.equal(list.items.length, 2)
      assert.equal(list.items[0].guest.email.length > 0, true)
      assert.equal((await call('GET', `/admin/bookings?q=${b1.reference}`, c)).json().items[0].id, b1.id)
      assert.equal((await call('GET', '/admin/bookings?q=ASHA', c)).json().total, 2)
      assert.equal((await call('GET', '/admin/bookings?q=%25', c)).json().total, 0)
      assert.equal((await call('GET', '/admin/bookings?status=confirmed', c)).json().total, 0)
      assert.equal((await call('GET', '/admin/bookings?status=pending&paymentStatus=pay_at_hotel', c)).json().total, 3)
      assert.deepEqual((await call('GET', '/admin/bookings?sort=totalAmount&order=desc', c)).json().items.map((i: { totalAmount: number }) => i.totalAmount), [6000, 3000, 1500])
      const range = `from=${addDays(todayIST(), 6)}&to=${addDays(todayIST(), 30)}`
      assert.equal((await call('GET', `/admin/bookings?${range}`, c)).json().total, 2)
      assert.doesNotMatch((await call('GET', '/admin/bookings', c)).body, /passwordHash|password_hash|scrypt\$|token_hash/)
      for (const url of ['/admin/bookings?from=2030-02-01&to=2030-01-01', '/admin/bookings?status=nope', '/admin/bookings?pageSize=101', '/admin/bookings?sort=guest']) {
        const r = await call('GET', url, c)
        assert.equal(r.statusCode, 422, url)
        assert.equal(r.json().error, 'validation_failed')
      }
    })
    test('bookings: PATCH transitions, payment, external ids, 404/409/422', async () => {
      await seed('admin@x.com', 'admin')
      const g = await seed('g@x.com', 'guest')
      const x = await mkBooking(g, 5)
      const y = await mkBooking(g, 9)
      const c = await login('admin@x.com')
      const patch = (id: string, body: object) => call('PATCH', `/admin/bookings/${id}`, c, body)
      assert.equal((await patch(crypto.randomUUID(), { status: 'confirmed' })).statusCode, 404)
      assert.equal((await patch('nope', { status: 'confirmed' })).statusCode, 422)
      for (const body of [{}, { status: 'done' }, { totalAmount: 1 }, { externalHmsBookingId: '' }]) assert.equal((await patch(x.id, body)).statusCode, 422)
      const bad = await patch(x.id, { status: 'completed' })
      assert.equal(bad.statusCode, 409)
      assert.deepEqual(bad.json(), { error: 'invalid_transition' })
      const ok = await patch(x.id, { status: 'confirmed', paymentStatus: 'paid', externalHmsBookingId: 'HMS-9', externalPosFolioId: 'POS-9' })
      assert.equal(ok.statusCode, 200)
      const bk = ok.json().booking
      assert.deepEqual([bk.status, bk.paymentStatus, bk.externalHmsBookingId, bk.externalPosFolioId], ['confirmed', 'paid', 'HMS-9', 'POS-9'])
      assert.equal(bk.guest.id, g)
      const dup = await patch(y.id, { externalHmsBookingId: 'HMS-9' })
      assert.equal(dup.statusCode, 409)
      assert.deepEqual(dup.json(), { error: 'external_id_taken' })
      assert.equal((await patch(x.id, { externalHmsBookingId: null })).json().booking.externalHmsBookingId, null)
      const cancelled = (await patch(x.id, { status: 'cancelled' })).json().booking
      assert.ok(cancelled.cancelledAt)
      assert.equal(cancelled.canCancel, false)
      assert.equal((await patch(x.id, { status: 'confirmed' })).statusCode, 409) // terminal
      assert.equal((await patch(x.id, { status: 'cancelled' })).statusCode, 200) // same value, no-op
    })
    test('bookings: stats include bookings and everBooked; a guest cannot reach other bookings via /admin', async () => {
      await seed('admin@x.com', 'admin')
      const g = await seed('g@x.com', 'guest')
      await mkBooking(g, 5)
      const done = await mkBooking(g, 9)
      await store.updateAdminBooking(done.id, { status: 'confirmed' })
      const c = await login('admin@x.com')
      const stats = (await call('GET', '/admin/stats', c)).json()
      assert.equal(stats.lifecycle.everBooked, 1)
      assert.equal(stats.bookings.total, 2)
      assert.deepEqual(stats.bookings.byStatus, { pending: 1, confirmed: 1, cancelled: 0, completed: 0 })
      assert.equal(stats.bookings.upcoming, 2)
      assert.equal(stats.bookings.createdLast7Days, 2)
      assert.equal(stats.totals.users, 2) // existing keys unchanged
      assert.equal((await call('GET', '/admin/bookings', await login('g@x.com'))).statusCode, 403)
    })
  })
}

suite('memory', memoryStore, async () => {}, false)
const pool: pg.Pool | undefined = await testPool()
if (pool) {
  const p = pool
  suite('postgres', () => pgStore(p), async () => void (await resetDb(p)), true)
  after(() => p.end())
} else {
  test('admin API: postgres', { skip: 'TEST_DATABASE_URL not set' }, () => {})
}
