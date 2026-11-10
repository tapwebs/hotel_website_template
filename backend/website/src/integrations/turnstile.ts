/**
 * Cloudflare Turnstile CAPTCHA validator for website public forms and booking checkout.
 * Skips check when TURNSTILE_SECRET_KEY is unset (development and tests).
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // Bypass in development or tests

  if (!token) return false

  try {
    const formData = new URLSearchParams()
    formData.append('secret', secret)
    formData.append('response', token)
    if (ip) formData.append('remoteip', ip)

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
