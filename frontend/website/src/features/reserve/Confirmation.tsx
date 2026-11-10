import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { CircleCheck, MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { hotel } from '@/data/hotel'
import { getMyBooking } from '@/features/account/accountApi'
import { BookingFacts } from '@/features/account/BookingFacts'
import { useAccountResource } from '@/features/account/useAccountData'
import { ErrorPanel, Skeleton } from '@/features/account/ui'
import { cn, container } from '@/lib/utils'
import { PaymentExtensionPoint } from './PaymentExtensionPoint'
export function Confirmation() {
  const { id = '' } = useParams()
  const res = useAccountResource((signal) => getMyBooking(id, { signal }), id)
  const heading = useRef<HTMLHeadingElement>(null)
  const booking = res.data
  useEffect(() => {
    if (booking) heading.current?.focus()
  }, [booking])
  return (
    <div className={cn(container, 'grid max-w-3xl gap-6 py-8 sm:py-10')}>
      {!booking ? (
        res.status === 'error' ? (
          <>
            <ErrorPanel error={res.error} onRetry={res.reload} />
            <Link to="/account/bookings" className="font-semibold text-burgundy underline underline-offset-4">
              Go to my bookings
            </Link>
          </>
        ) : (
          <Skeleton rows={2} label="Loading your booking…" />
        )
      ) : (
        <>
          <header className="grid gap-3">
            <CircleCheck className="size-10 text-burgundy" aria-hidden="true" />
            <h1 ref={heading} tabIndex={-1} className="font-display text-h2 text-burgundy outline-none">
              Request received
            </h1>
            <p className="text-walnut">Keep this reference:</p>
            <p className="font-mono text-3xl font-semibold tracking-widest text-burgundy select-all sm:text-4xl">{booking.reference}</p>
          </header>
          <section aria-labelledby="summary-title" className="rounded-md border border-border bg-ivory p-5 sm:p-6">
            <h2 id="summary-title" className="mb-4 font-display text-xl text-burgundy">
              Your stay
            </h2>
            <BookingFacts booking={booking} />
          </section>
          <section aria-labelledby="next-title" className="grid gap-2">
            <h2 id="next-title" className="font-display text-xl text-burgundy">
              What happens next
            </h2>
            <p className="text-walnut">
              The hotel will confirm your stay by WhatsApp or phone. Your stay is confirmed only after the hotel replies; until then your
              request is held as pending.
            </p>
          </section>
          <PaymentExtensionPoint booking={booking} />
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={`/account/bookings/${encodeURIComponent(booking.id)}`}>View in my account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-walnut">
            Questions?
            <a href={hotel.phoneHref} className="inline-flex min-h-11 items-center gap-2 font-semibold text-burgundy underline underline-offset-4">
              <Phone className="size-4" aria-hidden="true" /> {hotel.phoneDisplay}
            </a>
            <a href={hotel.phoneHrefSecondary} className="inline-flex min-h-11 items-center gap-2 font-semibold text-burgundy underline underline-offset-4">
              <Phone className="size-4" aria-hidden="true" /> {hotel.phoneDisplaySecondary}
            </a>
            <a
              href={buildWhatsAppUrl(`Hello ${hotel.name}, I have a question about my booking ${booking.reference}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-burgundy underline underline-offset-4"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
            </a>
          </p>
        </>
      )}
    </div>
  )
}
