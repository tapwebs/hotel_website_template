import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Phone, X } from 'lucide-react'
import { hotel } from '@/data/hotel'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'

const defaultMsg = 'Hello, I have a question about Hotel Dream Heaven’s.'

export function WhatsAppFab() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <aside aria-label="Quick contact" className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 hidden md:block">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Contact options"
          className="absolute right-0 bottom-16 mb-2 w-80 rounded-xl border border-gold/60 bg-cream p-4 shadow-[0_12px_36px_-12px_rgb(74_17_27/0.4)] backdrop-blur animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-burgundy">Chat or Call</h3>
              <p className="text-xs text-muted-foreground">Select a line to WhatsApp or Call</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close contact options"
              className="rounded-full p-1 text-muted-foreground hover:bg-gold-soft/30 hover:text-burgundy"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid gap-2.5">
            {hotel.contactLines.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-ivory p-2.5 transition-colors hover:border-gold/60"
              >
                <div className="min-w-0 pr-2">
                  <span className="block text-xs font-medium text-muted-foreground">{c.label}</span>
                  <span className="font-semibold text-sm text-burgundy">{c.phoneDisplay}</span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <a
                    href={buildWhatsAppUrl(defaultMsg, c.whatsappNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${c.phoneDisplay}`}
                    className="flex size-9 items-center justify-center rounded-md border border-emerald-600/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors"
                  >
                    <MessageCircle className="size-4" />
                  </a>
                  <a
                    href={c.phoneHref}
                    aria-label={`Call ${c.phoneDisplay}`}
                    className="flex size-9 items-center justify-center rounded-md border border-gold/60 bg-cream text-burgundy hover:bg-burgundy hover:text-ivory transition-colors"
                  >
                    <Phone className="size-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Chat or call the hotel"
        className="grid size-14 place-items-center rounded-full border border-gold/70 bg-burgundy text-ivory shadow-[0_10px_30px_-10px_rgb(74_17_27/0.7)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-burgundy-deep"
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </button>
    </aside>
  )
}
