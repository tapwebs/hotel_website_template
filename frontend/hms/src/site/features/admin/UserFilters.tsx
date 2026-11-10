import { useEffect, useRef, useState } from 'react'
import { Button } from '@/site/components/ui/button'
import { Input } from '@/site/components/ui/input'
import { Field, selectClass } from '@/site/components/forms/Field'
import { DEFAULT_PARAMS, hasFilters, PAGE_SIZES } from './adminApi'
import { roles, statuses, type ListParams, type Order, type SortKey } from './adminTypes'

const sortOptions: { value: `${SortKey}:${Order}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A to Z' },
  { value: 'name:desc', label: 'Name Z to A' },
  { value: 'email:asc', label: 'Email A to Z' },
  { value: 'lastLoginAt:desc', label: 'Last login, latest' },
  { value: 'lastLoginAt:asc', label: 'Last login, earliest' },
]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function UserFilters({ params, onChange }: { params: ListParams; onChange: (next: Partial<ListParams>) => void }) {
  const [q, setQ] = useState(params.q)
  const sent = useRef(params.q)
  // Keep the box in step when the URL changes from outside (back button, Clear filters), not from our own echo.
  useEffect(() => {
    if (params.q !== sent.current) {
      sent.current = params.q
      setQ(params.q)
    }
  }, [params.q])
  // Debounce typing (300 ms) before it reaches the URL and the API.
  useEffect(() => {
    if (q === params.q) return
    const t = setTimeout(() => {
      sent.current = q
      onChange({ q, page: 1 })
    }, 300)
    return () => clearTimeout(t)
  }, [q, params.q, onChange])

  return (
    <form
      role="search"
      aria-label="Filter users"
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-4 rounded-2xl border border-border bg-ivory p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <Field id="au-q" label="Search" className="sm:col-span-2 lg:col-span-2">
        {(aria) => (
          <Input
            {...aria}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Name, email or phone"
            autoComplete="off"
          />
        )}
      </Field>
      <Field id="au-role" label="Role">
        {(aria) => (
          <select
            {...aria}
            className={selectClass}
            value={params.role}
            onChange={(e) => onChange({ role: e.target.value as ListParams['role'], page: 1 })}
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {cap(r)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id="au-status" label="Status">
        {(aria) => (
          <select
            {...aria}
            className={selectClass}
            value={params.status}
            onChange={(e) => onChange({ status: e.target.value as ListParams['status'], page: 1 })}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <details className="group sm:col-span-2 lg:col-span-6" open={params.sort !== DEFAULT_PARAMS.sort || params.pageSize !== DEFAULT_PARAMS.pageSize}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-md text-sm font-semibold text-burgundy underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          View options (sort, per page)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <Field id="au-sort" label="Sort by">
        {(aria) => (
          <select
            {...aria}
            className={selectClass}
            value={`${params.sort}:${params.order}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':') as [SortKey, Order]
              onChange({ sort, order, page: 1 })
            }}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id="au-size" label="Per page">
        {(aria) => (
          <select
            {...aria}
            className={selectClass}
            value={params.pageSize}
            onChange={(e) => onChange({ pageSize: Number(e.target.value), page: 1 })}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
      </Field>
        </div>
      </details>
      <div className="sm:col-span-2 lg:col-span-6">
        <Button
          type="button"
          variant="outline"
          disabled={!hasFilters(params)}
          onClick={() => {
            sent.current = ''
            setQ('')
            onChange({ q: '', role: '', status: '', page: 1, sort: DEFAULT_PARAMS.sort, order: DEFAULT_PARAMS.order })
          }}
        >
          Clear filters
        </Button>
      </div>
    </form>
  )
}
