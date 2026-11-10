import type pg from 'pg'
import { createPool } from '../core/db.ts'
import { migrate } from '../scripts/migrate.ts'

/** Returns a migrated test pool, or undefined when TEST_DATABASE_URL is unset. Refuses unsafe targets. */
export async function testPool(): Promise<pg.Pool | undefined> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) return undefined
  const dbName = new URL(url).pathname.slice(1)
  if (url === process.env.DATABASE_URL || !dbName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL and name a database ending in _test')
  }
  const pool = createPool(url)
  await migrate(pool)
  return pool
}

export const resetDb = (pool: pg.Pool) => pool.query('TRUNCATE bookings, users, sessions, qr_organizations CASCADE')
