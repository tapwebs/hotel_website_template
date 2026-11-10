import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApi, normalizeAnalytics } from './api'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const make = (res: Response | Error) => {
  const fetchImpl = vi.fn(async () => {
    if (res instanceof Error) throw res
    return res
  })
  return { fetchImpl, api: createApi({ baseUrl: 'https://api.test/', fetchImpl: fetchImpl as unknown as typeof fetch }) }
}

describe('api client', () => {
  it('sends the session cookie and builds the contract URL', async () => {
    const { api, fetchImpl } = make(json(200, { items: [] }))
    await api.listOrganizations({ search: 'dream', category: '' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/qr-hub/admin/organizations?search=dream')
    expect(init.credentials).toBe('include')
  })

  it('maps 401 and 403 to ApiError with a readable message', async () => {
    const err = await make(json(401, {}))
      .api.listOrganizations()
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
    expect((err as ApiError).message).toMatch(/sign in/i)
    const forbidden = await make(json(403, { error: 'Admins only' }))
      .api.listOrganizations()
      .catch((e: unknown) => e)
    expect((forbidden as ApiError).message).toBe('Admins only')
  })

  it('keeps per-row errors from a 400 bulk response', async () => {
    const { api } = make(json(400, { error: 'Invalid', rows: [{ index: 2, message: 'Bad URL' }] }))
    const err = (await api.bulkLinks('x', [{ title: 'a', destination_url: 'b' }]).catch((e: unknown) => e)) as ApiError
    expect(err.status).toBe(400)
    expect(err.rows).toEqual([{ index: 2, message: 'Bad URL' }])
  })

  it('turns a network failure into status 0', async () => {
    const err = (await make(new TypeError('offline'))
      .api.listOrganizations()
      .catch((e: unknown) => e)) as ApiError
    expect(err.status).toBe(0)
  })

  it('refuses to call when no base URL is configured', async () => {
    const err = (await createApi({ baseUrl: '' })
      .me()
      .catch((e: unknown) => e)) as ApiError
    expect(err.status).toBe(0)
    expect(err.message).toMatch(/not configured/i)
  })

  it('me() resolves null for signed-out visitors and the user otherwise', async () => {
    expect(await make(json(401, {})).api.me()).toBeNull()
    const user = { id: '1', name: 'A', email: 'a@b.c', role: 'admin' }
    expect(await make(json(200, { user })).api.me()).toEqual(user)
  })

  it('reads the filename of a download from Content-Disposition', async () => {
    const res = new Response('a,b', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="visits-2026.csv"' } })
    const { filename } = await make(res).api.exportCsv({ type: 'visits' })
    expect(filename).toBe('visits-2026.csv')
  })

  it('normalizeAnalytics fills gaps so the screens never crash', () => {
    const a = normalizeAnalytics({ totals: { visits: 3 }, byHour: [{ hour: 7, count: 5 }], byWeekday: [1, 2] })
    expect(a.byHour).toHaveLength(24)
    expect(a.byHour[7]).toBe(5)
    expect(a.byWeekday).toHaveLength(7)
    expect(a.totals).toEqual({ visits: 3, scans: 3, clicks: 0 })
    expect(a.byPlacement).toEqual([])
  })
  it("reads the server shape for busiest hours and days (visits per bucket)", () => {
    const a = normalizeAnalytics({ byHour: [{ hour: 21, visits: 9 }], byWeekday: [{ weekday: 5, visits: 4 }] })
    expect(a.byHour[21]).toBe(9)
    expect(a.byWeekday[5]).toBe(4)
  })
})
