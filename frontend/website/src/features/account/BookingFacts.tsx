import { hotel } from '@/data/hotel'
import { fmtDateTime } from '@/features/admin/format'
import { formatINR } from '@/lib/format'
import { formatStay, nightsLabel, roomsLabel } from './dates'
import { PaymentBadge, BookingStatusBadge } from './badges'
import type { Booking } from './accountTypes'
/** Read-only summary of a booking, as a description list. Used by the detail page and the confirmation page. */
export function BookingFacts({ booking: b }: { booking: Booking }) {
  const rows: [string, React.ReactNode][] = [
    ['Reference', <span key="r" className="font-mono font-semibold tracking-wider select-all">{b.reference}</span>],
    ['Status', <BookingStatusBadge key="s" status={b.status} />],
    ['Room', `${b.room.name} × ${roomsLabel(b.roomCount)}`],
    ['Check-in', `${formatStay(b.checkIn)}, from ${hotel.checkIn}`],
    ['Check-out', formatStay(b.checkOut)],
    ['Length of stay', nightsLabel(b.nights)],
    ['Guests', `${b.adults} ${b.adults === 1 ? 'adult' : 'adults'}${b.children ? `, ${b.children} ${b.children === 1 ? 'child' : 'children'}` : ''}`],
    ['Extra bed', b.extraBed ? 'Requested (charge shared by the hotel when it confirms)' : 'No'],
    ['Special requests', b.specialRequests || 'None'],
    ['Rate per night', formatINR(b.ratePerNight)],
    [
      'Total',
      <span key="t">
        <span className="font-semibold tabular-nums">{formatINR(b.totalAmount)}</span>
        <span className="block text-sm text-muted-foreground">Room charge, excluding taxes and extra bed</span>
      </span>,
    ],
    ['Payment', <PaymentBadge key="p" status={b.paymentStatus} />],
    ['Requested on', fmtDateTime(b.createdAt)],
  ]
  if (b.cancelledAt) rows.push(['Cancelled on', fmtDateTime(b.cancelledAt)])
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 sm:contents">
          <dt className="text-sm font-semibold text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words text-walnut">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
