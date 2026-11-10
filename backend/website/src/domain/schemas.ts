import { z } from 'zod'
import { ROOMS, ROOM_IDS, addDays, daysBetween, isValidDate } from './bookings.ts'
// Mirrors the request bodies sent by frontend/src/features/auth/authService.ts.
export const emailField = z.string().trim().max(254).pipe(z.email())
export const passwordField = z.string().min(8).max(200)
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(200),
  remember: z.boolean().optional(),
})
export const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailField,
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  password: passwordField,
  consent: z.literal(true),
})


const roles = z.enum(['guest', 'staff', 'admin'])
const statuses = z.enum(['active', 'disabled'])
// Query strings are coerced; unknown keys are ignored; repeated keys arrive as arrays and fail.
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z
    .string()
    .trim()
    .max(100)
    .transform((s) => s || undefined)
    .optional(),
  role: roles.optional(),
  status: statuses.optional(),
  sort: z.enum(['createdAt', 'name', 'email', 'lastLoginAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
})
export const idParamSchema = z.object({ id: z.uuid() })
export const roleBodySchema = z.strictObject({ role: roles })
export const statusBodySchema = z.strictObject({ status: statuses })

// ---- Guest account + bookings --------------------------------------------------------------------------------

export const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine(isValidDate, 'Enter a valid date.')
const bookingStatus = z.enum(['pending', 'confirmed', 'cancelled', 'completed'])
const paymentStatus = z.enum(['unpaid', 'pay_at_hotel', 'paid', 'refunded'])

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  filter: z.enum(['all', 'upcoming', 'past', 'cancelled']).default('all'),
})

/** Factory so tests can inject "today" (Asia/Kolkata, YYYY-MM-DD). */
export const createBookingSchema = (today: string) =>
  z
    .strictObject({
      requestId: z.uuid().optional(),
      roomId: z.enum(ROOM_IDS),
      checkIn: isoDateField,
      checkOut: isoDateField,
      rooms: z.number().int().min(1).max(5),
      adults: z.number().int().min(1),
      children: z.number().int().min(0).max(10).default(0),
      extraBed: z.boolean().default(false),
      specialRequests: z
        .string()
        .trim()
        .max(500)
        .nullish()
        .transform((v) => v || null),
    })
    .superRefine((b, ctx) => {
      const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (b.checkIn < today) bad('checkIn', 'Check-in cannot be in the past.')
      else if (b.checkIn > addDays(today, 365)) bad('checkIn', 'Choose a date within the next year.')
      if (b.checkOut <= b.checkIn) bad('checkOut', 'Check-out must be at least 1 night after check-in.')
      else if (daysBetween(b.checkIn, b.checkOut) > 30) bad('checkOut', 'Stays are limited to 30 nights.')
      if (b.adults < b.rooms) bad('adults', 'Each room needs at least 1 adult.')
      else if (b.adults > b.rooms * ROOMS[b.roomId].maxAdults) bad('adults', `Each room sleeps up to ${ROOMS[b.roomId].maxAdults} adults.`)
    })

// "" and null clear an optional text field (stored as NULL); otherwise the trimmed value must fit the limits.
const clearable = (min: number, max: number, pattern?: RegExp) => {
  const text = pattern ? z.string().min(min).max(max).regex(pattern) : z.string().min(min).max(max)
  return z
    .string()
    .trim()
    .nullable()
    .transform((v) => v || null)
    .pipe(text.nullable())
    .optional()
}
export const profilePatchSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
    country: clearable(2, 80),
    addressLine1: clearable(0, 120),
    addressLine2: clearable(0, 120),
    city: clearable(0, 80),
    state: clearable(0, 80),
    postcode: clearable(3, 12, /^[A-Za-z0-9 -]+$/),
    preferences: z
      .strictObject({
        bed: z.enum(['no_preference', 'king', 'twin', 'extra_bed']),
        dietary: z.enum(['no_preference', 'vegetarian', 'vegan', 'jain', 'other']),
        notes: z.string().max(500),
      })
      .optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })

export const passwordBodySchema = z
  .strictObject({ currentPassword: z.string().min(1).max(200), newPassword: passwordField })
  .superRefine((b, ctx) => {
    if (b.newPassword === b.currentPassword) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Choose a different password.' })
  })
export const deleteBodySchema = z.strictObject({ password: z.string().min(1).max(200) })

export const adminBookingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z
      .string()
      .trim()
      .max(100)
      .transform((s) => s || undefined)
      .optional(),
    status: bookingStatus.optional(),
    paymentStatus: paymentStatus.optional(),
    from: isoDateField.optional(),
    to: isoDateField.optional(),
    /** Front-desk views for the date `day`: guests arriving, leaving, or staying over (active bookings only). */
    view: z.enum(['arrivals', 'departures', 'inhouse']).optional(),
    day: isoDateField.optional(),
    sort: z.enum(['createdAt', 'checkIn', 'totalAmount']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((q, ctx) => {
    if (q.view && !q.day) ctx.addIssue({ code: 'custom', path: ['day'], message: '"day" is required with "view".' })
    if (q.from && q.to && q.from > q.to) ctx.addIssue({ code: 'custom', path: ['from'], message: '"from" must not be after "to".' })
  })
const externalId = z.string().trim().min(1).max(100).nullable()
export const adminBookingPatchSchema = z
  .strictObject({
    status: bookingStatus.optional(),
    paymentStatus: paymentStatus.optional(),
    externalHmsBookingId: externalId.optional(),
    externalPosFolioId: externalId.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })
// ---- QR Hub --------------------------------------------------------------------------------------------------
export const QR_CATEGORIES = ['Hotel', 'Restaurant / Dining', 'Banquet / Weddings', 'Rooms', 'Events', 'Other'] as const
export const slugField = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens.')
export const codeField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens.')
/** Absolute URL restricted to the given schemes (never javascript:, data:, file: ...). */
const urlWith = (schemes: string[], max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => {
      try {
        const u = new URL(v)
        if (!schemes.includes(u.protocol)) return false
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname !== '' : v.length > u.protocol.length
      } catch {
        return false
      }
    }, `Use a URL starting with ${schemes.map((s) => s.replace(':', '')).join(', ')}.`)
export const destinationUrl = urlWith(['http:', 'https:', 'tel:', 'mailto:'])
const httpUrl = urlWith(['http:', 'https:'])
const httpsUrl = urlWith(['https:'])
// "" and null clear an optional text field (stored as NULL).
const optText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .transform((v) => v || null)
    .optional()
const optUrl = (u: z.ZodType<string>) =>
  z
    .union([z.literal(''), z.null(), u])
    .transform((v) => v || null)
    .optional()
const imageRef = z
  .union([
    z.literal(''),
    z.null(),
    z
      .string()
      .trim()
      .max(2000)
      .refine((v) => (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\//.test(v), 'Use a /path or an https URL.'),
  ])
  .transform((v) => v || null)
  .optional()
/** ISO timestamp; a value without a zone is read as Asia/Kolkata. */
const when = z
  .union([z.iso.datetime({ offset: true, local: true }), z.null()])
  .transform((v) => (v && !/(Z|[+-]\d\d:\d\d)$/.test(v) ? `${v.length === 16 ? `${v}:00` : v}+05:30` : v))
  .optional()
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.')
const hours = z.union([z.strictObject({ open: hhmm, close: hhmm }), z.null()]).optional()
const orderedDates = (o: { show_from?: string | null; show_until?: string | null; starts_at?: string | null; ends_at?: string | null }, ctx: z.RefinementCtx) => {
  const a = o.show_from ?? o.starts_at
  const b = o.show_until ?? o.ends_at
  if (a && b && Date.parse(b) <= Date.parse(a)) ctx.addIssue({ code: 'custom', path: [o.show_until !== undefined ? 'show_until' : 'ends_at'], message: 'End must be after start.' })
}
const linkShape = {
  title: z.string().trim().min(1).max(100),
  title_hi: optText(100),
  destination_url: destinationUrl,
  category: z.string().trim().min(1).max(40),
  icon: optText(40),
  description: optText(300),
  description_hi: optText(300),
  is_featured: z.boolean(),
  status: z.enum(['active', 'disabled']),
  show_from: when,
  show_until: when,
  hours,
}
const { title: _t, destination_url: _d, ...linkOptional } = linkShape
export const linkInputSchema = z.strictObject({ title: linkShape.title, destination_url: linkShape.destination_url, ...partialShape(linkOptional) }).superRefine(orderedDates)
export const linkPatchSchema = z
  .strictObject(partialShape(linkShape))
  .superRefine(orderedDates)
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })
export function partialShape<T extends z.ZodRawShape>(shape: T): { [K in keyof T]: z.ZodOptional<T[K]> } {
  return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, (v as z.ZodType).optional()])) as never
}
const wifiPassword = z.union([z.string().max(128), z.null()]).transform((v) => v || null).optional()
export const orgShape = {
  name: z.string().trim().min(1).max(120),
  category: z.enum(QR_CATEGORIES),
  description: optText(1000),
  description_hi: optText(1000),
  phone: optText(40),
  whatsapp: optText(40),
  email: optText(254),
  address: optText(300),
  maps_url: optUrl(httpUrl),
  website_url: optUrl(httpUrl),
  review_url: optUrl(httpsUrl),
  profile_image: imageRef,
  logo: imageRef,
  theme: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).refine((t) => Object.keys(t).length <= 30, 'Too many theme keys.'),
  wifi_ssid: optText(64),
  wifi_password: wifiPassword,
  wifi_visible: z.boolean(),
  qr_status: z.enum(['active', 'inactive', 'draft']),
  status: z.enum(['published', 'unpublished', 'archived']),
}
export const orgCreateSchema = z.strictObject({
  ...partialShape(orgShape),
  name: orgShape.name,
  slug: slugField.optional(),
  links: z.array(linkInputSchema).max(100).optional(),
})
export const orgPatchSchema = z
  .strictObject(partialShape(orgShape))
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })
export const qrStatusBodySchema = z.strictObject({ qr_status: z.enum(['active', 'inactive', 'draft']) })
export const slugParamSchema = z.object({ slug: slugField })
export const orgListQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .transform((s) => s || undefined)
    .optional(),
  category: z.enum(QR_CATEGORIES).optional(),
  status: z.enum(['published', 'unpublished', 'archived']).optional(),
})
export const linkOrderSchema = z.strictObject({ ids: z.array(z.uuid()).max(500) })
export const placementShape = {
  code: codeField,
  label: z.string().trim().min(1).max(80),
  kind: z.enum(['room', 'table', 'lobby', 'hall', 'desk', 'other']),
  status: z.enum(['active', 'disabled']),
}
export const placementInputSchema = z.strictObject({ code: placementShape.code, label: placementShape.label, kind: placementShape.kind.optional(), status: placementShape.status.optional() })
export const placementPatchSchema = z
  .strictObject({ label: placementShape.label.optional(), kind: placementShape.kind.optional(), status: placementShape.status.optional() })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })
export const placementRangeSchema = z
  .strictObject({
    kind: placementShape.kind,
    prefix: codeField,
    labelPrefix: z.string().trim().min(1).max(60),
    /** Append an unguessable suffix to every code (printed QRs cannot be enumerated). */
    random: z.boolean().optional(),
    from: z.number().int().min(0).max(99999),
    to: z.number().int().min(0).max(99999),
  })
  .superRefine((r, ctx) => {
    if (r.to < r.from) ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" must not be before "from".' })
    else if (r.to - r.from + 1 > 500) ctx.addIssue({ code: 'custom', path: ['to'], message: 'At most 500 placements at once.' })
  })
export const offerShape = {
  text: z.string().trim().min(1).max(300),
  text_hi: optText(300),
  link_url: optUrl(destinationUrl),
  starts_at: when,
  ends_at: when,
}
export const offerInputSchema = z.strictObject(offerShape).superRefine(orderedDates)
export const offerPatchSchema = z
  .strictObject(partialShape(offerShape))
  .superRefine(orderedDates)
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })
export const bulkLinksBodySchema = z.strictObject({ links: z.array(z.unknown()).min(1).max(500) })
export const bulkToOrgsBodySchema = z.strictObject({ slugs: z.array(slugField).min(1).max(200), links: z.array(z.unknown()).min(1).max(500) })
export const bulkActionSchema = z.strictObject({
  entity: z.enum(['links', 'placements', 'organizations']),
  ids: z.array(z.uuid()).min(1).max(500),
  action: z.enum(['enable', 'disable', 'delete']),
})
/** Date range in Asia/Kolkata days; defaults to the last 30 days (resolved in the route). */
export const rangeQuerySchema = z
  .object({ from: isoDateField.optional(), to: isoDateField.optional() })
  .superRefine((q, ctx) => {
    if (q.from && q.to && q.from > q.to) ctx.addIssue({ code: 'custom', path: ['from'], message: '"from" must not be after "to".' })
    if (q.from && q.to && daysBetween(q.from, q.to) > 366) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Range is limited to 366 days.' })
  })
export const csvQuerySchema = z
  .object({ type: z.enum(['visits', 'clicks']), slug: slugField.optional(), from: isoDateField.optional(), to: isoDateField.optional() })
  .superRefine((q, ctx) => {
    if (q.from && q.to && q.from > q.to) ctx.addIssue({ code: 'custom', path: ['from'], message: '"from" must not be after "to".' })
  })
export const exportJsonQuerySchema = z.object({
  slugs: z.string().max(5000).default('all'),
  includeWifi: z.enum(['0', '1']).default('0'),
})
export const importQuerySchema = z.object({
  mode: z.enum(['skip', 'update']).default('skip'),
  dryRun: z.enum(['0', '1']).default('1'),
})
export const settingsPutSchema = z
  .strictObject({
    baseUrl: httpsUrl.transform((v) => v.replace(/\/+$/, '')).optional(),
    posterCta: z.string().trim().min(1).max(80).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field', path: [] })
export const integrationsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) })
export const publicHubQuerySchema = z.object({ p: codeField.optional() })
export const publicVisitSchema = z.object({ slug: slugField })
export const publicClickSchema = z.object({
  slug: slugField,
  linkId: z.union([z.uuid(), z.literal('review')]),
  placement: codeField.optional(),
})

// ---- Admin tools: staff accounts, room rates, activity ------------------------------------------------------------
export const createUserSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: emailField,
  phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
  password: passwordField,
  role: z.enum(['guest', 'staff']).default('staff'),
})
export const guestSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) })
export const roomParamSchema = z.object({ roomId: z.enum(ROOM_IDS) })
export const roomRateBodySchema = z.strictObject({ rate: z.number().int().min(100).max(1_000_000) })
export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
})
