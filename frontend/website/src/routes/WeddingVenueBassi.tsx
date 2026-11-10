import { Link } from 'react-router'
import { Seo } from '@/components/Seo'
import { PageIntro } from '@/components/sections/PageIntro'
import { weddingsHero } from '@/components/heroArt'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { PetalDecor } from '@/components/ui/PetalDecor'
import { hotel } from '@/data/hotel'
import { packages, venues } from '@/data/events'
import { cn, container, inlineLink } from '@/lib/utils'

export default function WeddingVenueBassi() {
  return (
    <>
      <Seo path="/wedding-venue-in-bassi" />
      <PageIntro
        {...weddingsHero}
        breadcrumb="Wedding venue in Metropolis"
        title="Grand Wedding Venue & Celebrations in Metropolis"
        lede={`${hotel.name} features an indoor banquet hall and a grand open lawn for weddings and celebrations, with full catering and luxury accommodation for your guests.`}
      >
        <Link to="/weddings-events" className={cn(inlineLink, 'justify-self-start text-lg')}>
          Plan your event and send an enquiry
        </Link>
      </PageIntro>

      <section aria-labelledby="venues-title" className={cn(container, 'relative isolate grid gap-5 pb-16')}>
        <PetalDecor variant="dots" side="left" />
        <h2 id="venues-title" className="text-h2 text-burgundy-deep">
          Two venues for weddings and celebrations
        </h2>
        <p className="max-w-[64ch] text-walnut">
          {hotel.name} is an ideal venue at {hotel.address.street}, {hotel.address.city}. You can
          hold the main function on the lawn and the smaller rituals in the banquet hall.
        </p>
        <dl className="grid max-w-4xl gap-6 md:grid-cols-2">
          {venues.map((v) => (
            <div key={v.id} className="grid content-start gap-2 border-t border-gold/60 pt-4">
              <dt className="font-display text-2xl text-burgundy-deep">
                {v.name}: {v.capacityLabel.replace('guests, ', '')} {v.capacity} guests
              </dt>
              <dd className="text-walnut">{v.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="included-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-5 py-16 lg:py-20')}>
          <h2 id="included-title" className="text-h2 text-burgundy-deep">
            What we can plan with you
          </h2>
          <div className="grid max-w-4xl gap-6 md:grid-cols-2">
            {packages.map((p) => (
              <div key={p.name} className="grid content-start gap-2">
                <h3 className="font-display text-2xl text-burgundy-deep">{p.name}</h3>
                <ul className="grid list-disc gap-1 pl-5 text-walnut">
                  {p.includes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="max-w-[64ch] text-walnut">
            Package prices are given on enquiry. Call or WhatsApp {hotel.phoneDisplay} or {hotel.phoneDisplaySecondary}.
          </p>
        </div>
      </section>

      <section aria-labelledby="guests-title" className={cn(container, 'grid gap-4 py-16 lg:py-20')}>
        <h2 id="guests-title" className="text-h2 text-burgundy-deep">
          For visiting families and event guests
        </h2>
        <p className="max-w-[64ch] text-walnut">
          The hotel stands in an accessible regional location with convenient highway connectivity. Dedicated parking is available in the spacious front forecourt, and event attendees can easily reserve{' '}
          <Link to="/rooms" className={inlineLink}>
            rooms at the hotel
          </Link>
          . Custom menus are prepared by our{' '}
          <Link to="/dining" className={inlineLink}>
            multi-cuisine kitchen
          </Link>
          .
        </p>
      </section>

      <PageFaqs path="/wedding-venue-in-bassi" title="Questions about weddings & celebrations" />
    </>
  )
}
