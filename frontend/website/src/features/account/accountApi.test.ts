import { describe, expect, it, vi } from 'vitest'
import {
  buildBookingsQuery,
  cancelBooking,
  changePassword,
  createBooking,
  deleteAccount,
  errorFor,
  fieldIssues,
  getProfile,
  listMyBookings,
  parseBookingsParams,
  toBookingsSearch,
  updateProfile,
} from './accountApi'
const base = 'http://api.test'
const booking = {
  id: 'b1', reference: 'HDH-7K3M9Q', status: 'pending', paymentStatus: 'pay_at_hotel',
  room: { id: 'deluxe', name: 'Deluxe Room' }, roomCount: 1, checkIn: '2026-11-01', checkOut: '2026-11-03', nights: 2,
  adults: 2, children: 0, extraBed: false, specialRequests: null, ratePerNight: 1500, totalAmount: 3000, currency: 'INR',
  canCancel: true, cancelledAt: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
}
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))
const opts = (f: ReturnType<typeof reply>) => ({ baseUrl: base, fetchImpl: f as unknown as typeof fetch })
describe('booking list params', () => {
  it('builds the query and round-trips URL params with safe fallbacks', () => {
    expect(buildBookingsQuery({ filter: 'past', page: 2 })).toBe('page=2&pageSize=10&filter=past')
    expect(parseBookingsParams(new URLSearchParams('filter=bogus&page=-3'))).toEqual({ filter: 'all', page: 1 })
    expect(parseBookingsParams(new URLSearchParams('filter=cancelled&page=4'))).toEqual({ filter: 'cancelled', page: 4 })
    expect(toBookingsSearch({ filter: 'all', page: 1 }).toString()).toBe('')
    expect(toBookingsSearch({ filter: 'upcoming', page: 2 }).toString()).toBe('filter=upcoming&page=2')
  })
})
describe('requests', () => {
  it('createBooking sends only the allowed fields (never a total) with credentials', async () => {
    const f = reply(201, { booking })
    const r = await createBooking(
      { roomId: 'deluxe', checkIn: '2026-11-01', checkOut: '2026-11-03', rooms: 1, adults: 2, children: 0, extraBed: false, specialRequests: null },
      '11111111-1111-4111-8111-111111111111',
      opts(f),
    )
    expect(r.ok).toBe(true)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${base}/me/bookings`)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(Object.keys(JSON.parse(init.body as string)).sort()).toEqual(
      ['adults', 'checkIn', 'checkOut', 'children', 'extraBed', 'requestId', 'roomId', 'rooms', 'specialRequests'].sort(),
    )
  })
  it('DELETE /me sends a JSON body', async () => {
    const f = reply(200, { ok: true })
    await deleteAccount('secret', opts(f))
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${base}/me`)
    expect(init.method).toBe('DELETE')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({ password: 'secret' })
  })
  it('cancel is a body-less POST; password change and profile patch hit the contract paths', async () => {
    const f = reply(200, { booking })
    await cancelBooking('b 1', opts(f))
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${base}/me/bookings/b%201/cancel`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    const p = reply(200, { ok: true })
    await changePassword('old', 'newpass12', opts(p))
    expect((p.mock.calls[0] as unknown as [string])[0]).toBe(`${base}/me/password`)
    const u = reply(422, { error: 'validation_failed', issues: [] })
    await updateProfile({ name: 'A B' }, opts(u))
    expect((u.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('PATCH')
  })
  it('parses list and profile responses; a wrong shape is a server error', async () => {
    const list = await listMyBookings({ filter: 'all', page: 1 }, 10, opts(reply(200, { items: [booking], page: 1, pageSize: 10, total: 1, totalPages: 1, counts: { all: 1, upcoming: 1, past: 0, cancelled: 0 } })))
    expect(list.ok && list.data.items[0].reference).toBe('HDH-7K3M9Q')
    const bad = await getProfile(opts(reply(200, { profile: { id: 1 } })))
    expect(bad).toMatchObject({ ok: false, error: { kind: 'server' } })
  })
})
describe('errorFor', () => {
  it('maps statuses and codes', () => {
    expect(errorFor(401, null).kind).toBe('unauthenticated')
    expect(errorFor(403, { error: 'forbidden_origin' }).message).toContain('Reload the page')
    expect(errorFor(404, { error: 'not_found' })).toMatchObject({ kind: 'not_found', message: 'We could not find that booking.' })
    expect(errorFor(409, { error: 'not_cancellable' }).message).toContain('can no longer be cancelled online')
    expect(errorFor(409, { error: 'upcoming_bookings', count: 2 }).message).toContain('upcoming stays')
    expect(errorFor(409, { error: 'booking_limit' }).kind).toBe('conflict')
    expect(errorFor(429, { error: 'rate_limited' }).kind).toBe('rate_limited')
    expect(errorFor(500, {}).kind).toBe('server')
  })
  it('keeps 422 issues and maps them to fields by their last path segment', () => {
    const e = errorFor(422, { error: 'validation_failed', issues: [{ path: 'preferences.bed', message: 'Bad bed' }, { path: 'currentPassword', message: 'Current password is incorrect.' }, { path: '', message: 'root' }] })
    expect(e.kind).toBe('validation')
    expect(fieldIssues(e)).toEqual({ bed: 'Bad bed', currentPassword: 'Current password is incorrect.', '': 'root' })
  })
})
