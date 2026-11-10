import { useState } from 'react'
import { Pause, Play, Star } from 'lucide-react'
import { reviews, type Review } from '@/data/reviews'
import { cn, container } from '@/lib/utils'

/** Guest reviews as a slow marquee. Pauses on hover/focus and via the button; static under reduced motion. */
export function Reviews() {
  const [paused, setPaused] = useState(false)

  return (
    <section aria-labelledby="reviews-title" className="pattern-buti overflow-hidden bg-ivory py-10 md:py-16 lg:py-28">
      <div className={cn(container, 'mb-6 md:mb-12 flex flex-wrap items-end justify-between gap-3 md:gap-6')}>
        <h2 id="reviews-title" className="max-w-[18ch] text-h2 text-burgundy-deep">
          What our guests say
        </h2>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-walnut transition-transform hover:border-burgundy hover:text-burgundy active:scale-[0.98] motion-reduce:hidden max-md:hidden"
        >
          {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
          {paused ? 'Play reviews' : 'Pause reviews'}
        </button>
      </div>

      <div
        role="region"
        aria-label="Guest reviews, scrolling"
        tabIndex={0}
        className="group outline-offset-[-3px] motion-reduce:overflow-x-auto motion-reduce:pb-4 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:pb-2 max-md:[scrollbar-width:none]"
      >
        <div
          className={cn(
            'flex w-max animate-marquee gap-4 px-3 md:gap-6 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:px-6 max-md:animate-none max-md:px-4',
            paused && '[animation-play-state:paused]',
          )}
          style={{ '--marquee-duration': '90s' } as React.CSSProperties}
        >
          <ul className="m-stagger flex gap-4 md:gap-6">
            {reviews.map((r) => (
              <ReviewCard key={r.quote} review={r} />
            ))}
          </ul>
          {/* Second copy makes the loop seamless; hidden from assistive tech and under reduced motion. */}
          <ul className="flex gap-4 md:gap-6 motion-reduce:hidden max-md:hidden" aria-hidden="true">
            {reviews.map((r) => (
              <ReviewCard key={r.quote} review={r} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="w-[min(22rem,80vw)] shrink-0 transition-transform active:scale-[0.98] max-md:snap-start">
      <figure className="grid h-full content-between gap-4 rounded-md border border-border bg-cream p-4 md:gap-6 md:p-6">
        <div className="grid gap-4">
          <p className="flex gap-1 text-burgundy" role="img" aria-label={`Rated ${review.rating} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={cn('size-4', i < review.rating ? 'fill-current' : 'text-border')} aria-hidden="true" />
            ))}
          </p>
          <blockquote lang={review.lang} className="font-display text-base leading-snug text-walnut md:text-lg">
            <p>“{review.quote}”</p>
          </blockquote>
        </div>
        <figcaption className="text-sm font-semibold text-muted-foreground">{review.lang === 'en' ? 'English' : 'Hinglish'}</figcaption>
      </figure>
    </li>
  )
}
