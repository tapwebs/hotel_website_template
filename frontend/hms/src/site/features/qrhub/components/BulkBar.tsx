import type { ReactNode } from 'react'
import { Button } from '@/site/features/qrhub/components/ui/button'

/** Sticky action bar shown while rows are selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-3 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold bg-burgundy-deep p-3 text-ivory shadow-lg on-dark"
    >
      <span className="mr-auto text-sm font-semibold">{count} selected</span>
      {children}
      <Button size="sm" variant="outline-light" onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}
