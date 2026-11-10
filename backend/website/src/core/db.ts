import pg from 'pg'

export function parseDatabaseUrl(rawUrl: string): { connectionString: string; schema: string } {
  try {
    const parsed = new URL(rawUrl)
    const schema =
      parsed.searchParams.get('schema') ||
      parsed.searchParams.get('currentSchema') ||
      process.env.POSTGRES_SCHEMA ||
      'website'
    parsed.searchParams.delete('schema')
    parsed.searchParams.delete('currentSchema')
    if (!/^[a-zA-Z0-9_]+$/.test(schema)) {
      throw new Error(`Invalid schema name: ${schema}`)
    }
    return { connectionString: parsed.toString(), schema }
  } catch (err) {
    if ((err as Error).message.startsWith('Invalid schema name')) {
      throw err
    }
    const schema = process.env.POSTGRES_SCHEMA || 'website'
    if (!/^[a-zA-Z0-9_]+$/.test(schema)) {
      throw new Error(`Invalid schema name: ${schema}`)
    }
    return { connectionString: rawUrl, schema }
  }
}

export function createPool(url: string, schemaOverride?: string): pg.Pool {
  const { connectionString, schema: detectedSchema } = parseDatabaseUrl(url)
  const schema = schemaOverride || detectedSchema
  if (!/^[a-zA-Z0-9_]+$/.test(schema)) {
    throw new Error(`Invalid schema name: ${schema}`)
  }
  const max = process.env.POSTGRES_POOL_SIZE ? Number(process.env.POSTGRES_POOL_SIZE) : 20
  const idleTimeoutMillis = process.env.POSTGRES_IDLE_TIMEOUT_MS ? Number(process.env.POSTGRES_IDLE_TIMEOUT_MS) : 30_000
  const pool = new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis: 5000,
    options: `-c search_path=${schema}`,
  })
  pool.on('error', (err) => console.error(`Postgres pool error: ${err.message}`))
  return pool
}

