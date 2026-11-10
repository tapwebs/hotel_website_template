import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSession } from './SessionContext'
import { SessionErrorScreen } from './SessionErrorScreen'
import { CustomerMenuSkeleton } from '../../../components/ui/Skeleton'

/**
 * /t/:token — exchanges the QR token for a session, then immediately
 * replaces history with /menu so the token never lingers in the address
 * bar or browser history (see plan §3/§4: "after scan, the address bar
 * shows /menu only").
 */
export function TokenExchangePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { exchangeToken, error } = useSession()
  const [failed, setFailed] = useState(false)
  const attempted = useRef(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark')
    }

    if (attempted.current || !token) return
    attempted.current = true

    exchangeToken(token)
      .then(() => navigate('/dining/menu', { replace: true }))
      .catch(() => setFailed(true))
  }, [token, exchangeToken, navigate])

  if (failed || error) {
    return <SessionErrorScreen message={error} />
  }

  return <CustomerMenuSkeleton />
}
