import { useState } from 'react'
import { Button } from '@/site/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/site/components/ui/dialog'
import { Input } from '@/site/components/ui/input'
import { Field, selectClass } from '@/site/components/forms/Field'
import { fieldIssues } from '@/site/features/account/accountApi'
import { createUser } from './toolsApi'
import type { AdminUser } from './adminTypes'

const toPhone = (v: string) => (v.replace(/\D/g, '').length === 10 ? `+91${v.replace(/\D/g, '')}` : undefined)

export function AddStaffDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: AdminUser) => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">{open ? <Body onClose={onClose} onCreated={onCreated} /> : null}</DialogContent>
    </Dialog>
  )
}

function Body({ onClose, onCreated }: { onClose: () => void; onCreated: (u: AdminUser) => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', role: 'staff' as 'staff' | 'guest' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<Record<string, string>>({})
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const submit = async () => {
    setError('')
    const e: Record<string, string> = {}
    if (f.name.trim().length < 2) e.name = 'Enter a name.'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email.'
    if (f.phone.trim() && !toPhone(f.phone)) e.phone = 'Use a 10-digit mobile number.'
    if (f.password.length < 8) e.password = 'At least 8 characters.'
    setIssues(e)
    if (Object.keys(e).length) return
    setBusy(true)
    const r = await createUser({ name: f.name.trim(), email: f.email.trim(), phone: toPhone(f.phone), password: f.password, role: f.role })
    setBusy(false)
    if (r.ok) {
      onCreated(r.data)
      return onClose()
    }
    const raw = fieldIssues(r.error)
    setIssues(raw)
    setError(Object.keys(raw).length ? 'Please fix the highlighted fields.' : r.error.message)
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl text-burgundy-deep">Add an account</DialogTitle>
        <DialogDescription>Front-desk staff can work with bookings only. Share the password with them in person and ask them to change it.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="as-name" label="Full name" error={issues.name} className="sm:col-span-2">
          {(a) => <Input {...a} value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />}
        </Field>
        <Field id="as-email" label="Email" error={issues.email}>
          {(a) => <Input {...a} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />}
        </Field>
        <Field id="as-phone" label="Mobile" optional error={issues.phone}>
          {(a) => <Input {...a} inputMode="numeric" placeholder="10 digits" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}
        </Field>
        <Field id="as-pw" label="Temporary password" error={issues.password}>
          {(a) => <Input {...a} type="text" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />}
        </Field>
        <Field id="as-role" label="Role">
          {(a) => (
            <select {...a} className={selectClass} value={f.role} onChange={(e) => set('role', e.target.value)}>
              <option value="staff">Front-desk staff</option>
              <option value="guest">Guest</option>
            </select>
          )}
        </Field>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-ivory p-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? 'Adding…' : 'Add account'}
        </Button>
      </div>
    </>
  )
}
