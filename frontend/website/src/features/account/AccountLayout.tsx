import { NavLink, Outlet } from 'react-router'
import { cn, container } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-context'
import { AccountTabBar } from './AccountTabBar'
import { RequireAuth } from './RequireAuth'
const tabs = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/bookings', label: 'My bookings', end: false },
  { to: '/account/profile', label: 'Profile', end: false },
  { to: '/account/help', label: 'Help', end: false },
  { to: '/account/security', label: 'Security', end: false },
] as const
/** Auth-required shell for every /account page: heading, section nav, and the child route. */
export function AccountLayout() {
  const { auth } = useAuth()
  const name = auth.status === 'authenticated' ? auth.user.name : ''
  return (
    <RequireAuth>
      <div className={cn(container, 'pt-5 pb-28 sm:py-10 md:pb-10')}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-burgundy font-display text-lg text-ivory md:hidden">
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <h1 className="font-display text-h3 text-burgundy md:text-h2">My account</h1>
        </div>
        <nav aria-label="Account sections" className="sticky top-16 z-10 -mx-4 mt-4 hidden overflow-x-auto bg-cream/95 px-4 backdrop-blur sm:mx-0 sm:px-0 md:block">
          <ul className="flex w-max min-w-full gap-1 border-b border-gold/40">
            {tabs.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold whitespace-nowrap text-walnut outline-none hover:text-burgundy focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isActive ? 'border-burgundy text-burgundy' : 'border-transparent',
                    )
                  }
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-5 md:mt-6">
          <Outlet />
        </div>
      </div>
      <AccountTabBar />
    </RequireAuth>
  )
}
