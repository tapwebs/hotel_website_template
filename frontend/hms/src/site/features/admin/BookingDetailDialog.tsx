import { useState } from 'react'
import { Button } from '@/site/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/site/components/ui/dialog'
import { Input } from '@/site/components/ui/input'
import { Field, selectClass } from '@/site/components/forms/Field'
import { formatINR } from '@/site/lib/format'
import { formatStay, nightsLabel } from '@/site/features/account/dates'
import { BookingStatusBadge, PaymentBadge } from '@/site/features/account/badges'
import { paymentLabel, paymentStatuses, statusLabel, type BookingStatus, type PaymentStatus } from '@/site/features/account/accountTypes'
import { fieldIssues } from '@/site/features/account/accountApi'
import { nextStatuses, updateAdminBooking } from './bookingsApi'
import { GuestContact } from './GuestContact'
import { fmtDateTime } from './format'
import type { AdminBooking, AdminError, BookingPatch } from './adminTypes'

interface Props {
  booking: AdminBooking | null
  onClose: () => void
  onUpdated: (b: AdminBooking) => void
  /** Called for 401/403 so the dashboard can re-check the session. */
  onAuthError: (e: AdminError) => void
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 break-words text-walnut">{children}</dd>
    </div>
  )
}

export function BookingDetailDialog({ booking, ...rest }: Props) {
  return (
    <Dialog open={booking !== null} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {/* Re-mount per booking so draft state never leaks between bookings. */}
        {booking ? <Body key={booking.id} booking={booking} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ booking: b, onUpdated, onAuthError }: Omit<Props, 'booking' | 'onClose'> & { booking: AdminBooking }) {
  const [status, setStatus] = useState<BookingStatus>(b.status)
  const [payment, setPayment] = useState<PaymentStatus>(b.paymentStatus)
  const [hms, setHms] = useState(b.externalHmsBookingId ?? '')
  const [pos, setPos] = useState(b.externalPosFolioId ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const patch: BookingPatch = {}
  if (status !== b.status) patch.status = status
  if (payment !== b.paymentStatus) patch.paymentStatus = payment
  if (hms.trim() !== (b.externalHmsBookingId ?? '')) patch.externalHmsBookingId = hms.trim() || null
  if (pos.trim() !== (b.externalPosFolioId ?? '')) patch.externalPosFolioId = pos.trim() || null
  const dirty = Object.keys(patch).length > 0

  const save = async () => {
    setBusy(true)
    setMessage(null)
    setFieldErrors({})
    const r = await updateAdminBooking(b.id, patch)
    setBusy(false)
    if (r.ok) {
      setConfirmCancel(false)
      setStatus(r.data.status)
      setPayment(r.data.paymentStatus)
      setHms(r.data.externalHmsBookingId ?? '')
      setPos(r.data.externalPosFolioId ?? '')
      setMessage({ kind: 'ok', text: 'Booking updated.' })
      onUpdated(r.data)
      return
    }
    setConfirmCancel(false)
    setFieldErrors(fieldIssues(r.error))
    setMessage({ kind: 'error', text: r.error.message })
    if (r.error.kind === 'unauthenticated' || r.error.kind === 'forbidden') onAuthError(r.error)
  }
  const onSave = () => (patch.status === 'cancelled' ? setConfirmCancel(true) : void save())

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-mono text-2xl tracking-wider text-burgundy-deep">{b.reference}</DialogTitle>
        <DialogDescription>
          {b.guest ? `${b.guest.name} · ${b.guest.email}` : 'Deleted account (personal details removed)'}
        </DialogDescription>
        <div className="flex flex-wrap gap-2">
          <BookingStatusBadge status={b.status} />
          <PaymentBadge status={b.paymentStatus} />
        </div>
        {b.guest?.phone ? (
          <div className="flex flex-wrap gap-2">
            <GuestContact booking={b} labels />
          </div>
        ) : null}
      </DialogHeader>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Guest phone">{b.guest?.phone ?? '—'}</Detail>
        <Detail label="Room">
          {b.room.name} × {b.roomCount}
        </Detail>
        <Detail label="Stay">
          {formatStay(b.checkIn)} to {formatStay(b.checkOut)} ({nightsLabel(b.nights)})
        </Detail>
        <Detail label="Guests">
          {b.adults} {b.adults === 1 ? 'adult' : 'adults'}, {b.children} {b.children === 1 ? 'child' : 'children'}
          {b.extraBed ? ', extra bed requested' : ''}
        </Detail>
        <Detail label="Rate / total">
          {formatINR(b.ratePerNight)} per night · {formatINR(b.totalAmount)} (excl. taxes and extra bed)
        </Detail>
        <Detail label="Requested">{fmtDateTime(b.createdAt, '—')}</Detail>
        <Detail label="Special requests">{b.specialRequests ?? '—'}</Detail>
        {b.cancelledAt ? <Detail label="Cancelled">{fmtDateTime(b.cancelledAt, '—')}</Detail> : null}
      </dl>

      <div className="grid gap-4 border-t border-gold/30 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="bd-status"
            label="Status"
            hint={nextStatuses[b.status].length === 1 ? 'This status is final.' : undefined}
            error={fieldErrors.status}
          >
            {(aria) => (
              <select
                {...aria}
                className={selectClass}
                value={status}
                disabled={busy || nextStatuses[b.status].length === 1}
                onChange={(e) => {
                  setStatus(e.target.value as BookingStatus)
                  setConfirmCancel(false)
                }}
              >
                {nextStatuses[b.status].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="bd-pay" label="Payment status" error={fieldErrors.paymentStatus}>
            {(aria) => (
              <select
                {...aria}
                className={selectClass}
                value={payment}
                disabled={busy}
                onChange={(e) => setPayment(e.target.value as PaymentStatus)}
              >
                {paymentStatuses.map((s) => (
                  <option key={s} value={s}>
                    {paymentLabel[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <details className="sm:col-span-2" open={Boolean(b.externalHmsBookingId || b.externalPosFolioId)}>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-burgundy underline underline-offset-4">Advanced: system ids</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field id="bd-hms" label="HMS booking id" optional error={fieldErrors.externalHmsBookingId}>
            {(aria) => <Input {...aria} value={hms} maxLength={100} disabled={busy} onChange={(e) => setHms(e.target.value)} autoComplete="off" />}
          </Field>
          <Field id="bd-pos" label="POS folio id" optional error={fieldErrors.externalPosFolioId}>
            {(aria) => <Input {...aria} value={pos} maxLength={100} disabled={busy} onChange={(e) => setPos(e.target.value)} autoComplete="off" />}
          </Field>
            </div>
          </details>
        </div>

        {confirmCancel ? (
          <div role="group" aria-label="Confirm cancellation" className="grid gap-3 rounded-md border border-destructive/40 bg-cream/60 p-3">
            <p className="text-sm text-walnut">Cancel booking {b.reference}? A cancelled booking cannot be reopened.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={busy} onClick={() => void save()}>
                Yes, cancel booking
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(false)}>
                Keep booking
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button disabled={busy || !dirty} onClick={onSave}>
              Save changes
            </Button>
          </div>
        )}

        <div
          aria-live="polite"
          role={message?.kind === 'error' ? 'alert' : 'status'}
          className={message?.kind === 'error' ? 'text-sm font-medium text-destructive' : 'text-sm font-medium text-walnut'}
        >
          {message?.text}
        </div>
      </div>
    </>
  )
}
