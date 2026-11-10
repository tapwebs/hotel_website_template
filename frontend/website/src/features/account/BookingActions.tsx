import { useState } from 'react'
import { CalendarPlus, Check, Copy, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { hotel } from '@/data/hotel'
import { formatStay } from './dates'
import { downloadIcs } from './calendar'
import type { Booking } from './accountTypes'

/** Useful one-tap actions for a booking: directions, calendar, call, WhatsApp, share/copy. */
export function BookingActions({ booking: b, compact = false }: { booking: Booking; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  const live = b.status === 'pending' || b.status === 'confirmed'
  const text = `${hotel.name}: booking ${b.reference}, ${b.room.name}, ${formatStay(b.checkIn)} to ${formatStay(b.checkOut)}.`
  const share = async () => {
    try {
      if (canShare) await navigator.share({ title: hotel.name, text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }
  const size = compact ? 'sm' : 'default'
  return (
    <div className="flex flex-wrap gap-2">
      {live ? (
        <Button variant="outline" size={size} onClick={() => downloadIcs(b)}>
          <CalendarPlus aria-hidden="true" /> Add to calendar
        </Button>
      ) : null}
      <Button asChild variant="outline" size={size}>
        <a href={hotel.directionsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin aria-hidden="true" /> Directions<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Button>
      {!compact ? (
        <>
          <Button asChild variant="outline">
            <a href={hotel.phoneHref}>
              <Phone aria-hidden="true" /> Call
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={buildWhatsAppUrl(`Hello ${hotel.name}, about my booking ${b.reference}.`)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
        </>
      ) : null}
      <Button variant="outline" size={size} onClick={() => void share()}>
        {copied ? <Check aria-hidden="true" /> : canShare ? <Share2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? 'Copied' : canShare ? 'Share' : 'Copy details'}
      </Button>
    </div>
  )
}
