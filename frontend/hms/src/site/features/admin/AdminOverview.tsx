import { Link } from 'react-router-dom'
import { ArrowRight, BedDouble, CalendarCheck, CalendarClock, Clock, LogIn, LogOut, QrCode, Users } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { BookingStatusBadge } from '@/site/features/account/badges'
import { formatStay, nightsLabel } from '@/site/features/account/dates'
import { statusLabel, type BookingStatus } from '@/site/features/account/accountTypes'
import { useAuth } from '@/site/features/auth/auth-context'
import { formatINR } from '@/site/lib/format'
import { cn } from '@/site/lib/utils'
import { api as qrApi } from '@/site/features/qrhub/lib/api'
import { istDay } from '@/site/features/qrhub/lib/dates'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { listAdminBookings } from './bookingsApi'
import { useWebsite } from './AdminShell'
import { fmtNumber } from './format'
import { Sparkline } from './Sparkline'
import { useResource } from './useAdminData'
import type { AdminBookingList } from './adminTypes'

const card = 'rounded-2xl border border-border bg-ivory p-4 shadow-xs sm:p-5'

function Kpi({
  label,
  value,
  note,
  icon: Icon,
  to,
  accent,
}: {
  label: string
  value: number
  note?: string
  icon: typeof Users
  to: string
  accent?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        card,
        'group grid gap-1 outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
        accent && 'border-gold bg-gold-soft/30',
      )}
    >
      <span className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
        {label}
        <Icon className="size-4 text-burgundy" aria-hidden="true" />
      </span>
      <span className="font-display text-4xl leading-none lining-nums text-burgundy-deep tabular-nums">{fmtNumber(value)}</span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </Link>
  )
}

const barColor: Record<BookingStatus, string> = {
  pending: 'bg-gold',
  confirmed: 'bg-burgundy',
  completed: 'bg-walnut/60',
  cancelled: 'bg-destructive/70',
}

/** QR scans, visits and clicks for the last 30 days, with the top spots. Admin only (the data comes from QR Hub). */
function QrSummary() {
  const qr = useLoad(() => qrApi.analytics({ from: istDay(29), to: istDay(0) }), [])
  return (
    <section aria-labelledby="qr-card" className={card}>
      <div className="flex items-center justify-between">
        <h3 id="qr-card" className="flex items-center gap-2 font-semibold text-walnut">
          <QrCode className="size-4 text-burgundy" aria-hidden="true" /> QR codes, last 30 days
        </h3>
        <Link
          to="/app/qr/analytics"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-burgundy hover:underline"
        >
          Analytics <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {qr.data ? (
        <div className="mt-2 grid gap-4 sm:grid-cols-[auto_1fr]">
          <dl className="grid grid-cols-3 gap-4 sm:grid-cols-1 sm:gap-2">
            {(
              [
                ['Scans', qr.data.totals.scans],
                ['Visits', qr.data.totals.visits],
                ['Clicks', qr.data.totals.clicks],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground uppercase">{k}</dt>
                <dd className="font-display text-2xl text-burgundy-deep tabular-nums">{fmtNumber(v)}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Top spots</p>
            {qr.data.byPlacement.length === 0 ? (
              <p className="text-sm text-muted-foreground">No placement scans yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {[...qr.data.byPlacement]
                  .sort((a, b) => b.scans - a.scans)
                  .slice(0, 3)
                  .map((p) => (
                    <li key={p.code} className="flex justify-between gap-3 py-1.5">
                      <span className="truncate">{p.label}</span>
                      <span className="font-semibold tabular-nums">{p.scans}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">{qr.error ?? 'Loading…'}</p>
      )}
    </section>
  )
}

/** `embedded`: shown inside the hotel dashboard as its Website & QR section (no greeting). */
export function AdminOverview({ embedded = false }: { embedded?: boolean }) {
  const { stats } = useWebsite()
  const { auth } = useAuth()
  const isAdmin = auth.status === 'authenticated' && auth.user.role === 'admin'
  const first = (auth.status === 'authenticated' ? auth.user.name : '').trim().split(/\s+/)[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const pending = useResource<AdminBookingList>(
    (signal) => listAdminBookings({ page: 1, q: '', status: 'pending', paymentStatus: '' }, { signal }),
    'ov-pending',
  )
  const arrivals = useResource<AdminBookingList>(
    (signal) => listAdminBookings({ page: 1, q: '', status: '', paymentStatus: '', desk: 'arrivals_today' }, { signal }),
    'ov-arrivals',
  )
  const departures = useResource<AdminBookingList>(
    (signal) => listAdminBookings({ page: 1, q: '', status: '', paymentStatus: '', desk: 'departures_today' }, { signal }),
    'ov-departures',
  )
  const inHouse = useResource<AdminBookingList>(
    (signal) => listAdminBookings({ page: 1, q: '', status: '', paymentStatus: '', desk: 'inhouse' }, { signal }),
    'ov-inhouse',
  )

  const s = stats.data
  if (!s) {
    return stats.status === 'error' ? (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-ivory p-5 text-destructive"
      >
        <p className="font-medium">Could not load the dashboard. {stats.error.message}</p>
        <Button variant="outline" onClick={stats.reload}>
          Retry
        </Button>
      </div>
    ) : (
      <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <span className="sr-only">Loading dashboard…</span>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-border/50 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  const { bookings, totals } = s
  const total = Math.max(1, bookings.total)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className="font-display text-h3 text-walnut">Website &amp; QR</h2>
          ) : (
            <h2 className="font-display text-h3 text-walnut">
              {greeting}, {first}
            </h2>
          )}
          <p className="text-sm text-muted-foreground">
            {bookings.byStatus.pending > 0
              ? `${bookings.byStatus.pending} website booking ${bookings.byStatus.pending === 1 ? 'request needs' : 'requests need'} confirming.`
              : 'No website requests are waiting.'}
          </p>
        </div>
        <Button asChild>
          <Link to="/app/reservations?source=website&status=PENDING">Review requests</Link>
        </Button>
      </div>
      <section aria-labelledby="today" className="grid gap-3">
        <h3 id="today" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {embedded ? 'Website guests today' : 'Today at the hotel'}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Arriving', arrivals.data?.total, LogIn, 'arrivals_today'],
              ['In house', inHouse.data?.total, BedDouble, 'inhouse'],
              ['Departing', departures.data?.total, LogOut, 'departures_today'],
            ] as const
          ).map(([label, n, Icon, desk]) => (
            <Link
              key={desk}
              to={`/app/reservations?source=website&desk=${desk}`}
              className={cn(
                card,
                'grid gap-1 outline-none transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
              )}
            >
              <span className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                {label}
                <Icon className="size-4 text-burgundy" aria-hidden="true" />
              </span>
              <span className="font-display text-4xl leading-none lining-nums text-burgundy-deep tabular-nums">{n ?? '–'}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Awaiting confirmation"
          value={bookings.byStatus.pending}
          icon={Clock}
          to="/app/reservations?source=website&status=pending"
          accent={bookings.byStatus.pending > 0}
        />
        <Kpi label="Upcoming stays" value={bookings.upcoming} icon={CalendarClock} to="/app/reservations?source=website&status=confirmed" />
        <Kpi
          label="New bookings, 7 days"
          value={bookings.createdLast7Days}
          note={`${fmtNumber(bookings.createdLast30Days)} in 30 days`}
          icon={CalendarCheck}
          to="/app/reservations?source=website"
        />
        <Kpi
          label="Total users"
          value={totals.users}
          note={`${fmtNumber(totals.active)} active · ${fmtNumber(totals.disabled)} disabled`}
          icon={Users}
          to={isAdmin ? '/app/staff/website' : '/app/reservations?source=website'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="status-mix" className={card}>
          <h3 id="status-mix" className="font-semibold text-walnut">
            Bookings by status
          </h3>
          <ul className="mt-3 grid gap-3">
            {(Object.keys(bookings.byStatus) as BookingStatus[]).map((k) => {
              const n = bookings.byStatus[k]
              return (
                <li key={k}>
                  <Link
                    to={`/app/reservations?source=website&status=${k}`}
                    className="grid gap-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex justify-between text-sm text-walnut">
                      {statusLabel[k]}
                      <span className="font-semibold tabular-nums">{fmtNumber(n)}</span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-border">
                      <span
                        className={cn('block h-full rounded-full', barColor[k])}
                        style={{ width: `${Math.round((n / total) * 100)}%` }}
                      />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
        <Sparkline days={s.signupsByDay} />
      </div>

      <div className="grid gap-4">
        <section aria-labelledby="pending-q" className={card}>
          <div className="flex items-center justify-between">
            <h3 id="pending-q" className="font-semibold text-walnut">
              Needs confirmation
            </h3>
            <Link
              to="/app/reservations?source=website&status=pending"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-burgundy hover:underline"
            >
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          {pending.data && pending.data.items.length > 0 ? (
            <ul className="mt-1 divide-y divide-border">
              {pending.data.items.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <Link
                    to={`/app/reservations?source=website&q=${encodeURIComponent(b.reference)}`}
                    className="grid gap-0.5 py-3 outline-none hover:bg-gold-soft/20 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wider text-burgundy">{b.reference}</span>
                      <BookingStatusBadge status={b.status} />
                    </span>
                    <span className="text-sm text-walnut">
                      {b.room.name} × {b.roomCount} · {formatStay(b.checkIn)} · {nightsLabel(b.nights)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatINR(b.totalAmount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {pending.status === 'loading' ? 'Loading…' : 'No requests are waiting. Nice work.'}
            </p>
          )}
        </section>
      </div>

      {isAdmin && <QrSummary />}
    </div>
  )
}
