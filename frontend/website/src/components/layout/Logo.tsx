import { Link } from 'react-router'
import { images, srcset } from '@/data/images'
import { cn } from '@/lib/utils'

/** Round wood badge + wordmark. Links home. */
export function Logo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  const logo = images.brand.logo
  return (
    <Link to="/" className={cn('flex min-h-11 min-w-0 items-center gap-3 rounded-md', className)} aria-label="Hotel Dream Heaven’s, home">
      <img
        src={`/images/${logo.slug}-160.webp`}
        srcSet={srcset(logo, 'webp')}
        sizes="48px"
        width={48}
        height={48}
        alt=""
        className="size-10 shrink-0 rounded-full sm:size-12"
      />
      <span className="grid leading-none" translate="no">
        <span
          className={cn(
            'font-display text-[1.25rem] font-semibold tracking-tight sm:text-[1.4rem]',
            tone === 'dark' ? 'text-burgundy' : 'text-ivory',
          )}
        >
          Dream Heaven’s
        </span>
        <span className={cn('mt-1 hidden text-xs font-medium sm:block', tone === 'dark' ? 'text-muted-foreground' : 'text-cream/80')}>
          Hotel, Agra Road, Jaipur
        </span>
      </span>
    </Link>
  )
}
