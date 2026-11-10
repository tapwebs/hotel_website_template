import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { BookingProvider } from '@/components/booking/BookingProvider'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileActionBar } from './MobileActionBar'
import { PageTransition } from './PageTransition'
import { SkipLink } from './SkipLink'
import { WhatsAppFab } from './WhatsAppFab'
import { CookieConsentBanner } from './CookieConsentBanner'

export function RootLayout() {
  // The floating WhatsApp/call controls would overlap the admin table controls on phones.
  const path = useLocation().pathname
  const admin = path.startsWith('/admin')
  // /account gets its own app-style tab bar on phones, so the generic bar, FAB and footer are hidden there.
  const account = path.startsWith('/account')
  return (
    <AuthProvider>
      <BookingProvider>
        <SkipLink />
        {admin ? null : <Header />}
        <main id="main" tabIndex={-1} className="outline-none">
          {/* Admin pages swap instantly (cached data, no fade): the fade made every section switch flicker. */}
          {admin ? (
            <Outlet />
          ) : (
            <PageTransition>
              <Outlet />
            </PageTransition>
          )}
        </main>
        {admin ? null : account ? <div className="max-md:hidden"><Footer /></div> : <Footer />}
        {admin ? null : account ? <div className="max-md:hidden"><WhatsAppFab /></div> : <WhatsAppFab />}
        {admin || account ? null : <MobileActionBar />}
        <CookieConsentBanner />
        <ScrollRestoration />
      </BookingProvider>
    </AuthProvider>
  )
}

export function AppFallback() {
  return <div className="min-h-dvh bg-cream" aria-busy="true" />
}
