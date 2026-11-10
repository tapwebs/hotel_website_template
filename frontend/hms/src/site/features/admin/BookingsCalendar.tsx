import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { BookingStatusBadge } from '@/site/features/account/badges'
import { addDaysYmd } from './calendarMath'
import { cn } from '@/site/lib/utils'
import { istDate, listAdminBookings } from './bookingsApi'
import { useResource } from './useAdminData'
import type { AdminBooking } from './adminTypes'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthTitle = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shiftMonth = (ym: string, n: number) => {
  const d = new Date(`${ym}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 7)
}

/** Loads every non-cancelled booking whose stay touches the month (stays are at most 30 nights, so look 30 days back). */
function useMonthBookings(ym: string) {
  const from = addDaysYmd(`${ym}-01`, -31)
  const to = addDaysYmd(`${shiftMonth(ym, 1)}-01`, -1)
  return useResource<AdminBooking[]>(async (signal) => {
    const out: AdminBooking[] = []
    for (let page = 1; page <= 20; page++) {
      const r = await listAdminBookings({ page, q: '', status: '', paymentStatus: '', range: { from, to } }, { signal })
      if (!r.ok) return r
      out.push(...r.data.items)
      if (page >= r.data.totalPages) break
    }
    return { ok: true, data: out.filter((b) => b.status !== 'cancelled') }
  }, `calendar:${ym}`)
}

/** Month grid: rooms in use each night, with arrivals and departures. Click a day to list its bookings. */
export function BookingsCalendar({ onOpen }: { onOpen: (b: AdminBooking) => void }) {
  const today = istDate(0)
  const [ym, setYm] = useState(today.slice(0, 7))
  const [day, setDay] = useState(today)
  const res = useMonthBookings(ym)

  const days = useMemo(() => {
    const first = new Date(`${ym}-01T00:00:00Z`)
    const lead = (first.getUTCDay() + 6) % 7 // Monday first
    const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
    return [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)]
  }, [ym])
  const list = res.data ?? []
  const info = (d: string) => {
    const stay = list.filter((b) => b.checkIn <= d && d < b.checkOut)
    return {
      rooms: stay.reduce((n, b) => n + b.roomCount, 0),
      arrivals: list.filter((b) => b.checkIn === d).length,
      departures: list.filter((b) => b.checkOut === d).length,
    }
  }
  const sel = list.filter((b) => b.checkIn <= day && day <= b.checkOut)
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="icon-sm" onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Previous month">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl text-burgundy-deep" aria-live="polite">
            {monthTitle(ym)}
          </h3>
          {ym !== today.slice(0, 7) && (
            <Button variant="outline" size="sm" onClick={() => (setYm(today.slice(0, 7)), setDay(today))}>
              Today
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon-sm" onClick={() => setYm(shiftMonth(ym, 1))} aria-label="Next month">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <div className={cn('rounded-2xl border border-border bg-ivory p-2 sm:p-3', res.status === 'loading' && 'opacity-60')} aria-busy={res.status === 'loading'}>
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-semibold text-muted-foreground uppercase sm:text-xs">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <span key={`b${i}`} />
            const x = info(d)
            const on = d === day
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                aria-pressed={on}
                aria-label={`${d}: ${x.rooms} rooms in use, ${x.arrivals} arriving, ${x.departures} leaving`}
                className={cn(
                  'grid min-h-14 content-start gap-0.5 rounded-lg border p-1 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-20 sm:p-2',
                  on ? 'border-burgundy bg-gold-soft/40' : 'border-transparent hover:bg-gold-soft/20',
                  d === today && 'ring-1 ring-gold',
                )}
              >
                <span className="text-xs font-semibold text-walnut sm:text-sm">{Number(d.slice(8))}</span>
                {x.rooms > 0 && <span className="w-fit rounded-full bg-burgundy px-1.5 text-[10px] font-bold text-ivory sm:text-xs">{x.rooms}</span>}
                <span className="hidden text-[11px] text-muted-foreground sm:block">
                  {x.arrivals > 0 && `↓${x.arrivals} `}
                  {x.departures > 0 && `↑${x.departures}`}
                </span>
              </button>
            )
          })}
        </div>
        <p className="px-1 pt-2 text-xs text-muted-foreground">Number = rooms in use that night. ↓ arriving, ↑ leaving. Cancelled bookings are left out.</p>
      </div>
      <section aria-labelledby="day-list" className="grid gap-2">
        <h3 id="day-list" className="font-semibold text-walnut">
          {new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
        </h3>
        {sel.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings on this day.</p>
        ) : (
          <ul className="grid gap-2">
            {sel.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ivory p-3">
                <span className="min-w-0">
                  <span className="block font-mono font-semibold tracking-wider text-burgundy">{b.reference}</span>
                  <span className="block truncate text-sm text-walnut">
                    {b.guest?.name ?? 'Deleted account'} · {b.room.name} × {b.roomCount}
                  </span>
                  <span className="text-xs text-muted-foreground">{b.checkIn === day ? 'Arrives' : b.checkOut === day ? 'Leaves' : 'Staying'}</span>
                </span>
                <span className="flex items-center gap-2">
                  <BookingStatusBadge status={b.status} />
                  <Button variant="outline" size="sm" onClick={() => onOpen(b)}>
                    View
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
