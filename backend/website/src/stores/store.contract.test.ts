import assert from 'node:assert/strict'
import { after, beforeEach, describe } from 'node:test'
import { test } from 'node:test'
import type pg from 'pg'
import { memoryStore, pgStore, type AdminBookingQuery, type ListQuery, type NewBookingInput, type UserStore } from './store.ts'
import { addDays } from '../domain/bookings.ts'
import { resetDb, testPool } from './test-db.ts'

const base: ListQuery = { page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }
let n = 0
const mk = (store: UserStore, name: string, extra: { email?: string; phone?: string | null } = {}) => {
  const id = crypto.randomUUID()
  return store
    .create({ id, name, email: extra.email ?? `u${n++}@example.com`, phone: extra.phone === undefined ? null : extra.phone, passwordHash: 'h' })
    .then(() => id)
}

function suite(label: string, make: () => UserStore, reset: () => Promise<void>, pool?: pg.Pool) {
  describe(`UserStore contract: ${label}`, () => {
    let s: UserStore
    beforeEach(async () => {
      await reset()
      s = make()
    })

    test('create, duplicate email (case-insensitive), findByEmail', async () => {
      assert.equal(await s.create({ id: crypto.randomUUID(), name: 'A', email: 'A@x.com', phone: null, passwordHash: 'h' }), true)
      assert.equal(await s.create({ id: crypto.randomUUID(), name: 'B', email: 'a@X.com', phone: null, passwordHash: 'h' }), false)
      const u = await s.findByEmail('A@X.COM')
      assert.equal(u?.role, 'guest')
      assert.equal(u?.status, 'active')
      assert.equal(u?.lastLoginAt, null)
    })

    test('list: pagination, search (literal % and _), filter, sort with NULLS LAST', async () => {
      const a = await mk(s, 'Alice', { phone: '+919876543210' })
      await mk(s, 'Bob 100%')
      await mk(s, 'Carol_x')
      await mk(s, 'Carolyx')
      await s.recordLogin(a)
      assert.equal((await s.list({ ...base, pageSize: 3 })).items.length, 3)
      assert.equal((await s.list({ ...base, pageSize: 3, page: 2 })).items.length, 1)
      assert.equal((await s.list({ ...base, page: 9 })).items.length, 0)
      assert.equal((await s.list({ ...base, page: 9 })).total, 4)
      assert.equal((await s.list({ ...base, q: '%' })).total, 1)
      assert.equal((await s.list({ ...base, q: 'carol_' })).total, 1)
      assert.equal((await s.list({ ...base, q: '98765' })).total, 1)
      assert.equal((await s.list({ ...base, q: 'ALICE' })).total, 1)
      assert.equal((await s.list({ ...base, role: 'admin' })).total, 0)
      for (const order of ['asc', 'desc'] as const) {
        const items = (await s.list({ ...base, sort: 'lastLoginAt', order })).items
        assert.equal(items[0]!.id, a) // the only user with a login sorts first both ways
      }
      assert.deepEqual((await s.list({ ...base, sort: 'name', order: 'asc' })).items.map((u) => u.name)[0], 'Alice')
      assert.ok(!('passwordHash' in (await s.list(base)).items[0]!))
    })

    test('stats: counts and 30 zero-filled UTC days', async () => {
      const a = await mk(s, 'A')
      await mk(s, 'B')
      await s.update(a, { role: 'admin' })
      await s.recordLogin(a)
      const st = await s.stats()
      assert.equal(st.totals.users, 2)
      assert.equal(st.totals.admins, 1)
      assert.equal(st.totals.guests, 1)
      assert.equal(st.lifecycle.everLoggedIn, 1)
      assert.equal(st.activeLast30Days, 1)
      assert.equal(st.signupsByDay.length, 30)
      assert.equal(st.signupsByDay[29]!.date, new Date().toISOString().slice(0, 10))
      assert.equal(st.signupsByDay.reduce((t, d) => t + d.count, 0), 2)
    })

    test('update: not_found, last_admin, disabling deletes sessions', async () => {
      const a = await mk(s, 'A')
      const b = await mk(s, 'B')
      assert.deepEqual(await s.update(crypto.randomUUID(), { role: 'staff' }), { ok: false, reason: 'not_found' })
      await s.update(a, { role: 'admin' })
      assert.deepEqual(await s.update(a, { role: 'guest' }), { ok: false, reason: 'last_admin' })
      assert.deepEqual(await s.update(a, { status: 'disabled' }), { ok: false, reason: 'last_admin' })
      await s.update(b, { role: 'admin' })
      assert.equal((await s.update(a, { role: 'guest' })).ok, true)
      await s.createSession(b, 'tok', new Date(Date.now() + 60_000))
      assert.equal((await s.findSession('tok'))?.id, b)
      await s.update(a, { role: 'admin' }) // two admins again
      assert.equal((await s.update(b, { status: 'disabled' })).ok, true)
      assert.equal(await s.findSession('tok'), undefined)
    })

    test('sessions: expiry and disabled users', async () => {
      const a = await mk(s, 'A')
      await s.createSession(a, 'old', new Date(Date.now() - 1000))
      await s.createSession(a, 'live', new Date(Date.now() + 60_000))
      assert.equal(await s.findSession('old'), undefined)
      assert.equal((await s.findSession('live'))?.email.endsWith('@example.com'), true)
      await s.update(a, { status: 'disabled' })
      assert.equal(await s.findSession('live'), undefined)
      await s.deleteSession('live')
    })
    // ---- profile and bookings -------------------------------------------------------------------------------
    const TODAY = '2030-06-15'
    const stay = (inDays: number, nights = 2, extra: Partial<NewBookingInput> = {}): NewBookingInput => ({
      roomId: 'deluxe',
      checkIn: addDays(TODAY, inDays),
      checkOut: addDays(TODAY, inDays + nights),
      rooms: 1,
      adults: 2,
      children: 0,
      extraBed: false,
      specialRequests: null,
      ...extra,
    })
    const book = async (userId: string, input: NewBookingInput) => {
      const r = await s.createBooking(userId, input, TODAY)
      assert.ok(r.ok)
      return r.booking
    }
    const adminQ: AdminBookingQuery = { page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }
    test('profile: defaults, clearing, preferences, marketing flag', async () => {
      const a = await mk(s, 'Ann')
      const p0 = (await s.getProfile(a))!
      assert.deepEqual(p0.preferences, { bed: 'no_preference', dietary: 'no_preference', notes: '' })
      assert.equal(p0.marketingOptIn, false)
      assert.equal(p0.country, null)
      assert.equal(await s.getProfile(crypto.randomUUID()), undefined)
      const p1 = (await s.updateProfile(a, { name: 'Ann B', phone: '+919876543210', country: 'India', city: 'Jaipur', preferences: { bed: 'king', dietary: 'jain', notes: 'quiet' }, marketingOptIn: true }))!
      assert.equal(p1.name, 'Ann B')
      assert.equal(p1.city, 'Jaipur')
      assert.equal(p1.preferences.bed, 'king')
      assert.equal(p1.marketingOptIn, true)
      assert.equal(p1.phone, '+919876543210')
      const p2 = (await s.updateProfile(a, { city: null, marketingOptIn: true }))!
      assert.equal(p2.city, null)
      assert.equal(p2.country, 'India') // untouched keys stay
      assert.equal(p2.preferences.dietary, 'jain')
      assert.equal((await s.updateProfile(a, { marketingOptIn: false }))!.marketingOptIn, false)
      assert.equal(await s.updateProfile(crypto.randomUUID(), { name: 'x' }), undefined)
      assert.ok(!('passwordHash' in p2))
    })
    test('marketing_opt_in_at: set on false->true only, cleared on false (pg column)', async (t) => {
      if (!pool) return t.skip('postgres only')
      const a = await mk(s, 'Ann')
      const at = async () => (await pool.query('SELECT marketing_opt_in_at AS t FROM users WHERE id = $1', [a])).rows[0].t as Date | null
      assert.equal(await at(), null)
      await s.updateProfile(a, { marketingOptIn: true })
      const first = await at()
      assert.ok(first)
      await s.updateProfile(a, { marketingOptIn: true })
      assert.equal((await at())!.getTime(), first.getTime())
      await s.updateProfile(a, { marketingOptIn: false })
      assert.equal(await at(), null)
    })
    test('changePassword keeps only the given session', async () => {
      const a = await mk(s, 'Ann')
      await s.createSession(a, 'keep', new Date(Date.now() + 60_000))
      await s.createSession(a, 'other', new Date(Date.now() + 60_000))
      await s.changePassword(a, 'newhash', 'keep')
      assert.equal((await s.findSession('keep'))?.id, a)
      assert.equal(await s.findSession('other'), undefined)
      assert.equal((await s.findById(a))?.passwordHash, 'newhash')
    })
    test('createBooking: server total, pending, pay_at_hotel, requestId replay, limit', async () => {
      const a = await mk(s, 'Ann')
      const rid = crypto.randomUUID()
      const r = await s.createBooking(a, stay(10, 3, { roomId: 'super-deluxe', rooms: 2, adults: 3, requestId: rid, specialRequests: 'late' }), TODAY)
      assert.ok(r.ok && r.created)
      const b = r.booking
      assert.match(b.reference, /^HDH-[A-HJ-NP-Z2-9]{6}$/)
      assert.equal(b.status, 'pending')
      assert.equal(b.paymentStatus, 'pay_at_hotel')
      assert.equal(b.nights, 3)
      assert.equal(b.ratePerNight, 2300)
      assert.equal(b.totalAmount, 3 * 2300 * 2)
      assert.equal(b.room.name, 'Super Deluxe Room')
      assert.equal(b.checkIn, addDays(TODAY, 10)) // plain YYYY-MM-DD, no time zone drift
      assert.equal(b.canCancel, true)
      assert.equal(b.guest?.id, a)
      const again = await s.createBooking(a, stay(10, 3, { requestId: rid }), TODAY)
      assert.ok(again.ok && !again.created)
      assert.equal(again.ok && again.booking.id, b.id)
      assert.equal((await s.listBookings(a, { filter: 'all', page: 1, pageSize: 50 }, TODAY)).total, 1)
      for (let i = 0; i < 9; i++) await book(a, stay(20 + i))
      assert.deepEqual(await s.createBooking(a, stay(40), TODAY), { ok: false, reason: 'booking_limit' })
      await s.cancelBooking(a, b.id, TODAY) // cancelled stays free a slot
      assert.equal((await s.createBooking(a, stay(40), TODAY)).ok, true)
      assert.deepEqual(await s.createBooking(crypto.randomUUID(), stay(5), TODAY), { ok: false, reason: 'user_missing' })
    })
    test('listBookings: filters, counts, order, paging', async () => {
      const a = await mk(s, 'Ann')
      const future = await book(a, stay(10))
      const soon = await book(a, stay(3))
      const inProgress = await book(a, stay(-1, 3)) // checkout after today: still "upcoming", no longer cancellable
      const past = await book(a, stay(-20, 2))
      const cancelled = await book(a, stay(30))
      await s.cancelBooking(a, cancelled.id, TODAY)
      const list = (filter: 'all' | 'upcoming' | 'past' | 'cancelled', page = 1, pageSize = 10) => s.listBookings(a, { filter, page, pageSize }, TODAY)
      const up = await list('upcoming')
      assert.deepEqual(up.items.map((b) => b.id), [inProgress.id, soon.id, future.id]) // check_in ASC
      assert.equal(up.items[0]!.canCancel, false)
      assert.deepEqual(up.counts, { all: 5, upcoming: 3, past: 1, cancelled: 1 })
      assert.equal(up.total, 3)
      assert.deepEqual((await list('past')).items.map((b) => b.id), [past.id])
      assert.deepEqual((await list('cancelled')).items.map((b) => b.id), [cancelled.id])
      const all = await list('all')
      assert.equal(all.total, 5)
      assert.equal(all.items[0]!.id, cancelled.id) // created_at DESC
      assert.equal((await list('all', 2, 2)).items.length, 2)
      assert.equal((await list('all', 9, 2)).items.length, 0)
      assert.equal((await list('all', 9, 2)).total, 5)
    })
    test('ownership: another user cannot read or cancel a booking', async () => {
      const a = await mk(s, 'Ann')
      const b = await mk(s, 'Bob')
      const mine = await book(a, stay(10))
      assert.equal(await s.getBooking(b, mine.id, TODAY), undefined)
      assert.deepEqual(await s.cancelBooking(b, mine.id, TODAY), { ok: false, reason: 'not_found' })
      assert.equal((await s.listBookings(b, { filter: 'all', page: 1, pageSize: 10 }, TODAY)).total, 0)
      assert.equal((await s.getBooking(a, mine.id, TODAY))?.status, 'pending') // untouched
      assert.equal(await s.getBooking(a, crypto.randomUUID(), TODAY), undefined)
    })
    test('cancel: idempotent, past and completed are not cancellable', async () => {
      const a = await mk(s, 'Ann')
      const b1 = await book(a, stay(10))
      const c1 = await s.cancelBooking(a, b1.id, TODAY)
      assert.ok(c1.ok && c1.changed && c1.booking.status === 'cancelled' && c1.booking.cancelledAt && !c1.booking.canCancel)
      const c2 = await s.cancelBooking(a, b1.id, TODAY)
      assert.ok(c2.ok && !c2.changed)
      assert.equal(c2.ok && c2.booking.cancelledAt, c1.ok && c1.booking.cancelledAt)
      const old = await book(a, stay(-5, 2))
      assert.deepEqual(await s.cancelBooking(a, old.id, TODAY), { ok: false, reason: 'not_cancellable' })
      const done = await book(a, stay(10))
      await s.updateAdminBooking(done.id, { status: 'confirmed' }, TODAY)
      await s.updateAdminBooking(done.id, { status: 'completed' }, TODAY)
      assert.deepEqual(await s.cancelBooking(a, done.id, TODAY), { ok: false, reason: 'not_cancellable' })
    })
    test('deleteAccount: blocked by upcoming, anonymises the rest, role rules', async () => {
      const a = await mk(s, 'Ann')
      await s.createSession(a, 'tok', new Date(Date.now() + 60_000))
      const up1 = await book(a, stay(10))
      const prog = await book(a, stay(-1, 3)) // in progress also blocks
      assert.deepEqual(await s.deleteAccount(a, TODAY), { ok: false, reason: 'upcoming_bookings', count: 2 })
      assert.ok(await s.getProfile(a))
      await s.cancelBooking(a, up1.id, TODAY)
      await s.updateAdminBooking(prog.id, { status: 'cancelled' }, TODAY)
      const keep = await book(a, stay(-30, 2, { specialRequests: 'my secret note' }))
      assert.deepEqual(await s.deleteAccount(a, TODAY), { ok: true })
      assert.equal(await s.getProfile(a), undefined)
      assert.equal(await s.findSession('tok'), undefined)
      const kept = (await s.getAdminBooking(keep.id, TODAY))!
      assert.equal(kept.guest, null)
      assert.equal(kept.specialRequests, null)
      assert.equal(kept.reference, keep.reference)
      assert.equal(kept.totalAmount, keep.totalAmount)
      assert.deepEqual(await s.deleteAccount(a, TODAY), { ok: false, reason: 'not_found' })
      const st = await mk(s, 'Staff')
      await s.update(st, { role: 'staff' })
      assert.deepEqual(await s.deleteAccount(st, TODAY), { ok: false, reason: 'not_allowed_for_role' })
    })
    test('admin list: search (literal %), filters, sort, paging', async () => {
      const a = await mk(s, 'Asha Rao', { email: 'asha@x.com', phone: '+919876543210' })
      const b = await mk(s, 'Bob 100%', { email: 'bob@x.com' })
      const b1 = await book(a, stay(5, 2))
      const b2 = await book(a, stay(20, 4, { roomId: 'super-deluxe' }))
      const b3 = await book(b, stay(8, 1))
      await s.updateAdminBooking(b3.id, { status: 'confirmed', paymentStatus: 'paid' }, TODAY)
      const q = (extra: Partial<AdminBookingQuery>) => s.listAdminBookings({ ...adminQ, ...extra }, TODAY)
      assert.equal((await q({})).total, 3)
      assert.equal((await q({ q: b1.reference.toLowerCase() })).items[0]!.id, b1.id)
      assert.equal((await q({ q: 'asha' })).total, 2)
      assert.equal((await q({ q: 'BOB@X' })).total, 1)
      assert.equal((await q({ q: '98765' })).total, 2)
      assert.equal((await q({ q: '%' })).total, 1) // literal percent only matches "Bob 100%"... via name
      assert.equal((await q({ status: 'confirmed' })).total, 1)
      assert.equal((await q({ paymentStatus: 'paid' })).items[0]!.id, b3.id)
      assert.equal((await q({ from: addDays(TODAY, 6), to: addDays(TODAY, 20) })).total, 2) // inclusive bounds
      assert.deepEqual((await q({ sort: 'totalAmount', order: 'desc' })).items.map((x) => x.id), [b2.id, b1.id, b3.id])
      assert.deepEqual((await q({ sort: 'checkIn', order: 'asc' })).items.map((x) => x.id), [b1.id, b3.id, b2.id])
      assert.equal((await q({ pageSize: 2, page: 2 })).items.length, 1)
      assert.equal((await q({ pageSize: 2, page: 9 })).items.length, 0)
      assert.equal((await q({ pageSize: 2, page: 9 })).total, 3)
    })
    test('admin update: transitions, cancelled_at, payment, external ids', async () => {
      const a = await mk(s, 'Ann')
      const x = await book(a, stay(5))
      const y = await book(a, stay(9))
      const up = (id: string, patch: Parameters<UserStore['updateAdminBooking']>[1]) => s.updateAdminBooking(id, patch, TODAY)
      assert.deepEqual(await up(crypto.randomUUID(), { status: 'confirmed' }), { ok: false, reason: 'not_found' })
      assert.deepEqual(await up(x.id, { status: 'completed' }), { ok: false, reason: 'invalid_transition' })
      assert.equal((await up(x.id, { status: 'pending', paymentStatus: 'unpaid' })).ok, true) // same status is a no-op
      const c = await up(x.id, { status: 'confirmed', externalHmsBookingId: 'HMS-1', externalPosFolioId: 'F-1' })
      assert.ok(c.ok && c.booking.status === 'confirmed' && c.booking.paymentStatus === 'unpaid' && c.booking.externalHmsBookingId === 'HMS-1')
      assert.deepEqual(await up(y.id, { externalHmsBookingId: 'HMS-1' }), { ok: false, reason: 'external_id_taken' })
      assert.deepEqual(await up(y.id, { externalPosFolioId: 'F-1' }), { ok: false, reason: 'external_id_taken' })
      const cleared = await up(x.id, { externalHmsBookingId: null })
      assert.ok(cleared.ok && cleared.booking.externalHmsBookingId === null && cleared.booking.externalPosFolioId === 'F-1')
      assert.equal((await up(y.id, { externalHmsBookingId: 'HMS-1' })).ok, true) // freed
      const cx = await up(x.id, { status: 'cancelled' })
      assert.ok(cx.ok && cx.booking.cancelledAt)
      assert.deepEqual(await up(x.id, { status: 'confirmed' }), { ok: false, reason: 'invalid_transition' }) // terminal
    })
    test('stats: booking numbers and everBooked', async () => {
      const a = await mk(s, 'Ann')
      await mk(s, 'Bob')
      const b1 = await book(a, stay(5))
      await book(a, stay(9))
      await book(a, stay(-30, 2))
      await s.updateAdminBooking(b1.id, { status: 'confirmed' }, TODAY)
      const st = await s.stats(TODAY)
      assert.equal(st.lifecycle.everBooked, 1)
      assert.equal(st.bookings.total, 3)
      assert.deepEqual(st.bookings.byStatus, { pending: 2, confirmed: 1, cancelled: 0, completed: 0 })
      assert.equal(st.bookings.upcoming, 2)
      assert.equal(st.bookings.createdLast7Days, 3)
      assert.equal(st.bookings.createdLast30Days, 3)
    })
  })
}

suite('memory', memoryStore, async () => {})
const testPoolInstance: pg.Pool | undefined = await testPool()
if (testPoolInstance) {
  const p = testPoolInstance
  suite('postgres', () => pgStore(p), async () => void (await resetDb(p)), p)
  after(() => p.end())
} else {
  test('UserStore contract: postgres', { skip: 'TEST_DATABASE_URL not set' }, () => {})
}
