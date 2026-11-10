import { Navigate, useParams } from 'react-router-dom'

/** Old printed room cards point at /dine/:token; send them to the TapMenu room flow. */
export function LegacyRoomRedirect() {
  const { token = '' } = useParams()
  return <Navigate to={`/dining/r/${encodeURIComponent(token)}`} replace />
}
