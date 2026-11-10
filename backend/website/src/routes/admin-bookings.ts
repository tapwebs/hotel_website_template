import { randomBytes, randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { todayIST } from '../domain/bookings.ts'
import { parse, type Guard } from '../core/http.ts'
import type { BookingSyncHooks } from '../integrations/types.ts'
import type { IntegrationEndpoint } from '../integrations/config.ts'
import { actorId, getHmsReservation, syncBookingToHms } from '../integrations/hms.ts'
import { runHook } from './account.ts'
import { allPages } from './admin.ts'
import { toCsv } from '../domain/qr-hub-io.ts'
import { hashPassword } from '../core/password.ts'
import { adminBookingListQuerySchema, adminBookingPatchSchema, createBookingSchema, emailField, idParamSchema } from '../domain/schemas.ts'
import type { UserStore } from '../stores/store.ts'

export function registerAdminBookings(
  app: FastifyInstance,
  store: UserStore,
  guard: Guard,
  deps: { now: () => Date; bookingSync?: BookingSyncHooks; hms?: IntegrationEndpoint },
): void {
  const today = () => todayIST(deps.now())
  const log = (me: { id: string; name: string }, action: string, target: string, detail = '') => store.addActivity({ actorId: actorId(me), actorName: me.name, action, target, detail })
  // Check order: session (401), role (403), Origin on unsafe methods (403), validation (422), lookup (404), rules (409).
  app.get('/admin/bookings', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const q = parse(adminBookingListQuerySchema, req.query, reply)
    if (!q) return
    const { items, total } = await store.listAdminBookings(q, today())
    return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) }
  })

  app.get('/admin/bookings.csv', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    const q = parse(adminBookingListQuerySchema, req.query, reply)
    if (!q) return
    const rows = await allPages((page) => store.listAdminBookings({ ...q, page, pageSize: 100 }, today()))
    const cols = ['reference', 'guest', 'email', 'phone', 'room', 'rooms', 'check_in', 'check_out', 'nights', 'adults', 'children', 'status', 'payment', 'total_inr', 'requested']
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="bookings-${today()}.csv"`)
      .send(
        toCsv(
          cols,
          rows.map((b) => ({
            reference: b.reference, guest: b.guest?.name ?? '', email: b.guest?.email ?? '', phone: b.guest?.phone ?? '', room: b.room.name, rooms: b.roomCount,
            check_in: b.checkIn, check_out: b.checkOut, nights: b.nights, adults: b.adults, children: b.children, status: b.status, payment: b.paymentStatus,
            total_inr: b.totalAmount, requested: b.createdAt,
          })),
        ),
      )
  })
  // Booking taken by phone or at the desk. The guest is an existing user (userId) or a new one (name + email): a new
  // guest gets an account with an unusable random password, so the booking has an owner without anyone sharing a password.
  const createSchema = z
    .strictObject({
      userId: z.uuid().optional(),
      guest: z
        .strictObject({ name: z.string().trim().min(2).max(100), email: emailField, phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional() })
        .optional(),
      booking: z.unknown(),
      status: z.enum(['pending', 'confirmed']).default('confirmed'),
      paymentStatus: z.enum(['unpaid', 'pay_at_hotel', 'paid']).optional(),
    })
    .refine((b) => Boolean(b.userId) !== Boolean(b.guest), { message: 'Provide either userId or guest.', path: ['guest'] })
  app.post('/admin/bookings', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const body = parse(createSchema, req.body, reply)
    if (!body) return
    const input = parse(createBookingSchema(today()), body.booking, reply)
    if (!input) return
    let userId = body.userId
    if (body.guest) {
      const email = body.guest.email.toLowerCase()
      userId = (await store.findByEmail(email))?.id
      if (!userId) {
        userId = randomUUID()
        await store.create({
          id: userId,
          name: body.guest.name,
          email,
          phone: body.guest.phone ?? null,
          passwordHash: await hashPassword(randomBytes(24).toString('base64url')),
        })
      }
    }
    const created = await store.createBooking(userId!, input, today())
    if (!created.ok) return reply.code(created.reason === 'user_missing' ? 404 : 409).send({ error: created.reason })
    let booking = created.booking
    const patch = { status: body.status === 'pending' ? undefined : body.status, paymentStatus: body.paymentStatus }
    if (patch.status || patch.paymentStatus) {
      const upd = await store.updateAdminBooking(booking.id, patch, today())
      if (upd.ok) booking = upd.booking
    }
    await log(me, 'booking.created', booking.reference, `${booking.room.name}, ${booking.checkIn} to ${booking.checkOut}`)
    await runHook(req.log, deps.bookingSync?.onBookingCreated, booking)
    return reply.code(201).send({ booking })
  })
  app.patch('/admin/bookings/:id', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    const body = parse(adminBookingPatchSchema, req.body, reply)
    if (!body) return
    const res = await store.updateAdminBooking(p.id, body, today())
    if (!res.ok) return reply.code(res.reason === 'not_found' ? 404 : 409).send({ error: res.reason })
    await log(me, 'booking.updated', res.booking.reference, Object.entries(body).map(([k, v]) => `${k} -> ${v ?? 'none'}`).join(', '))
    await runHook(req.log, deps.bookingSync?.onBookingChanged, res.booking)
    return { booking: res.booking }
  })

  // Retry the HMS sync by hand (failures of the automatic hook are only logged).
  app.post('/admin/bookings/:id/sync-hms', async (req, reply) => {
    const me = await guard(req, reply, true)
    if (!me) return
    if (!deps.hms) return reply.code(503).send({ error: 'hms_not_configured' })
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    const b = await store.getAdminBooking(p.id, today())
    if (!b) return reply.code(404).send({ error: 'not_found' })
    try {
      const booking = await syncBookingToHms(deps.hms, store, b)
      await log(me, 'booking.hms_sync', booking.reference, booking.externalHmsBookingId ?? '')
      return { booking }
    } catch (err) {
      req.log.error({ err, reference: b.reference }, 'HMS sync failed')
      return reply.code(502).send({ error: 'hms_sync_failed', message: (err as Error).message })
    }
  })
  // Live HMS state (reservation status, in-house / checked out) for one booking.
  app.get('/admin/bookings/:id/hms', async (req, reply) => {
    if (!(await guard(req, reply, false))) return
    if (!deps.hms) return reply.code(503).send({ error: 'hms_not_configured' })
    const p = parse(idParamSchema, req.params, reply)
    if (!p) return
    const b = await store.getAdminBooking(p.id, today())
    if (!b) return reply.code(404).send({ error: 'not_found' })
    try {
      return { hms: await getHmsReservation(deps.hms, b.reference) }
    } catch {
      return reply.code(404).send({ error: 'not_synced' })
    }
  })
}
