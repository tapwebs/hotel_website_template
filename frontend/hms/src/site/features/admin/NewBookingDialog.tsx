import { useEffect, useState } from 'react'
import { Button } from '@/site/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/site/components/ui/dialog'
import { Input } from '@/site/components/ui/input'
import { Textarea } from '@/site/components/ui/textarea'
import { Field, selectClass } from '@/site/components/forms/Field'
import { rooms } from '@/site/data/rooms'
import { formatINR } from '@/site/lib/format'
import { cn } from '@/site/lib/utils'
import { fieldIssues } from '@/site/features/account/accountApi'
import { createAdminBooking, istDate } from './bookingsApi'
import { searchGuests, type GuestHit } from './toolsApi'
import type { AdminBooking, AdminError } from './adminTypes'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (b: AdminBooking) => void
  onAuthError: (e: AdminError) => void
}

const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const toPhone = (v: string) => (v.replace(/\D/g, '').length === 10 ? `+91${v.replace(/\D/g, '')}` : undefined)

export function NewBookingDialog({ open, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && rest.onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">{open ? <Body {...rest} /> : null}</DialogContent>
    </Dialog>
  )
}

function Body({ onClose, onCreated, onAuthError }: Omit<Props, 'open'>) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' })
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<GuestHit[]>([])
  const [picked, setPicked] = useState<GuestHit | null>(null)
  const [f, setF] = useState({
    roomId: rooms[0]!.id as string,
    checkIn: istDate(0),
    checkOut: istDate(1),
    rooms: 1,
    adults: 2,
    children: 0,
    extraBed: false,
    specialRequests: '',
    status: 'confirmed' as 'confirmed' | 'pending',
    paymentStatus: 'pay_at_hotel' as 'unpaid' | 'pay_at_hotel' | 'paid',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<Record<string, string>>({})

  // Existing-guest search (debounced).
  useEffect(() => {
    if (mode !== 'existing' || search.trim().length < 2) return
    const t = setTimeout(() => {
      void searchGuests(search.trim()).then((r) => r.ok && setFound(r.data.items))
    }, 300)
    return () => clearTimeout(t)
  }, [mode, search])

  const room = rooms.find((r) => r.id === f.roomId)!
  const nights = nightsBetween(f.checkIn, f.checkOut)
  const total = nights > 0 ? nights * room.rate * f.rooms : 0
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  const submit = async () => {
    setError('')
    setIssues({})
    if (mode === 'existing' && !picked) return setError('Choose a guest first.')
    if (mode === 'new') {
      if (guest.name.trim().length < 2) return setIssues({ name: 'Enter the guest’s name.' })
      if (!/^\S+@\S+\.\S+$/.test(guest.email.trim())) return setIssues({ email: 'Enter a valid email.' })
      if (guest.phone.trim() && !toPhone(guest.phone)) return setIssues({ phone: 'Use a 10-digit mobile number.' })
    }
    setBusy(true)
    const r = await createAdminBooking({
      ...(mode === 'existing' ? { userId: picked!.id } : { guest: { name: guest.name.trim(), email: guest.email.trim(), phone: toPhone(guest.phone) } }),
      booking: {
        roomId: f.roomId,
        checkIn: f.checkIn,
        checkOut: f.checkOut,
        rooms: f.rooms,
        adults: f.adults,
        children: f.children,
        extraBed: f.extraBed,
        specialRequests: f.specialRequests.trim() || null,
      },
      status: f.status,
      paymentStatus: f.paymentStatus,
    })
    setBusy(false)
    if (r.ok) {
      onCreated(r.data)
      return onClose()
    }
    if (r.error.kind === 'unauthenticated' || r.error.kind === 'forbidden') return onAuthError(r.error)
    const raw = fieldIssues(r.error)
    setIssues(raw)
    setError(Object.keys(raw).length ? 'Please fix the highlighted fields.' : r.error.message)
  }

  const tab = (m: 'new' | 'existing', label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      className={cn('min-h-10 flex-1 rounded-md px-3 text-sm font-semibold transition-colors', mode === m ? 'bg-burgundy text-ivory' : 'text-walnut hover:bg-gold-soft/40')}
    >
      {label}
    </button>
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl text-burgundy-deep">New booking</DialogTitle>
        <DialogDescription>For a phone call or a guest at the desk. Confirmed by default.</DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold text-walnut">Guest</legend>
        <div role="group" aria-label="Guest type" className="flex gap-1 rounded-lg border bg-background p-0.5">
          {tab('new', 'New guest')}
          {tab('existing', 'Existing guest')}
        </div>
        {mode === 'new' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="nb-name" label="Full name" error={issues.name}>
              {(a) => <Input {...a} value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} autoComplete="off" />}
            </Field>
            <Field id="nb-phone" label="Mobile" optional error={issues.phone}>
              {(a) => <Input {...a} inputMode="numeric" placeholder="10 digits" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />}
            </Field>
            <Field id="nb-email" label="Email" className="sm:col-span-2" error={issues.email} hint="If this email already has an account, the booking is added to it.">
              {(a) => <Input {...a} type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} autoComplete="off" />}
            </Field>
          </div>
        ) : (
          <div className="grid gap-2">
            <Input aria-label="Search guests" type="search" placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            {picked && (
              <p className="rounded-md border border-gold bg-gold-soft/30 px-3 py-2 text-sm text-walnut">
                Booking for <span className="font-semibold">{picked.name}</span> · {picked.email}
              </p>
            )}
            <ul className="grid gap-1">
              {found.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => setPicked(u)} className={cn('flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm hover:border-burgundy', picked?.id === u.id && 'border-burgundy')}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                    </span>
                    {picked?.id === u.id && <span className="text-xs font-semibold text-burgundy">Selected</span>}
                  </button>
                </li>
              ))}
              {search.trim().length >= 2 && found.length === 0 && <li className="px-1 text-sm text-muted-foreground">No guests found. Use “New guest”.</li>}
            </ul>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-walnut">Stay</legend>
        <Field id="nb-room" label="Room type">
          {(a) => (
            <select {...a} className={selectClass} value={f.roomId} onChange={(e) => set('roomId', e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {formatINR(r.rate)} a night
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="nb-rooms" label="Rooms" error={issues.rooms}>
          {(a) => <Input {...a} type="number" min={1} max={5} value={f.rooms} onChange={(e) => set('rooms', Number(e.target.value))} />}
        </Field>
        <Field id="nb-in" label="Check-in" error={issues.checkIn}>
          {(a) => <Input {...a} type="date" min={istDate(0)} value={f.checkIn} onChange={(e) => set('checkIn', e.target.value)} />}
        </Field>
        <Field id="nb-out" label="Check-out" error={issues.checkOut}>
          {(a) => <Input {...a} type="date" min={f.checkIn} value={f.checkOut} onChange={(e) => set('checkOut', e.target.value)} />}
        </Field>
        <Field id="nb-adults" label="Adults" error={issues.adults}>
          {(a) => <Input {...a} type="number" min={1} value={f.adults} onChange={(e) => set('adults', Number(e.target.value))} />}
        </Field>
        <Field id="nb-children" label="Children" error={issues.children}>
          {(a) => <Input {...a} type="number" min={0} max={10} value={f.children} onChange={(e) => set('children', Number(e.target.value))} />}
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm text-walnut sm:col-span-2">
          <input type="checkbox" className="size-5 accent-burgundy" checked={f.extraBed} onChange={(e) => set('extraBed', e.target.checked)} /> Extra bed
        </label>
        <Field id="nb-notes" label="Special requests" optional className="sm:col-span-2">
          {(a) => <Textarea {...a} rows={2} maxLength={500} value={f.specialRequests} onChange={(e) => set('specialRequests', e.target.value)} />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-walnut">Status and payment</legend>
        <Field id="nb-status" label="Booking status">
          {(a) => (
            <select {...a} className={selectClass} value={f.status} onChange={(e) => set('status', e.target.value as typeof f.status)}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Awaiting confirmation</option>
            </select>
          )}
        </Field>
        <Field id="nb-pay" label="Payment">
          {(a) => (
            <select {...a} className={selectClass} value={f.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value as typeof f.paymentStatus)}>
              <option value="pay_at_hotel">Pay at hotel</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          )}
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-cream p-3">
        <p className="text-sm text-walnut">
          {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'} × ${f.rooms} ${f.rooms === 1 ? 'room' : 'rooms'}` : 'Choose valid dates'}
          <span className="block text-xs text-muted-foreground">Room charge, excluding taxes and extra bed</span>
        </p>
        <p className="font-display text-2xl text-burgundy tabular-nums">{formatINR(total)}</p>
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
          {busy ? 'Creating…' : 'Create booking'}
        </Button>
      </div>
    </>
  )
}
