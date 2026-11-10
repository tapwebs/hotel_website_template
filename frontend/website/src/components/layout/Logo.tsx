import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** Monogram wood badge + wordmark. Links home. */
export function Logo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <Link to="/" className={cn('flex min-h-11 min-w-0 items-center gap-3 rounded-md', className)} aria-label="TapMenu Grand Resort & Spa, home">
      <div className="size-10 sm:size-12 shrink-0 rounded-full bg-burgundy-deep text-gold flex items-center justify-center font-display font-bold text-base sm:text-lg ring-1 ring-gold/60 shadow-inner">
        TM
      </div>
      <span className="grid leading-none" translate="no">
        <span
          className={cn(
            'font-display text-[1.25rem] font-semibold tracking-tight sm:text-[1.4rem]',
            tone === 'dark' ? 'text-burgundy' : 'text-ivory',
          )}
        >
          TapMenu Grand
        </span>
        <span className={cn('mt-1 hidden text-xs font-medium sm:block', tone === 'dark' ? 'text-muted-foreground' : 'text-cream/80')}>
          Luxury Resort & Spa
        </span>
      </span>
    </Link>
  )
}
