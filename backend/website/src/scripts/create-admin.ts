import { createPool } from '../core/db.ts'
import { hashPassword } from '../core/password.ts'
import { emailField, passwordField } from '../domain/schemas.ts'

// Usage: npm run create-admin -- <email> [password]   (password may also come from ADMIN_PASSWORD).
// argv/env can show in shell history or `ps`: use a throwaway password and change it. Secrets are never printed.
const usage = 'Usage: npm run create-admin -- <email> [password]  (or set ADMIN_PASSWORD)'
const email = emailField.safeParse(process.argv[2])
const password = passwordField.safeParse(process.argv[3] ?? process.env.ADMIN_PASSWORD)
if (!email.success || !password.success) {
  console.error(`${!email.success ? 'Invalid email. ' : 'Invalid password (8 to 200 characters). '}${usage}`)
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required.')
  process.exit(1)
}
const pool = createPool(url)
try {
  const res = await pool.query<{ created: boolean }>(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES ('Administrator', $1, $2, 'admin', 'active')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'active', password_hash = EXCLUDED.password_hash, updated_at = now()
     RETURNING (xmax = 0) AS created`,
    [email.data.toLowerCase(), await hashPassword(password.data)],
  )
  console.log(res.rows[0]?.created ? `created admin ${email.data.toLowerCase()}` : `promoted ${email.data.toLowerCase()} to admin`)
} catch (err) {
  console.error(`create-admin failed: ${(err as Error).message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
