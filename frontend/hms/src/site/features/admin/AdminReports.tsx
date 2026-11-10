
import { Download } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { formatINR } from '@/site/lib/format'
import { cn } from '@/site/lib/utils'
import { statusLabel, paymentLabel, type BookingStatus, type PaymentStatus } from '@/site/features/account/accountTypes'
import { useState } from 'react'
import { useWebsite } from './AdminShell'
import { fmtNumber } from './format'
import { downloadCsv, getReport, type Report } from './toolsApi'
import { useResource } from './useAdminData'

const card = 'rounded-2xl border border-border bg-ivory p-4 shadow-xs sm:p-5'
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={cn(card, 'grid gap-1 p-4 sm:p-4')}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-3xl text-burgundy-deep tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

function Bars({ rows, format = fmtNumber, tone = 'bg-burgundy' }: { rows: { label: string; value: number }[]; format?: (n: number) => string; tone?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid gap-1 text-sm">
          <span className="flex justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="font-semibold tabular-nums">{format(r.value)}</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-border">
            <span className={cn('block h-full rounded-full', tone)} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Body({ r }: { r: Report }) {
  const { stats } = useWebsite()
  const t = r.totals
  const cancelRate = t.bookings ? Math.round((t.cancelled / t.bookings) * 100) : 0
  const lc = stats.data?.lifecycle
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings" value={fmtNumber(t.bookings)} note="All time" />
        <Stat label="Room charge booked" value={formatINR(t.revenue)} note="Confirmed and completed, excluding taxes" />
        <Stat label="Cancellation rate" value={`${cancelRate}%`} note={`${fmtNumber(t.cancelled)} cancelled`} />
        <Stat label="Average stay" value={`${t.avgStay} nights`} note={`${fmtNumber(t.roomNights)} room-nights`} />
      </div>
      <section aria-labelledby="by-month" className={card}>
        <h3 id="by-month" className="mb-1 font-semibold text-walnut">
          Bookings by month of check-in
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">Last 12 months with bookings.</p>
        {r.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Month</th>
                  <th className="py-2 pr-3 text-right">Bookings</th>
                  <th className="py-2 pr-3 text-right">Cancelled</th>
                  <th className="py-2 pr-3 text-right">Room-nights</th>
                  <th className="py-2 text-right">Room charge</th>
                </tr>
              </thead>
              <tbody>
                {r.months.map((m) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{monthName(m.month)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.bookings}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.cancelled}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.nights}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{formatINR(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-3">
        <section aria-labelledby="rm" className={card}>
          <h3 id="rm" className="mb-3 font-semibold text-walnut">
            Room types
          </h3>
          <Bars rows={r.rooms.map((x) => ({ label: x.name, value: x.count }))} />
        </section>
        <section aria-labelledby="st" className={card}>
          <h3 id="st" className="mb-3 font-semibold text-walnut">
            Booking status
          </h3>
          <Bars rows={r.statuses.map((x) => ({ label: statusLabel[x.name as BookingStatus] ?? x.name, value: x.count }))} tone="bg-gold" />
        </section>
        <section aria-labelledby="pay" className={card}>
          <h3 id="pay" className="mb-3 font-semibold text-walnut">
            Payment
          </h3>
          <Bars rows={r.payments.map((x) => ({ label: paymentLabel[x.name as PaymentStatus] ?? x.name, value: x.count }))} tone="bg-walnut/60" />
        </section>
      </div>
      {lc && (
        <section aria-labelledby="funnel" className={card}>
          <h3 id="funnel" className="mb-3 font-semibold text-walnut">
            Guest journey
          </h3>
          <Bars
            rows={[
              { label: 'Registered', value: lc.registered },
              { label: 'Logged in', value: lc.everLoggedIn },
              { label: 'Booked', value: lc.everBooked },
            ]}
          />
        </section>
      )}
    </div>
  )
}

export function AdminReports() {
  const res = useResource((signal) => getReport({ signal }), 'reports')
  const [msg, setMsg] = useState('')
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Worked out from your bookings. Updated every time you open this page.</p>
        <Button variant="outline" size="sm" onClick={async () => setMsg(await downloadCsv('/admin/bookings.csv', 'bookings.csv'))}>
          <Download aria-hidden="true" /> Export all bookings (CSV)
        </Button>
      </div>
      {msg && <p role="alert" className="text-sm font-semibold text-destructive">{msg}</p>}
      {res.data ? (
        <Body r={res.data} />
      ) : res.status === 'error' ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-ivory p-5 text-destructive">
          <p className="font-medium">Could not load reports. {res.error.message}</p>
          <Button variant="outline" onClick={res.reload}>
            Retry
          </Button>
        </div>
      ) : (
        <div role="status" aria-busy="true" className="grid gap-4">
          <span className="sr-only">Loading reports…</span>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-border/50 motion-reduce:animate-none" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-border/50 motion-reduce:animate-none" />
        </div>
      )}
    </div>
  )
}
