import { createHash, randomBytes } from 'node:crypto'

export const COOKIE = 'hdh_session'
const DAY_S = 86_400

export const newToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function readCookie(header: string | undefined, name = COOKIE): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}

export function sessionCookie(token: string, opts: { remember: boolean; secure: boolean }): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${opts.remember ? `; Max-Age=${30 * DAY_S}` : ''}${opts.secure ? '; Secure' : ''}`
}

export const clearCookie = (secure: boolean) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`

export const sessionExpiry = (remember: boolean) => new Date(Date.now() + (remember ? 30 * DAY_S : DAY_S) * 1000)
