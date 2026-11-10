import { Link } from 'react-router'
import { Seo } from '@/components/Seo'
import { PageIntro } from '@/components/sections/PageIntro'
import { contactHero } from '@/components/heroArt'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { PetalDecor } from '@/components/ui/PetalDecor'
import { hotel } from '@/data/hotel'
import { rooms } from '@/data/rooms'
import { formatINR } from '@/lib/format'
import { cn, container, inlineLink } from '@/lib/utils'

export default function HotelNearDausa() {
  return (
    <>
      <Seo path="/hotel-near-dausa" />
      <PageIntro
        {...contactHero}
        breadcrumb="Hotel near Highway"
        title="Regional Resort & Highway Stay in Metropolis"
        lede={`${hotel.name} is conveniently situated in Metropolis with easy highway access: rooms from ${formatINR(hotel.priceFrom)} a night, a restaurant and event venues.`}
      >
        <BookNowButton size="lg" className="justify-self-start" />
      </PageIntro>

      <section aria-labelledby="route-title" className={cn(container, 'relative isolate grid gap-4 pb-16')}>
        <PetalDecor variant="dots" side="left" />
        <h2 id="route-title" className="text-h2 text-burgundy-deep">
          Reaching the resort
        </h2>
        <p className="max-w-[64ch] text-walnut">
          The resort is situated along the main metropolitan thoroughfare with direct road access. Turn in at the main gate and park in the secure front forecourt.
        </p>
        <p className="max-w-[64ch] text-walnut">
          The address is {hotel.address.street}, {hotel.address.city}, {hotel.address.region}. Open the{' '}
          <a href={hotel.directionsUrl} className={inlineLink} target="_blank" rel="noopener">
            hotel on Maps
          </a>{' '}
          or see{' '}
          <Link to="/contact#directions" className={inlineLink}>
            directions on our contact page
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="options-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-4 py-16 lg:py-20')}>
          <h2 id="options-title" className="text-h2 text-burgundy-deep">
            Stay, eat and celebrate
          </h2>
          <ul className="grid max-w-[64ch] list-disc gap-2 pl-5 text-walnut">
            {rooms.map((r) => (
              <li key={r.name}>
                {r.name}: {formatINR(r.rate)} a night before taxes, {r.occupancy.toLowerCase()}.{' '}
              </li>
            ))}
            <li>
              A pure vegetarian{' '}
              <Link to="/dining" className={inlineLink}>
                restaurant
              </Link>{' '}
              on the ground floor, with room service.
            </li>
            <li>
              A banquet hall and an event lawn: see our{' '}
              <Link to="/weddings-events" className={inlineLink}>
                weddings and celebrations venues
              </Link>
              .
            </li>
          </ul>
          <p className="max-w-[64ch] text-walnut">
            Bookings are requests: send your dates by WhatsApp or phone on {hotel.phoneDisplay} and the hotel confirms availability and the
            final price.
          </p>
        </div>
      </section>

      <PageFaqs path="/hotel-near-dausa" title="Questions about staying at the resort" />
    </>
  )
}
