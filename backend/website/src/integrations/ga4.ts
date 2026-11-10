import { accessToken, failed, fetchWithRetry, notConnected, type GoogleEnv, type IntegrationState } from './google.ts'

export interface Ga4Metrics {
  users: number
  sessions: number
  pageViews: number
  engagementRate: number // percent
  trafficTrend: { date: string; users: number; sessions: number }[]
}
interface CacheEntry {
  expiresAt: number
  state: IntegrationState<Ga4Metrics>
}
const _ga4Cache = new Map<string, CacheEntry>()
const GA4_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function clearGa4Cache(): void {
  _ga4Cache.clear()
}

/** GA4 Data API v1beta report for the hub page(s) of one organization. Off unless all three env vars are set. */
export async function fetchGa4(slug: string, days: number, env: GoogleEnv = process.env, fetcher: typeof fetch = fetch): Promise<IntegrationState<Ga4Metrics>> {
  const { GA4_PROPERTY_ID: property, GA4_CLIENT_EMAIL: email, GA4_PRIVATE_KEY: key } = env
  if (!property || !email || !key) return notConnected('ga4', 'Google Analytics 4', 'Not connected. Set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY on the API server.')

  const cacheKey = `${property}:${slug}:${days}`
  const cached = _ga4Cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.state
  }

  try {
    const token = await accessToken(email, key, 'https://www.googleapis.com/auth/analytics.readonly', fetcher)
    const res = await fetchWithRetry(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(property)}:runReport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'engagementRate' }],
        dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: `/hub/${slug}` } } },
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      signal: AbortSignal.timeout(8000),
    }, fetcher)
    if (!res.ok) throw new Error(`Analytics API returned HTTP ${res.status}`)
    const rows = ((await res.json()) as { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }).rows ?? []
    let users = 0
    let sessions = 0
    let pageViews = 0
    let engagement = 0
    const trafficTrend = rows.map((r) => {
      const [u, s, p, e] = r.metricValues.map((m) => Number(m.value) || 0) as [number, number, number, number]
      users += u
      sessions += s
      pageViews += p
      engagement += e
      return { date: r.dimensionValues[0]?.value ?? '', users: u, sessions: s }
    })
    const result: IntegrationState<Ga4Metrics> = {
      provider: 'ga4',
      name: 'Google Analytics 4',
      status: 'connected',
      lastSynced: new Date().toISOString(),
      explanation: 'Synced with Google Analytics 4.',
      data: { users, sessions, pageViews, engagementRate: rows.length ? Math.round((engagement / rows.length) * 100) : 0, trafficTrend },
    }
    _ga4Cache.set(cacheKey, { expiresAt: Date.now() + GA4_TTL_MS, state: result })
    return result
  } catch (err) {
    return failed('ga4', 'Google Analytics 4', err)
  }
}
