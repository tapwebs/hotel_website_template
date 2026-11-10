import { useRef, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Picture } from '@/components/Picture'
import type { GalleryItem } from '@/data/images'
import { play } from '@/lib/sounds'

interface LightboxProps {
  items: GalleryItem[]
  index: number | null
  onIndexChange: (index: number | null) => void
  /** Thumbnail that opened the lightbox; there is no Radix trigger, so focus returns here on close. */
  opener: RefObject<HTMLElement | null>
}

/** Radix Dialog gives the focus trap, Esc to close and focus return. Arrow keys step through. */
export function Lightbox({ items, index, onIndexChange, opener }: LightboxProps) {
  const item = index === null ? undefined : items[index]
  const touchX = useRef<number | null>(null)
  const step = (d: number) => {
    if (index === null) return
    play('whoosh')
    onIndexChange((index + d + items.length) % items.length)
  }

  return (
    <Dialog open={item !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className="max-w-[min(96vw,80rem)] gap-4 border-gold/40 bg-ink p-3 text-cream sm:max-w-[min(96vw,80rem)] sm:p-5 on-dark [&>[data-slot=dialog-close]]:bg-ink/80 [&>[data-slot=dialog-close]]:text-ivory"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          opener.current?.focus()
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const dx = (e.changedTouches[0]?.clientX ?? 0) - (touchX.current ?? 0)
          if (touchX.current !== null && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
          touchX.current = null
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1)
          if (e.key === 'ArrowLeft') step(-1)
        }}
      >
        {item ? (
          <>
            <Picture image={item.image} sizes="96vw" className="h-[min(65svh,52rem)] w-full" imgClassName="object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="grid min-w-0 gap-1">
                <DialogTitle className="font-sans text-sm font-semibold text-gold-soft">
                  {item.category}, {index! + 1} of {items.length}
                </DialogTitle>
                <DialogDescription className="text-sm text-cream/85">{item.image.alt}</DialogDescription>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="grid size-11 place-items-center rounded-md border border-cream/30 hover:border-gold-soft hover:text-gold-soft"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="grid size-11 place-items-center rounded-md border border-cream/30 hover:border-gold-soft hover:text-gold-soft"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
