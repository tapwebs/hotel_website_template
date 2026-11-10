import { useEffect, useRef } from 'react'
import { Mail, MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hotel } from '@/data/hotel'
import { inlineLink, cn } from '@/lib/utils'

interface RequestReadyProps {
  whatsappUrl: string
  mailtoUrl: string
  onEdit: () => void
}

/** Confirmation state shared by every enquiry form. Never claims a booking is made. */
export function RequestReady({ whatsappUrl, mailtoUrl, onEdit }: RequestReadyProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <div role="status" className="grid gap-5 rounded-md border border-gold/60 bg-ivory p-6">
      <div className="hairline w-16" aria-hidden="true" />
      <h3 ref={headingRef} tabIndex={-1} className="text-h3 text-burgundy outline-none">
        Your request is ready.
      </h3>
      <p className="max-w-prose text-walnut">
        The hotel will confirm availability on WhatsApp. If WhatsApp did not open, use one of the options below.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> Open WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={mailtoUrl}>
            <Mail aria-hidden="true" /> Send by Email
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={hotel.phoneHrefTertiary}>
            <Phone aria-hidden="true" /> Call Now
          </a>
        </Button>
      </div>
      <button type="button" onClick={onEdit} className={cn('min-h-11 justify-self-start text-sm', inlineLink, 'hover:text-burgundy-deep')}>
        Edit request
      </button>
    </div>
  )
}
