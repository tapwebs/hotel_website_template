import { useState } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { hotel } from '@/data/hotel'

const defaultMsg = 'Hello, I have a question about TapMenu Grand Resort.'

/** Press feedback: a slight scale-down on tap (Tailwind v4 `scale` is its own property, so list it in the transition). */
const tap =
  'h-12 px-2 transition-[color,background-color,border-color,box-shadow,scale,translate] active:scale-[0.98] motion-reduce:transition-none'
const outline = `${tap} border-gold/50 bg-ivory/70 text-burgundy shadow-none hover:bg-gold-soft/40`

/** Sticky Call / WhatsApp / Book bar below md. Body padding in index.css keeps it off the footer, so the bar stays 4rem tall. */
export function MobileActionBar() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav
        aria-label="Quick contact"
        className="m-bar-in fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-cream/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-[0_-8px_24px_-14px_rgb(74_17_27/0.35)] backdrop-blur supports-[backdrop-filter]:bg-cream/85 md:hidden"
      >
        {/* Gold top hairline */}
        <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-gold/0 via-gold/80 to-gold/0" />
        <div className="grid grid-cols-3 gap-2 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            className={outline}
            onClick={() => setSheetOpen(true)}
            aria-label="Call the hotel"
          >
            <Phone aria-hidden="true" /> Call
          </Button>
          <Button
            type="button"
            variant="outline"
            className={outline}
            onClick={() => setSheetOpen(true)}
            aria-label="WhatsApp the hotel"
          >
            <MessageCircle aria-hidden="true" /> WhatsApp
          </Button>
          <BookNowButton className={`${tap} shadow-[0_6px_16px_-10px_rgb(74_17_27/0.8)] hover:bg-burgundy-deep`}>Book</BookNowButton>
        </div>
      </nav>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-t border-gold/60 bg-cream p-5 pb-8 sm:max-w-md sm:mx-auto">
          <SheetHeader className="border-b border-border/80 pb-3">
            <SheetTitle className="font-display text-xl text-burgundy">Connect with us</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Choose a line to Call or WhatsApp directly.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-3">
            {hotel.contactLines.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-ivory p-3 shadow-xs"
              >
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">{c.label}</span>
                  <span className="font-semibold text-base text-burgundy">{c.phoneDisplay}</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={buildWhatsAppUrl(defaultMsg, c.whatsappNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSheetOpen(false)}
                    aria-label={`WhatsApp ${c.phoneDisplay}`}
                    className="flex size-10 items-center justify-center rounded-md border border-emerald-600/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                  >
                    <MessageCircle className="size-5" />
                  </a>
                  <a
                    href={c.phoneHref}
                    onClick={() => setSheetOpen(false)}
                    aria-label={`Call ${c.phoneDisplay}`}
                    className="flex size-10 items-center justify-center rounded-md border border-gold/60 bg-cream text-burgundy hover:bg-burgundy hover:text-ivory transition-colors"
                  >
                    <Phone className="size-5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
