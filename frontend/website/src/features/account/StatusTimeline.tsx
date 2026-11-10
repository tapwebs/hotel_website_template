import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Booking } from './accountTypes'

/** Request -> Confirmed -> Stayed progress. A cancelled booking shows a single cancelled line instead. */
export function StatusTimeline({ status }: { status: Booking['status'] }) {
  if (status === 'cancelled') return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">This booking was cancelled.</p>
  const steps = ['Requested', 'Confirmed', 'Stayed']
  const at = status === 'pending' ? 0 : status === 'confirmed' ? 1 : 2
  return (
    <ol aria-label="Booking progress" className="grid grid-cols-3 gap-2">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === at ? 'step' : undefined} className="grid justify-items-center gap-1 text-center">
          <span
            className={cn(
              'grid size-8 place-items-center rounded-full border text-xs font-semibold',
              i <= at ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-cream text-muted-foreground',
            )}
          >
            {i < at || (i === at && at === 2) ? <Check className="size-4" aria-hidden="true" /> : i + 1}
          </span>
          <span className={cn('text-xs', i <= at ? 'font-semibold text-walnut' : 'text-muted-foreground')}>{s}</span>
        </li>
      ))}
    </ol>
  )
}
