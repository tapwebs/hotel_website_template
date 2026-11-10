import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, UserPlus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/site/components/ui/button'
import { useAuth } from '@/site/features/auth/auth-context'
import { AddStaffDialog } from './AddStaffDialog'
import { DEFAULT_PARAMS, buildListQuery, parseListParams, toSearchParams } from './adminApi'
import { downloadCsv } from './toolsApi'
import { useWebsite } from './AdminShell'
import { UserDetailDialog } from './UserDetailDialog'
import { UserFilters } from './UserFilters'
import { UsersTable } from './UsersTable'
import { useAdminUsers } from './useAdminData'
import type { AdminError, AdminUser, ListParams, SortKey } from './adminTypes'

export function AdminUsersPage() {
  const { stats } = useWebsite()
  const { auth, clear, refresh } = useAuth()
  const selfId = auth.status === 'authenticated' ? auth.user.id : ''
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => parseListParams(sp), [sp])
  const users = useAdminUsers(params)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const update = useCallback(
    (next: Partial<ListParams>) => setSp((cur) => toSearchParams({ ...parseListParams(cur), ...next }), { replace: true }),
    [setSp],
  )
  const onSort = (k: SortKey) =>
    update(params.sort === k ? { order: params.order === 'asc' ? 'desc' : 'asc', page: 1 } : { sort: k, order: k === 'name' ? 'asc' : 'desc', page: 1 })
  // Session expired (401) or role revoked (403) mid-use: re-check who we are.
  const onAuthError = useCallback((e: AdminError) => (e.kind === 'unauthenticated' ? clear() : refresh()), [clear, refresh])
  useEffect(() => {
    const e = users.error
    if (e && (e.kind === 'unauthenticated' || e.kind === 'forbidden')) onAuthError(e)
  }, [users.error, onAuthError])
  // A page past the end (filters shrank the list) snaps back to the last page.
  const data = users.data
  useEffect(() => {
    if (users.status === 'ready' && data && data.items.length === 0 && data.total > 0 && params.page > data.totalPages) update({ page: data.totalPages })
  }, [users.status, data, params.page, update])
  return (
    <section aria-labelledby="admin-users" className="grid gap-4">
      <h2 id="admin-users" className="sr-only">
        Users
      </h2>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={async () => setMsg(await downloadCsv(`/admin/users.csv?${buildListQuery({ ...params, page: 1 })}`, 'users.csv'))}>
          <Download aria-hidden="true" /> Export
        </Button>
        <Button onClick={() => setAdding(true)}>
          <UserPlus aria-hidden="true" /> Add account
        </Button>
      </div>
      {msg && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {msg}
        </p>
      )}
      <UserFilters params={params} onChange={update} />
      <AddStaffDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          users.reload()
          stats.reload()
        }}
      />
      <UsersTable
        users={users}
        params={params}
        onSort={onSort}
        onPage={(page) => update({ page })}
        onView={setSelected}
        onClear={() => update({ q: '', role: '', status: '', page: 1, sort: DEFAULT_PARAMS.sort, order: DEFAULT_PARAMS.order })}
      />
      <UserDetailDialog
        user={selected}
        selfId={selfId}
        onClose={() => setSelected(null)}
        onAuthError={onAuthError}
        onUpdated={(u) => {
          setSelected(u)
          users.reload()
          stats.reload()
        }}
      />
    </section>
  )
}
