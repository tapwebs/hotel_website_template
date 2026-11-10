import { MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { hotel } from '@/site/data/hotel'
import type { AdminBooking } from './adminTypes'

/** Call / WhatsApp the guest of a booking. Renders nothing when the guest has no phone number. */
export function GuestContact({ booking: b, size = 'icon-sm', labels = false }: { booking: AdminBooking; size?: 'icon-sm' | 'default'; labels?: boolean }) {
  const phone = b.guest?.phone
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const text = encodeURIComponent(`Hello ${b.guest?.name ?? ''}, this is ${hotel.name} about your booking ${b.reference}.`)
  const s = labels ? 'default' : size
  return (
    <>
      <Button asChild variant="outline" size={s} title={`Call ${phone}`}>
        <a href={`tel:${phone}`} aria-label={`Call ${b.guest?.name ?? 'guest'} on ${phone}`}>
          <Phone aria-hidden="true" /> {labels ? 'Call guest' : null}
        </a>
      </Button>
      <Button asChild variant="outline" size={s} title="WhatsApp the guest">
        <a href={`https://wa.me/${digits}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${b.guest?.name ?? 'guest'} (opens in a new tab)`}>
          <MessageCircle aria-hidden="true" /> {labels ? 'WhatsApp guest' : null}
        </a>
      </Button>
    </>
  )
}
