import { describe, expect, it, vi } from 'vitest'
import { authBaseUrl, DEFAULT_GOOGLE_CLIENT_ID, getSession, googleClientId, signIn, signInWithGoogle, signOut, signUp } from './authService'
import { safeNext } from './auth-context'
import { loginSchema, passwordStrength, signupSchema } from './schemas'
const valid = {
  name: 'Asha Sharma',
  email: 'asha@example.com',
  phone: '98765 43210',
  password: 'Sup3r-secret',
  confirmPassword: 'Sup3r-secret',
  consent: true,
}
describe('schemas', () => {
  it('accepts a valid signup and login', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })
  it('rejects short passwords, mismatches, bad phone/email and missing consent', () => {
    expect(signupSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' }).success).toBe(false)
    const mismatch = signupSchema.safeParse({ ...valid, confirmPassword: 'different1' })
    expect(mismatch.success ? [] : mismatch.error.issues.map((i) => i.path[0])).toContain('confirmPassword')
    expect(signupSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false)
    expect(signupSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false)
    expect(signupSchema.safeParse({ ...valid, consent: false }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
  it('rates password strength', () => {
    expect(passwordStrength('abc').label).toBe('Too short')
    expect(passwordStrength('abcdefgh').label).toBe('Weak')
    expect(passwordStrength('Abcdefg1').label).toBe('Fair')
    expect(passwordStrength('Abcdefghij1!').label).toBe('Strong')
  })
})
describe('authService', () => {
  it('returns AUTH_NOT_CONFIGURED without calling the network when no base URL is set', async () => {
    const fetchImpl = vi.fn()
    expect(await signIn({ email: 'a@b.co', password: 'x' }, { baseUrl: '', fetchImpl })).toEqual({ ok: false, code: 'AUTH_NOT_CONFIGURED' })
    expect(await signUp(valid, { baseUrl: '  ', fetchImpl })).toEqual({ ok: false, code: 'AUTH_NOT_CONFIGURED' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('POSTs JSON to /auth/login and maps failures to generic codes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    expect(await signIn({ email: 'a@b.co', password: 'pw' }, { baseUrl: 'https://api.test/', fetchImpl })).toEqual({ ok: true })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/auth/login')
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST')
    expect(
      await signIn(
        { email: 'a@b.co', password: 'pw' },
        { baseUrl: 'https://api.test', fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 401 }) },
      ),
    ).toEqual({ ok: false, code: 'INVALID_REQUEST' })
    expect(
      await signIn(
        { email: 'a@b.co', password: 'pw' },
        { baseUrl: 'https://api.test', fetchImpl: vi.fn().mockRejectedValue(new TypeError('x')) },
      ),
    ).toEqual({ ok: false, code: 'NETWORK' })
  })
  it('POSTs idToken to /auth/google with credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, user: { id: 'g1', name: 'G User', email: 'g@test.co', role: 'guest' } }),
    })
    const res = await signInWithGoogle('valid-token-123', { baseUrl: 'https://api.test', fetchImpl })
    expect(res).toEqual({ ok: true, user: { id: 'g1', name: 'G User', email: 'g@test.co', role: 'guest' } })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/auth/google')
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST')
    expect(fetchImpl.mock.calls[0][1].credentials).toBe('include')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ idToken: 'valid-token-123' })
  })
})
describe('sessions', () => {
  const base = { baseUrl: 'https://api.test' }
  const user = { id: 'u1', name: 'Asha', email: 'a@b.co', role: 'admin' }
  const login = { email: 'a@b.co', password: 'pw' }
  it('sends credentials and remember, and returns the parsed user', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, user }) })
    expect(await signIn({ ...login, remember: true }, { ...base, fetchImpl })).toEqual({ ok: true, user })
    expect(fetchImpl.mock.calls[0][1].credentials).toBe('include')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ ...login, remember: true })
  })
  it('treats an unparseable 200 body as success without a user', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ nope: 1 }) })
    expect(await signIn(login, { ...base, fetchImpl })).toEqual({ ok: true })
  })
  it('maps 403 to ACCOUNT_DISABLED', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    expect(await signIn(login, { ...base, fetchImpl })).toEqual({ ok: false, code: 'ACCOUNT_DISABLED' })
  })
  it('getSession: 200 -> user, 401 -> null, network -> error, unconfigured -> no fetch', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user }) })
    expect(await getSession({ ...base, fetchImpl: ok })).toEqual({ ok: true, user })
    expect(ok.mock.calls[0][0]).toBe('https://api.test/auth/me')
    expect(ok.mock.calls[0][1].credentials).toBe('include')
    expect(await getSession({ ...base, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 401 }) })).toEqual({
      ok: true,
      user: null,
    })
    expect(await getSession({ ...base, fetchImpl: vi.fn().mockRejectedValue(new TypeError('x')) })).toEqual({ ok: false, code: 'NETWORK' })
    const never = vi.fn()
    expect(await getSession({ baseUrl: '', fetchImpl: never })).toEqual({ ok: false, code: 'AUTH_NOT_CONFIGURED' })
    expect(never).not.toHaveBeenCalled()
  })
  it('signOut POSTs /auth/logout with credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    expect(await signOut({ ...base, fetchImpl })).toBe(true)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/auth/logout')
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })
  it('safeNext only accepts same-origin paths', () => {
    expect(safeNext('/admin')).toBe('/admin')
    expect(safeNext('/book?room=deluxe&in=2026-11-01')).toBe('/book?room=deluxe&in=2026-11-01')
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'admin', undefined, 5]) expect(safeNext(bad)).toBeNull()
  })

  it('authBaseUrl respects explicit options and falls back to production when on hoteldreamheavens.in', () => {
    expect(authBaseUrl({ baseUrl: 'https://custom.api' })).toBe('https://custom.api')
    expect(authBaseUrl({ baseUrl: 'https://custom.api/' })).toBe('https://custom.api')
    expect(authBaseUrl({ baseUrl: '' })).toBe('')

    // Strips trailing /api or /api/v1 if set in environment
    vi.stubEnv('VITE_AUTH_API_URL', 'https://api.example.com/api')
    try {
      expect(authBaseUrl()).toBe('https://api.example.com')
    } finally {
      vi.unstubAllEnvs()
    }

    vi.stubEnv('VITE_AUTH_API_URL', 'https://api.example.com/api/v1')
    try {
      expect(authBaseUrl()).toBe('https://api.example.com')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('googleClientId returns default web client ID for localhost', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const hadWindow = 'window' in globalThis
    const originalWindow = (globalThis as Record<string, unknown>).window
    try {
      ;(globalThis as Record<string, unknown>).window = { location: { hostname: 'localhost' } }
      expect(googleClientId()).toBe(DEFAULT_GOOGLE_CLIENT_ID)

      ;(globalThis as Record<string, unknown>).window = { location: { hostname: 'unrelated-domain.com' } }
      expect(googleClientId()).toBe('')
    } finally {
      vi.unstubAllEnvs()
      if (hadWindow) {
        (globalThis as Record<string, unknown>).window = originalWindow
      } else {
        delete (globalThis as Record<string, unknown>).window
      }
    }
  })
})
