import { Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './features/customer/session/SessionContext'
import { SessionGuard } from './features/customer/session/SessionGuard'
import { TokenExchangePage } from './features/customer/session/TokenExchangePage'
import { MenuPage } from './features/customer/menu/MenuPage'
import { CartPage } from './features/customer/cart/CartPage'
import { CheckoutPage } from './features/customer/checkout/CheckoutPage'
import { TrackingPage } from './features/customer/tracking/TrackingPage'

/**
 * The TapMenu customer app, copied as-is and mounted under /dining/*.
 * /dining/t/:token  table QR (restaurant, rooftop, pool bar)
 * /dining/r/:token  room card (charged to the guest's folio)
 * /dining/order/:trackingToken  per-order tracking link (no session needed)
 */
export default function GuestDiningApp() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="t/:token" element={<TokenExchangePage />} />
        <Route path="r/:token" element={<TokenExchangePage />} />
        <Route path="menu" element={<SessionGuard><MenuPage /></SessionGuard>} />
        <Route path="cart" element={<SessionGuard><CartPage /></SessionGuard>} />
        <Route path="checkout" element={<SessionGuard><CheckoutPage /></SessionGuard>} />
        <Route path="order/:orderToken" element={<TrackingPage />} />
        <Route path="*" element={<Navigate to="/dining/menu" replace />} />
      </Routes>
    </SessionProvider>
  )
}
