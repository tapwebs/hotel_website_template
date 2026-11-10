/** Plain SVG bar chart (no chart library). Bars use currentColor-free brand fills; each bar has a <title> tooltip. */
export function BarChart({
  values,
  labels,
  title,
  height = 140,
  highlightMax = true,
}: {
  values: number[]
  labels: string[]
  title: string
  height?: number
  highlightMax?: boolean
}) {
  const max = Math.max(1, ...values)
  const n = values.length
  const W = 480
  const pad = 4
  const slot = (W - pad * 2) / n
  const barW = Math.max(2, slot * 0.7)
  const top = values.indexOf(Math.max(...values))
  const labelEvery = n > 12 ? Math.ceil(n / 8) : 1
  return (
    <svg viewBox={`0 0 ${W} ${height + 22}`} role="img" aria-label={title} className="h-auto w-full">
      <line x1={pad} x2={W - pad} y1={height} y2={height} stroke="var(--color-border)" />
      {values.map((v, i) => {
        const h = (v / max) * (height - 8)
        const x = pad + i * slot + (slot - barW) / 2
        const best = highlightMax && v > 0 && i === top
        return (
          <g key={i}>
            <rect x={x} y={height - h} width={barW} height={h} rx={2} fill={best ? 'var(--color-burgundy)' : 'var(--color-gold)'}>
              <title>{`${labels[i]}: ${v}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={height + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted-foreground)">
                {labels[i]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
