import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BedDouble, Check, Clock, Copy, MessageCircle, Moon, Phone, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { hotel } from '@/data/hotel'
import type { AdminError } from '@/features/admin/adminTypes'
import { cancelBooking, getMyBooking } from './accountApi'
import { BookingActions } from './BookingActions'
import { StatusTimeline } from './StatusTimeline'
import { countdownLabel } from './calendar'
import { useAccountResource } from './useAccountData'
import { useAuth } from '@/features/auth/auth-context'
import { play } from '@/lib/sounds'
import { ErrorPanel, Panel, Skeleton } from './ui'
import { BookingStatusBadge, PaymentBadge } from './badges'
import { fmtDateTime } from '@/features/admin/format'
import { formatINR } from '@/lib/format'
import { formatStay, nightsLabel, roomsLabel } from './dates'
import type { Booking } from './accountTypes'
export function BookingDetail() {
  const { id = '' } = useParams()
  const res = useAccountResource((signal) => getMyBooking(id, { signal }), id)
  const [overrideState, setOverride] = useState<Booking | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AdminError | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const { clear } = useAuth()
  const keepRef = useRef<HTMLButtonElement>(null)
  const doneRef = useRef<HTMLParagraphElement>(null)
  const { reload } = res
  // Moves focus into the confirmation (keep = safe default) and to the result message afterwards.
  useEffect(() => {
    if (confirming) keepRef.current?.focus()
  }, [confirming])
  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])
  // A cancelled copy only applies to the booking it came from (the id can change when navigating).
  const booking = (overrideState?.id === id ? overrideState : null) ?? res.data
  if (!booking) {
    if (res.status === 'error')
      return (
        <div className="grid gap-4">
          <ErrorPanel error={res.error} onRetry={res.reload} />
          <Link to="/account/bookings" className="font-semibold text-burgundy underline underline-offset-4">
            Back to my bookings
          </Link>
        </div>
      )
    return <Skeleton rows={2} label="Loading your booking…" />
  }
  const cancel = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await cancelBooking(booking.id)
    setBusy(false)
    if (r.ok) {
      setOverride(r.data)
      setConfirming(false)
      setDone(true)
      play('success')
      return
    }
    if (r.error.kind === 'unauthenticated') return clear()
    play('error')
    setError(r.error)
    setConfirming(false)
    if (r.error.code === 'not_cancellable') {
      setOverride(null)
      reload()
    }
  }
  const msg = `Hello ${hotel.name}, I have a question about my booking ${booking.reference}.`
  const live = booking.status === 'pending' || booking.status === 'confirmed'
  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(booking.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: the reference is still selectable */
    }
  }
  const stat = 'grid gap-0.5 rounded-md border border-border bg-cream/60 p-3'
  const label = 'flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase'
  return (
    <div className="grid gap-5">
      <Link to="/account/bookings" className="inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-burgundy underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> My stays
      </Link>

      {done ? (
        <p ref={doneRef} tabIndex={-1} role="status" className="rounded-md border border-gold bg-gold-soft/40 p-3 font-semibold text-walnut outline-none">
          Your booking was cancelled.
        </p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-ivory p-3 font-semibold text-destructive">
            {error.message}
          </p>
        ) : null}
      </div>

      <section aria-label="Booking summary" className="on-dark grid gap-5 rounded-2xl bg-[linear-gradient(150deg,var(--color-burgundy-deep),var(--color-walnut))] p-5 text-cream sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-xs font-semibold tracking-wide text-cream/70 uppercase">Booking reference</p>
            <h2 className="flex items-center gap-2 font-mono text-2xl tracking-wider sm:text-3xl">
              <span className="select-all">{booking.reference}</span>
              <button type="button" onClick={() => void copyRef()} aria-label={copied ? 'Reference copied' : 'Copy reference'} className="grid size-9 place-items-center rounded-md bg-cream/10 outline-none hover:bg-cream/20 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              </button>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentBadge status={booking.paymentStatus} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md bg-cream/10 p-4">
          <div>
            <p className="text-xs tracking-wide text-cream/70 uppercase">Check-in</p>
            <p className="font-display text-lg leading-tight sm:text-xl">{formatStay(booking.checkIn)}</p>
            <p className="text-xs text-cream/70">From {hotel.checkIn}</p>
          </div>
          <span className="grid justify-items-center gap-0.5 text-xs text-cream/80">
            <Moon className="size-4" aria-hidden="true" />
            {nightsLabel(booking.nights)}
          </span>
          <div className="text-right">
            <p className="text-xs tracking-wide text-cream/70 uppercase">Check-out</p>
            <p className="font-display text-lg leading-tight sm:text-xl">{formatStay(booking.checkOut)}</p>
            <p className="text-xs text-cream/70">By {hotel.checkOut}</p>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-cream/90">
          <span className="font-semibold">
            {booking.room.name} × {roomsLabel(booking.roomCount)}
          </span>
          {live ? <span className="rounded-full bg-gold-soft px-3 py-0.5 text-xs font-semibold text-burgundy">{countdownLabel(booking)}</span> : null}
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <Panel aria-label="Booking progress" className="grid gap-4">
            <StatusTimeline status={booking.status} />
            {booking.status === 'pending' ? (
              <p className="text-center text-sm text-muted-foreground">The hotel will confirm your request shortly. You can also call to speed it up.</p>
            ) : null}
          </Panel>

          <Panel aria-labelledby="stay-title" className="grid gap-4">
            <h3 id="stay-title" className="font-semibold text-walnut">
              Stay details
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <div className={stat}>
                <dt className={label}>
                  <Users className="size-3.5" aria-hidden="true" /> Guests
                </dt>
                <dd className="text-walnut">
                  {booking.adults} {booking.adults === 1 ? 'adult' : 'adults'}
                  {booking.children ? `, ${booking.children} ${booking.children === 1 ? 'child' : 'children'}` : ''}
                </dd>
              </div>
              <div className={stat}>
                <dt className={label}>
                  <BedDouble className="size-3.5" aria-hidden="true" /> Extra bed
                </dt>
                <dd className="text-walnut">{booking.extraBed ? 'Requested' : 'No'}</dd>
              </div>
              <div className={stat}>
                <dt className={label}>
                  <Clock className="size-3.5" aria-hidden="true" /> Requested on
                </dt>
                <dd className="text-walnut">{fmtDateTime(booking.createdAt)}</dd>
              </div>
              <div className={stat}>
                <dt className={label}>Payment</dt>
                <dd>
                  <PaymentBadge status={booking.paymentStatus} />
                </dd>
              </div>
              <div className={`${stat} col-span-2`}>
                <dt className={label}>Special requests</dt>
                <dd className="break-words text-walnut">{booking.specialRequests || 'None'}</dd>
              </div>
            </dl>
            {booking.extraBed ? <p className="text-xs text-muted-foreground">The hotel shares the extra bed charge when it confirms.</p> : null}
            {booking.cancelledAt ? <p className="text-sm text-muted-foreground">Cancelled on {fmtDateTime(booking.cancelledAt)}</p> : null}
          </Panel>

          <Panel aria-labelledby="price-title" className="grid gap-3">
            <h3 id="price-title" className="font-semibold text-walnut">
              Price
            </h3>
            <dl className="grid gap-2 text-walnut">
              <div className="flex justify-between gap-4">
                <dt>
                  {formatINR(booking.ratePerNight)} × {nightsLabel(booking.nights)} × {roomsLabel(booking.roomCount)}
                </dt>
                <dd className="tabular-nums">{formatINR(booking.totalAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatINR(booking.totalAmount)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">Room charge, excluding taxes and extra bed. Payment is made at the hotel.</p>
          </Panel>
        </div>

        <aside aria-label="Actions" className="grid gap-5 lg:sticky lg:top-24">
          <Panel aria-labelledby="actions-title" className="grid gap-3">
            <h3 id="actions-title" className="font-semibold text-walnut">
              Quick actions
            </h3>
            <BookingActions booking={booking} />
          </Panel>

          <Panel aria-labelledby="help-title" className="grid gap-3">
            <h3 id="help-title" className="font-semibold text-walnut">
              Need to change something?
            </h3>
            <p className="text-sm text-muted-foreground">Call or WhatsApp the hotel and mention your reference. Dates and rooms are changed by the hotel.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={hotel.phoneHref}>
                  <Phone aria-hidden="true" /> {hotel.phoneDisplay}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={hotel.phoneHrefSecondary}>
                  <Phone aria-hidden="true" /> {hotel.phoneDisplaySecondary}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={buildWhatsAppUrl(msg)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" /> WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            </div>
          </Panel>

          {booking.canCancel ? (
            <Panel aria-labelledby="cancel-title" className="grid gap-3">
              <h3 id="cancel-title" className="font-semibold text-walnut">
                Cancel this booking
              </h3>
              {confirming ? (
                <div role="group" aria-label={`Confirm cancelling booking ${booking.reference}`} className="grid gap-3">
                  <p className="text-walnut">Cancel booking {booking.reference}? This cannot be undone online.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="destructive" onClick={() => void cancel()} disabled={busy}>
                      {busy ? 'Cancelling…' : 'Yes, cancel'}
                    </Button>
                    <Button ref={keepRef} variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                      Keep booking
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">You can cancel online until check-in. Ask the hotel about any charges or refunds.</p>
                  <div>
                    <Button variant="outline" onClick={() => setConfirming(true)}>
                      Cancel booking
                    </Button>
                  </div>
                </>
              )}
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
