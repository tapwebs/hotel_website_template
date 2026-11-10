import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ArchPanel, LineDivider } from '@/components/LineArt'
import { Picture } from '@/components/Picture'
import { images } from '@/data/images'
import { venues } from '@/data/events'
import { cn, container } from '@/lib/utils'

export function WeddingsTeaser() {
  return (
    <section
      aria-labelledby="weddings-teaser-title"
      className="pattern-jali on-dark relative isolate overflow-hidden bg-burgundy-deep text-cream"
    >
      {/* Gold line-art arches framing the section edges, like a mandap entrance. */}
      {/* Only where the page margin is wide enough to hold them clear of the content. */}
      <ArchPanel className="absolute top-1/2 -left-24 -z-10 hidden h-[70%] w-auto -translate-y-1/2 text-gold-soft/25 2xl:block" />
      <ArchPanel className="absolute top-1/2 -right-24 -z-10 hidden h-[70%] w-auto -translate-y-1/2 text-gold-soft/25 2xl:block" />
      {/* Diamond-chain divider under the heading, on all sizes. */}
      <div className={cn(container, 'grid gap-8 py-10 md:py-16 lg:gap-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-28')}>
        <div className="m-reveal grid gap-6 md:gap-10 max-md:gap-5">
          <h2 id="weddings-teaser-title" className="max-w-[16ch] text-h1 text-ivory">
            Celebrations for 120 or 2,000
          </h2>
          <LineDivider className="-mt-4 h-5 w-48 text-gold-soft/70" />
          <dl className="grid gap-8 sm:grid-cols-2 max-md:grid-cols-2 max-md:gap-4">
            {venues.map((v) => (
              <div key={v.id} className="grid gap-2 border-t border-gold/50 pt-5 max-md:gap-1 max-md:pt-3">
                <dt className="order-2 text-sm text-cream/85">{v.name}</dt>
                <dd className="order-1 font-display text-6xl leading-none text-gold-soft tabular-nums sm:text-7xl max-md:text-5xl">
                  {v.capacity}
                  <span className="sr-only"> {v.capacityLabel}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="max-w-[54ch] text-cream/85">
            A marble banquet hall for engagements, birthdays and corporate dinners. An open lawn for the wedding itself. Our kitchen caters
            both, and family can stay upstairs.
          </p>
          <Button asChild variant="gold" size="lg" className="justify-self-start">
            <Link to="/weddings-events">Plan your wedding or event</Link>
          </Button>
        </div>
        <Picture
          image={images.home.weddingsTeaser}
          sizes="(min-width: 1024px) 34vw, 100vw"
          className="aspect-[4/5] overflow-hidden rounded-md max-md:aspect-[16/10]"
          imgClassName="m-parallax"
        />
      </div>
    </section>
  )
}
