import { Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hotel } from '@/data/hotel'

/** "Send by Email" + "Call Now" row under the primary WhatsApp submit button. */
export function EmailCallButtons({ onEmail }: { onEmail: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button type="button" variant="outline" sound={false} onClick={onEmail}>
        <Mail aria-hidden="true" /> Send by Email
      </Button>
      <Button asChild variant="outline">
        <a href={hotel.phoneHrefTertiary}>
          <Phone aria-hidden="true" /> Call Now
        </a>
      </Button>
    </div>
  )
}
