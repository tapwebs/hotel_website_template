import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { addDays, startOfToday } from 'date-fns'
import { CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError } from '@/components/forms/Field'
import { BookingSummary } from '@/components/booking/BookingSummary'
import { Stepper } from '@/components/booking/Stepper'
import { hotel } from '@/data/hotel'
import { extraBedNote, getRoom, rooms as roomList } from '@/data/rooms'
import type { AdminError } from '@/features/admin/adminTypes'
import { createBooking, fieldIssues } from '@/features/account/accountApi'
import { formatStay, parseYmd, toYmd } from '@/features/account/dates'
import { RequireAuth } from '@/features/account/RequireAuth'
import { useAuth } from '@/features/auth/auth-context'
import { formatINR } from '@/lib/format'
import { play, playError } from '@/lib/sounds'
import { cn, container } from '@/lib/utils'
import { draftEstimate, draftToSearch, MAX_NOTES, MAX_ROOMS, parseDraft, validateDraft, type BookingDraft, type DraftField } from './draft'
const dateInput =
  'h-12 w-full min-w-0 rounded-md border border-input bg-ivory px-3 text-base text-walnut shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'
/** /book: the reservation form for signed-in guests; anonymous guests get a log in / sign up gate that keeps the selection. */
export function ReservePage() {
  const { auth } = useAuth()
  const [sp] = useSearchParams()
  const draft = parseDraft(sp)
  const returnTo = `/book?${draftToSearch(draft)}`
  if (auth.status === 'anonymous' && auth.configured) return <Gate draft={draft} returnTo={returnTo} />
  return (
    <RequireAuth>
      <ReserveForm />
    </RequireAuth>
  )
}
function Gate({ draft, returnTo }: { draft: BookingDraft; returnTo: string }) {
  const room = getRoom(draft.roomId)
  const { nights, total } = draftEstimate(draft)
  return (
    <div className={cn(container, 'max-w-2xl py-8 sm:py-10')}>
      <div className="grid gap-4 rounded-md border border-gold/60 bg-ivory p-6">
        <h1 className="font-display text-h2 text-burgundy">Log in or create an account to reserve</h1>
        <p className="text-walnut">Your selection is saved. After you log in you will come straight back here.</p>
        <p className="rounded-md bg-cream p-4 text-walnut">
          {room.name} × {draft.rooms}
          {draft.checkIn && draft.checkOut ? (
            <>
              <br />
              {formatStay(draft.checkIn)} to {formatStay(draft.checkOut)}
              {nights > 0 ? ` · ${nights} ${nights === 1 ? 'night' : 'nights'} · about ${formatINR(total)}` : ''}
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/login" state={{ from: returnTo }}>
              Log in
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/signup" state={{ from: returnTo }}>
              Create an account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
function ReserveForm() {
  const { clear } = useAuth()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [draft, setDraft] = useState<BookingDraft>(() => parseDraft(sp))
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState<AdminError | null>(null)
  const [serverErrors, setServerErrors] = useState<Partial<Record<DraftField, string>>>({})
  // One id per distinct request: a double click replays the same booking, an edited request gets a new id.
  const requestId = useRef(crypto.randomUUID())
  const sending = useRef(false)
  const today = startOfToday()
  // Keep the URL in step with the form, so a reload keeps the selection.
  useEffect(() => {
    const next = draftToSearch(draft)
    if (next !== draftToSearch(parseDraft(sp))) setSp(next, { replace: true })
  }, [draft, sp, setSp])
  const errors = useMemo(() => ({ ...validateDraft(draft), ...serverErrors }), [draft, serverErrors])
  const shown = attempted ? errors : {}
  const change = (patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setServerErrors({})
    setApiError(null)
    requestId.current = crypto.randomUUID()
  }
  const setDate = (name: 'checkIn' | 'checkOut', v: string) => {
    const patch: Partial<BookingDraft> = { [name]: v }
    const inD = parseYmd(name === 'checkIn' ? v : draft.checkIn)
    const outD = parseYmd(name === 'checkOut' ? v : draft.checkOut)
    // Keep check-out after check-in so nights always compute.
    if (name === 'checkIn' && inD && outD && outD <= inD) patch.checkOut = toYmd(addDays(inD, 1))
    change(patch)
  }
  const room = getRoom(draft.roomId)
  const inD = parseYmd(draft.checkIn)
  const outD = parseYmd(draft.checkOut)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending.current) return
    setAttempted(true)
    if (Object.keys(validateDraft(draft)).length) return playError()
    sending.current = true
    setBusy(true)
    setApiError(null)
    const r = await createBooking(
      {
        roomId: draft.roomId,
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        rooms: draft.rooms,
        adults: draft.adults,
        children: draft.children,
        extraBed: draft.extraBed,
        specialRequests: draft.notes.trim() || null,
      },
      requestId.current,
    )
    sending.current = false
    setBusy(false)
    if (r.ok) {
      play('success')
      return void navigate(`/book/confirmation/${encodeURIComponent(r.data.id)}`, { replace: true })
    }
    if (r.error.kind === 'unauthenticated') return clear()
    play('error')
    const issues = fieldIssues(r.error)
    const map: Record<string, DraftField> = { checkIn: 'checkIn', checkOut: 'checkOut', adults: 'adults', rooms: 'rooms', children: 'children', specialRequests: 'notes' }
    const fe: Partial<Record<DraftField, string>> = {}
    for (const [k, m] of Object.entries(issues)) if (map[k]) fe[map[k]] = m
    setServerErrors(fe)
    setApiError(r.error)
  }
  const msgs = Object.values(shown).filter(Boolean)
  return (
    <div className={cn(container, 'max-w-2xl py-8 sm:py-10')}>
      <h1 className="font-display text-h2 text-burgundy">Reserve your stay</h1>
      <p className="mt-2 text-walnut">Rooms from {formatINR(roomList[0].rate)} a night. Check-in and check-out at {hotel.checkIn}.</p>
      <form noValidate onSubmit={submit} aria-label="Reserve a room" className="mt-6 grid gap-6">
        <div className="sr-only" aria-live="polite">
          {msgs.length ? `${msgs.length} ${msgs.length === 1 ? 'problem' : 'problems'}: ${msgs.join(' ')}` : ''}
        </div>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-semibold text-walnut">Room</legend>
          <div className="grid grid-cols-2 gap-3">
            {roomList.map((r) => (
              <label
                key={r.id}
                className="relative flex min-h-16 cursor-pointer flex-col justify-center rounded-md border border-border bg-ivory px-3 py-2 has-[:checked]:border-burgundy has-[:checked]:bg-cream has-[:checked]:ring-2 has-[:checked]:ring-burgundy/30 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="radio"
                  name="room"
                  value={r.id}
                  checked={draft.roomId === r.id}
                  onChange={() => change({ roomId: r.id })}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-walnut">{r.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{formatINR(r.rate)} / night</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-semibold text-walnut">Dates</legend>
          <Field id="rs-in" label="Check-in" error={shown.checkIn}>
            {(aria) => (
              <input {...aria} type="date" min={toYmd(today)} value={draft.checkIn} onChange={(e) => setDate('checkIn', e.target.value)} autoComplete="off" className={dateInput} />
            )}
          </Field>
          <Field id="rs-out" label="Check-out" error={shown.checkOut}>
            {(aria) => (
              <input
                {...aria}
                type="date"
                min={toYmd(addDays(inD ?? today, 1))}
                value={draft.checkOut}
                onChange={(e) => setDate('checkOut', e.target.value)}
                autoComplete="off"
                className={dateInput}
              />
            )}
          </Field>
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-semibold text-walnut">Guests</legend>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            <Stepper label="Rooms" value={draft.rooms} min={1} max={MAX_ROOMS} onChange={(n) => change({ rooms: n })} />
            <Stepper label="Adults" value={draft.adults} min={1} max={MAX_ROOMS * room.maxAdults} onChange={(n) => change({ adults: n })} />
            <Stepper label="Children" value={draft.children} min={0} max={10} onChange={(n) => change({ children: n })} />
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">Up to {room.maxAdults} adults per room.</p>
          {shown.adults ? <FieldError id="rs-adults-error">{shown.adults}</FieldError> : null}
          {shown.rooms ? <FieldError id="rs-rooms-error">{shown.rooms}</FieldError> : null}
          {shown.children ? <FieldError id="rs-children-error">{shown.children}</FieldError> : null}
          <label
            htmlFor="rs-bed"
            className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-ivory px-3 py-2"
          >
            <span className="grid">
              <span className="text-sm font-semibold text-walnut">Extra bed</span>
              <span className="text-xs text-muted-foreground">{extraBedNote}</span>
            </span>
            <Switch id="rs-bed" checked={draft.extraBed} onCheckedChange={(c) => change({ extraBed: c })} />
          </label>
        </fieldset>
        <Field id="rs-notes" label="Special requests" optional hint={`${draft.notes.length}/${MAX_NOTES}`} error={shown.notes}>
          {(aria) => <Textarea {...aria} value={draft.notes} onChange={(e) => change({ notes: e.target.value })} rows={3} placeholder="Arrival time, access needs…" />}
        </Field>
        <BookingSummary room={room} rooms={draft.rooms} checkIn={inD ?? undefined} checkOut={outD ?? undefined} />
        <div aria-live="polite" className="empty:hidden">
          {apiError ? (
            <p role="alert" className="font-semibold text-destructive">
              {apiError.kind === 'validation' && Object.keys(serverErrors).length ? 'Please check the highlighted fields.' : apiError.message}
              {apiError.code === 'booking_limit' ? (
                <>
                  {' '}
                  <Link to="/account/bookings?filter=upcoming" className="underline underline-offset-4">
                    View upcoming bookings
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Button type="submit" size="lg" className="min-h-12 w-full" disabled={busy}>
            <CalendarCheck aria-hidden="true" /> {busy ? 'Reserving…' : 'Reserve'}
          </Button>
          <p className="text-xs text-muted-foreground">Your request is held as pending until the hotel confirms.</p>
        </div>
      </form>
    </div>
  )
}
