import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { cn } from '@/site/lib/utils'
import { RoleBadge, StatusBadge } from './badges'
import { fmtDate, fmtNumber } from './format'
import { hasFilters } from './adminApi'
import type { AdminUser, ListParams, SortKey, UserList } from './adminTypes'
import type { Resource } from './useAdminData'

function SortHeader({
  label,
  sortKey,
  params,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  params: ListParams
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = params.sort === sortKey
  const ascending = params.order === 'asc'
  const Icon = ascending ? ArrowUp : ArrowDown
  let ariaSort: 'ascending' | 'descending' | 'none' = 'none'
  if (active) ariaSort = ascending ? 'ascending' : 'descending'
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn('px-3 py-2 text-left font-semibold', className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-mx-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold outline-none hover:text-burgundy focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {label}
        {active ? <Icon className="size-4" aria-hidden="true" /> : null}
      </button>
    </th>
  )
}

interface Props {
  users: Resource<UserList>
  params: ListParams
  onSort: (k: SortKey) => void
  onPage: (page: number) => void
  onView: (u: AdminUser) => void
  onClear: () => void
}

export function UsersTable({ users, params, onSort, onPage, onView, onClear }: Props) {
  const { data, status } = users
  const th = 'px-3 py-2 text-left font-semibold'

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-ivory p-5 text-destructive"
      >
        <p className="font-medium">Could not load users. {users.error.message}</p>
        <Button variant="outline" onClick={users.reload}>
          Retry
        </Button>
      </div>
    )
  }
  if (!data) {
    return (
      <div role="status" aria-busy="true" className="grid gap-2">
        <span className="sr-only">Loading users…</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-border/50 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1
  const to = Math.min(data.total, (data.page - 1) * data.pageSize + data.items.length)
  const filtered = hasFilters(params)
  let summary = `Showing ${fmtNumber(from)} to ${fmtNumber(to)} of ${fmtNumber(data.total)} users`
  if (status === 'loading') summary = 'Updating…'
  else if (data.total === 0) summary = 'No users'

  return (
    <div className="grid gap-3">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {summary}
      </p>
      {data.items.length === 0 ? (
        <div role="status" className="grid justify-items-start gap-3 rounded-2xl border border-gold/50 bg-ivory p-6">
          <h3 className="text-h3 text-burgundy">{filtered ? 'No users match these filters' : 'No users yet'}</h3>
          <p className="text-walnut">
            {filtered ? 'Try a different search or clear the filters.' : 'New accounts will appear here.'}
          </p>
          {filtered ? (
            <Button variant="outline" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          className={cn('rounded-2xl border border-border bg-ivory', status === 'loading' && 'opacity-60')}
          aria-busy={status === 'loading'}
        >
          <table className="w-full text-sm text-walnut">
            <caption className="sr-only">
              Users, page {data.page} of {data.totalPages}
            </caption>
            <thead className="border-b border-border bg-cream/60">
              <tr>
                <SortHeader label="Name" sortKey="name" params={params} onSort={onSort} />
                <th scope="col" className={th}>
                  Role
                </th>
                <th scope="col" className={th}>
                  Status
                </th>
                <th scope="col" className={cn(th, 'hidden lg:table-cell')}>
                  Phone
                </th>
                <SortHeader label="Joined" sortKey="createdAt" params={params} onSort={onSort} className="hidden md:table-cell" />
                <SortHeader label="Last login" sortKey="lastLoginAt" params={params} onSort={onSort} className="hidden lg:table-cell" />
                <th scope="col" className={cn(th, 'text-right')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((u) => (
                <tr key={u.id} className="align-middle">
                  <th scope="row" className="px-3 md:max-w-0 py-2 text-left font-normal">
                    <span className="block [overflow-wrap:anywhere] font-semibold md:truncate text-walnut">{u.name}</span>
                    <span className="block [overflow-wrap:anywhere] text-xs md:truncate text-muted-foreground">{u.email}</span>
                  </th>
                  <td className="px-3 py-2">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">{u.phone ?? '—'}</td>
                  <td className="hidden px-3 py-2 whitespace-nowrap md:table-cell">{fmtDate(u.createdAt, '—')}</td>
                  <td className="hidden px-3 py-2 whitespace-nowrap lg:table-cell">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => onView(u)} aria-label={`View ${u.name}`}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" disabled={data.page <= 1 || status === 'loading'} onClick={() => onPage(data.page - 1)}>
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
        <span className="text-sm text-walnut">
          Page {fmtNumber(data.page)} of {fmtNumber(data.totalPages)}
        </span>
        <Button variant="outline" disabled={data.page >= data.totalPages || status === 'loading'} onClick={() => onPage(data.page + 1)}>
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </div>
  )
}
