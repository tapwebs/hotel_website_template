import type { AdminStats } from './adminTypes'

export function Sparkline({ days }: { days: AdminStats['signupsByDay'] }) {
  const w = 300
  const h = 60
  const max = Math.max(1, ...days.map((d) => d.count))
  const step = days.length > 1 ? w / (days.length - 1) : w
  const pts = days.map((d, i) => `${(i * step).toFixed(1)},${(h - 4 - (d.count / max) * (h - 8)).toFixed(1)}`).join(' ')
  return (
    <figure className="rounded-2xl border border-border bg-ivory p-4">
      <figcaption className="text-sm font-semibold text-muted-foreground">New sign-ups, last 30 days</figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Sign-ups per day over the last 30 days, peak ${max}`}
        className="mt-2 h-16 w-full text-burgundy"
      >
        <line x1="0" y1={h - 1} x2={w} y2={h - 1} className="stroke-gold/60" strokeWidth="1" />
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <details className="mt-2 text-sm text-walnut">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md font-semibold text-burgundy underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          View data as a table
        </summary>
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">New sign-ups per day, last 30 days (UTC)</caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-4">
                  Date
                </th>
                <th scope="col" className="py-1">
                  Sign-ups
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row" className="py-0.5 pr-4 font-normal">
                    {d.date}
                  </th>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
