import { MessageCircle, Phone } from 'lucide-react'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { hotel } from '@/data/hotel'
import { inlineLink, cn } from '@/lib/utils'
// Plain <a>/<button> only: this renders outside the router context when the app itself crashes.
const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy'
/** Friendly crash screen. Never shows error details to guests. */
export function ErrorFallback() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-2xl content-center gap-6 bg-cream px-4 py-20 text-walnut" role="alert">
      <div className="hairline w-20" aria-hidden="true" />
      <h1 className="text-h1 text-burgundy-deep">Something went wrong</h1>
      <p className="text-lede">
        Sorry, this page could not load. Please reload, or head back home. To book or ask a question right now, message or call us.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => window.location.reload()} className={`${btn} bg-burgundy text-ivory`}>
          Reload page
        </button>
        <a href="/" className={`${btn} border border-burgundy text-burgundy`}>
          Go to Home
        </a>
      </div>
      <div className="flex flex-wrap gap-x-6">
        <a
          href={buildWhatsAppUrl(`Hello ${hotel.name}, I would like to make an enquiry.`)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-flex min-h-11 items-center gap-2', inlineLink)}
        >
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp us
        </a>
        <a href={hotel.phoneHref} className={cn('inline-flex min-h-11 items-center gap-2', inlineLink)}>
          <Phone className="size-4" aria-hidden="true" /> {hotel.phoneDisplay}
        </a>
        <a href={hotel.phoneHrefSecondary} className={cn('inline-flex min-h-11 items-center gap-2', inlineLink)}>
          <Phone className="size-4" aria-hidden="true" /> {hotel.phoneDisplaySecondary}
        </a>
      </div>
    </main>
  )
}
