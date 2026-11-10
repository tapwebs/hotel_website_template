import { type RouteObject } from 'react-router'
import { ErrorFallback } from '@/components/ErrorFallback'
import { AppFallback, RootLayout } from '@/components/layout/RootLayout'
import { AdminRedirect } from '@/components/AdminRedirect'

// Every page is its own chunk (react-router `lazy`). Shared by the browser and the prerender.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    HydrateFallback: AppFallback,
    ErrorBoundary: ErrorFallback,
    children: [
      { index: true, lazy: page(() => import('@/routes/Home')) },
      { path: 'rooms', lazy: page(() => import('@/routes/Rooms')) },
      { path: 'weddings-events', lazy: page(() => import('@/routes/WeddingsEvents')) },
      { path: 'dining', lazy: page(() => import('@/routes/Dining')) },
      { path: 'gallery', lazy: page(() => import('@/routes/Gallery')) },
      { path: 'hotel-in-bassi-jaipur', lazy: page(() => import('@/routes/HotelInBassi')) },
      { path: 'wedding-venue-in-bassi', lazy: page(() => import('@/routes/WeddingVenueBassi')) },
      { path: 'hotel-near-dausa', lazy: page(() => import('@/routes/HotelNearDausa')) },
      { path: 'about', lazy: page(() => import('@/routes/About')) },
      { path: 'privacy-policy', lazy: page(() => import('@/routes/PrivacyPolicy')) },
      // Auth pages are noindex and not linked from the header/footer yet. Add the nav link here when the booking engine is live.
      { path: 'login', lazy: page(() => import('@/routes/Login')) },
      { path: 'signup', lazy: page(() => import('@/routes/Signup')) },
      // The admin moved into the HMS app (/app/admin/...). Old /admin links forward there.
      { path: 'admin/*', Component: AdminRedirect },
      { path: 'admin', Component: AdminRedirect },
      // Staff console links opened on the public domain (e.g. /app/qr/library) forward to the HMS host.
      { path: 'app/*', Component: AdminRedirect },
      { path: 'app', Component: AdminRedirect },
      // Guest account area and the reservation flow: signed-in only, noindex, not prerendered (see seo/routes.ts).
      {
        path: 'account',
        lazy: page(() => import('@/routes/Account')),
        children: [
          { index: true, lazy: page(() => import('@/routes/account/Overview')) },
          { path: 'bookings', lazy: page(() => import('@/routes/account/Bookings')) },
          { path: 'bookings/:id', lazy: page(() => import('@/routes/account/BookingDetail')) },
          { path: 'profile', lazy: page(() => import('@/routes/account/Profile')) },
          { path: 'help', lazy: page(() => import('@/routes/account/Help')) },
          { path: 'security', lazy: page(() => import('@/routes/account/Security')) },
        ],
      },
      { path: 'book', lazy: page(() => import('@/routes/Book')) },
      { path: 'book/confirmation/:id', lazy: page(() => import('@/routes/BookingConfirmation')) },
      { path: 'contact', lazy: page(() => import('@/routes/Contact')) },
      { path: '*', lazy: page(() => import('@/routes/NotFound')) },
    ],
  },
  // Public QR landing pages (scanned from printed QR codes). Standalone design, so outside RootLayout (no site header or footer).
  { path: '/hub/unavailable', lazy: () => import('@/features/qrhub/hub/Unavailable') },
  { path: '/hub/:slug', lazy: () => import('@/features/qrhub/hub/HotelHub') },
  // Guest dining app (table/room QR scan, menu, cart, checkout, tracking)
  { path: '/dining/*', lazy: () => import('@/tapmenu/GuestDiningApp').then(m => ({ Component: m.default })) },
  { path: '/dine/:token', lazy: () => import('@/tapmenu/LegacyRoomRedirect').then(m => ({ Component: m.LegacyRoomRedirect })) },
]
