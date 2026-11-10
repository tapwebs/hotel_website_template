import type pg from 'pg'
import {
  MAX_ACTIVE_BOOKINGS,
  canCancel,
  canTransition,
  isPast,
  isUpcoming,
  newReference,
  quote,
  todayIST,
  type BookingStatus,
  type PaymentStatus,
  type RoomId,
} from '../domain/bookings.ts'

export type Role = 'guest' | 'staff' | 'admin'
export type Status = 'active' | 'disabled'
export interface User {
  id: string
  name: string
  email: string // stored lowercased
  phone: string | null
  passwordHash: string
  role: Role
  status: Status
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  externalHmsId: string | null // TODO(link): set when the HMS integration exists
  externalPosId: string | null // TODO(link): set when the POS integration exists
  googleSub?: string | null
}
/** The ONLY shape routes may serialize: never carries the password hash. */
export type AdminUser = Omit<User, 'passwordHash'>
export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
}
export interface ListQuery {
  page: number
  pageSize: number
  q?: string
  role?: Role
  status?: Status
  sort: 'createdAt' | 'name' | 'email' | 'lastLoginAt'
  order: 'asc' | 'desc'
}
export interface Stats {
  totals: { users: number; active: number; disabled: number; guests: number; staff: number; admins: number }
  signups: { last7Days: number; last30Days: number }
  activeLast30Days: number
  lifecycle: { registered: number; everLoggedIn: number; everBooked: number; linkedHms: number; linkedPos: number }
  bookings: {
    total: number
    byStatus: Record<BookingStatus, number>
    upcoming: number
    createdLast7Days: number
    createdLast30Days: number
  }
  signupsByDay: { date: string; count: number }[]
}
export type UpdateResult = { ok: true; user: AdminUser } | { ok: false; reason: 'not_found' | 'last_admin' }
export interface NewUser {
  id: string
  name: string
  email: string
  phone: string | null
  passwordHash: string
}

export interface Booking {
  id: string
  reference: string
  status: BookingStatus
  paymentStatus: PaymentStatus
  room: { id: RoomId; name: string }
  roomCount: number
  checkIn: string
  checkOut: string
  nights: number
  adults: number
  children: number
  extraBed: boolean
  specialRequests: string | null
  ratePerNight: number
  totalAmount: number
  currency: 'INR'
  canCancel: boolean
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}
export interface AdminBooking extends Booking {
  guest: { id: string; name: string; email: string; phone: string | null } | null // null = deleted (anonymised) account
  externalHmsBookingId: string | null
  externalPosFolioId: string | null
}
export interface Preferences {
  bed: 'no_preference' | 'king' | 'twin' | 'extra_bed'
  dietary: 'no_preference' | 'vegetarian' | 'vegan' | 'jain' | 'other'
  notes: string
}
export interface Profile {
  id: string
  name: string
  email: string
  phone: string | null
  country: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postcode: string | null
  preferences: Preferences
  marketingOptIn: boolean
  role: Role
  createdAt: string
  lastLoginAt: string | null
}
export interface ProfilePatch {
  name?: string
  phone?: string
  country?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  preferences?: Preferences
  marketingOptIn?: boolean
}
const PROFILE_TEXT_KEYS = {
  name: 'name',
  phone: 'phone',
  country: 'country',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  city: 'city',
  state: 'state',
  postcode: 'postcode',
} as const
const DEFAULT_PREFS: Preferences = { bed: 'no_preference', dietary: 'no_preference', notes: '' }
export interface NewBookingInput {
  requestId?: string
  roomId: RoomId
  checkIn: string
  checkOut: string
  rooms: number
  adults: number
  children: number
  extraBed: boolean
  specialRequests: string | null
}
export type BookingFilter = 'all' | 'upcoming' | 'past' | 'cancelled'
export interface BookingCounts {
  all: number
  upcoming: number
  past: number
  cancelled: number
}
export interface AdminBookingQuery {
  page: number
  pageSize: number
  q?: string
  status?: BookingStatus
  paymentStatus?: PaymentStatus
  from?: string
  to?: string
  view?: 'arrivals' | 'departures' | 'inhouse'
  day?: string
  sort: 'createdAt' | 'checkIn' | 'totalAmount'
  order: 'asc' | 'desc'
}
export interface AdminBookingPatch {
  status?: BookingStatus
  paymentStatus?: PaymentStatus
  externalHmsBookingId?: string | null
  externalPosFolioId?: string | null
}
export interface ActivityEntry {
  id: string
  at: string
  actorId: string | null
  actorName: string
  action: string
  target: string
  detail: string
}
export type DeleteResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'not_allowed_for_role' | 'upcoming_bookings'; count?: number }
export type CreateBookingResult =
  | { ok: true; booking: AdminBooking; created: boolean }
  | { ok: false; reason: 'booking_limit' | 'user_missing' }
export type CancelResult =
  | { ok: true; booking: AdminBooking; changed: boolean }
  | { ok: false; reason: 'not_found' | 'not_cancellable' }
export type AdminBookingUpdateResult =
  | { ok: true; booking: AdminBooking }
  | { ok: false; reason: 'not_found' | 'invalid_transition' | 'external_id_taken' }

export interface UserStore {
  findByEmail(email: string): Promise<User | undefined>
  findByGoogleSub(sub: string): Promise<User | undefined>
  /** Creates a guest/active user. Returns false when the email is already taken. */
  create(user: NewUser): Promise<boolean>
  /** Creates a guest user registered via Google. Returns null on conflict. */
  createWithGoogle(user: { id: string; name: string; email: string; googleSub: string; phone?: string | null }): Promise<User | null>
  /** Links a Google sub to an existing account. Returns false on conflict. */
  linkGoogleSub(userId: string, sub: string): Promise<boolean>
  recordLogin(id: string): Promise<void>
  list(q: ListQuery): Promise<{ items: AdminUser[]; total: number }>
  get(id: string): Promise<AdminUser | undefined>
  stats(today?: string): Promise<Stats>
  update(id: string, patch: { role?: Role; status?: Status }): Promise<UpdateResult>
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>
  /** Unexpired session of an active user only. */
  findSession(tokenHash: string): Promise<SessionUser | undefined>
  deleteSession(tokenHash: string): Promise<void>
  /** Includes the password hash: only for verifying a password, never serialize it. */
  findById(id: string): Promise<User | undefined>
  getProfile(userId: string): Promise<Profile | undefined>
  updateProfile(userId: string, patch: ProfilePatch): Promise<Profile | undefined>
  /** Stores the new hash and deletes every session of the user except `keepTokenHash`. */
  changePassword(userId: string, passwordHash: string, keepTokenHash: string): Promise<void>
  /** Guests only; blocked while pending/confirmed stays are upcoming or in progress. Anonymises the rest. */
  deleteAccount(userId: string, today?: string): Promise<DeleteResult>
  createBooking(userId: string, input: NewBookingInput, today?: string): Promise<CreateBookingResult>
  /** Every booking method below is scoped to `userId` in the query itself: other users' ids read as not found. */
  listBookings(
    userId: string,
    q: { filter: BookingFilter; page: number; pageSize: number },
    today?: string,
  ): Promise<{ items: AdminBooking[]; total: number; counts: BookingCounts }>
  getBooking(userId: string, id: string, today?: string): Promise<AdminBooking | undefined>
  /** Idempotent: an already cancelled booking returns ok with changed=false. */
  cancelBooking(userId: string, id: string, today?: string): Promise<CancelResult>
  listAdminBookings(q: AdminBookingQuery, today?: string): Promise<{ items: AdminBooking[]; total: number }>
  getAdminBooking(id: string, today?: string): Promise<AdminBooking | undefined>
  updateAdminBooking(id: string, patch: AdminBookingPatch, today?: string): Promise<AdminBookingUpdateResult>
  /** Audit trail of admin actions (who did what). */
  addActivity(e: Omit<ActivityEntry, 'id' | 'at'>): Promise<void>
  listActivity(q: { page: number; pageSize: number }): Promise<{ items: ActivityEntry[]; total: number }>
  /** Admin-set nightly rates; rooms without a row use the built-in rate. */
  getRoomRates(): Promise<Record<string, number>>
  setRoomRate(roomId: string, rate: number): Promise<void>
  close?(): Promise<void>
}

const DAY = 86_400_000
/** Front-desk view for one day: arrivals (pending or confirmed), departures and in-house stays (confirmed). */
const matchesView = (r: { checkIn: string; checkOut: string; status: string }, view: 'arrivals' | 'departures' | 'inhouse', day: string) =>
  view === 'arrivals'
    ? r.checkIn === day && (r.status === 'pending' || r.status === 'confirmed')
    : view === 'departures'
      ? r.checkOut === day && r.status === 'confirmed'
      : r.checkIn <= day && r.checkOut > day && r.status === 'confirmed'
const strip = ({ passwordHash: _h, ...rest }: User): AdminUser => rest
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

export function memoryStore(): UserStore {
  const users = new Map<string, User>() // by id
  const activity: ActivityEntry[] = []
  const rates = new Map<string, number>()
  const sessions = new Map<string, { userId: string; expiresAt: number }>()
  const activeAdmins = (except?: string) =>
    [...users.values()].filter((u) => u.role === 'admin' && u.status === 'active' && u.id !== except).length
  const byEmail = (email: string) => [...users.values()].find((u) => u.email === email.toLowerCase())
  interface Extra {
    country: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    postcode: string | null
    preferences: Preferences
    marketingOptIn: boolean
  }
  const extras = new Map<string, Extra>()
  const extraOf = (id: string): Extra => {
    let e = extras.get(id)
    if (!e) {
      e = { country: null, addressLine1: null, addressLine2: null, city: null, state: null, postcode: null, preferences: { ...DEFAULT_PREFS }, marketingOptIn: false }
      extras.set(id, e)
    }
    return e
  }
  const profileOf = (u: User): Profile => {
    const e = extraOf(u.id)
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      country: e.country, addressLine1: e.addressLine1, addressLine2: e.addressLine2, city: e.city, state: e.state, postcode: e.postcode,
      preferences: { ...e.preferences }, marketingOptIn: e.marketingOptIn, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
    }
  }
  interface Rec {
    seq: number // insertion order: ISO timestamps tie within a millisecond
    id: string
    reference: string
    userId: string | null
    clientRequestId: string | null
    roomId: RoomId
    roomName: string
    roomCount: number
    checkIn: string
    checkOut: string
    nights: number
    adults: number
    children: number
    extraBed: boolean
    specialRequests: string | null
    ratePerNight: number
    totalAmount: number
    paymentStatus: PaymentStatus
    status: BookingStatus
    cancelledAt: string | null
    createdAt: string
    updatedAt: string
    externalHmsBookingId: string | null
    externalPosFolioId: string | null
  }
  const recs = new Map<string, Rec>()
  let seq = 0
  const view = (r: Rec, today: string): AdminBooking => {
    const u = r.userId ? users.get(r.userId) : undefined
    return {
      id: r.id, reference: r.reference, status: r.status, paymentStatus: r.paymentStatus,
      room: { id: r.roomId, name: r.roomName }, roomCount: r.roomCount, checkIn: r.checkIn, checkOut: r.checkOut, nights: r.nights,
      adults: r.adults, children: r.children, extraBed: r.extraBed, specialRequests: r.specialRequests,
      ratePerNight: r.ratePerNight, totalAmount: r.totalAmount, currency: 'INR', canCancel: canCancel(r, today),
      cancelledAt: r.cancelledAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
      guest: u ? { id: u.id, name: u.name, email: u.email, phone: u.phone } : null,
      externalHmsBookingId: r.externalHmsBookingId, externalPosFolioId: r.externalPosFolioId,
    }
  }
  const mine = (userId: string) => [...recs.values()].filter((r) => r.userId === userId)
  const cmp = (a: string | number, b: string | number) => {
    if (a === b) return 0
    return a < b ? -1 : 1
  }
  return {
    findByEmail: async (email) => byEmail(email),
    findByGoogleSub: async (sub) => [...users.values()].find((u) => u.googleSub === sub),
    create: async (u) => {
      const email = u.email.toLowerCase()
      if (byEmail(email)) return false
      const now = new Date().toISOString()
      users.set(u.id, {
        ...u,
        email,
        role: 'guest',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        externalHmsId: null,
        externalPosId: null,
        googleSub: null,
      })
      return true
    },
    createWithGoogle: async (u) => {
      const email = u.email.toLowerCase()
      if (byEmail(email) || [...users.values()].some((x) => x.googleSub === u.googleSub)) return null
      const now = new Date().toISOString()
      const created: User = {
        id: u.id,
        name: u.name,
        email,
        phone: u.phone ?? null,
        passwordHash: '',
        role: 'guest',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        externalHmsId: null,
        externalPosId: null,
        googleSub: u.googleSub,
      }
      users.set(u.id, created)
      return created
    },
    linkGoogleSub: async (userId, sub) => {
      const u = users.get(userId)
      if (!u) return false
      if (u.googleSub && u.googleSub !== sub) return false
      if ([...users.values()].some((x) => x.id !== userId && x.googleSub === sub)) return false
      u.googleSub = sub
      u.updatedAt = new Date().toISOString()
      return true
    },
    recordLogin: async (id) => {
      const u = users.get(id)
      if (u) u.lastLoginAt = new Date().toISOString()
    },
    list: async (q) => {
      const term = q.q?.toLowerCase()
      const rows = [...users.values()].filter(
        (u) =>
          (!q.role || u.role === q.role) &&
          (!q.status || u.status === q.status) &&
          (!term || [u.name, u.email, u.phone ?? ''].some((f) => f.toLowerCase().includes(term))),
      )
      const dir = q.order === 'asc' ? 1 : -1
      const val = (u: User) => (q.sort === 'name' ? u.name.toLowerCase() : u[q.sort])
      rows.sort((a, b) => {
        const x = val(a)
        const y = val(b)
        if (x === null && y !== null) return 1 // NULLS LAST both ways
        if (y === null && x !== null) return -1
        const c = x === y ? 0 : x! < y! ? -1 : 1
        return c * dir || a.id.localeCompare(b.id)
      })
      const start = (q.page - 1) * q.pageSize
      return { items: rows.slice(start, start + q.pageSize).map(strip), total: rows.length }
    },
    get: async (id) => {
      const u = users.get(id)
      return u && strip(u)
    },
    stats: async (today = todayIST()) => {
      const all = [...users.values()]
      const bk = [...recs.values()]
      const now = Date.now()
      const since = (days: number) => all.filter((u) => Date.parse(u.createdAt) >= now - days * DAY).length
      const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * DAY).toISOString().slice(0, 10))
      return {
        totals: {
          users: all.length,
          active: all.filter((u) => u.status === 'active').length,
          disabled: all.filter((u) => u.status === 'disabled').length,
          guests: all.filter((u) => u.role === 'guest').length,
          staff: all.filter((u) => u.role === 'staff').length,
          admins: all.filter((u) => u.role === 'admin').length,
        },
        signups: { last7Days: since(7), last30Days: since(30) },
        activeLast30Days: all.filter((u) => u.lastLoginAt && Date.parse(u.lastLoginAt) >= now - 30 * DAY).length,
        lifecycle: {
          registered: all.length,
          everLoggedIn: all.filter((u) => u.lastLoginAt).length,
          everBooked: new Set(bk.map((b) => b.userId).filter(Boolean)).size,
          linkedHms: all.filter((u) => u.externalHmsId).length,
          linkedPos: all.filter((u) => u.externalPosId).length,
        },
        bookings: {
          total: bk.length,
          byStatus: {
            pending: bk.filter((b) => b.status === 'pending').length,
            confirmed: bk.filter((b) => b.status === 'confirmed').length,
            cancelled: bk.filter((b) => b.status === 'cancelled').length,
            completed: bk.filter((b) => b.status === 'completed').length,
          },
          upcoming: bk.filter((b) => isUpcoming(b, today)).length,
          createdLast7Days: bk.filter((b) => Date.parse(b.createdAt) >= now - 7 * DAY).length,
          createdLast30Days: bk.filter((b) => Date.parse(b.createdAt) >= now - 30 * DAY).length,
        },
        signupsByDay: days.map((date) => ({ date, count: all.filter((u) => u.createdAt.slice(0, 10) === date).length })),
      }
    },
    update: async (id, patch) => {
      const u = users.get(id)
      if (!u) return { ok: false, reason: 'not_found' }
      const removesAdmin =
        u.role === 'admin' && u.status === 'active' && ((patch.role && patch.role !== 'admin') || patch.status === 'disabled')
      if (removesAdmin && activeAdmins(id) === 0) return { ok: false, reason: 'last_admin' }
      if (patch.role) u.role = patch.role
      if (patch.status) u.status = patch.status
      u.updatedAt = new Date().toISOString()
      if (patch.status === 'disabled') for (const [k, s] of sessions) if (s.userId === id) sessions.delete(k)
      return { ok: true, user: strip(u) }
    },
    createSession: async (userId, tokenHash, expiresAt) => {
      for (const [k, s] of sessions) if (s.expiresAt < Date.now()) sessions.delete(k)
      sessions.set(tokenHash, { userId, expiresAt: expiresAt.getTime() })
    },
    findSession: async (tokenHash) => {
      const s = sessions.get(tokenHash)
      const u = s && users.get(s.userId)
      if (!s || !u || s.expiresAt <= Date.now() || u.status !== 'active') return undefined
      return { id: u.id, name: u.name, email: u.email, role: u.role }
    },
    deleteSession: async (tokenHash) => {
      sessions.delete(tokenHash)
    },
    findById: async (id) => users.get(id),
    getProfile: async (id) => {
      const u = users.get(id)
      return u && profileOf(u)
    },
    updateProfile: async (id, patch) => {
      const u = users.get(id)
      if (!u) return undefined
      const e = extraOf(id)
      if (patch.name !== undefined) u.name = patch.name
      if (patch.phone !== undefined) u.phone = patch.phone
      for (const k of ['country', 'addressLine1', 'addressLine2', 'city', 'state', 'postcode'] as const) {
        if (patch[k] !== undefined) e[k] = patch[k]
      }
      if (patch.preferences) e.preferences = { ...patch.preferences }
      if (patch.marketingOptIn !== undefined) e.marketingOptIn = patch.marketingOptIn
      u.updatedAt = new Date().toISOString()
      return profileOf(u)
    },
    changePassword: async (id, hash, keep) => {
      const u = users.get(id)
      if (!u) return
      u.passwordHash = hash
      u.updatedAt = new Date().toISOString()
      for (const [k, sess] of sessions) if (sess.userId === id && k !== keep) sessions.delete(k)
    },
    deleteAccount: async (id, today = todayIST()) => {
      const u = users.get(id)
      if (!u) return { ok: false, reason: 'not_found' }
      if (u.role !== 'guest') return { ok: false, reason: 'not_allowed_for_role' }
      const count = mine(id).filter((r) => isUpcoming(r, today)).length
      if (count) return { ok: false, reason: 'upcoming_bookings', count }
      for (const r of mine(id)) {
        r.userId = null
        r.specialRequests = null
        r.updatedAt = new Date().toISOString()
      }
      for (const [k, sess] of sessions) if (sess.userId === id) sessions.delete(k)
      extras.delete(id)
      users.delete(id)
      return { ok: true }
    },
    createBooking: async (userId, input, today = todayIST()) => {
      if (!users.has(userId)) return { ok: false, reason: 'user_missing' }
      if (input.requestId) {
        const dup = mine(userId).find((r) => r.clientRequestId === input.requestId)
        if (dup) return { ok: true, booking: view(dup, today), created: false }
      }
      if (mine(userId).filter((r) => isUpcoming(r, today)).length >= MAX_ACTIVE_BOOKINGS) return { ok: false, reason: 'booking_limit' }
      const q = quote(input.roomId, input.checkIn, input.checkOut, input.rooms)
      let reference = newReference()
      while ([...recs.values()].some((r) => r.reference === reference)) reference = newReference()
      const now = new Date().toISOString()
      const rec: Rec = {
        seq: seq++, id: crypto.randomUUID(), reference, userId, clientRequestId: input.requestId ?? null,
        roomId: input.roomId, roomName: q.roomName, roomCount: input.rooms, checkIn: input.checkIn, checkOut: input.checkOut,
        nights: q.nights, adults: input.adults, children: input.children, extraBed: input.extraBed, specialRequests: input.specialRequests,
        ratePerNight: q.ratePerNight, totalAmount: q.totalAmount, paymentStatus: 'pay_at_hotel', status: 'pending', cancelledAt: null,
        createdAt: now, updatedAt: now, externalHmsBookingId: null, externalPosFolioId: null,
      }
      recs.set(rec.id, rec)
      return { ok: true, booking: view(rec, today), created: true }
    },
    listBookings: async (userId, q, today = todayIST()) => {
      const all = mine(userId)
      const counts = {
        all: all.length,
        upcoming: all.filter((r) => isUpcoming(r, today)).length,
        past: all.filter((r) => isPast(r, today)).length,
        cancelled: all.filter((r) => r.status === 'cancelled').length,
      }
      const matchesFilter = (r: Rec): boolean => {
        switch (q.filter) {
          case 'all':
            return true
          case 'upcoming':
            return isUpcoming(r, today)
          case 'past':
            return isPast(r, today)
          case 'cancelled':
            return r.status === 'cancelled'
        }
      }
      const rows = all.filter(matchesFilter)
      rows.sort((a, b) => {
        if (q.filter === 'upcoming') return cmp(a.checkIn, b.checkIn) || cmp(a.id, b.id)
        if (q.filter === 'all') return cmp(b.seq, a.seq)
        return cmp(b.checkIn, a.checkIn) || cmp(a.id, b.id)
      })
      const start = (q.page - 1) * q.pageSize
      return { items: rows.slice(start, start + q.pageSize).map((r) => view(r, today)), total: counts[q.filter], counts }
    },
    getBooking: async (userId, id, today = todayIST()) => {
      const r = recs.get(id)
      return r && r.userId === userId ? view(r, today) : undefined
    },
    cancelBooking: async (userId, id, today = todayIST()) => {
      const r = recs.get(id)
      if (!r || r.userId !== userId) return { ok: false, reason: 'not_found' }
      if (canCancel(r, today)) {
        r.status = 'cancelled'
        r.cancelledAt = r.updatedAt = new Date().toISOString()
        return { ok: true, booking: view(r, today), changed: true }
      }
      return r.status === 'cancelled' ? { ok: true, booking: view(r, today), changed: false } : { ok: false, reason: 'not_cancellable' }
    },
    listAdminBookings: async (q, today = todayIST()) => {
      const term = q.q?.toLowerCase()
      const rows = [...recs.values()].filter((r) => {
        const u = r.userId ? users.get(r.userId) : undefined
        return (
          (!q.status || r.status === q.status) &&
          (!q.paymentStatus || r.paymentStatus === q.paymentStatus) &&
          (!q.from || r.checkIn >= q.from) &&
          (!q.to || r.checkIn <= q.to) &&
          (!q.view || !q.day || matchesView(r, q.view, q.day)) &&
          (!term || [r.reference, u?.name ?? '', u?.email ?? '', u?.phone ?? ''].some((f) => f.toLowerCase().includes(term)))
        )
      })
      const dir = q.order === 'asc' ? 1 : -1
      const val = (r: Rec): string | number => {
        switch (q.sort) {
          case 'createdAt':
            return r.seq
          case 'checkIn':
            return r.checkIn
          case 'totalAmount':
            return r.totalAmount
        }
      }
      rows.sort((a, b) => cmp(val(a), val(b)) * dir || cmp(a.id, b.id))
      const start = (q.page - 1) * q.pageSize
      return { items: rows.slice(start, start + q.pageSize).map((r) => view(r, today)), total: rows.length }
    },
    addActivity: async (e) => {
      activity.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...e })
    },
    listActivity: async (q) => ({ items: activity.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: activity.length }),
    getRoomRates: async () => Object.fromEntries(rates),
    setRoomRate: async (roomId, rate) => {
      rates.set(roomId, rate)
    },
    getAdminBooking: async (id, today = todayIST()) => {
      const r = recs.get(id)
      return r && view(r, today)
    },
    updateAdminBooking: async (id, patch, today = todayIST()) => {
      const r = recs.get(id)
      if (!r) return { ok: false, reason: 'not_found' }
      if (patch.status && !canTransition(r.status, patch.status)) return { ok: false, reason: 'invalid_transition' }
      const taken = (key: 'externalHmsBookingId' | 'externalPosFolioId') =>
        patch[key] != null && [...recs.values()].some((o) => o.id !== id && o[key] === patch[key])
      if (taken('externalHmsBookingId') || taken('externalPosFolioId')) return { ok: false, reason: 'external_id_taken' }
      const now = new Date().toISOString()
      if (patch.status && patch.status !== r.status) {
        r.status = patch.status
        if (patch.status === 'cancelled') r.cancelledAt = now
      }
      if (patch.paymentStatus) r.paymentStatus = patch.paymentStatus
      if (patch.externalHmsBookingId !== undefined) r.externalHmsBookingId = patch.externalHmsBookingId
      if (patch.externalPosFolioId !== undefined) r.externalPosFolioId = patch.externalPosFolioId
      r.updatedAt = now
      return { ok: true, booking: view(r, today) }
    },
  }
}

interface UserRow {
  id: string
  name: string
  email: string
  phone: string | null
  password_hash: string | null
  role: Role
  status: Status
  created_at: Date
  updated_at: Date
  last_login_at: Date | null
  external_hms_id: string | null
  external_pos_id: string | null
  google_sub: string | null
}
const COLS = 'id, name, email, phone, password_hash, role, status, created_at, updated_at, last_login_at, external_hms_id, external_pos_id, google_sub'
const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  passwordHash: r.password_hash ?? '',
  role: r.role,
  status: r.status,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  lastLoginAt: r.last_login_at?.toISOString() ?? null,
  externalHmsId: r.external_hms_id,
  externalPosId: r.external_pos_id,
  googleSub: r.google_sub ?? null,
})
// Whitelists: sort/order never come from input as SQL text.
const SORT_COLUMNS = { createdAt: 'created_at', name: 'lower(name)', email: 'email', lastLoginAt: 'last_login_at' } as const
const ORDER = { asc: 'ASC', desc: 'DESC' } as const
const BOOKING_SORT = { createdAt: 'b.created_at', checkIn: 'b.check_in', totalAmount: 'b.total_amount' } as const

// date columns are read as text so the driver never turns them into JS Dates (no time zone shifts).
const BCOLS = `b.id, b.reference, b.room_id, b.room_name, b.room_count, b.check_in::text AS check_in, b.check_out::text AS check_out,
  b.nights, b.adults, b.children, b.extra_bed, b.special_requests, b.rate_per_night, b.total_amount, b.currency, b.payment_status,
  b.status, b.cancelled_at, b.created_at, b.updated_at, b.external_hms_booking_id, b.external_pos_folio_id,
  u.id AS guest_id, u.name AS guest_name, u.email AS guest_email, u.phone AS guest_phone`
const BFROM = 'FROM bookings b LEFT JOIN users u ON u.id = b.user_id'
interface BookingRow {
  id: string
  reference: string
  room_id: RoomId
  room_name: string
  room_count: number
  check_in: string
  check_out: string
  nights: number
  adults: number
  children: number
  extra_bed: boolean
  special_requests: string | null
  rate_per_night: number
  total_amount: number
  currency: 'INR'
  payment_status: PaymentStatus
  status: BookingStatus
  cancelled_at: Date | null
  created_at: Date
  updated_at: Date
  external_hms_booking_id: string | null
  external_pos_folio_id: string | null
  guest_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
}
const toBookingView = (r: BookingRow, today: string): AdminBooking => ({
  id: r.id,
  reference: r.reference,
  status: r.status,
  paymentStatus: r.payment_status,
  room: { id: r.room_id, name: r.room_name },
  roomCount: r.room_count,
  checkIn: r.check_in,
  checkOut: r.check_out,
  nights: r.nights,
  adults: r.adults,
  children: r.children,
  extraBed: r.extra_bed,
  specialRequests: r.special_requests,
  ratePerNight: r.rate_per_night,
  totalAmount: r.total_amount,
  currency: r.currency,
  canCancel: canCancel({ status: r.status, checkIn: r.check_in }, today),
  cancelledAt: r.cancelled_at?.toISOString() ?? null,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  guest: r.guest_id ? { id: r.guest_id, name: r.guest_name!, email: r.guest_email!, phone: r.guest_phone } : null,
  externalHmsBookingId: r.external_hms_booking_id,
  externalPosFolioId: r.external_pos_folio_id,
})
interface ProfileRow {
  id: string
  name: string
  email: string
  phone: string | null
  country: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postcode: string | null
  preferences: Partial<Preferences>
  marketing_opt_in: boolean
  role: Role
  created_at: Date
  last_login_at: Date | null
}
const PROFILE_COLS =
  'id, name, email, phone, country, address_line1, address_line2, city, state, postcode, preferences, marketing_opt_in, role, created_at, last_login_at'
const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  country: r.country,
  addressLine1: r.address_line1,
  addressLine2: r.address_line2,
  city: r.city,
  state: r.state,
  postcode: r.postcode,
  preferences: { ...DEFAULT_PREFS, ...r.preferences },
  marketingOptIn: r.marketing_opt_in,
  role: r.role,
  createdAt: r.created_at.toISOString(),
  lastLoginAt: r.last_login_at?.toISOString() ?? null,
})
const isUniqueViolation = (err: unknown) => (err as { code?: string }).code === '23505'

export function pgStore(pool: pg.Pool): UserStore {
  const one = async (sql: string, params: unknown[]) => (await pool.query<UserRow>(sql, params)).rows[0]
  const bookingById = async (id: string, today: string, userId?: string) => {
    const r = (
      await pool.query<BookingRow>(`SELECT ${BCOLS} ${BFROM} WHERE b.id = $1 ${userId ? 'AND b.user_id = $2' : ''}`, userId ? [id, userId] : [id])
    ).rows[0]
    return r && toBookingView(r, today)
  }
  return {
    findByEmail: async (email) => {
      const r = await one(`SELECT ${COLS} FROM users WHERE email = $1`, [email.toLowerCase()])
      return r && toUser(r)
    },
    findByGoogleSub: async (sub) => {
      const r = await one(`SELECT ${COLS} FROM users WHERE google_sub = $1`, [sub])
      return r && toUser(r)
    },
    create: async (u) => {
      const res = await pool.query(
        `INSERT INTO users (id, name, email, phone, password_hash) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING RETURNING id`,
        [u.id, u.name, u.email.toLowerCase(), u.phone, u.passwordHash],
      )
      return res.rowCount === 1
    },
    createWithGoogle: async (u) => {
      try {
        const res = await pool.query<UserRow>(
          `INSERT INTO users (id, name, email, phone, role, status, google_sub)
           VALUES ($1, $2, $3, $4, 'guest', 'active', $5)
           ON CONFLICT (email) DO NOTHING
           RETURNING ${COLS}`,
          [u.id, u.name, u.email.toLowerCase(), u.phone ?? null, u.googleSub],
        )
        const row = res.rows[0]
        return row ? toUser(row) : null
      } catch (err) {
        if (isUniqueViolation(err)) return null
        throw err
      }
    },
    linkGoogleSub: async (userId, sub) => {
      try {
        const res = await pool.query(
          `UPDATE users SET google_sub = $2, updated_at = now()
           WHERE id = $1 AND (google_sub IS NULL OR google_sub = $2)`,
          [userId, sub],
        )
        return res.rowCount === 1
      } catch (err) {
        if (isUniqueViolation(err)) return false
        throw err
      }
    },
    recordLogin: async (id) => {
      await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id])
    },
    list: async (q) => {
      const where: string[] = []
      const params: unknown[] = []
      if (q.role) where.push(`role = $${params.push(q.role)}`)
      if (q.status) where.push(`status = $${params.push(q.status)}`)
      // ponytail: sequential scan; add a pg_trgm index when the user table outgrows it.
      if (q.q) {
        const p = `$${params.push(escapeLike(q.q))}`
        where.push(`(name ILIKE '%' || ${p} || '%' OR email ILIKE '%' || ${p} || '%' OR phone ILIKE '%' || ${p} || '%')`)
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const total = Number((await pool.query<{ n: string }>(`SELECT count(*) AS n FROM users ${clause}`, params)).rows[0]!.n)
      const limit = `$${params.push(q.pageSize)}`
      const offset = `$${params.push((q.page - 1) * q.pageSize)}`
      const rows = await pool.query<UserRow>(
        `SELECT ${COLS} FROM users ${clause} ORDER BY ${SORT_COLUMNS[q.sort]} ${ORDER[q.order]} NULLS LAST, id LIMIT ${limit} OFFSET ${offset}`,
        params,
      )
      return { items: rows.rows.map((r) => strip(toUser(r))), total }
    },
    get: async (id) => {
      const r = await one(`SELECT ${COLS} FROM users WHERE id = $1`, [id])
      return r && strip(toUser(r))
    },
    stats: async (today = todayIST()) => {
      const [agg, days, bk] = await Promise.all([
        pool.query<Record<string, string>>(`SELECT
          count(*) AS users,
          count(*) FILTER (WHERE status = 'active') AS active,
          count(*) FILTER (WHERE status = 'disabled') AS disabled,
          count(*) FILTER (WHERE role = 'guest') AS guests,
          count(*) FILTER (WHERE role = 'staff') AS staff,
          count(*) FILTER (WHERE role = 'admin') AS admins,
          count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS s7,
          count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS s30,
          count(*) FILTER (WHERE last_login_at >= now() - interval '30 days') AS active30,
          count(last_login_at) AS ever,
          count(external_hms_id) AS hms,
          count(external_pos_id) AS pos
          FROM users`),
        pool.query<{ date: string; count: string }>(`SELECT to_char(d, 'YYYY-MM-DD') AS date, count(u.id) AS count
          FROM generate_series((now() AT TIME ZONE 'UTC')::date - 29, (now() AT TIME ZONE 'UTC')::date, interval '1 day') AS d
          LEFT JOIN users u ON (u.created_at AT TIME ZONE 'UTC')::date = d::date
          GROUP BY d ORDER BY d`),
        pool.query<Record<string, string>>(
          `SELECT count(*) AS total,
          count(*) FILTER (WHERE status = 'pending') AS pending,
          count(*) FILTER (WHERE status = 'confirmed') AS confirmed,
          count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
          count(*) FILTER (WHERE status = 'completed') AS completed,
          count(*) FILTER (WHERE status IN ('pending','confirmed') AND check_out >= $1::date) AS upcoming,
          count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS c7,
          count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS c30,
          count(DISTINCT user_id) AS booked
          FROM bookings`,
          [today],
        ),
      ])
      const b = Object.fromEntries(Object.entries(bk.rows[0]!).map(([k, v]) => [k, Number(v)])) as Record<string, number>
      const a = Object.fromEntries(Object.entries(agg.rows[0]!).map(([k, v]) => [k, Number(v)])) as Record<string, number>
      return {
        totals: { users: a.users!, active: a.active!, disabled: a.disabled!, guests: a.guests!, staff: a.staff!, admins: a.admins! },
        signups: { last7Days: a.s7!, last30Days: a.s30! },
        activeLast30Days: a.active30!,
        lifecycle: { registered: a.users!, everLoggedIn: a.ever!, everBooked: b.booked!, linkedHms: a.hms!, linkedPos: a.pos! },
        bookings: {
          total: b.total!,
          byStatus: { pending: b.pending!, confirmed: b.confirmed!, cancelled: b.cancelled!, completed: b.completed! },
          upcoming: b.upcoming!,
          createdLast7Days: b.c7!,
          createdLast30Days: b.c30!,
        },
        signupsByDay: days.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
      }
    },
    update: async (id, patch) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Serializes admin changes so two admins cannot demote each other into a zero-admin state.
        await client.query("SELECT pg_advisory_xact_lock(hashtext('hdh-admin-guard'))")
        const cur = (await client.query<UserRow>(`SELECT ${COLS} FROM users WHERE id = $1 FOR UPDATE`, [id])).rows[0]
        if (!cur) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'not_found' }
        }
        const removesAdmin =
          cur.role === 'admin' && cur.status === 'active' && ((patch.role && patch.role !== 'admin') || patch.status === 'disabled')
        if (removesAdmin) {
          const others = await client.query(
            "SELECT 1 FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1 LIMIT 1",
            [id],
          )
          if (others.rowCount === 0) {
            await client.query('ROLLBACK')
            return { ok: false, reason: 'last_admin' }
          }
        }
        const row = (
          await client.query<UserRow>(
            `UPDATE users SET role = COALESCE($2, role), status = COALESCE($3, status), updated_at = now()
             WHERE id = $1 RETURNING ${COLS}`,
            [id, patch.role ?? null, patch.status ?? null],
          )
        ).rows[0]!
        if (patch.status === 'disabled') await client.query('DELETE FROM sessions WHERE user_id = $1', [id])
        await client.query('COMMIT')
        return { ok: true, user: strip(toUser(row)) }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    createSession: async (userId, tokenHash, expiresAt) => {
      await pool.query('DELETE FROM sessions WHERE expires_at < now()')
      await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt])
    },
    findSession: async (tokenHash) => {
      const r = (
        await pool.query<{ id: string; name: string; email: string; role: Role }>(
          `SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
          [tokenHash],
        )
      ).rows[0]
      return r
    },
    deleteSession: async (tokenHash) => {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
    },
    findById: async (id) => {
      const r = await one(`SELECT ${COLS} FROM users WHERE id = $1`, [id])
      return r && toUser(r)
    },
    getProfile: async (id) => {
      const r = (await pool.query<ProfileRow>(`SELECT ${PROFILE_COLS} FROM users WHERE id = $1`, [id])).rows[0]
      return r && toProfile(r)
    },
    updateProfile: async (id, patch) => {
      const params: unknown[] = [id]
      const sets: string[] = []
      for (const [key, col] of Object.entries(PROFILE_TEXT_KEYS)) {
        const v = patch[key as keyof typeof PROFILE_TEXT_KEYS]
        if (v !== undefined) sets.push(`${col} = $${params.push(v)}`)
      }
      if (patch.preferences) sets.push(`preferences = $${params.push(JSON.stringify(patch.preferences))}::jsonb`)
      if (patch.marketingOptIn !== undefined) {
        const p = `$${params.push(patch.marketingOptIn)}::boolean`
        // Timestamp only moves on a false -> true change; turning it off clears it.
        sets.push(
          `marketing_opt_in = ${p}`,
          `marketing_opt_in_at = CASE WHEN ${p} THEN (CASE WHEN marketing_opt_in THEN marketing_opt_in_at ELSE now() END) ELSE NULL END`,
        )
      }
      const res = await pool.query<ProfileRow>(
        `UPDATE users SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1 RETURNING ${PROFILE_COLS}`,
        params,
      )
      return res.rows[0] && toProfile(res.rows[0])
    },
    changePassword: async (id, hash, keep) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [id, hash])
        await client.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [id, keep])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    deleteAccount: async (id, today = todayIST()) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const u = (await client.query<{ role: Role }>('SELECT role FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!u || u.role !== 'guest') {
          await client.query('ROLLBACK')
          return { ok: false, reason: u ? 'not_allowed_for_role' : 'not_found' }
        }
        const count = Number(
          (
            await client.query<{ n: string }>(
              "SELECT count(*) AS n FROM bookings WHERE user_id = $1 AND status IN ('pending','confirmed') AND check_out >= $2::date",
              [id, today],
            )
          ).rows[0]!.n,
        )
        if (count) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'upcoming_bookings', count }
        }
        // Remaining bookings are anonymised by the FK (ON DELETE SET NULL); free text is wiped first.
        await client.query('UPDATE bookings SET special_requests = NULL, updated_at = now() WHERE user_id = $1', [id])
        await client.query('DELETE FROM users WHERE id = $1', [id])
        await client.query('COMMIT')
        return { ok: true }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    createBooking: async (userId, input, today = todayIST()) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT pg_advisory_xact_lock(hashtext('hdh-book:' || $1::text))", [userId])
        if (input.requestId) {
          const dup = (await client.query<{ id: string }>('SELECT id FROM bookings WHERE user_id = $1 AND client_request_id = $2', [userId, input.requestId]))
            .rows[0]
          if (dup) {
            await client.query('COMMIT')
            return { ok: true, booking: (await bookingById(dup.id, today, userId))!, created: false }
          }
        }
        const active = Number(
          (
            await client.query<{ n: string }>(
              "SELECT count(*) AS n FROM bookings WHERE user_id = $1 AND status IN ('pending','confirmed') AND check_out >= $2::date",
              [userId, today],
            )
          ).rows[0]!.n,
        )
        if (active >= MAX_ACTIVE_BOOKINGS) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'booking_limit' }
        }
        const q = quote(input.roomId, input.checkIn, input.checkOut, input.rooms)
        let id: string | undefined
        for (let i = 0; i < 5 && !id; i++) {
          id = (
            await client.query<{ id: string }>(
              `INSERT INTO bookings (reference, user_id, client_request_id, room_id, room_name, room_count, check_in, check_out, nights,
                 adults, children, extra_bed, special_requests, rate_per_night, total_amount)
               VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12, $13, $14, $15)
               ON CONFLICT (reference) DO NOTHING RETURNING id`,
              [newReference(), userId, input.requestId ?? null, input.roomId, q.roomName, input.rooms, input.checkIn, input.checkOut,
                q.nights, input.adults, input.children, input.extraBed, input.specialRequests, q.ratePerNight, q.totalAmount],
            )
          ).rows[0]?.id
        }
        if (!id) throw new Error('could not allocate a unique booking reference')
        await client.query('COMMIT')
        return { ok: true, booking: (await bookingById(id, today, userId))!, created: true }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        if ((err as { code?: string }).code === '23503') return { ok: false, reason: 'user_missing' }
        throw err
      } finally {
        client.release()
      }
    },
    listBookings: async (userId, q, today = todayIST()) => {
      const c = (
        await pool.query<Record<string, string>>(
          `SELECT count(*) AS "all",
            count(*) FILTER (WHERE status IN ('pending','confirmed') AND check_out >= $2::date) AS upcoming,
            count(*) FILTER (WHERE status <> 'cancelled' AND check_out < $2::date) AS past,
            count(*) FILTER (WHERE status = 'cancelled') AS cancelled
           FROM bookings WHERE user_id = $1`,
          [userId, today],
        )
      ).rows[0]!
      const counts = { all: Number(c.all), upcoming: Number(c.upcoming), past: Number(c.past), cancelled: Number(c.cancelled) }
      const [where, order] = {
        all: ['$2::date IS NOT NULL', 'b.created_at DESC, b.id'], // every filter references $2 so the param types always resolve
        upcoming: ["b.status IN ('pending','confirmed') AND b.check_out >= $2::date", 'b.check_in ASC, b.id'],
        past: ["b.status <> 'cancelled' AND b.check_out < $2::date", 'b.check_in DESC, b.id'],
        cancelled: ["b.status = 'cancelled' AND $2::date IS NOT NULL", 'b.check_in DESC, b.id'],
      }[q.filter]
      const rows = await pool.query<BookingRow>(
        `SELECT ${BCOLS} ${BFROM} WHERE b.user_id = $1 AND ${where} ORDER BY ${order} LIMIT $3 OFFSET $4`,
        [userId, today, q.pageSize, (q.page - 1) * q.pageSize],
      )
      return { items: rows.rows.map((r) => toBookingView(r, today)), total: counts[q.filter], counts }
    },
    getBooking: (userId, id, today = todayIST()) => bookingById(id, today, userId),
    cancelBooking: async (userId, id, today = todayIST()) => {
      const upd = await pool.query(
        `UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now()
         WHERE id = $1 AND user_id = $2 AND status IN ('pending','confirmed') AND check_in >= $3::date RETURNING id`,
        [id, userId, today],
      )
      const booking = await bookingById(id, today, userId)
      if (!booking) return { ok: false, reason: 'not_found' }
      if (upd.rowCount === 1) return { ok: true, booking, changed: true }
      return booking.status === 'cancelled' ? { ok: true, booking, changed: false } : { ok: false, reason: 'not_cancellable' }
    },
    listAdminBookings: async (q, today = todayIST()) => {
      const where: string[] = []
      const params: unknown[] = []
      if (q.status) where.push(`b.status = $${params.push(q.status)}`)
      if (q.paymentStatus) where.push(`b.payment_status = $${params.push(q.paymentStatus)}`)
      if (q.from) where.push(`b.check_in >= $${params.push(q.from)}::date`)
      if (q.to) where.push(`b.check_in <= $${params.push(q.to)}::date`)
      if (q.view && q.day) {
        const d = `$${params.push(q.day)}::date`
        if (q.view === 'arrivals') where.push(`b.check_in = ${d} AND b.status IN ('pending','confirmed')`)
        else if (q.view === 'departures') where.push(`b.check_out = ${d} AND b.status = 'confirmed'`)
        else where.push(`b.check_in <= ${d} AND b.check_out > ${d} AND b.status = 'confirmed'`)
      }
      if (q.q) {
        const p = `$${params.push(escapeLike(q.q))}`
        where.push(
          `(b.reference ILIKE '%' || ${p} || '%' OR u.name ILIKE '%' || ${p} || '%' OR u.email ILIKE '%' || ${p} || '%' OR u.phone ILIKE '%' || ${p} || '%')`,
        )
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const total = Number((await pool.query<{ n: string }>(`SELECT count(*) AS n ${BFROM} ${clause}`, params)).rows[0]!.n)
      const limit = `$${params.push(q.pageSize)}`
      const offset = `$${params.push((q.page - 1) * q.pageSize)}`
      const rows = await pool.query<BookingRow>(
        `SELECT ${BCOLS} ${BFROM} ${clause} ORDER BY ${BOOKING_SORT[q.sort]} ${ORDER[q.order]}, b.id LIMIT ${limit} OFFSET ${offset}`,
        params,
      )
      return { items: rows.rows.map((r) => toBookingView(r, today)), total }
    },
    addActivity: async (e) => {
      await pool.query('INSERT INTO activity_log (actor_id, actor_name, action, target, detail) VALUES ($1, $2, $3, $4, $5)', [e.actorId, e.actorName, e.action, e.target, e.detail])
    },
    listActivity: async (q) => {
      const total = Number((await pool.query<{ n: string }>('SELECT count(*) AS n FROM activity_log')).rows[0]!.n)
      const rows = await pool.query<{ id: string; at: Date; actor_id: string | null; actor_name: string; action: string; target: string; detail: string }>(
        'SELECT id, at, actor_id, actor_name, action, target, detail FROM activity_log ORDER BY at DESC, id LIMIT $1 OFFSET $2',
        [q.pageSize, (q.page - 1) * q.pageSize],
      )
      return {
        items: rows.rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actorId: r.actor_id, actorName: r.actor_name, action: r.action, target: r.target, detail: r.detail })),
        total,
      }
    },
    getRoomRates: async () => Object.fromEntries((await pool.query<{ room_id: string; rate: number }>('SELECT room_id, rate FROM room_rates')).rows.map((r) => [r.room_id, r.rate])),
    setRoomRate: async (roomId, rate) => {
      await pool.query('INSERT INTO room_rates (room_id, rate) VALUES ($1, $2) ON CONFLICT (room_id) DO UPDATE SET rate = EXCLUDED.rate, updated_at = now()', [roomId, rate])
    },
    getAdminBooking: (id, today = todayIST()) => bookingById(id, today),
    updateAdminBooking: async (id, patch, today = todayIST()) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const cur = (await client.query<{ status: BookingStatus }>('SELECT status FROM bookings WHERE id = $1 FOR UPDATE', [id])).rows[0]
        if (!cur) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'not_found' }
        }
        if (patch.status && !canTransition(cur.status, patch.status)) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'invalid_transition' }
        }
        const params: unknown[] = [id]
        const sets: string[] = []
        if (patch.status && patch.status !== cur.status) {
          sets.push(`status = $${params.push(patch.status)}`)
          if (patch.status === 'cancelled') sets.push('cancelled_at = now()')
        }
        if (patch.paymentStatus) sets.push(`payment_status = $${params.push(patch.paymentStatus)}`)
        if (patch.externalHmsBookingId !== undefined) sets.push(`external_hms_booking_id = $${params.push(patch.externalHmsBookingId)}`)
        if (patch.externalPosFolioId !== undefined) sets.push(`external_pos_folio_id = $${params.push(patch.externalPosFolioId)}`)
        await client.query(`UPDATE bookings SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1`, params)
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        if (isUniqueViolation(err)) return { ok: false, reason: 'external_id_taken' }
        throw err
      } finally {
        client.release()
      }
      return { ok: true, booking: (await bookingById(id, today))! }
    },
    close: () => pool.end(),
  }
}
