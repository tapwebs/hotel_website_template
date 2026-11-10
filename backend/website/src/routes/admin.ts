import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { ZodType } from 'zod'
import { actorId } from '../integrations/hms.ts'
import { ROOMS, ROOM_IDS, applyRoomRates, currentRate, todayIST } from '../domain/bookings.ts'
import { parse, type Guard } from '../core/http.ts'
import { hashPassword } from '../core/password.ts'
import { toCsv } from '../domain/qr-hub-io.ts'
import {
  activityQuerySchema,
  createUserSchema,
  guestSearchQuerySchema,
  idParamSchema,
  listQuerySchema,
  roleBodySchema,
  roomParamSchema,
  roomRateBodySchema,
  statusBodySchema,
} from '../domain/schemas.ts'
import type { AdminBooking, Role, SessionUser, Status, UserStore } from '../stores/store.ts'

/** Every page of a paged query (page size 100), capped so one request cannot walk an unbounded table. */
export async function allPages<T>(load: (page: number) => Promise<{ items: T[]; total: number }>, cap = 5000): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; out.length < cap; page++) {
    const r = await load(page)
    out.push(...r.items)
    if (out.length >= r.total || r.items.length === 0) break
  }
  return out
}

const monthOf = (ymd: string) => ymd.slice(0, 7)

export function registerAdmin(
  app: FastifyInstance,
  store: UserStore,
  guard: Guard,
  now: () => Date = () => new Date(),
  /** Admin or staff (front desk): stats and guest search. Everything else here is admin only. */
  staffGuard: Guard = guard,
  /** HMS is the rate source of truth when connected; website rate edits are refused. */
  ratesLocked = false,
): void {
  const log = (me: SessionUser, action: string, target: string, detail = '') =>
    store.addActivity({ actorId: actorId(me), actorName: me.name, action, target, detail })
  // Check order: session (401), role (403), Origin on unsafe methods (403), validation (422), lookup (404), rules (409).
  app.get('/admin/users', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const q = parse(listQuerySchema, req.query, reply)
    if (!q) return
    const { items, total } = await store.list(q)
    return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) }
  })
  app.get('/admin/users.csv', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const q = parse(listQuerySchema, req.query, reply)
    if (!q) return
    const rows = await allPages((page) => store.list({ ...q, page, pageSize: 100 }))
    const cols = ['name', 'email', 'phone', 'role', 'status', 'joined', 'last_login']
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="users-${todayIST(now())}.csv"`)
      .send(toCsv(cols, rows.map((u) => ({ name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status, joined: u.createdAt, last_login: u.lastLoginAt }))))
  })
  // Reception looks guests up by name, email or phone when taking a booking; only guest accounts, only a few fields.
  app.get('/admin/guest-search', async (req, reply) => {
    if (!(await staffGuard(req, reply, false))) return
    const q = parse(guestSearchQuerySchema, req.query, reply)
    if (!q) return
    const { items } = await store.list({ page: 1, pageSize: 6, q: q.q, role: 'guest', sort: 'name', order: 'asc' })
    return { items: items.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone })) }
  })
  app.post('/admin/users', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const body = parse(createUserSchema, req.body, reply)
    if (!body) return
    const id = randomUUID()
    const ok = await store.create({ id, name: body.name, email: body.email.toLowerCase(), phone: body.phone ?? null, passwordHash: await hashPassword(body.password) })
    if (!ok) return reply.code(409).send({ error: 'email_taken' })
    if (body.role !== 'guest') await store.update(id, { role: body.role })
    await log(me, 'user.created', body.email.toLowerCase(), `role ${body.role}`)
    return reply.code(201).send({ user: await store.get(id) })
  })
  app.get('/admin/users/:id', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    const user = await store.get(p.id)
    return user ? { user } : reply.code(404).send({ error: 'not_found' })
  })
  const patch = (field: 'role' | 'status', bodySchema: ZodType<{ role?: Role; status?: Status }>) =>
    app.patch(`/admin/users/:id/${field}`, async (req, reply) => {
      const me = await guard(req, reply, true)
      if (!me) return
      const p = parse(idParamSchema, req.params, reply)
      if (!p) return
      const body = parse(bodySchema, req.body, reply)
      if (!body) return
      const target = await store.get(p.id)
      if (!target) return reply.code(404).send({ error: 'not_found' })
      if (p.id === me.id) return reply.code(409).send({ error: 'self_modification_forbidden' })
      const res = await store.update(p.id, body)
      if (res.ok) {
        await log(me, `user.${field}`, target.email, `${field} -> ${body[field]}`)
        return { user: res.user }
      }
      return res.reason === 'not_found'
        ? reply.code(404).send({ error: 'not_found' })
        : reply.code(409).send({ error: 'last_admin' })
    })
  patch('role', roleBodySchema)
  patch('status', statusBodySchema)
  app.get('/admin/stats', async (req, reply) => {
    if (!(await staffGuard(req, reply, false))) return
    return { generatedAt: new Date().toISOString(), ...(await store.stats(todayIST(now()))) }
  })

  // ---- Reports: computed from the bookings themselves ----
  app.get('/admin/reports', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const today = todayIST(now())
    const all = await allPages((page) => store.listAdminBookings({ page, pageSize: 100, sort: 'createdAt', order: 'desc' }, today))
    const earns = (b: AdminBooking) => b.status === 'confirmed' || b.status === 'completed'
    const months = new Map<string, { month: string; bookings: number; cancelled: number; revenue: number; nights: number }>()
    for (const b of all) {
      const m = months.get(monthOf(b.checkIn)) ?? { month: monthOf(b.checkIn), bookings: 0, cancelled: 0, revenue: 0, nights: 0 }
      m.bookings++
      if (b.status === 'cancelled') m.cancelled++
      if (earns(b)) {
        m.revenue += b.totalAmount
        m.nights += b.nights * b.roomCount
      }
      months.set(m.month, m)
    }
    const count = <K extends string>(key: (b: AdminBooking) => K) => {
      const c = new Map<K, number>()
      for (const b of all) c.set(key(b), (c.get(key(b)) ?? 0) + 1)
      return [...c].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count)
    }
    const kept = all.filter(earns)
    return {
      generatedAt: now().toISOString(),
      totals: {
        bookings: all.length,
        cancelled: all.filter((b) => b.status === 'cancelled').length,
        revenue: kept.reduce((s, b) => s + b.totalAmount, 0),
        roomNights: kept.reduce((s, b) => s + b.nights * b.roomCount, 0),
        avgStay: kept.length ? Math.round((kept.reduce((s, b) => s + b.nights, 0) / kept.length) * 10) / 10 : 0,
      },
      months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
      rooms: count((b) => b.room.name as string),
      payments: count((b) => b.paymentStatus),
      statuses: count((b) => b.status),
    }
  })

  // ---- Activity log ----
  app.get('/admin/activity', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const q = parse(activityQuerySchema, req.query, reply)
    if (!q) return
    const { items, total } = await store.listActivity(q)
    return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) }
  })

  // ---- Room rates ----
  app.get('/admin/rooms', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    return { items: ROOM_IDS.map((id) => ({ id, name: ROOMS[id].name, rate: currentRate(id), defaultRate: ROOMS[id].ratePerNight, maxAdults: ROOMS[id].maxAdults })) }
  })
  app.put('/admin/rooms/:roomId', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    if (ratesLocked) return reply.code(409).send({ error: 'rates_managed_by_hms' })
    const p = parse(roomParamSchema, req.params, reply)
    const body = p && parse(roomRateBodySchema, req.body, reply)
    if (!p || !body) return
    const before = currentRate(p.roomId)
    await store.setRoomRate(p.roomId, body.rate)
    applyRoomRates(await store.getRoomRates())
    await log(me, 'room.rate', ROOMS[p.roomId].name, `₹${before} -> ₹${body.rate}`)
    return { id: p.roomId, name: ROOMS[p.roomId].name, rate: body.rate }
  })
}
