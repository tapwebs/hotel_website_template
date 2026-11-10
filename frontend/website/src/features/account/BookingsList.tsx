import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownUp, BedDouble, CalendarCheck, CalendarClock, CalendarDays, CalendarX, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBooking } from '@/components/booking/booking-context'
import { cn } from '@/lib/utils'
import { listMyBookings, parseBookingsParams, toBookingsSearch } from './accountApi'
import { bookingFilters, filterLabel, type BookingFilter } from './accountTypes'
import { BookingCard } from './BookingCard'
import { useAccountResource } from './useAccountData'
import { ErrorPanel, Panel } from './ui'

const filterIcon: Record<BookingFilter, typeof CalendarDays> = {
  all: CalendarDays,
  upcoming: CalendarClock,
  past: CalendarCheck,
  cancelled: CalendarX,
}
const emptyCopy: Record<Exclude<BookingFilter, 'all'>, string> = {
  upcoming: 'No upcoming stays. Plan one and it will appear here.',
  past: 'Completed stays will be listed here after check-out.',
  cancelled: 'Nothing cancelled. Good news.',
}

/** Placeholder shaped like a booking card, so the list does not jump when it loads. */
const CardSkeleton = () => <div className="h-56 animate-pulse rounded-xl border border-border bg-border/40 motion-reduce:animate-none" />

export function BookingsList() {
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => parseBookingsParams(sp), [sp])
  const { openBooking, preloadBooking } = useBooking()
  const [q, setQ] = useState('')
  const [newestFirst, setNewestFirst] = useState(false)
  const res = useAccountResource((signal) => listMyBookings(params, undefined, { signal }), `mybookings:${params.filter}:${params.page}`)
  const data = res.data

  // A page past the end (e.g. after cancelling the last item of a filter) snaps back to the last page.
  useEffect(() => {
    if (res.status === 'ready' && res.data.items.length === 0 && params.page > 1)
      setSp(toBookingsSearch({ ...params, page: res.data.totalPages }), { replace: true })
  }, [res.status, res.data, params, setSp])

  const go = (next: Partial<typeof params>) => setSp(toBookingsSearch({ ...params, ...next }))

  // Search and sort only act on the page that is loaded (the API pages by 10).
  const items = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = (data?.items ?? []).filter((b) => !term || `${b.reference} ${b.room.name} ${b.checkIn} ${b.checkOut}`.toLowerCase().includes(term))
    return [...list].sort((a, b) => (newestFirst ? b.createdAt.localeCompare(a.createdAt) : a.checkIn.localeCompare(b.checkIn)))
  }, [data, q, newestFirst])

  const bookButton = (
    <Button onClick={() => openBooking()} onPointerEnter={preloadBooking} onFocus={preloadBooking} aria-haspopup="dialog">
      <Plus aria-hidden="true" /> New booking
    </Button>
  )

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-h3 text-walnut">My stays</h2>
          <p className="text-sm text-muted-foreground">{data ? `${data.counts.all} ${data.counts.all === 1 ? 'booking' : 'bookings'} in total` : 'Loading…'}</p>
        </div>
        <div className="max-md:hidden">{bookButton}</div>
      </div>

      {/* Equal-width segmented filter: no sideways scrolling on phones, sticks under the header. */}
      <nav aria-label="Filter bookings" className="sticky top-14 z-10 -mx-4 bg-cream/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-0">
        <ul className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-ivory p-1 md:max-w-xl">
          {bookingFilters.map((f) => {
            const active = params.filter === f
            const Icon = filterIcon[f]
            return (
              <li key={f}>
                <Link
                  to={{ search: toBookingsSearch({ filter: f, page: 1 }).toString() }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'grid min-h-12 place-content-center justify-items-center gap-0.5 rounded-lg px-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 md:grid-flow-col md:gap-2 md:text-sm',
                    active ? 'bg-burgundy text-ivory shadow-sm' : 'text-walnut hover:bg-gold-soft/40',
                  )}
                >
                  <Icon className="size-4 max-md:hidden" aria-hidden="true" />
                  <span className="text-base leading-none tabular-nums md:hidden">{data ? data.counts[f] : '–'}</span>
                  <span>{filterLabel[f]}</span>
                  {data ? <span className="tabular-nums opacity-80 max-md:hidden">({data.counts[f]})</span> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {data && data.items.length > 0 ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reference, room or date"
              aria-label="Search the bookings on this page"
              className="h-11 w-full rounded-md border border-border bg-ivory pr-10 pl-9 text-sm text-walnut outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {q ? (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground">
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <Button variant="outline" size="icon" onClick={() => setNewestFirst((v) => !v)} aria-pressed={newestFirst} aria-label={newestFirst ? 'Sorted by newest booking. Sort by check-in date' : 'Sorted by check-in date. Sort by newest booking'} title={newestFirst ? 'Newest booking first' : 'Check-in date first'}>
            <ArrowDownUp aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {res.status === 'loading' && !data ? (
        <div role="status" aria-busy="true" className="grid gap-4">
          <span className="sr-only">Loading your bookings…</span>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}
      {res.status === 'error' ? <ErrorPanel error={res.error} onRetry={res.reload} /> : null}

      {data ? (
        <div aria-busy={res.status === 'loading'} className={cn('grid gap-4', res.status === 'loading' && 'opacity-60')}>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {data.total === 0 ? '' : q ? `${items.length} of ${data.items.length} shown on this page` : `Showing ${data.items.length} of ${data.total}`}
          </p>
          {items.length > 0 ? (
            <ul className="grid gap-4 xl:grid-cols-2">
              {items.map((b) => (
                <li key={b.id}>
                  <BookingCard booking={b} />
                </li>
              ))}
            </ul>
          ) : data.items.length > 0 ? (
            <Panel className="grid justify-items-center gap-3 py-8 text-center">
              <Search className="size-8 text-burgundy/60" aria-hidden="true" />
              <p className="font-semibold text-walnut">No match for “{q}”</p>
              <Button variant="outline" onClick={() => setQ('')}>
                Clear search
              </Button>
            </Panel>
          ) : data.counts.all === 0 ? (
            <Panel className="grid justify-items-center gap-3 py-10 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-gold-soft/60 text-burgundy">
                <BedDouble className="size-8" aria-hidden="true" />
              </span>
              <h3 className="font-display text-xl text-burgundy">No stays yet</h3>
              <p className="max-w-sm text-muted-foreground">Reserve a room and it shows up here with its reference, status and quick actions.</p>
              <Button onClick={() => openBooking()} onPointerEnter={preloadBooking} onFocus={preloadBooking} aria-haspopup="dialog">
                <CalendarDays aria-hidden="true" /> Plan your stay
              </Button>
            </Panel>
          ) : (
            <Panel className="grid justify-items-center gap-3 py-8 text-center">
              <h3 className="font-display text-xl text-burgundy">No {filterLabel[params.filter].toLowerCase()} bookings</h3>
              {params.filter !== 'all' ? <p className="text-muted-foreground">{emptyCopy[params.filter]}</p> : null}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => go({ filter: 'all', page: 1 })}>
                  Show all bookings
                </Button>
                {params.filter === 'upcoming' ? bookButton : null}
              </div>
            </Panel>
          )}
          {data.totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
              <Button variant="outline" disabled={data.page <= 1} onClick={() => go({ page: data.page - 1 })}>
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {data.page} of {data.totalPages}
              </span>
              <Button variant="outline" disabled={data.page >= data.totalPages} onClick={() => go({ page: data.page + 1 })}>
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
