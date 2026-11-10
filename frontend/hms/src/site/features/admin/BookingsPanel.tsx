import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Download, List, Plus } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { Input } from '@/site/components/ui/input'
import { Field, selectClass } from '@/site/components/forms/Field'
import { formatINR } from '@/site/lib/format'
import { formatStay, nightsLabel } from '@/site/features/account/dates'
import { BookingStatusBadge, PaymentBadge } from '@/site/features/account/badges'
import {
  bookingStatuses,
  paymentLabel,
  paymentStatuses,
  statusLabel,
  type BookingStatus,
  type PaymentStatus,
} from '@/site/features/account/accountTypes'
import { cn } from '@/site/lib/utils'
import { BookingDetailDialog } from './BookingDetailDialog'
import {
  DEFAULT_BOOKING_PARAMS,
  DESK_VIEWS,
  buildBookingsQuery,
  hasBookingFilters,
  listAdminBookings,
  updateAdminBooking,
} from './bookingsApi'
import { GuestContact } from './GuestContact'
import { BookingsCalendar } from './BookingsCalendar'
import { NewBookingDialog } from './NewBookingDialog'
import { downloadCsv } from './toolsApi'
import { fmtNumber } from './format'
import { useResource } from './useAdminData'
import type { AdminBooking, AdminBookingList, AdminError, BookingListParams } from './adminTypes'

interface Props {
  /** Called for 401/403 so the dashboard can re-check the session. */
  onAuthError: (e: AdminError) => void
  /** Called after a booking changed so the summary cards can refresh. */
  onChanged: () => void
}

function summaryText(data: AdminBookingList, loading: boolean): string {
  if (loading) return 'Updating…'
  if (data.total === 0) return 'No bookings'
  const first = (data.page - 1) * data.pageSize + 1
  const last = (data.page - 1) * data.pageSize + data.items.length
  return `Showing ${fmtNumber(first)} to ${fmtNumber(last)} of ${fmtNumber(data.total)} bookings`
}

/** Bookings section of the admin dashboard: search, filter, page, and open a booking to update it. */
export function BookingsPanel({ onAuthError, onChanged }: Props) {
  // /admin/bookings?status=pending&q=HDH-... opens pre-filtered (links from the overview).
  const [sp] = useSearchParams()
  const initStatus = sp.get('status') as BookingStatus | null
  const init: BookingListParams = {
    ...DEFAULT_BOOKING_PARAMS,
    q: sp.get('q')?.slice(0, 100) ?? '',
    status: initStatus && bookingStatuses.includes(initStatus) ? initStatus : '',
    desk: DESK_VIEWS.find((d) => d.id === sp.get('desk'))?.id ?? '',
  }
  const [params, setParams] = useState<BookingListParams>(init)
  const [q, setQ] = useState(init.q)
  const [selected, setSelected] = useState<AdminBooking | null>(null)
  const [creating, setCreating] = useState(sp.get('new') === '1')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const bookings = useResource<AdminBookingList>((signal) => listAdminBookings(params, { signal }), `bookings:${JSON.stringify(params)}`)
  const update = useCallback((next: Partial<BookingListParams>) => setParams((p) => ({ ...p, ...next })), [])

  // Debounce typing (300 ms) before it reaches the API.
  useEffect(() => {
    if (q === params.q) return
    const t = setTimeout(() => setParams((p) => ({ ...p, q, page: 1 })), 300)
    return () => clearTimeout(t)
  }, [q, params.q])

  const { data, status } = bookings
  useEffect(() => {
    if (bookings.error && (bookings.error.kind === 'unauthenticated' || bookings.error.kind === 'forbidden')) onAuthError(bookings.error)
  }, [bookings.error, onAuthError])

  const clear = () => {
    setQ('')
    setParams(DEFAULT_BOOKING_PARAMS)
  }
  // One tap: pending -> confirmed without opening the detail dialog.
  const confirmNow = async (b: AdminBooking) => {
    setConfirming(b.id)
    setNotice(null)
    const r = await updateAdminBooking(b.id, { status: 'confirmed' })
    setConfirming(null)
    if (r.ok) {
      setNotice({ kind: 'ok', text: `${b.reference} confirmed.` })
      bookings.reload()
      onChanged()
      return
    }
    if (r.error.kind === 'unauthenticated' || r.error.kind === 'forbidden') return onAuthError(r.error)
    setNotice({ kind: 'error', text: r.error.message })
  }
  const filtered = hasBookingFilters(params)
  const th = 'px-3 py-2 text-left font-semibold'

  return (
    <section aria-labelledby="admin-bookings" className="grid gap-4">
      <h2 id="admin-bookings" className="sr-only">
        Bookings
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Front desk shortcuts"
          className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0', view === 'calendar' && 'hidden')}
        >
          {DESK_VIEWS.map((d) => {
            const on = params.desk === d.id
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => update({ desk: on ? '' : d.id, status: '', page: 1 })}
                className={cn(
                  'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                  on ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-ivory text-walnut hover:border-burgundy',
                )}
              >
                {d.label}
              </button>
            )
          })}
        </div>
        <div role="group" aria-label="View" className="ml-auto flex rounded-lg border bg-background p-0.5">
          {(
            [
              ['list', 'List', List],
              ['calendar', 'Calendar', CalendarDays],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors',
                view === v ? 'bg-burgundy text-ivory' : 'text-walnut hover:bg-gold-soft/40',
              )}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={async () =>
            setNotice(
              (await downloadCsv(`/admin/bookings.csv?${buildBookingsQuery({ ...params, page: 1 })}`, 'bookings.csv'))
                ? { kind: 'error', text: 'Could not export. Please try again.' }
                : { kind: 'ok', text: 'Bookings exported.' },
            )
          }
        >
          <Download aria-hidden="true" /> <span className="max-sm:sr-only">Export</span>
        </Button>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> New booking
        </Button>
      </div>
      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'rounded-md border px-3 py-2 text-sm font-semibold',
            notice.kind === 'error' ? 'border-destructive/40 text-destructive' : 'border-gold bg-gold-soft/30 text-walnut',
          )}
        >
          {notice.text}
        </p>
      )}
      {view === 'calendar' ? (
        <BookingsCalendar onOpen={setSelected} />
      ) : (
        <>
          <form
            role="search"
            aria-label="Filter bookings"
            onSubmit={(e) => e.preventDefault()}
            className="grid gap-4 rounded-2xl border border-border bg-ivory p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field id="ab-q" label="Search">
              {(aria) => (
                <Input
                  {...aria}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  maxLength={100}
                  placeholder="Reference, name, email or phone"
                  autoComplete="off"
                />
              )}
            </Field>
            <Field id="ab-status" label="Status">
              {(aria) => (
                <select
                  {...aria}
                  className={selectClass}
                  value={params.status}
                  onChange={(e) => update({ status: e.target.value as BookingStatus | '', page: 1 })}
                >
                  <option value="">All statuses</option>
                  {bookingStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="ab-pay" label="Payment">
              {(aria) => (
                <select
                  {...aria}
                  className={selectClass}
                  value={params.paymentStatus}
                  onChange={(e) => update({ paymentStatus: e.target.value as PaymentStatus | '', page: 1 })}
                >
                  <option value="">All payments</option>
                  {paymentStatuses.map((s) => (
                    <option key={s} value={s}>
                      {paymentLabel[s]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="outline" disabled={!filtered && !q} onClick={clear}>
                Clear filters
              </Button>
            </div>
          </form>

          {status === 'error' ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-ivory p-5 text-destructive"
            >
              <p className="font-medium">Could not load bookings. {bookings.error.message}</p>
              <Button variant="outline" onClick={bookings.reload}>
                Retry
              </Button>
            </div>
          ) : !data ? (
            <div role="status" aria-busy="true" className="grid gap-2">
              <span className="sr-only">Loading bookings…</span>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-border/50 motion-reduce:animate-none" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {summaryText(data, status === 'loading')}
              </p>
              {data.items.length === 0 && data.total > 0 ? (
                // The list shrank under us (for example the last booking on this page was cancelled).
                <div role="status" className="grid justify-items-start gap-3 rounded-2xl border border-gold/50 bg-ivory p-6">
                  <h3 className="text-h3 text-burgundy">This page is now empty</h3>
                  <Button variant="outline" onClick={() => update({ page: data.totalPages })}>
                    Go to the last page
                  </Button>
                </div>
              ) : data.items.length === 0 ? (
                <div role="status" className="grid justify-items-start gap-3 rounded-2xl border border-gold/50 bg-ivory p-6">
                  <h3 className="text-h3 text-burgundy">{filtered ? 'No bookings match these filters' : 'No bookings yet'}</h3>
                  <p className="text-walnut">
                    {filtered ? 'Try a different search or clear the filters.' : 'Reservation requests from guests will appear here.'}
                  </p>
                  {filtered ? (
                    <Button variant="outline" onClick={clear}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <ul className={cn('grid gap-3 md:hidden', status === 'loading' && 'opacity-60')} aria-label="Bookings">
                    {data.items.map((b) => (
                      <li key={b.id} className="grid gap-3 rounded-xl border border-border bg-ivory p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono font-semibold tracking-wider text-burgundy">{b.reference}</p>
                            <p className="truncate text-sm font-semibold text-walnut">{b.guest?.name ?? 'Deleted account'}</p>
                          </div>
                          <div className="grid justify-items-end gap-1">
                            <BookingStatusBadge status={b.status} />
                            <PaymentBadge status={b.paymentStatus} />
                          </div>
                        </div>
                        <p className="text-sm text-walnut">
                          {b.room.name} × {b.roomCount} · {formatStay(b.checkIn)} · {nightsLabel(b.nights)}
                          <span className="block font-semibold tabular-nums">{formatINR(b.totalAmount)}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {b.status === 'pending' && (
                            <Button size="sm" onClick={() => void confirmNow(b)} disabled={confirming === b.id}>
                              <Check aria-hidden="true" /> {confirming === b.id ? 'Confirming…' : 'Confirm'}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setSelected(b)} aria-label={`View booking ${b.reference}`}>
                            View
                          </Button>
                          <span className="ml-auto flex gap-2">
                            <GuestContact booking={b} />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div
                    className={cn('hidden rounded-2xl border border-border bg-ivory md:block', status === 'loading' && 'opacity-60')}
                    aria-busy={status === 'loading'}
                  >
                    <table className="w-full text-sm text-walnut">
                      <caption className="sr-only">
                        Bookings, page {data.page} of {data.totalPages}
                      </caption>
                      <thead className="border-b border-border bg-cream/60">
                        <tr>
                          <th scope="col" className={th}>
                            Reference
                          </th>
                          <th scope="col" className={`${th} hidden md:table-cell`}>
                            Guest
                          </th>
                          <th scope="col" className={`${th} hidden lg:table-cell`}>
                            Stay
                          </th>
                          <th scope="col" className={th}>
                            Status
                          </th>
                          <th scope="col" className={`${th} hidden md:table-cell`}>
                            Payment
                          </th>
                          <th scope="col" className={`${th} hidden sm:table-cell`}>
                            Total
                          </th>
                          <th scope="col" className={`${th} text-right`}>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.items.map((b) => (
                          <tr key={b.id} className="align-middle">
                            <th scope="row" className="px-3 py-2 text-left font-normal">
                              <span className="block font-mono font-semibold tracking-wider text-burgundy">{b.reference}</span>
                              <span className="block text-xs text-muted-foreground md:hidden">{b.guest?.name ?? 'Deleted account'}</span>
                            </th>
                            <td className="hidden min-w-44 px-3 py-2 md:table-cell">
                              <span className="block font-semibold [overflow-wrap:anywhere]">{b.guest?.name ?? 'Deleted account'}</span>
                              <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{b.guest?.email ?? '—'}</span>
                            </td>
                            <td className="hidden px-3 py-2 whitespace-nowrap lg:table-cell">
                              <span className="block">
                                {b.room.name} × {b.roomCount}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {formatStay(b.checkIn)} · {nightsLabel(b.nights)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <BookingStatusBadge status={b.status} />
                            </td>
                            <td className="hidden px-3 py-2 md:table-cell">
                              <PaymentBadge status={b.paymentStatus} />
                            </td>
                            <td className="hidden px-3 py-2 whitespace-nowrap tabular-nums sm:table-cell">{formatINR(b.totalAmount)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-2">
                                {b.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => void confirmNow(b)}
                                    disabled={confirming === b.id}
                                    aria-label={`Confirm booking ${b.reference}`}
                                  >
                                    <Check aria-hidden="true" /> {confirming === b.id ? '…' : 'Confirm'}
                                  </Button>
                                )}
                                <GuestContact booking={b} />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelected(b)}
                                  aria-label={`View booking ${b.reference}`}
                                >
                                  View
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <nav aria-label="Bookings pagination" className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" disabled={data.page <= 1 || status === 'loading'} onClick={() => update({ page: data.page - 1 })}>
                  <ChevronLeft aria-hidden="true" /> Previous
                </Button>
                <span className="text-sm text-walnut">
                  Page {fmtNumber(data.page)} of {fmtNumber(data.totalPages)}
                </span>
                <Button
                  variant="outline"
                  disabled={data.page >= data.totalPages || status === 'loading'}
                  onClick={() => update({ page: data.page + 1 })}
                >
                  Next <ChevronRight aria-hidden="true" />
                </Button>
              </nav>
            </div>
          )}
        </>
      )}
      <NewBookingDialog
        open={creating}
        onClose={() => setCreating(false)}
        onAuthError={onAuthError}
        onCreated={(b) => {
          setNotice({ kind: 'ok', text: `Booking ${b.reference} created.` })
          bookings.reload()
          onChanged()
        }}
      />
      <BookingDetailDialog
        booking={selected}
        onClose={() => setSelected(null)}
        onAuthError={onAuthError}
        onUpdated={(b) => {
          setSelected(b)
          bookings.reload()
          onChanged()
        }}
      />
    </section>
  )
}
