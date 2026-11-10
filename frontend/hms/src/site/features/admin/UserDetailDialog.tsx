import { useState } from 'react'
import { Button } from '@/site/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/site/components/ui/dialog'
import { Field, selectClass } from '@/site/components/forms/Field'
import { setRole, setStatus } from './adminApi'
import { RoleBadge, StatusBadge } from './badges'
import { fmtDateTime } from './format'
import { roles, type AdminError, type AdminUser, type Role } from './adminTypes'

interface Props {
  user: AdminUser | null
  /** The signed-in admin's id: their own role/status cannot be changed. */
  selfId: string
  onClose: () => void
  onUpdated: (u: AdminUser) => void
  /** Called for 401/403 so the dashboard can re-check the session. */
  onAuthError: (e: AdminError) => void
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 break-words text-walnut">{children}</dd>
    </div>
  )
}

export function UserDetailDialog({ user, ...rest }: Props) {
  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {/* Re-mount per user so draft state never leaks between users. */}
        {user ? <Body key={user.id} user={user} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Body({ user, selfId, onUpdated, onAuthError }: Omit<Props, 'user' | 'onClose'> & { user: AdminUser }) {
  const [role, setRoleDraft] = useState<Role>(user.role)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const self = user.id === selfId

  const run = async (call: () => ReturnType<typeof setRole>, okText: string) => {
    setBusy(true)
    setMessage(null)
    const r = await call()
    setBusy(false)
    if (r.ok) {
      setConfirmDisable(false)
      setMessage({ kind: 'ok', text: okText })
      setRoleDraft(r.data.role)
      onUpdated(r.data)
    } else {
      setMessage({ kind: 'error', text: r.error.message })
      if (r.error.kind === 'unauthenticated' || r.error.kind === 'forbidden') onAuthError(r.error)
    }
  }

  const disabled = user.status === 'disabled'
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl text-burgundy-deep">{user.name}</DialogTitle>
        <DialogDescription>{user.email}</DialogDescription>
        <div className="flex flex-wrap gap-2">
          <RoleBadge role={user.role} />
          <StatusBadge status={user.status} />
        </div>
      </DialogHeader>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Phone">{user.phone ?? '—'}</Detail>
        <Detail label="Joined">{fmtDateTime(user.createdAt, '—')}</Detail>
        <Detail label="Last login">{fmtDateTime(user.lastLoginAt)}</Detail>
        <Detail label="Last updated">{fmtDateTime(user.updatedAt, '—')}</Detail>
      </dl>

      <div className="grid gap-4 border-t border-gold/30 pt-4">
        {self ? <p className="text-sm text-muted-foreground">You cannot change your own role or status.</p> : null}
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field id="ud-role" label="Role">
            {(aria) => (
              <select
                {...aria}
                className={selectClass}
                value={role}
                disabled={self || busy}
                onChange={(e) => setRoleDraft(e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button disabled={self || busy || role === user.role} onClick={() => run(() => setRole(user.id, role), 'Role updated.')}>
            Save role
          </Button>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-walnut">Account status</p>
          {confirmDisable ? (
            <div role="group" aria-label="Confirm disable" className="grid gap-3 rounded-md border border-destructive/40 bg-cream/60 p-3">
              <p className="text-sm text-walnut">Disable this account? They will be signed out immediately.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => run(() => setStatus(user.id, 'disabled'), 'Account disabled.')}
                >
                  Yes, disable
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirmDisable(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {disabled ? (
                <Button disabled={self || busy} onClick={() => run(() => setStatus(user.id, 'active'), 'Account re-enabled.')}>
                  Re-enable account
                </Button>
              ) : (
                <Button variant="outline" disabled={self || busy} onClick={() => setConfirmDisable(true)}>
                  Disable account
                </Button>
              )}
            </div>
          )}
        </div>

        <div
          aria-live="polite"
          role={message?.kind === 'error' ? 'alert' : 'status'}
          className={message?.kind === 'error' ? 'text-sm font-medium text-destructive' : 'text-sm font-medium text-walnut'}
        >
          {message?.text}
        </div>
      </div>
    </>
  )
}
