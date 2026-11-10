import { Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { AuthUnavailable } from '@/features/auth/AuthUnavailable'
import { useAuth } from '@/features/auth/auth-context'
import { container } from '@/lib/utils'
const Gate = ({ children }: { children: React.ReactNode }) => <div className={`${container} py-10`}>{children}</div>
/** Gate for any signed-in role: anonymous -> /login (and back to this exact page after login). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { auth, refresh } = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') {
    return (
      <Gate>
        <div aria-busy="true" role="status" className="grid gap-4">
          <span className="sr-only">Checking your session…</span>
          <div className="h-10 w-2/3 max-w-md animate-pulse rounded-md bg-border/60 motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-2xl bg-border/40 motion-reduce:animate-none" />
        </div>
      </Gate>
    )
  }
  if (auth.status === 'anonymous') {
    return auth.configured ? (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    ) : (
      <Gate>
        <AuthUnavailable />
      </Gate>
    )
  }
  if (auth.status === 'error') {
    return (
      <Gate>
        <div role="alert" className="grid max-w-xl gap-3 rounded-md border border-destructive/40 bg-ivory p-6">
          <h2 className="text-h3 text-burgundy">We could not check your session</h2>
          <p className="text-walnut">The server could not be reached. Please try again.</p>
          <div>
            <Button onClick={refresh}>Try again</Button>
          </div>
        </div>
      </Gate>
    )
  }
  return <>{children}</>
}
