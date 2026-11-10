import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Picture } from '@/components/Picture'
import { gallery, type GalleryCategory } from '@/data/images'
import { cn } from '@/lib/utils'
import { play } from '@/lib/sounds'
import { Lightbox } from './Lightbox'

const categories: GalleryCategory[] = ['Exterior', 'Lobby', 'Rooms & Corridors', 'Banquet', 'Lighting', 'Murals']

/** Filterable photo grid. The active filter lives in the URL (?category=…). */
export function GalleryGrid() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('category')
  const active = categories.find((c) => c === raw) ?? null
  const items = active ? gallery.filter((g) => g.category === active) : gallery
  const [open, setOpen] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const choose = (c: GalleryCategory | null) => {
    play('tick')
    setParams(c ? { category: c } : {}, { replace: true, preventScrollReset: true })
    setOpen(null)
  }

  return (
    <>
      <div
        role="group"
        aria-label="Filter photos"
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {[null, ...categories].map((c) => (
          <button
            key={c ?? 'all'}
            type="button"
            aria-pressed={active === c}
            onClick={() => choose(c)}
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy',
              active === c
                ? 'border-burgundy bg-burgundy text-ivory'
                : 'border-border bg-ivory text-walnut hover:border-burgundy hover:text-burgundy',
            )}
          >
            {c ?? 'All'}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {items.length} photos{active ? ` in ${active}` : ''}.
      </p>
      <ul className="m-stagger grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
        {items.map((item, i) => (
          <li key={item.image.slug}>
            <button
              type="button"
              onClick={(e) => {
                opener.current = e.currentTarget
                setOpen(i)
              }}
              aria-haspopup="dialog"
              className="group block aspect-square w-full overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            >
              <span className="sr-only">Open larger: </span>
              <Picture
                as="span"
                image={item.image}
                sizes="(max-width: 767px) 48vw, (min-width: 1024px) 31vw, 48vw"
                showCaption={false}
                className="h-full"
                imgClassName="transition-transform duration-700 ease-[var(--ease-soft)] group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox items={items} index={open} onIndexChange={setOpen} opener={opener} />
    </>
  )
}
