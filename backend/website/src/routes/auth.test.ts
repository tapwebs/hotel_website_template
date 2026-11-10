import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { buildApp } from '../app.ts'
import { hashPassword, verifyPassword } from '../core/password.ts'
import { memoryStore } from '../stores/store.ts'

const ORIGIN = 'http://localhost:5173'
const app = (max = 1000) => buildApp({ store: memoryStore(), allowedOrigin: ORIGIN, rateLimit: { max, windowMs: 60_000 } })
const signup = { name: 'Asha Rao', email: 'Asha@Example.com', phone: '+919876543210', password: 'correct horse', consent: true }
const post = (a: ReturnType<typeof app>, url: string, payload: unknown, headers: Record<string, string> = {}) =>
  a.inject({ method: 'POST', url, payload: payload as object, headers })

test('password hash round trip', async () => {
  const h = await hashPassword('secret123')
  assert.match(h, /^scrypt\$16384\$8\$1\$/)
  assert.equal(await verifyPassword('secret123', h), true)
  assert.equal(await verifyPassword('wrong', h), false)
  assert.equal(await verifyPassword('secret123', 'garbage'), false)
})

test('signup: happy path, duplicate, invalid bodies', async () => {
  const a = app()
  assert.equal((await post(a, '/auth/signup', signup)).statusCode, 201)
  assert.equal((await post(a, '/auth/signup', { ...signup, email: 'asha@example.com' })).statusCode, 409)
  for (const bad of [{ password: 'short' }, { phone: '+911234567890' }, { consent: false }, { email: 'nope' }]) {
    const res = await post(a, '/auth/signup', { ...signup, email: 'b@example.com', ...bad })
    assert.equal(res.statusCode, 400)
  }
})

test('login: happy path, wrong password and unknown email look the same', async () => {
  const a = app()
  await post(a, '/auth/signup', signup)
  const ok = await post(a, '/auth/login', { email: 'ASHA@example.com', password: 'correct horse' })
  assert.equal(ok.statusCode, 200)
  assert.match(String(ok.headers['set-cookie']), /^hdh_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax$/)
  assert.equal(ok.json().user.email, 'asha@example.com')
  assert.equal(ok.json().user.role, 'guest')
  const wrong = await post(a, '/auth/login', { email: 'asha@example.com', password: 'nope nope' })
  const unknown = await post(a, '/auth/login', { email: 'who@example.com', password: 'nope nope' })
  assert.equal(wrong.statusCode, 401)
  assert.equal(unknown.statusCode, 401)
  assert.equal(wrong.body, unknown.body)
  assert.equal((await post(a, '/auth/login', { email: 'x' })).statusCode, 400)
})

test('CORS allows only the configured origin; security headers set; health works', async () => {
  const a = app()
  const allowed = await a.inject({ method: 'OPTIONS', url: '/auth/login', headers: { origin: ORIGIN } })
  assert.equal(allowed.statusCode, 204)
  assert.equal(allowed.headers['access-control-allow-origin'], ORIGIN)
  const other = await post(a, '/auth/login', { email: 'a@b.co', password: 'x' }, { origin: 'https://evil.example' })
  assert.equal(other.headers['access-control-allow-origin'], undefined)
  const health = await a.inject({ method: 'GET', url: '/health' })
  assert.equal(health.statusCode, 200)
  assert.equal(health.headers['x-content-type-options'], 'nosniff')
  assert.throws(() => buildApp({ store: memoryStore(), allowedOrigin: '*' }))
})

test('rate limit returns 429 after the limit', async () => {
  const a = app(2)
  const body = { email: 'a@b.co', password: 'x' }
  assert.equal((await post(a, '/auth/login', body)).statusCode, 401)
  assert.equal((await post(a, '/auth/login', body)).statusCode, 401)
  const limited = await post(a, '/auth/login', body)
  assert.equal(limited.statusCode, 429)
  assert.ok(limited.headers['retry-after'])
})
test('login throttle counts failed attempts only, per email and per IP', async () => {
  const a = app(3)
  await post(a, '/auth/signup', signup)
  const good = { email: 'asha@example.com', password: 'correct horse' }
  for (let i = 0; i < 6; i++) assert.equal((await post(a, '/auth/login', good)).statusCode, 200) // successes are free
  const bad = { email: 'asha@example.com', password: 'wrong wrong' }
  for (let i = 0; i < 3; i++) assert.equal((await post(a, '/auth/login', bad)).statusCode, 401)
  assert.equal((await post(a, '/auth/login', bad)).statusCode, 429)
  assert.equal((await post(a, '/auth/login', good)).statusCode, 429) // locked for that email, even with the right password
})
test('login throttle is per email, independent of IP', async () => {
  const a = app(2)
  const bad = (email: string, remoteAddress: string) =>
    a.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'x' }, remoteAddress })
  assert.equal((await bad('one@example.com', '10.0.0.1')).statusCode, 401)
  assert.equal((await bad('one@example.com', '10.0.0.2')).statusCode, 401)
  assert.equal((await bad('one@example.com', '10.0.0.3')).statusCode, 429) // fresh IP, same email: locked
  assert.equal((await bad('two@example.com', '10.0.0.3')).statusCode, 401) // other email on that IP is fine
})
test('signup stays limited per IP', async () => {
  const a = app(1)
  assert.equal((await post(a, '/auth/signup', signup)).statusCode, 201)
  assert.equal((await post(a, '/auth/signup', { ...signup, email: 'b@example.com' })).statusCode, 429)
})
test('X-Forwarded-For is rejected unless TRUST_PROXY is set', async () => {
  const headers = { 'x-forwarded-for': '1.2.3.4' }
  const body = { email: 'a@b.co', password: 'x' }
  const rejected = await post(app(), '/auth/login', body, headers)
  assert.equal(rejected.statusCode, 400)
  assert.equal(rejected.json().error, 'untrusted_proxy_header')
  const trusted = buildApp({ store: memoryStore(), allowedOrigin: ORIGIN, trustProxy: true })
  assert.equal((await post(trusted, '/auth/login', body, headers)).statusCode, 401)
})
test('email longer than 254 characters is rejected', async () => {
  const long = `${'a'.repeat(250)}@example.com`
  assert.equal((await post(app(), '/auth/signup', { ...signup, email: long })).statusCode, 400)
  assert.equal((await post(app(), '/auth/login', { email: long, password: 'x' })).statusCode, 400)
})
test('CORS: credentials only for the allowed origin; PATCH allowed in preflight', async () => {
  const a = app()
  const pre = await a.inject({ method: 'OPTIONS', url: '/admin/users', headers: { origin: ORIGIN } })
  assert.equal(pre.headers['access-control-allow-credentials'], 'true')
  assert.match(String(pre.headers['access-control-allow-methods']), /PATCH/)
  const other = await a.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } })
  assert.equal(other.headers['access-control-allow-credentials'], undefined)
})
test('server.ts exits 1 with a clear message when the database is unreachable', () => {
  const run = spawnSync(process.execPath, ['src/server.ts'], {
    env: { ...process.env, ALLOWED_ORIGIN: ORIGIN, DATABASE_URL: 'postgres://u:secretpw@127.0.0.1:1/db', PORT: '0' },
    encoding: 'utf8',
  })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /Cannot connect to the database/)
  assert.doesNotMatch(run.stderr, /secretpw/)
})
