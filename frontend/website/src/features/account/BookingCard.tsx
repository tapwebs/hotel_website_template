import { Link } from 'react-router'
import { CalendarPlus, ChevronRight, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hotel } from '@/data/hotel'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/format'
import { nightsLabel, parseYmd, roomsLabel } from './dates'
import { BookingStatusBadge, PaymentBadge } from './badges'
import { countdownLabel, downloadIcs } from './calendar'
import type { Booking } from './accountTypes'

const stripe: Record<Booking['status'], string> = {
  pending: 'border-l-gold',
  confirmed: 'border-l-burgundy',
  cancelled: 'border-l-destructive',
  completed: 'border-l-border',
}

/** "19" over "OCT" for a YYYY-MM-DD date. */
function DateBlock({ ymd, caption }: { ymd: string; caption: string }) {
  const d = parseYmd(ymd)
  return (
    <div className="grid min-w-14 justify-items-center rounded-md bg-cream px-2 py-1.5 text-center leading-tight">
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{caption}</span>
      <span className="font-display text-2xl text-burgundy tabular-nums">{d ? d.getDate() : '–'}</span>
      <span className="text-[11px] font-semibold text-walnut uppercase">{d ? d.toLocaleDateString('en-IN', { month: 'short' }) : ''}</span>
    </div>
  )
}

/** One booking in a list: date blocks, room, total, countdown, and the main actions. */
export function BookingCard({ booking: b, headingLevel: H = 'h3' }: { booking: Booking; headingLevel?: 'h2' | 'h3' }) {
  const live = b.status === 'pending' || b.status === 'confirmed'
  const inactive = b.status === 'cancelled'
  return (
    <article className={cn('grid gap-4 rounded-xl border border-l-4 border-border bg-ivory p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5', stripe[b.status], inactive && 'opacity-80')}>
      <div className="flex items-start gap-3">
        <DateBlock ymd={b.checkIn} caption="In" />
        <div className="min-w-0 flex-1">
          <H className="font-display text-lg leading-snug text-walnut">
            {b.room.name} <span className="text-muted-foreground">× {roomsLabel(b.roomCount)}</span>
          </H>
          <p className="mt-0.5 font-mono text-sm tracking-wider text-burgundy">{b.reference}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <BookingStatusBadge status={b.status} />
            <PaymentBadge status={b.paymentStatus} />
          </div>
        </div>
        <DateBlock ymd={b.checkOut} caption="Out" />
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-walnut">
        <span>{nightsLabel(b.nights)}</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          {b.adults} {b.adults === 1 ? 'adult' : 'adults'}
          {b.children ? `, ${b.children} ${b.children === 1 ? 'child' : 'children'}` : ''}
        </span>
        {live ? <span className="rounded-full bg-gold-soft/60 px-2.5 py-0.5 text-xs font-semibold text-burgundy">{countdownLabel(b)}</span> : null}
      </p>

      <div className="flex items-end justify-between gap-3 border-t border-dashed border-border pt-3">
        <p>
          <span className="block text-xs text-muted-foreground">Room charge</span>
          <span className="text-lg font-semibold text-walnut tabular-nums">{formatINR(b.totalAmount)}</span>
        </p>
        <div className="flex items-center gap-2">
          {live ? (
            <Button variant="outline" size="icon" onClick={() => downloadIcs(b)} aria-label={`Add booking ${b.reference} to calendar`} title="Add to calendar">
              <CalendarPlus aria-hidden="true" />
            </Button>
          ) : null}
          <Button asChild variant="outline" size="icon" title="Directions">
            <a href={hotel.directionsUrl} target="_blank" rel="noopener noreferrer" aria-label="Directions to the hotel (opens in a new tab)">
              <MapPin aria-hidden="true" />
            </a>
          </Button>
          <Button asChild>
            <Link to={`/account/bookings/${encodeURIComponent(b.id)}`}>
              Details<span className="sr-only"> for {b.reference}</span> <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
