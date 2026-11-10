import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarRange, Download, Minus } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { BarChart } from '@/site/features/qrhub/components/BarChart'
import { Card, Notice } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { saveBlob } from '@/site/features/qrhub/lib/download'
import { istDay } from '@/site/features/qrhub/lib/dates'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { cn, errMsg } from '@/site/features/qrhub/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const PRESETS = [7, 30, 90] as const

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1
const shortDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
const peak = (v: number[]) => (v.some((x) => x > 0) ? v.indexOf(Math.max(...v)) : -1)

/** Total with a change badge against the previous period of the same length. */
function Kpi({ label, value, prev, hint }: { label: string; value: number | string; prev?: number; hint?: string }) {
  const cur = typeof value === 'number' ? value : null
  const delta = cur !== null && prev !== undefined ? (prev === 0 ? (cur === 0 ? 0 : null) : Math.round(((cur - prev) / prev) * 100)) : undefined
  const Icon = delta === undefined || delta === 0 ? Minus : delta === null || delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <Card className="grid gap-1 p-4 sm:p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-3xl text-burgundy tabular-nums">{value}</p>
      {delta !== undefined ? (
        <p className={cn('inline-flex items-center gap-1 text-xs font-semibold', delta !== null && delta < 0 ? 'text-destructive' : delta === 0 ? 'text-muted-foreground' : 'text-emerald-700')}>
          <Icon className="size-3.5" aria-hidden />
          {delta === null ? 'New' : `${delta > 0 ? '+' : ''}${delta}%`}
          <span className="font-normal text-muted-foreground">vs previous period</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-4">
      <span className="sr-only">Loading analytics…</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    </div>
  )
}

/** Analytics for the hotel hub: range picker, totals with change vs the previous period, daily chart, busiest times, spots, top links. */
export function AnalyticsView({ slug }: { slug?: string }) {
  const [preset, setPreset] = useState<number | 'custom'>(30)
  const [from, setFrom] = useState(istDay(29))
  const [to, setTo] = useState(istDay(0))
  const [draft, setDraft] = useState({ from, to })
  const [msg, setMsg] = useState('')
  const len = daysBetween(from, to)
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(len - 1))
  const { data, error } = useLoad(() => api.analytics({ from, to }, slug), [slug, from, to])
  const prev = useLoad(() => api.analytics({ from: prevFrom, to: prevTo }, slug), [slug, prevFrom, prevTo])

  const pickPreset = (days: number) => {
    setPreset(days)
    setFrom(istDay(days - 1))
    setTo(istDay(0))
    setMsg('')
  }
  const apply = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) return setMsg('Choose a start date that is not after the end date.')
    setMsg('')
    setPreset('custom')
    setFrom(draft.from)
    setTo(draft.to)
  }
  const exportCsv = async (type: 'visits' | 'clicks') => {
    setMsg('')
    try {
      const { blob, filename } = await api.exportCsv({ type, slug, from, to })
      saveBlob(blob, filename)
    } catch (e) {
      setMsg(errMsg(e))
    }
  }

  // One bar per day, including quiet days, so the chart shows the real shape of the range.
  const days = Array.from({ length: Math.min(len, 366) }, (_, i) => addDays(from, i))
  const visitsByDay = new Map((data?.daily ?? []).map((d) => [d.date, d.visits]))
  const daily = days.map((d) => visitsByDay.get(d) ?? 0)
  const bestDay = peak(daily)
  const ranking = data ? [...data.byPlacement].sort((a, b) => b.scans - a.scans) : []
  const maxScans = Math.max(1, ...ranking.map((p) => p.scans))
  const links = data ? [...data.topLinks].sort((a, b) => b.clicks - a.clicks) : []
  const maxClicks = Math.max(1, ...links.map((l) => l.clicks))
  const ctr = data && data.totals.visits > 0 ? (data.totals.clicks / data.totals.visits).toFixed(1) : '–'
  const hr = data ? peak(data.byHour) : -1
  const wd = data ? peak(data.byWeekday) : -1
  const empty = data && data.totals.visits === 0 && data.totals.scans === 0 && data.totals.clicks === 0

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Date range" className="flex rounded-lg border bg-background p-0.5">
            {PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={preset === d}
                onClick={() => pickPreset(d)}
                className={cn('min-h-9 rounded-md px-3 text-sm font-semibold transition-colors', preset === d ? 'bg-burgundy text-ivory' : 'text-walnut hover:bg-gold-soft/40')}
              >
                {d} days
              </button>
            ))}
            <button
              type="button"
              aria-pressed={preset === 'custom'}
              onClick={() => setPreset('custom')}
              className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors', preset === 'custom' ? 'bg-burgundy text-ivory' : 'text-walnut hover:bg-gold-soft/40')}
            >
              <CalendarRange className="size-4" aria-hidden /> Custom
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {shortDate(from)} – {shortDate(to)} · {len} {len === 1 ? 'day' : 'days'}
          </p>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportCsv('visits')}>
              <Download /> Visits
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv('clicks')}>
              <Download /> Clicks
            </Button>
          </div>
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="From date" type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="w-40" />
            <span className="text-muted-foreground">to</span>
            <Input aria-label="To date" type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="w-40" />
            <Button size="sm" onClick={apply}>
              Apply
            </Button>
          </div>
        )}
        {msg && <Notice kind="error">{msg}</Notice>}
      </Card>

      {error && <Notice kind="error">{error}</Notice>}
      {!data && !error && <Skeleton />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
            <Kpi label="Visits" value={data.totals.visits} prev={prev.data?.totals.visits} />
            <Kpi label="QR scans" value={data.totals.scans} prev={prev.data?.totals.scans} />
            <Kpi label="Link clicks" value={data.totals.clicks} prev={prev.data?.totals.clicks} />
            <Kpi label="Clicks per visit" value={ctr} hint="Average links opened per visit" />
          </div>

          {empty ? (
            <Card className="grid justify-items-center gap-1 py-10 text-center">
              <p className="font-display text-xl text-burgundy">No activity in this period</p>
              <p className="max-w-sm text-sm text-muted-foreground">Scans and visits appear here as soon as guests use your QR codes. Try a longer range.</p>
            </Card>
          ) : (
            <>
              <Card>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-h3 text-burgundy">Visits per day</h3>
                  {bestDay >= 0 && (
                    <p className="text-sm text-muted-foreground">
                      Best day: <span className="font-semibold text-walnut">{shortDate(days[bestDay]!)}</span> with {daily[bestDay]} {daily[bestDay] === 1 ? 'visit' : 'visits'}
                    </p>
                  )}
                </div>
                <BarChart values={daily} labels={days.map(shortDate)} title="Visits per day" />
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-h3 text-burgundy">Busiest hours</h3>
                    {hr >= 0 && <p className="text-sm text-muted-foreground">Peak: <span className="font-semibold text-walnut">{hourLabel(hr)}</span></p>}
                  </div>
                  <BarChart values={data.byHour} labels={HOURS} title="Visits by hour of day" />
                  <p className="mt-2 text-xs text-muted-foreground">Hour of day, India time.</p>
                </Card>
                <Card>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-h3 text-burgundy">Busiest days</h3>
                    {wd >= 0 && <p className="text-sm text-muted-foreground">Peak: <span className="font-semibold text-walnut">{WEEKDAYS_LONG[wd]}</span></p>}
                  </div>
                  <BarChart values={data.byWeekday} labels={WEEKDAYS} title="Visits by day of week" />
                  <p className="mt-2 text-xs text-muted-foreground">Day of the week, India time.</p>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <h3 className="mb-3 text-h3 text-burgundy">Top spots by scans</h3>
                  {ranking.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No placement scans yet. Print placement QRs to see which spots get used.</p>
                  ) : (
                    <ol className="grid gap-3">
                      {ranking.slice(0, 10).map((p, i) => (
                        <li key={p.code} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
                          <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="truncate font-medium">{p.label}</span>
                          <span className="font-semibold tabular-nums">
                            {p.scans} <span className="font-normal text-muted-foreground">{p.scans === 1 ? 'scan' : 'scans'}</span>
                          </span>
                          <span />
                          <span className="col-span-2 h-1.5 rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-burgundy" style={{ width: `${(p.scans / maxScans) * 100}%` }} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
                <Card>
                  <h3 className="mb-3 text-h3 text-burgundy">Top links</h3>
                  {links.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No link clicks yet.</p>
                  ) : (
                    <ol className="grid gap-3">
                      {links.slice(0, 10).map((l, i) => (
                        <li key={l.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
                          <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="truncate font-medium">{l.title}</span>
                          <span className="font-semibold tabular-nums">
                            {l.clicks} <span className="font-normal text-muted-foreground">{l.clicks === 1 ? 'click' : 'clicks'}</span>
                          </span>
                          <span />
                          <span className="col-span-2 h-1.5 rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-gold" style={{ width: `${(l.clicks / maxClicks) * 100}%` }} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
