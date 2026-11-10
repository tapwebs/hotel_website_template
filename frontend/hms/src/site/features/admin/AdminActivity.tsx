import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { fmtDateTime } from './format'
import { listActivity } from './toolsApi'
import { useResource } from './useAdminData'

const LABEL: Record<string, string> = {
  'booking.created': 'Created a booking',
  'booking.updated': 'Updated a booking',
  'user.created': 'Added an account',
  'user.role': 'Changed a role',
  'user.status': 'Changed account status',
  'room.rate': 'Changed a room rate',
}

export function AdminActivity() {
  const [page, setPage] = useState(1)
  const res = useResource((signal) => listActivity(page, { signal }), `activity:${page}`)
  const d = res.data
  if (!d) {
    return res.status === 'error' ? (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-ivory p-5 text-destructive">
        <p className="font-medium">Could not load the activity log. {res.error.message}</p>
        <Button variant="outline" onClick={res.reload}>
          Retry
        </Button>
      </div>
    ) : (
      <div role="status" aria-busy="true" className="grid gap-2">
        <span className="sr-only">Loading activity…</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-border/50 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Who confirmed, cancelled, created or changed things, newest first.</p>
      {d.items.length === 0 ? (
        <div className="rounded-2xl border border-gold/50 bg-ivory p-6 text-walnut">Nothing yet. Actions like confirming a booking or changing a rate will be listed here.</div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-ivory">
          {d.items.map((a) => (
            <li key={a.id} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <span className="text-xs text-muted-foreground sm:pt-0.5">{fmtDateTime(a.at)}</span>
              <span className="min-w-0 text-sm text-walnut">
                <span className="font-semibold">{a.actorName}</span> · {LABEL[a.action] ?? a.action}
                {a.target && <span className="font-mono font-semibold tracking-wide text-burgundy"> {a.target}</span>}
                {a.detail && <span className="block text-xs break-words text-muted-foreground">{a.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {d.totalPages > 1 && (
        <nav aria-label="Activity pagination" className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft aria-hidden="true" /> Newer
          </Button>
          <span className="text-sm text-walnut">
            Page {d.page} of {d.totalPages}
          </span>
          <Button variant="outline" disabled={page >= d.totalPages} onClick={() => setPage(page + 1)}>
            Older <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}
