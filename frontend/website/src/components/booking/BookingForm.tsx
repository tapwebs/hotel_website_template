import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, format, startOfToday } from 'date-fns'
import { useState } from 'react'
import { CalendarCheck, ChevronDown, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { play, playError } from '@/lib/sounds'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, FieldError } from '@/components/forms/Field'
import { RequestReady } from '@/components/forms/RequestReady'
import { EmailCallButtons } from '@/components/forms/EnquiryActions'
import { NamePhoneFields } from '@/components/forms/EnquiryFields'
import { useEnquirySend } from '@/components/forms/useEnquirySend'
import { extraBedNote, getRoom, rooms as roomList, type RoomId } from '@/data/rooms'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { authBaseUrl } from '@/features/auth/authService'
import { toYmd } from '@/features/account/dates'
import type { BookingDraft } from '@/features/reserve/draft'
import { BookingSummary } from './BookingSummary'
import { Stepper, StepNum } from './Stepper'
import { buildBookingMessage, nightsBetween } from './buildWhatsAppUrl'
import { phoneSchema } from './phoneSchema'

const MAX_ROOMS = 5

const schema = z
  .object({
    checkIn: z.date({ error: 'Choose your check-in date.' }),
    checkOut: z.date({ error: 'Choose your check-out date.' }),
    roomId: z.enum(['deluxe', 'super-deluxe']),
    rooms: z.coerce.number().int().min(1).max(MAX_ROOMS),
    adults: z.coerce.number().int().min(1),
    extraBed: z.boolean(),
    name: z.string().trim().min(2, 'Enter your name.'),
    phone: phoneSchema,
    email: z.union([z.literal(''), z.email('Enter a valid email, or leave it empty.')]),
    notes: z.string().max(500, 'Keep notes under 500 characters.'),
  })
  .superRefine((v, ctx) => {
    if (nightsBetween(v.checkIn, v.checkOut) < 1)
      ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out must be at least 1 night after check-in.' })
    if (v.adults > v.rooms * 2)
      ctx.addIssue({ code: 'custom', path: ['adults'], message: 'Each room sleeps up to 2 adults. Add a room or reduce adults.' })
    if (v.adults < v.rooms) ctx.addIssue({ code: 'custom', path: ['adults'], message: 'Each room needs at least 1 adult.' })
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

interface BookingFormProps {
  defaultRoomId?: RoomId
  /** Prefix for element ids, so two forms can share a page. */
  idPrefix?: string
  /** Kept for call-site compatibility; the layout is now responsive by itself. */
  layout?: 'compact' | 'wide'
  /** When set (and the accounts API is configured) a "Reserve online" action is offered; it receives the selection. */
  onReserveOnline?: (draft: BookingDraft) => void
}

export default function BookingForm({ defaultRoomId = 'deluxe', idPrefix = 'book', onReserveOnline }: BookingFormProps) {
  const { ready, clear, open } = useEnquirySend()
  const today = startOfToday()

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    setValue,
    trigger,
    getValues,
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      checkIn: undefined,
      checkOut: undefined,
      roomId: defaultRoomId,
      rooms: 1,
      adults: 2,
      extraBed: false,
      name: '',
      phone: '',
      email: '',
      notes: '',
    },
  })

  const [checkIn, checkOut, roomId, roomsCount, adultsCount] = useWatch({
    control,
    name: ['checkIn', 'checkOut', 'roomId', 'rooms', 'adults'],
  })
  const [showMore, setShowMore] = useState(false)
  const room = getRoom(roomId as RoomId)
  const roomsNum = Number(roomsCount) || 1
  const adultsNum = Number(adultsCount) || 1

  const send = (channel: 'whatsapp' | 'email') =>
    handleSubmit((v) => {
      const r = getRoom(v.roomId)
      const message = buildBookingMessage({
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        roomName: r.name,
        rate: r.rate,
        rooms: v.rooms,
        adults: v.adults,
        extraBed: v.extraBed,
        name: v.name,
        phone: v.phone,
        email: v.email,
        notes: v.notes,
      })
      open(channel, message, `Room request: ${r.name}`)
    }, playError)

  const reserveOnline = async () => {
    // Name and phone are not needed for an account booking: validate only what the booking uses.
    if (!(await trigger(['roomId', 'checkIn', 'checkOut', 'rooms', 'adults', 'notes']))) return playError()
    play('click')
    const v = getValues()
    onReserveOnline?.({
      roomId: v.roomId,
      checkIn: toYmd(v.checkIn as Date),
      checkOut: toYmd(v.checkOut as Date),
      rooms: Number(v.rooms),
      adults: Number(v.adults),
      children: 0,
      extraBed: v.extraBed,
      notes: v.notes ?? '',
    })
  }
  if (ready) return <RequestReady {...ready} onEdit={clear} />

  const id = (name: string) => `${idPrefix}-${name}`
  const toDate = (v: string) => {
    const [y, m, d] = v.split('-').map(Number)
    return v ? new Date(y, m - 1, d) : (undefined as unknown as Date)
  }
  const setDate = (name: 'checkIn' | 'checkOut', v: string) => {
    const opts = { shouldValidate: isSubmitted, shouldDirty: true }
    const d = toDate(v)
    setValue(name, d, opts)
    // Keep check-out after check-in so nights always compute.
    if (name === 'checkIn' && d && checkOut && nightsBetween(d, checkOut) < 1) setValue('checkOut', addDays(d, 1), opts)
  }
  const iso = (d?: Date) => (d instanceof Date && !isNaN(+d) ? format(d, 'yyyy-MM-dd') : '')
  const minOut = format(checkIn instanceof Date ? addDays(checkIn, 1) : addDays(today, 1), 'yyyy-MM-dd')
  const dateInput =
    'h-12 w-full min-w-0 rounded-md border border-input bg-ivory px-3 text-base text-walnut shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'
  const msgs = [errors.checkIn, errors.checkOut, errors.adults, errors.name, errors.phone, errors.email, errors.notes]
    .map((e) => e?.message)
    .filter(Boolean)

  return (
    <form
      noValidate
      onSubmit={send('whatsapp')}
      className="grid gap-5"
      aria-label={idPrefix === 'sheet' ? 'Quick room request' : 'Room request'}
    >
      <div className="sr-only" aria-live="polite">
        {msgs.length ? `${msgs.length} ${msgs.length === 1 ? 'problem' : 'problems'}: ${msgs.join(' ')}` : ''}
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-walnut">
          <StepNum n={1} /> Room &amp; dates
        </legend>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Room type">
          {roomList.map((r) => (
            <label
              key={r.id}
              className="relative flex min-h-16 cursor-pointer flex-col justify-center rounded-md border border-border bg-ivory px-3 py-2 has-[:checked]:border-burgundy has-[:checked]:bg-cream has-[:checked]:ring-2 has-[:checked]:ring-burgundy/30 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <input type="radio" value={r.id} {...register('roomId')} className="sr-only" />
              <span className="text-sm font-semibold text-walnut">{r.name}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{formatINR(r.rate)} / night</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id={id('checkin')} label="Check-in" error={errors.checkIn?.message}>
            {(aria) => (
              <input
                {...aria}
                type="date"
                min={format(today, 'yyyy-MM-dd')}
                value={iso(checkIn)}
                onChange={(e) => setDate('checkIn', e.target.value)}
                autoComplete="off"
                className={dateInput}
              />
            )}
          </Field>
          <Field id={id('checkout')} label="Check-out" error={errors.checkOut?.message}>
            {(aria) => (
              <input
                {...aria}
                type="date"
                min={minOut}
                value={iso(checkOut)}
                onChange={(e) => setDate('checkOut', e.target.value)}
                autoComplete="off"
                className={dateInput}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-walnut">
          <StepNum n={2} /> Guests &amp; details
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label="Rooms"
            value={roomsNum}
            min={1}
            max={MAX_ROOMS}
            onChange={(n) => setValue('rooms', n, { shouldValidate: isSubmitted, shouldDirty: true })}
          />
          <Stepper
            label="Adults"
            value={adultsNum}
            min={1}
            max={MAX_ROOMS * 2}
            onChange={(n) => setValue('adults', n, { shouldValidate: true, shouldDirty: true })}
          />
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">Up to 2 adults per room.</p>
        {errors.adults?.message ? <FieldError id={id('adults-error')}>{errors.adults.message}</FieldError> : null}
        <Controller
          control={control}
          name="extraBed"
          render={({ field }) => (
            <label
              htmlFor={id('extra-bed')}
              className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-ivory px-3 py-2"
            >
              <span className="grid">
                <span className="text-sm font-semibold text-walnut">Extra bed</span>
                <span className="text-xs text-muted-foreground">{extraBedNote}</span>
              </span>
              <Switch
                id={id('extra-bed')}
                checked={field.value}
                onCheckedChange={field.onChange}
                className="data-[size=default]:h-6 data-[size=default]:w-11 [&>span]:group-data-[size=default]/switch:size-5"
              />
            </label>
          )}
        />
        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <NamePhoneFields
            nameId={id('name')}
            phoneId={id('phone')}
            nameProps={register('name')}
            phoneProps={register('phone')}
            nameError={errors.name?.message}
            phoneError={errors.phone?.message}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          aria-controls={id('more')}
          className="flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-burgundy outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronDown
            className={cn('size-4 transition-transform motion-reduce:transition-none', showMore && 'rotate-180')}
            aria-hidden="true"
          />
          Add email or notes
        </button>
        <div id={id('more')} hidden={!showMore} className="grid gap-3">
          <Field id={id('email')} label="Email" optional error={errors.email?.message}>
            {(aria) => (
              <Input
                {...aria}
                {...register('email')}
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="Enter your email address"
              />
            )}
          </Field>
          <Field id={id('notes')} label="Notes" optional error={errors.notes?.message}>
            {(aria) => <Textarea {...aria} {...register('notes')} autoComplete="off" rows={2} placeholder="Arrival time, access needs…" />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-walnut">
          <StepNum n={3} /> Confirm
        </legend>
        <BookingSummary room={room} rooms={roomsNum} checkIn={checkIn} checkOut={checkOut} />
        {onReserveOnline && authBaseUrl() ? (
          <Button type="button" size="lg" sound={false} className="min-h-12 w-full" onClick={() => void reserveOnline()}>
            <CalendarCheck aria-hidden="true" /> Reserve online and track it in your account
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          variant={onReserveOnline && authBaseUrl() ? 'outline' : 'default'}
          className="min-h-12 w-full"
        >
          <MessageCircle aria-hidden="true" /> Send Request on WhatsApp
        </Button>
        <EmailCallButtons onEmail={send('email')} />
        <p className="text-xs text-muted-foreground">
          Sending opens WhatsApp with your request filled in. Your stay is confirmed only when the hotel replies.
        </p>
      </fieldset>
    </form>
  )
}
