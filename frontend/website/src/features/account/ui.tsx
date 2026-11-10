// Small shared pieces for the account area: loading skeleton, error panel, and a panel wrapper.
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AdminError } from '@/features/admin/adminTypes'
export function Skeleton({ rows = 3, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-md bg-border/50 motion-reduce:animate-none" />
      ))}
    </div>
  )
}
export function ErrorPanel({ error, onRetry }: { error: AdminError; onRetry?: () => void }) {
  return (
    <div role="alert" className="grid gap-3 rounded-md border border-destructive/40 bg-ivory p-5">
      <p className="font-semibold text-destructive">{error.message}</p>
      {onRetry && error.kind !== 'not_found' ? (
        <div>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  )
}
export const Panel = ({ className, ...props }: React.ComponentProps<'section'>) => (
  <section className={cn('rounded-md border border-border bg-ivory p-5 sm:p-6', className)} {...props} />
)
