import { Link } from 'react-router'
import type { CSSProperties } from 'react'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { Button } from '@/components/ui/button'
import { JharokhaFrame, Picture } from '@/components/Picture'
import { images } from '@/data/images'
import { hotel } from '@/data/hotel'
import { formatINR } from '@/lib/format'
import { cn, container } from '@/lib/utils'

const headline = ['Indian luxury,', 'within easy reach']

/**
 * The page's one orchestrated moment: the arch opens on the facade while the headline rises,
 * the back frame slides out, a gold inlay draws down the arch and the mural drifts behind.
 * Pure CSS, so it plays on first load of the prerendered page too. Reduced motion is handled
 * globally in index.css (animations collapse to ~0ms).
 */
export function Hero() {
  const rise = (delay: number, className?: string) => ({
    className: cn(className, 'animate-rise'),
    style: { '--delay': `${delay}s` } as CSSProperties,
  })

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      {/* Full-bleed mural, faded out under the text (left on desktop) and into the next section (bottom). */}
      <Picture
        image={images.decorative.peonies}
        priority
        sizes="(max-width: 767px) 50vw, 100vw"
        className="animate-drift pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-multiply mask-b-from-45% lg:mask-b-from-70% lg:mask-l-from-45%"
      />
      <div
        className={cn(
          container,
          'relative grid items-center gap-6 md:gap-12 pt-6 pb-8 md:pt-10 md:pb-12 lg:min-h-[calc(100svh-4.5rem)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-14',
        )}
      >
        <div className="order-1 grid gap-4 md:gap-7 lg:order-1">
          <h1 id="hero-title" className="text-display text-burgundy-deep">
            <span
              {...rise(0.1, 'mb-3 md:mb-7 flex items-center gap-3 font-sans text-sm font-medium tracking-normal text-muted-foreground')}
            >
              <span className="hairline animate-grow w-10 shrink-0" style={{ '--delay': '0.3s' } as CSSProperties} aria-hidden="true" />
              TapMenu Grand Resort & Spa · Luxury Hospitality
            </span>
            {headline.map((line, i) => (
              <span key={line} {...rise(0.2 + i * 0.12, cn('block', i === 1 && 'italic text-burgundy'))}>
                {line}
              </span>
            ))}
          </h1>
          <p {...rise(0.5, 'max-w-[34rem] text-lede text-walnut')}>
            Wood, marble and hand-painted architecture. Rooms from {formatINR(hotel.priceFrom)} a night.
          </p>
          <div {...rise(0.62, 'flex flex-wrap gap-3')}>
            <BookNowButton size="lg" />
            <Button asChild size="lg" variant="outline" className="border-walnut/30 bg-transparent">
              <Link to="/rooms">View Rooms</Link>
            </Button>
          </div>
        </div>

        {/* Width drives the 3:4 arch; on desktop it is capped by viewport height so the hero fits one screen. */}
        <div className="relative order-2 mx-auto w-[min(52%,13rem)] sm:w-[min(60%,18rem)] lg:order-2 lg:w-[min(100%,calc((100svh_-_11rem)*0.75))]">
          {/* Back frame: same size and arch as the photo, offset up-right, slides out from behind it. */}
          <JharokhaFrame
            className="animate-frame-in absolute inset-0 translate-x-3 -translate-y-3 sm:translate-x-5 sm:-translate-y-5"
            aria-hidden
          >
            <div className="h-full bg-gold-soft/70" />
          </JharokhaFrame>
          <div className="relative drop-shadow-[0_28px_32px_rgb(74_17_27/0.2)]">
            <JharokhaFrame className="animate-arch-open aspect-[3/4]">
              <div className="animate-settle h-full">
                <Picture
                  image={images.home.hero}
                  priority
                  sizes="(max-width: 639px) 13rem, (max-width: 767px) 18rem, (min-width: 1024px) 40vw, (min-width: 448px) 352px, 80vw"
                  className="h-full"
                />
              </div>
            </JharokhaFrame>
          </div>
          {/* Gold inlay that draws down both sides from the arch apex. */}
          <div className="pointer-events-none absolute inset-3 sm:inset-4" aria-hidden="true">
            <svg
              viewBox="0 0 100 133.333"
              preserveAspectRatio="none"
              className="animate-draw size-full overflow-visible text-gold drop-shadow-[0_0_1px_rgb(36_24_18/0.45)]"
              fill="none"
              stroke="currentColor"
              strokeWidth={0.35}
              strokeDasharray={1}
            >
              <path pathLength={1} d="M50 0C46 3.5 40 5.5 30 7.5 17 10 0 17 0 31V133.333" />
              <path pathLength={1} d="M50 0C54 3.5 60 5.5 70 7.5 83 10 100 17 100 31V133.333" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
