import { PaymentBadge } from '@/features/account/badges'
import type { Booking } from '@/features/account/accountTypes'
/**
 * EXTENSION POINT (payment): NON-FUNCTIONAL PLACEHOLDER. It has no inputs and makes no network calls.
 *
 * When online payment ships, replace the body of this component with the payment UI and keep it keyed on
 * `booking.paymentStatus`: `pay_at_hotel` / `unpaid` -> show the pay action, `paid` -> show the receipt.
 * The amount to charge is `booking.totalAmount` (computed by the server, never by the browser). The backend,
 * not the browser, must record `paid` (gateway webhook or a server-side verify endpoint; see the backend
 * README, "Payment seam"). Never add card fields to this site's own pages.
 */
export function PaymentExtensionPoint({ booking }: { booking: Booking }) {
  return (
    <section
      data-extension-point="payment"
      aria-labelledby="payment-title"
      className="grid gap-2 rounded-md border border-dashed border-gold bg-ivory p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payment-title" className="font-display text-xl text-burgundy">
          Payment
        </h2>
        <PaymentBadge status={booking.paymentStatus} />
      </div>
      <p className="text-walnut">Pay at the hotel on arrival (cash, UPI or cards). Online payment is not available yet.</p>
    </section>
  )
}
