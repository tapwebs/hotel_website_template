import type { FastifyInstance, FastifyReply } from 'fastify'
import { toBooking, todayIST } from '../domain/bookings.ts'
import { parse, type Guard } from '../core/http.ts'
import type { BookingSyncHooks } from '../integrations/types.ts'
import { hashPassword, verifyPassword } from '../core/password.ts'
import {
  bookingListQuerySchema,
  createBookingSchema,
  deleteBodySchema,
  idParamSchema,
  passwordBodySchema,
  profilePatchSchema,
} from '../domain/schemas.ts'
import { clearCookie, hashToken, readCookie } from '../core/session.ts'
import type { AdminBooking, UserStore } from '../stores/store.ts'

export interface AccountDeps {
  /** Session (401) and, for unsafe methods, Origin (403) check. */
  guard: Guard
  limiter: { hit(key: string): number; refund(key: string): void }
  now: () => Date
  secure: boolean
  bookingSync?: BookingSyncHooks
}

/** Runs an integration hook after the fact: a failing hook is logged and never fails the request. */
export async function runHook(
  log: { error(o: unknown, m?: string): void },
  fn: ((b: AdminBooking) => Promise<void>) | undefined,
  booking: AdminBooking,
): Promise<void> {
  if (!fn) return
  try {
    await fn(booking)
  } catch (err) {
    log.error(err, 'booking sync hook failed')
  }
}

export function registerAccount(app: FastifyInstance, store: UserStore, deps: AccountDeps): void {
  const { guard, limiter, now, secure, bookingSync } = deps
  const today = () => todayIST(now())
  const tooMany = (reply: FastifyReply, wait: number) => {
    reply.header('Retry-After', wait)
    return reply.code(429).send({ error: 'rate_limited' })
  }
  const bad = (path: string, message: string) => ({ error: 'validation_failed', issues: [{ path, message }] })
  // Check order: session (401), Origin on unsafe methods (403), validation (422), rate limit (429), lookup (404), rules (409).

  app.get('/me/profile', async (req, reply) => {
    const me = await guard(req, reply, false)
    if (!me) return
    const profile = await store.getProfile(me.id)
    return profile ? { profile } : reply.code(404).send({ error: 'not_found' })
  })

  app.patch('/me/profile', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const body = parse(profilePatchSchema, req.body, reply)
    if (!body) return
    const profile = await store.updateProfile(me.id, body)
    return profile ? { profile } : reply.code(404).send({ error: 'not_found' })
  })

  app.post('/me/password', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const body = parse(passwordBodySchema, req.body, reply)
    if (!body) return
    // Failed attempts only: the slot is reserved up front and refunded once the current password verified.
    const key = `pw:${me.id}`
    const wait = limiter.hit(key)
    if (wait) return tooMany(reply, wait)
    const user = await store.findById(me.id)
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return reply.code(422).send(bad('currentPassword', 'Current password is incorrect.'))
    }
    limiter.refund(key)
    await store.changePassword(me.id, await hashPassword(body.newPassword), hashToken(readCookie(req.headers.cookie)!))
    return { ok: true }
  })

  app.delete('/me', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const body = parse(deleteBodySchema, req.body, reply)
    if (!body) return
    const key = `del:${me.id}`
    const wait = limiter.hit(key)
    if (wait) return tooMany(reply, wait)
    const user = await store.findById(me.id)
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(422).send(bad('password', 'Password is incorrect.'))
    }
    limiter.refund(key)
    const res = await store.deleteAccount(me.id, today())
    if (!res.ok) {
      if (res.reason === 'upcoming_bookings') return reply.code(409).send({ error: 'upcoming_bookings', count: res.count })
      return reply.code(res.reason === 'not_found' ? 404 : 409).send({ error: res.reason })
    }
    reply.header('Set-Cookie', clearCookie(secure))
    return { ok: true }
  })

  app.get('/me/bookings', async (req, reply) => {
    const me = await guard(req, reply, false)
    if (!me) return
    const q = parse(bookingListQuerySchema, req.query, reply)
    if (!q) return
    const { items, total, counts } = await store.listBookings(me.id, q, today())
    return {
      items: items.map(toBooking),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      counts,
    }
  })

  app.get('/me/bookings/:id', async (req, reply) => {
    const me = await guard(req, reply, false)
    if (!me) return
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    const booking = await store.getBooking(me.id, p.id, today())
    return booking ? { booking: toBooking(booking) } : reply.code(404).send({ error: 'not_found' })
  })

  app.post('/me/bookings', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const body = parse(createBookingSchema(today()), req.body, reply)
    if (!body) return
    const wait = limiter.hit(`book:${me.id}`)
    if (wait) return tooMany(reply, wait)
    const res = await store.createBooking(me.id, body, today())
    if (!res.ok) return reply.code(res.reason === 'booking_limit' ? 409 : 401).send({ error: res.reason === 'booking_limit' ? 'booking_limit' : 'unauthenticated' })
    if (res.created) await runHook(req.log, bookingSync?.onBookingCreated, res.booking)
    return reply.code(res.created ? 201 : 200).send({ booking: toBooking(res.booking) })
  })

  app.post('/me/bookings/:id/cancel', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    const res = await store.cancelBooking(me.id, p.id, today())
    if (!res.ok) return reply.code(res.reason === 'not_found' ? 404 : 409).send({ error: res.reason })
    if (res.changed) await runHook(req.log, bookingSync?.onBookingChanged, res.booking)
    return { booking: toBooking(res.booking) }
  })
}
