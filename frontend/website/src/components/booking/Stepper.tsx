import { Minus, Plus } from 'lucide-react'

export function StepNum({ n }: { n: number }) {
  return (
    <span className="grid size-6 place-items-center rounded-full bg-burgundy text-xs font-semibold text-cream" aria-hidden="true">
      {n}
    </span>
  )
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const btn =
    'grid size-11 shrink-0 place-items-center rounded-md border border-border bg-cream text-walnut outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="flex items-center justify-between gap-1 rounded-md border border-border bg-ivory p-1">
      <button
        type="button"
        className={btn}
        aria-label={`Fewer ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="grid text-center leading-tight" aria-live="polite">
        <span className="text-base font-semibold tabular-nums text-walnut">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
