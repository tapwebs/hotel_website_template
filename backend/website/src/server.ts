import { buildApp } from './app.ts'
import { createPool } from './core/db.ts'
import { pgQrStore } from './stores/qr-store.ts'
import { memoryStore, pgStore, type UserStore } from './stores/store.ts'
import { integrationConfig } from './integrations/config.ts'
import { hmsSyncHooks } from './integrations/hms.ts'
import type pg from 'pg'

const allowedOrigin = process.env.ALLOWED_ORIGIN
if (!allowedOrigin) {
  console.error('ALLOWED_ORIGIN is required (single frontend origin, no wildcard).')
  process.exit(1)
}
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is required (Postgres connection string or "memory").')
  process.exit(1)
}

let store: UserStore
let pool: pg.Pool | undefined
let qrStore: ReturnType<typeof pgQrStore> | undefined

if (databaseUrl === 'memory') {
  if (process.env.NODE_ENV === 'production') {
    console.error('DATABASE_URL=memory is not allowed in production.')
    process.exit(1)
  }
  store = memoryStore()
  qrStore = undefined
} else {
  pool = createPool(databaseUrl)
  // Fail at startup, not on the first request. The URL (which holds the password) is never printed.
  try {
    await pool.query('select 1')
  } catch (err) {
    console.error(`Cannot connect to the database: ${(err as Error).message}`)
    process.exit(1)
  }
  store = pgStore(pool)
  qrStore = pgQrStore(pool)
}

const trustProxy = process.env.TRUST_PROXY === '1'
const { hms } = integrationConfig()
const app = buildApp({
  store, allowedOrigin, trustProxy, logger: true, qr: qrStore, siteUrl: process.env.SITE_URL,
  hms, bookingSync: hms ? hmsSyncHooks(hms, store) : undefined,
})
if (!trustProxy) {
  app.log.warn(
    'TRUST_PROXY is unset: auth requests carrying X-Forwarded-For are rejected. Behind a reverse proxy, set TRUST_PROXY=1.',
  )
}
const shutdown = () => void app.close().then(() => pool?.end()).then(() => process.exit(0))
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
