import { Navigate, useParams } from 'react-router-dom'

/**
 * Migration-only route. Old printed QR stickers point at
 * /r/:slug/t/:tableToken — this simply forwards the table token onward to
 * the new /t/:token flow so existing stickers keep working until they're
 * reprinted (see plan §10: "must be updated to emit /t/{token} URLs
 * before this goes live" — the fast-follow task updates the generator,
 * this route keeps old stickers alive in the meantime).
 */
export function LegacyRedirectPage() {
  const { tableToken } = useParams<{ slug: string; tableToken: string }>()

  if (!tableToken) {
    return <Navigate to="/" replace />
  }

  return <Navigate to={`/t/${tableToken}`} replace />
}
