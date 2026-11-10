import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { registerAccount } from './routes/account.ts'
import { registerAdmin } from './routes/admin.ts'
import { applyRoomRates } from './domain/bookings.ts'
import { registerAdminBookings } from './routes/admin-bookings.ts'
import type { BookingSyncHooks } from './integrations/types.ts'
import type { IntegrationEndpoint } from './integrations/config.ts'
import { hmsStaffFromGateway } from './integrations/hms.ts'
import { hashPassword, verifyPassword } from './core/password.ts'
import { registerQrHub } from './routes/qr-hub.ts'
import type { QrStore } from './stores/qr-store.ts'
import { loginSchema, signupSchema } from './domain/schemas.ts'
import { clearCookie, hashToken, newToken, readCookie, sessionCookie, sessionExpiry } from './core/session.ts'
import type { SessionUser, UserStore } from './stores/store.ts'

export interface AppOptions {
  store: UserStore
  allowedOrigin: string
  trustProxy?: boolean
  logger?: boolean
  /** Signup requests per IP, and failed logins per IP and per email, allowed per window. */
  rateLimit?: { max: number; windowMs: number }
  /** Clock for "today" (Asia/Kolkata) in booking rules; tests inject it. */
  now?: () => Date
  /** Optional HMS / POS hooks, see src/integrations/types.ts. */
  bookingSync?: BookingSyncHooks
  /** QR Hub store; the /qr-hub/* and /r/:slug routes are registered only when given. */
  qr?: QrStore
  /** Public site origin that /r/:slug redirects to; defaults to allowedOrigin. */
  siteUrl?: string
  /** Per-IP budget for the public QR Hub endpoints. */
  publicRateLimit?: { max: number; windowMs: number }
  /** HMS integration endpoint: enables HMS staff bearer tokens on staff routes and locks website rate edits. */
  hms?: IntegrationEndpoint
}

// Verified against when the email is unknown, so login time does not reveal which emails exist.
const dummyHash = hashPassword('not-a-real-password')

export function buildApp({
  store,
  allowedOrigin,
  trustProxy = false,
  logger = false,
  rateLimit = { max: 10, windowMs: 15 * 60_000 },
  now = () => new Date(),
  bookingSync,
  qr,
  siteUrl,
  publicRateLimit,
  hms,
}: AppOptions): FastifyInstance {
  if (!allowedOrigin || allowedOrigin === '*') throw new Error('ALLOWED_ORIGIN must be a single explicit origin')

  const app = Fastify({ logger, trustProxy, bodyLimit: 10 * 1024 })

  // CORS: exactly one origin, never "*". Other origins get no CORS headers and the browser blocks them.
  app.addHook('onRequest', async (req, reply) => {
    if (req.headers.origin === allowedOrigin) {
      reply.header('Access-Control-Allow-Origin', allowedOrigin)
      reply.header('Access-Control-Allow-Credentials', 'true')
      reply.header('Vary', 'Origin')
      if (req.method === 'OPTIONS') {
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        reply.header('Access-Control-Max-Age', '600')
        return reply.code(204).send()
      }
    }
  })

  // Standard Security Headers
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';")
    return payload
  })

  // ponytail: per-process counters, reset on restart, keyed on req.ip. Behind a reverse proxy TRUST_PROXY=1 is
  // mandatory (otherwise every client shares the proxy's IP). Upgrade to a shared store (Redis) for >1 instance.
  const counters = new Map<string, { count: number; resetAt: number }>()
  // Counts one hit; returns seconds to wait when over the limit, else 0.
  const hit = (key: string) => {
    const nowMs = Date.now()
    for (const [k, c] of counters) if (c.resetAt <= nowMs) counters.delete(k)
    const c = counters.get(key) ?? { count: 0, resetAt: nowMs + rateLimit.windowMs }
    c.count += 1
    counters.set(key, c)
    return c.count > rateLimit.max ? Math.ceil((c.resetAt - nowMs) / 1000) : 0
  }
  const refund = (key: string) => {
    const c = counters.get(key)
    if (c && c.count > 0) c.count -= 1
  }
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'POST' || !req.url.startsWith('/auth/')) return
    // Without TRUST_PROXY, req.ip is the socket peer; a forwarded header means we sit behind a proxy and
    // every client would share one rate-limit bucket. Never trust the spoofable header: refuse instead.
    if (!trustProxy && req.headers['x-forwarded-for'] !== undefined) {
      req.log.warn('X-Forwarded-For received while TRUST_PROXY is unset; request rejected')
      return reply.code(400).send({ error: 'untrusted_proxy_header' })
    }
    // Signup: every request counts, per IP. Login is throttled in the handler, on failures only.
    if (req.url.startsWith('/auth/signup')) {
      const wait = hit(`signup:${req.ip}`)
      if (wait) {
        reply.header('Retry-After', wait)
        return reply.code(429).send({ error: 'rate_limited' })
      }
    }
  })
  // Malformed JSON, oversized bodies etc. become invalid_request; anything else never leaks internals.
  app.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500
    if (status >= 400 && status < 500) return reply.code(status).send({ error: 'invalid_request' })
    req.log.error(err)
    return reply.code(500).send({ error: 'internal_error' })
  })
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Cache-Control', 'no-store')
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  })

  const secure = allowedOrigin.startsWith('https://')
  const currentSession = async (req: FastifyRequest): Promise<SessionUser | undefined> => {
    const token = readCookie(req.headers.cookie)
    return token ? store.findSession(hashToken(token)) : undefined
  }
  // CSRF: cookie-authenticated unsafe requests must come from the allowed origin.
  const originOk = (req: FastifyRequest) => req.headers.origin === allowedOrigin
  const userGuard = async (req: FastifyRequest, reply: FastifyReply, unsafe: boolean) => {
    const user = await currentSession(req)
    if (!user) return void reply.code(401).send({ error: 'unauthenticated' })
    if (unsafe && !originOk(req)) return void reply.code(403).send({ error: 'forbidden_origin' })
    return user
  }
  // Admin routes accept a website admin cookie, or HMS staff forwarded by the HMS gateway (the console at /app hosts the admin screens).
  // Gateway requests carry a server-side key, not a cookie, so the Origin (CSRF) check only applies to cookie sessions.
  const adminGuard = async (req: FastifyRequest, reply: FastifyReply, unsafe: boolean) => {
    const cookieUser = await currentSession(req)
    const user = cookieUser ?? hmsStaffFromGateway(hms, req)
    if (!user) return void reply.code(401).send({ error: 'unauthenticated' })
    if (user.role !== 'admin') return void reply.code(403).send({ error: 'forbidden' })
    if (unsafe && cookieUser && !originOk(req)) return void reply.code(403).send({ error: 'forbidden_origin' })
    return user
  }
  // Front-desk staff may work with bookings (and see the day's numbers); everything else stays admin only.
  // HMS staff come through the HMS gateway (see integrations/hms.ts).
  const staffGuard = async (req: FastifyRequest, reply: FastifyReply, unsafe: boolean) => {
    const cookieUser = await currentSession(req)
    const user = cookieUser ?? hmsStaffFromGateway(hms, req)
    if (!user) return void reply.code(401).send({ error: 'unauthenticated' })
    if (user.role !== 'admin' && user.role !== 'staff') return void reply.code(403).send({ error: 'forbidden' })
    if (unsafe && cookieUser && !originOk(req)) return void reply.code(403).send({ error: 'forbidden_origin' })
    return user
  }
  // Admin-edited room rates apply from start-up.
  app.addHook('onReady', async () => applyRoomRates(await store.getRoomRates()))
  registerAdmin(app, store, adminGuard, now, staffGuard, Boolean(hms))
  registerAdminBookings(app, store, staffGuard, { now, bookingSync, hms })
  if (qr) registerQrHub(app, qr, { guard: adminGuard, now, siteUrl: (siteUrl ?? allowedOrigin).replace(/\/+$/, ''), publicRateLimit })
  registerAccount(app, store, { guard: userGuard, limiter: { hit, refund }, now, secure, bookingSync })
  app.get('/auth/me', async (req, reply) => {
    const user = await currentSession(req)
    return user ? { user } : reply.code(401).send({ error: 'unauthenticated' })
  })
  app.post('/auth/logout', async (req, reply) => {
    if (!originOk(req)) return reply.code(403).send({ error: 'forbidden_origin' })
    const token = readCookie(req.headers.cookie)
    if (token) await store.deleteSession(hashToken(token))
    reply.header('Set-Cookie', clearCookie(secure))
    return reply.code(204).send()
  })
  app.get('/health', async () => ({ status: 'ok' }))

  app.post('/auth/signup', async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const { name, email, phone, password } = parsed.data
    const created = await store.create({
      id: randomUUID(),
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: await hashPassword(password),
    })
    return created ? reply.code(201).send({ ok: true }) : reply.code(409).send({ error: 'email_taken' })
  })

  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' })
    const email = parsed.data.email.toLowerCase()
    // Reserve a slot per IP and per email up front (so concurrent guesses cannot slip past), and refund it on
    // success: only failed attempts consume the budget.
    const keys = [`login-ip:${req.ip}`, `login-email:${email}`]
    const waits = keys.map(hit)
    if (waits.some(Boolean)) {
      reply.header('Retry-After', Math.max(...waits))
      return reply.code(429).send({ error: 'rate_limited' })
    }
    const user = await store.findByEmail(email)
    const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash))
    if (!user || !ok) return reply.code(401).send({ error: 'invalid_credentials' })
    keys.forEach(refund)
    // Only after the password verified, so a disabled account is not revealed to guessers.
    if (user.status === 'disabled') return reply.code(403).send({ error: 'account_disabled' })
    const remember = parsed.data.remember === true
    const token = newToken()
    await store.createSession(user.id, hashToken(token), sessionExpiry(remember))
    await store.recordLogin(user.id)
    reply.header('Set-Cookie', sessionCookie(token, { remember, secure }))
    return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
  })

  return app
}
