import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type pg from 'pg'
import { createPool } from '../core/db.ts'

const dir = join(import.meta.dirname, '..', '..', 'migrations')

/** Applies unapplied migrations/*.sql in filename order, each in its own transaction. Returns applied names. */
export async function migrate(pool: pg.Pool, log: (line: string) => void = () => {}): Promise<string[]> {
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['hdh-migrate'])
    const spResult = await client.query('SHOW search_path')
    const targetSchema = spResult.rows[0]?.search_path?.split(',')[0]?.trim() || 'website'
    if (targetSchema && targetSchema !== 'public' && /^[a-zA-Z0-9_]+$/.test(targetSchema)) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`)
      await client.query(`SET search_path TO "${targetSchema}"`)
    }
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (done.has(file)) continue
      const sql = await readFile(join(dir, file), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw new Error(`migration ${file} failed: ${(err as Error).message}`)
      }
      applied.push(file)
      log(`applied ${file}`)
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['hdh-migrate']).catch(() => {})
    client.release()
  }
  return applied
}

if (process.argv[1] === import.meta.filename) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required.')
    process.exit(1)
  }
  const pool = createPool(url)
  try {
    const applied = await migrate(pool, console.log)
    if (!applied.length) console.log('no pending migrations')
  } catch (err) {
    console.error(`Migration failed: ${(err as Error).message}`)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
