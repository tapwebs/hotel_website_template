import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt cost parameters (N=16384, r=8, p=1) are stored with each hash so they can be raised later.
const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

const derive = (password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keylen, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key)))
  })

/** Returns `scrypt$N$r$p$saltB64$hashB64`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P, KEYLEN)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

/** Constant-time check. Malformed stored hashes return false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  try {
    const key = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p), expected.length)
    return key.length === expected.length && timingSafeEqual(key, expected)
  } catch {
    return false
  }
}
