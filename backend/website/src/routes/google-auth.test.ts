import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp, type GoogleTokenPayload } from '../app.ts'
import { memoryStore } from '../stores/store.ts'
import { hashPassword } from '../core/password.ts'

const ORIGIN = 'http://localhost:5173'

function createApp(opts: {
  store?: ReturnType<typeof memoryStore>
  googleClientId?: string
  verifyGoogleToken?: (idToken: string) => Promise<GoogleTokenPayload>
} = {}) {
  const store = opts.store ?? memoryStore()
  return {
    store,
    app: buildApp({
      store,
      allowedOrigin: ORIGIN,
      googleClientId: opts.googleClientId ?? 'test-google-client-id',
      verifyGoogleToken: opts.verifyGoogleToken ?? (async (idToken: string) => {
        if (idToken === 'valid-new-token') {
          return { sub: 'google-sub-1001', email: 'google.guest@example.com', email_verified: true, name: 'Google Guest' }
        }
        if (idToken === 'valid-existing-token') {
          return { sub: 'google-sub-2002', email: 'existing.guest@example.com', email_verified: true, name: 'Existing Guest' }
        }
        if (idToken === 'unverified-email-token') {
          return { sub: 'google-sub-3003', email: 'unverified@example.com', email_verified: false, name: 'Unverified' }
        }
        if (idToken === 'staff-email-token') {
          return { sub: 'google-sub-4004', email: 'staff@example.com', email_verified: true, name: 'Staff Person' }
        }
        if (idToken === 'disabled-email-token') {
          return { sub: 'google-sub-5005', email: 'disabled@example.com', email_verified: true, name: 'Disabled Person' }
        }
        throw new Error('invalid_token')
      }),
    }),
  }
}

test('POST /auth/google rejects non-allowed origin with 403', async () => {
  const { app } = createApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'valid-new-token' },
    headers: { origin: 'http://evil.example.com' },
  })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().error, 'forbidden_origin')
})

test('POST /auth/google returns 503 when google auth is not configured', async () => {
  const app = buildApp({
    store: memoryStore(),
    allowedOrigin: ORIGIN,
  })
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'valid-new-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 503)
  assert.equal(res.json().error, 'auth_not_configured')
})

test('POST /auth/google rejects invalid request payload with 400', async () => {
  const { app } = createApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { badField: 'missing-id-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error, 'invalid_request')
})

test('POST /auth/google rejects invalid / expired tokens with 401', async () => {
  const { app } = createApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'some-bad-or-expired-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 401)
  assert.equal(res.json().error, 'invalid_token')
})

test('POST /auth/google rejects unverified email with 400', async () => {
  const { app } = createApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'unverified-email-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.json().error, 'unverified_email')
})

test('POST /auth/google signs up new guest customer, sets hdh_session cookie', async () => {
  const { app, store } = createApp()
  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'valid-new-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.user.email, 'google.guest@example.com')
  assert.equal(body.user.role, 'guest')
  assert.equal(body.user.name, 'Google Guest')

  const cookie = res.headers['set-cookie']
  assert.match(String(cookie), /^hdh_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/)

  // Verify user is in store with googleSub and role 'guest'
  const user = await store.findByGoogleSub('google-sub-1001')
  assert.ok(user)
  assert.equal(user.email, 'google.guest@example.com')
  assert.equal(user.role, 'guest')
  assert.equal(user.googleSub, 'google-sub-1001')

  // Verify session works with /auth/me
  const cookieVal = String(cookie).split(';')[0]
  const meRes = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { cookie: cookieVal },
  })
  assert.equal(meRes.statusCode, 200)
  assert.equal(meRes.json().user.email, 'google.guest@example.com')
})

test('POST /auth/google logs in existing customer by google_sub', async () => {
  const { app, store } = createApp()
  // Create customer
  await store.createWithGoogle({
    id: 'user-existing-1',
    name: 'Existing Customer',
    email: 'existing.guest@example.com',
    googleSub: 'google-sub-2002',
  })

  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'valid-existing-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.user.id, 'user-existing-1')
  assert.equal(body.user.email, 'existing.guest@example.com')
})

test('POST /auth/google safely links verified email to existing password guest account', async () => {
  const { app, store } = createApp()
  // Create guest via password signup
  await store.create({
    id: 'user-pwd-guest-1',
    name: 'Password Guest',
    email: 'existing.guest@example.com',
    phone: '+919876543210',
    passwordHash: await hashPassword('password123'),
  })

  const before = await store.findByEmail('existing.guest@example.com')
  assert.equal(before?.googleSub, null)

  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'valid-existing-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 200)

  const after = await store.findByEmail('existing.guest@example.com')
  assert.equal(after?.googleSub, 'google-sub-2002')
})

test('POST /auth/google rejects linking when account already linked to different Google account', async () => {
  const { app, store } = createApp()
  // Create guest with a different googleSub
  await store.createWithGoogle({
    id: 'user-pwd-guest-2',
    name: 'Other Google Guest',
    email: 'existing.guest@example.com',
    googleSub: 'google-sub-OTHER-999',
  })

  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'valid-existing-token' }, // claims sub 'google-sub-2002'
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 409)
  assert.equal(res.json().error, 'account_conflict')
})

test('POST /auth/google rejects login or linking to staff/admin accounts', async () => {
  const { app, store } = createApp()
  // Create staff user in store
  await store.create({
    id: 'staff-user-1',
    name: 'Staff Member',
    email: 'staff@example.com',
    phone: '+919876543210',
    passwordHash: await hashPassword('password123'),
  })
  await store.update('staff-user-1', { role: 'staff' })

  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'staff-email-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().error, 'forbidden')

  // Verify staff user's googleSub was NOT set
  const staff = await store.findByEmail('staff@example.com')
  assert.equal(staff?.googleSub, null)
  assert.equal(staff?.role, 'staff')
})

test('POST /auth/google rejects disabled accounts', async () => {
  const { app, store } = createApp()
  await store.createWithGoogle({
    id: 'disabled-user-1',
    name: 'Disabled User',
    email: 'disabled@example.com',
    googleSub: 'google-sub-5005',
  })
  await store.update('disabled-user-1', { status: 'disabled' })

  const res = await app.inject({
    method: 'POST',
    url: '/auth/google',
    payload: { idToken: 'disabled-email-token' },
    headers: { origin: ORIGIN },
  })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().error, 'account_disabled')
})
