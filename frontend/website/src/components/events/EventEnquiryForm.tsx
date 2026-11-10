import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO, startOfToday } from 'date-fns'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { playError } from '@/lib/sounds'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, selectClass } from '@/components/forms/Field'
import { RequestReady } from '@/components/forms/RequestReady'
import { EmailCallButtons } from '@/components/forms/EnquiryActions'
import { NamePhoneFields } from '@/components/forms/EnquiryFields'
import { useEnquirySend } from '@/components/forms/useEnquirySend'
import { buildEventMessage } from '@/components/booking/buildWhatsAppUrl'
import { phoneSchema } from '@/components/booking/phoneSchema'
import { eventTypes } from '@/data/events'

const venueLabels = { hall: 'Indoor banquet hall', lawn: 'Outdoor function lawn', both: 'Hall and lawn' } as const

const schema = z.object({
  eventType: z.enum(eventTypes, { error: 'Choose the type of event.' }),
  date: z
    .string()
    .min(1, 'Choose the event date.')
    .refine((v) => parseISO(v) >= startOfToday(), 'Choose today or a future date.'),
  guests: z.coerce
    .number({ error: 'Enter the number of guests.' })
    .int('Enter a whole number.')
    .min(1, 'Enter at least 1 guest.')
    .max(2000, 'The lawn hosts up to around 2,000 guests. Call us for larger events.'),
  venue: z.enum(['hall', 'lawn', 'both']),
  catering: z.enum(['yes', 'no']),
  name: z.string().trim().min(2, 'Enter your name.'),
  phone: phoneSchema,
  notes: z.string().max(500, 'Keep notes under 500 characters.'),
})

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export function EventEnquiryForm() {
  const { ready, clear, open } = useEnquirySend()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: { eventType: 'Wedding', date: '', guests: '', venue: 'lawn', catering: 'yes', name: '', phone: '', notes: '' },
  })

  const send = (channel: 'whatsapp' | 'email') =>
    handleSubmit((v) => {
      const message = buildEventMessage({
        eventType: v.eventType,
        date: parseISO(v.date),
        guests: v.guests,
        venue: venueLabels[v.venue],
        catering: v.catering === 'yes',
        name: v.name,
        phone: v.phone,
        notes: v.notes,
      })
      open(channel, message, `Event enquiry: ${v.eventType}`)
    }, playError)

  if (ready) return <RequestReady {...ready} onEdit={clear} />

  return (
    <form noValidate onSubmit={send('whatsapp')} className="grid gap-5 sm:grid-cols-2" aria-label="Event enquiry">
      <Field id="ev-type" label="Event type" error={errors.eventType?.message}>
        {(aria) => (
          <select {...aria} {...register('eventType')} className={selectClass}>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id="ev-date" label="Event date" error={errors.date?.message}>
        {(aria) => <Input {...aria} {...register('date')} type="date" min={format(startOfToday(), 'yyyy-MM-dd')} autoComplete="off" />}
      </Field>
      <Field id="ev-guests" label="Number of guests" error={errors.guests?.message}>
        {(aria) => (
          <Input
            {...aria}
            {...register('guests')}
            type="number"
            inputMode="numeric"
            min={1}
            max={2000}
            autoComplete="off"
            placeholder="Enter number of guests"
          />
        )}
      </Field>
      <Field id="ev-venue" label="Venue" error={errors.venue?.message}>
        {(aria) => (
          <select {...aria} {...register('venue')} className={selectClass}>
            <option value="lawn">Outdoor lawn (up to around 2,000)</option>
            <option value="hall">Banquet hall (around 120)</option>
            <option value="both">Both hall and lawn</option>
          </select>
        )}
      </Field>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-semibold text-walnut">Catering by our kitchen?</legend>
        <div className="flex flex-wrap gap-3">
          {(['yes', 'no'] as const).map((v) => (
            <label
              key={v}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-ivory px-4 has-[:checked]:border-burgundy has-[:checked]:bg-[#f3e4df]"
            >
              <input type="radio" value={v} {...register('catering')} className="size-4 accent-burgundy" />
              {v === 'yes' ? 'Yes, include catering' : 'No catering'}
            </label>
          ))}
        </div>
      </fieldset>
      <NamePhoneFields
        nameId="ev-name"
        phoneId="ev-phone"
        nameProps={register('name')}
        phoneProps={register('phone')}
        nameError={errors.name?.message}
        phoneError={errors.phone?.message}
      />
      <Field id="ev-notes" label="Tell us about the occasion" optional error={errors.notes?.message} className="sm:col-span-2">
        {(aria) => (
          <Textarea {...aria} {...register('notes')} rows={4} autoComplete="off" placeholder="Functions, timings, guest rooms needed…" />
        )}
      </Field>
      <div className="grid gap-3 sm:col-span-2">
        <Button type="submit" size="lg">
          <MessageCircle aria-hidden="true" /> Send Enquiry on WhatsApp
        </Button>
        <EmailCallButtons onEmail={send('email')} />
      </div>
    </form>
  )
}
