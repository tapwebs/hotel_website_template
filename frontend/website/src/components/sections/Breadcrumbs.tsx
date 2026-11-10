import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Visual breadcrumb trail: Home → current page. BreadcrumbList JSON-LD is emitted by Seo. */
export function Breadcrumbs({ current, tone = 'dark', className }: { current: string; tone?: 'dark' | 'light'; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className={cn('flex flex-wrap items-center gap-x-1 text-sm', tone === 'light' ? 'text-cream/85' : 'text-muted-foreground')}>
        <li className="inline-flex items-center gap-1">
          <Link
            to="/"
            className={cn(
              'inline-flex min-h-11 items-center underline-offset-4 hover:underline',
              tone === 'light' ? 'hover:text-gold-soft' : 'hover:text-burgundy',
            )}
          >
            Home
          </Link>
          <ChevronRight className="size-4" aria-hidden="true" />
        </li>
        <li>
          <span
            aria-current="page"
            className={cn('inline-flex min-h-11 items-center font-semibold', tone === 'light' ? 'text-ivory' : 'text-walnut')}
          >
            {current}
          </span>
        </li>
      </ol>
    </nav>
  )
}
