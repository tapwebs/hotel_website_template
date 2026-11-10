import { Link } from 'react-router'
import { Star } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { PageIntro } from '@/components/sections/PageIntro'
import { contactHero } from '@/components/heroArt'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { hotel, googleReviews } from '@/data/hotel'
import { formatINR } from '@/lib/format'
import { cn, container, inlineLink } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'

// Public Google reviews (from the hotel's Google Business Profile), quoted without reviewer names.
const googleQuotes = [
  'Ultra luxurious experience in dausa highway, good ambience',
  'The kitchen team clearly puts a lot of care into their work.',
  'Very good hotel and very nice service',
]

export default function HotelInBassi() {
  return (
    <>
      <Seo path="/hotel-in-bassi-jaipur" />
      <PageIntro
        {...contactHero}
        breadcrumb="Hotel in Bassi"
        title="Hotel in Bassi, Jaipur, on the Agra Road"
        lede={`${hotel.name} is on the Agra Road in Bassi, opposite Bharat Petroleum: rooms from ${formatINR(hotel.priceFrom)} a night, a restaurant, a banquet hall and a wedding lawn.`}
      >
        <BookNowButton size="lg" className="justify-self-start" />
      </PageIntro>

      <section aria-labelledby="where-title" className={cn(container, 'relative isolate grid gap-4 pb-16')}>
        <PetalDecor variant="dots" side="left" />
        <h2 id="where-title" className="text-h2 text-burgundy-deep">
          Where we are
        </h2>
        <p className="max-w-[64ch] text-walnut">
          {hotel.name} is at {hotel.address.street}, {hotel.address.city}, {hotel.address.region}, {hotel.address.landmark.toLowerCase()}.
          Bassi is about 30 km by road from Jaipur and about 27 km from Dausa, and the hotel stands on the Agra Road (the Jaipur–Dausa
          highway) that links them. Distances are approximate. The name is also written Hotel Dream Heavens or Hotel Dream Heaven; this is
          the hotel in Bassi, Jaipur, and it is not connected to similarly named hotels in other cities.
        </p>
        <ul className="grid max-w-[64ch] list-disc gap-2 pl-5 text-walnut">
          <li>
            Coming from Jaipur: follow the Agra Road towards Dausa until Bassi. The hotel is on the road, opposite the Bharat Petroleum
            pump.
          </li>
          <li>Coming from Dausa: head towards Jaipur on the Agra Road. The hotel is in Bassi, opposite Bharat Petroleum.</li>
          <li>On arrival: turn in at the gate and park in the front forecourt beside the entrance steps.</li>
        </ul>
        <p className="max-w-[64ch] text-walnut">
          See the map and step-by-step help on{' '}
          <Link to="/contact#directions" className={inlineLink}>
            contact and directions
          </Link>
          , or call {hotel.phoneDisplay}.
        </p>
      </section>

      <section aria-labelledby="stay-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-4 py-16 lg:py-20')}>
          <h2 id="stay-title" className="text-h2 text-burgundy-deep">
            Stay, eat and celebrate in one place
          </h2>
          <p className="max-w-[64ch] text-walnut">
            Choose a{' '}
            <Link to="/rooms" className={inlineLink}>
              Deluxe or Super Deluxe room
            </Link>{' '}
            from {formatINR(hotel.priceFrom)} a night, eat at our{' '}
            <Link to="/dining" className={inlineLink}>
              North Indian restaurant
            </Link>
            , or book the{' '}
            <Link to="/weddings-events" className={inlineLink}>
              banquet hall and wedding lawn
            </Link>{' '}
            for your event. See the{' '}
            <Link to="/gallery" className={inlineLink}>
              photo gallery
            </Link>{' '}
            and read{' '}
            <Link to="/about" className={inlineLink}>
              about the hotel and its facilities
            </Link>
            .
          </p>
        </div>
      </section>

      <section aria-labelledby="reviews-title" className={cn(container, 'grid gap-5 py-16 lg:py-20')}>
        <h2 id="reviews-title" className="text-h2 text-burgundy-deep">
          What guests say on Google
        </h2>
        <p className="flex items-center gap-2 text-walnut">
          <Star className="size-5 fill-gold text-gold" aria-hidden="true" />
          <span>
            Rated {googleReviews.rating} out of 5 from {googleReviews.count} Google reviews (as of {googleReviews.asOf}).{' '}
            <a href={hotel.directionsUrl} className={inlineLink} target="_blank" rel="noopener">
              Read them on Google
            </a>
          </span>
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {googleQuotes.map((q) => (
            <blockquote key={q} className="rounded-md border border-border bg-white p-5 text-walnut">
              “{q}”<footer className="mt-2 text-sm text-muted-foreground">Google review</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <PageFaqs path="/hotel-in-bassi-jaipur" title="Questions about finding the hotel" />
    </>
  )
}
