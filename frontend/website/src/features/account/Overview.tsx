import { Link } from 'react-router'
import { BedDouble, CalendarDays, ChevronRight, CircleHelp, KeyRound, LogOut, MapPin, MessageCircle, Phone, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBooking } from '@/components/booking/booking-context'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { hotel } from '@/data/hotel'
import { useAuth } from '@/features/auth/auth-context'
import { getProfile, listMyBookings } from './accountApi'
import type { Profile } from './accountTypes'
import { BookingActions } from './BookingActions'
import { BookingCard } from './BookingCard'
import { countdownLabel } from './calendar'
import { formatStay, nightsLabel } from './dates'
import { useAccountResource } from './useAccountData'
import { ErrorPanel, Panel, Skeleton } from './ui'

const h3 = 'text-sm font-semibold tracking-wide text-muted-foreground uppercase'

/** Share of useful profile fields filled in, with the first missing one to nudge towards. */
function completeness(p: Profile) {
  const checks: [string, boolean][] = [
    ['Add your mobile number', !!p.phone],
    ['Add your address', !!(p.addressLine1 && p.city)],
    ['Choose a bed preference', p.preferences.bed !== 'no_preference'],
    ['Choose a meal preference', p.preferences.dietary !== 'no_preference'],
  ]
  const done = checks.filter(([, ok]) => ok).length + 1 // name and email always exist
  return { pct: Math.round((done / (checks.length + 1)) * 100), next: checks.find(([, ok]) => !ok)?.[0] }
}

export function Overview() {
  const { auth, logout } = useAuth()
  const { openBooking, preloadBooking } = useBooking()
  const name = auth.status === 'authenticated' ? auth.user.name : ''
  const first = name.trim().split(/\s+/)[0] || 'there'
  const res = useAccountResource((signal) => listMyBookings({ filter: 'all', page: 1 }, 4, { signal }), 'overview')
  const prof = useAccountResource((signal) => getProfile({ signal }), 'overview-profile')

  if (res.status === 'loading' && !res.data) return <Skeleton rows={3} label="Loading your account…" />
  if (res.status === 'error' && !res.data) return <ErrorPanel error={res.error} onRetry={res.reload} />
  const data = res.data!
  const live = data.items.filter((b) => b.status === 'pending' || b.status === 'confirmed')
  const next = [...live].sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
  const recent = data.items.filter((b) => b.id !== next?.id).slice(0, 3)
  const pc = prof.data ? completeness(prof.data) : null

  const tiles = [
    { icon: CalendarDays, label: 'My stays', to: '/account/bookings' },
    { icon: MapPin, label: 'Directions', href: hotel.directionsUrl },
    { icon: Phone, label: 'Call hotel', href: hotel.phoneHref },
    { icon: MessageCircle, label: 'WhatsApp', href: buildWhatsAppUrl('Hello, I have a question about Hotel Dream Heaven’s.') },
    { icon: UserRound, label: 'Profile', to: '/account/profile' },
    { icon: CircleHelp, label: 'Help', to: '/account/help' },
  ]
  const tile =
    'grid justify-items-center gap-1.5 rounded-md border border-border bg-ivory px-2 py-3.5 text-center text-xs font-semibold text-walnut outline-none transition-transform active:scale-95 hover:border-burgundy focus-visible:ring-[3px] focus-visible:ring-ring/50'

  return (
    <div className="grid gap-6">
      <section aria-labelledby="hero" className="on-dark grid gap-4 rounded-2xl bg-[linear-gradient(150deg,var(--color-burgundy-deep),var(--color-walnut))] p-5 text-cream sm:p-6">
        <div>
          <h2 id="hero" className="font-display text-h3">
            Welcome, {first}
          </h2>
          <p className="text-sm text-cream/80">{next ? countdownLabel(next) : 'Ready for your next stay?'}</p>
        </div>
        {next ? (
          <div className="grid gap-1 rounded-md bg-cream/10 p-4">
            <p className="text-xs font-semibold tracking-wide uppercase text-cream/70">Next stay · {next.reference}</p>
            <p className="font-display text-xl">{next.room.name}</p>
            <p className="text-sm">
              {formatStay(next.checkIn)} to {formatStay(next.checkOut)} · {nightsLabel(next.nights)}
            </p>
            <Button asChild variant="gold" className="mt-2 w-fit">
              <Link to={`/account/bookings/${encodeURIComponent(next.id)}`}>
                View booking <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : (
          <div>
            <Button onClick={() => openBooking()} onPointerEnter={preloadBooking} onFocus={preloadBooking} aria-haspopup="dialog" variant="gold">
              <BedDouble aria-hidden="true" /> Book a room
            </Button>
            <p className="mt-2 text-xs text-cream/70">Rooms from ₹{hotel.priceFrom} a night.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="quick" className="grid gap-3">
        <h3 id="quick" className={h3}>
          Quick actions
        </h3>
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {tiles.map(({ icon: Icon, label, to, href }) => (
            <li key={label}>
              {to ? (
                <Link to={to} className={tile}>
                  <Icon className="size-5 text-burgundy" aria-hidden="true" />
                  {label}
                </Link>
              ) : (
                <a href={href} {...(href!.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={tile}>
                  <Icon className="size-5 text-burgundy" aria-hidden="true" />
                  {label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      {next ? (
        <section aria-labelledby="next-actions" className="grid gap-3">
          <h3 id="next-actions" className={h3}>
            For your next stay
          </h3>
          <Panel>
            <BookingActions booking={next} compact />
          </Panel>
        </section>
      ) : null}

      <section aria-labelledby="your-bookings" className="grid gap-3">
        <h3 id="your-bookings" className={h3}>
          Your bookings
        </h3>
        <ul className="grid grid-cols-3 gap-3">
          {(
            [
              ['Upcoming', data.counts.upcoming, 'upcoming'],
              ['Past', data.counts.past, 'past'],
              ['Cancelled', data.counts.cancelled, 'cancelled'],
            ] as const
          ).map(([label, count, filter]) => (
            <li key={filter}>
              <Link
                to={`/account/bookings?filter=${filter}`}
                className="grid rounded-md border border-border bg-ivory p-3 outline-none hover:border-burgundy focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-4"
              >
                <span className="font-display text-3xl text-burgundy lining-nums tabular-nums">{count}</span>
                <span className="text-sm text-walnut">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 ? (
        <section aria-labelledby="recent" className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 id="recent" className={h3}>
              Recent activity
            </h3>
            <Link to="/account/bookings" className="min-h-11 content-center text-sm font-semibold text-burgundy underline-offset-4 hover:underline">
              See all
            </Link>
          </div>
          <ul className="grid gap-3">
            {recent.map((b) => (
              <li key={b.id}>
                <BookingCard booking={b} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pc && pc.pct < 100 ? (
        <Panel aria-labelledby="completeness" className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="completeness" className="font-semibold text-walnut">
              Profile {pc.pct}% complete
            </h3>
            <Button asChild variant="outline" size="sm">
              <Link to="/account/profile">{pc.next ?? 'Review'}</Link>
            </Button>
          </div>
          <div role="progressbar" aria-label="Profile completeness" aria-valuenow={pc.pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-burgundy transition-[width]" style={{ width: `${pc.pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">A complete profile makes booking and check-in faster.</p>
        </Panel>
      ) : null}

      <section aria-labelledby="more" className="grid gap-3">
        <h3 id="more" className={h3}>
          Account
        </h3>
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-ivory">
          {[
            { icon: UserRound, label: 'Edit profile and preferences', to: '/account/profile' },
            { icon: KeyRound, label: 'Password and security', to: '/account/security' },
            { icon: CircleHelp, label: 'Help and hotel info', to: '/account/help' },
          ].map(({ icon: Icon, label, to }) => (
            <li key={to}>
              <Link to={to} className="flex min-h-12 items-center gap-3 px-4 text-walnut outline-none active:bg-gold-soft/40 hover:bg-gold-soft/30 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <Icon className="size-4 text-burgundy" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => void logout()} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-destructive outline-none active:bg-gold-soft/40 focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </button>
          </li>
        </ul>
      </section>
    </div>
  )
}
