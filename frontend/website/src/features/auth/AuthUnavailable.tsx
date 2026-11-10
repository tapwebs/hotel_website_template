import { MessageCircle } from 'lucide-react'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { Button } from '@/components/ui/button'
import { hotel } from '@/data/hotel'
/** Shown when the auth API is not configured. Honest: nothing was created or signed in. */
export function AuthUnavailable() {
  return (
    <div role="status" className="grid gap-4 rounded-md border border-gold/60 bg-ivory p-6 max-md:p-5">
      <h2 className="text-h3 text-burgundy">Online accounts are launching soon</h2>
      <p className="text-walnut">
        Your details were not saved and no account was created. For now, book via WhatsApp and the hotel will confirm.
      </p>
      <div>
        <Button asChild className="max-md:h-12 max-md:w-full">
          <a href={buildWhatsAppUrl(`Hello ${hotel.name}, I would like to book a room.`)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> Book on WhatsApp
          </a>
        </Button>
      </div>
    </div>
  )
}
