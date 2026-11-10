import { Link } from 'react-router'
import { Seo } from '@/components/Seo'
import { BookingBar } from '@/components/sections/BookingBar'
import { DiningTeaser } from '@/components/sections/DiningTeaser'
import { Facilities } from '@/components/sections/Facilities'
import { Hero } from '@/components/sections/Hero'
import { LocationStrip } from '@/components/sections/LocationStrip'
import { PropertyExplorerSection } from '@/components/sections/PropertyExplorerSection'
import { Reviews } from '@/components/sections/Reviews'
import { RoomsTeaser } from '@/components/sections/RoomsTeaser'
import { WeddingsTeaser } from '@/components/sections/WeddingsTeaser'
import { hotel } from '@/data/hotel'
import { rooms } from '@/data/rooms'
import { formatINR } from '@/lib/format'
import { cn, container, inlineLink } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'

export default function Home() {
  return (
    <>
      <Seo path="/" />
      <Hero />
      <section
        aria-labelledby="home-facts-title"
        className={cn(container, 'relative isolate grid gap-6 pt-8 md:grid-cols-2 md:gap-10 md:pt-14 lg:pt-20')}
      >
        <PetalDecor variant="dots" side="right" />
        <div className="m-reveal grid content-start gap-2 md:gap-3">
          <h2 id="home-facts-title" className="text-h3 text-burgundy-deep">
            Where is {hotel.name}?
          </h2>
          <p className="max-w-[56ch] text-sm text-walnut md:text-base">
            {hotel.name} is a hotel and restaurant on {hotel.address.street}, {hotel.address.city}, {hotel.address.region}, opposite Bharat
            Petroleum. It has Deluxe rooms at {formatINR(rooms[0].rate)} and Super Deluxe rooms at {formatINR(rooms[1].rate)} a night,
            check-in and check-out at {hotel.checkIn}, a banquet hall for about 120 guests, a lawn for 1,500 to 2,000, on-site parking and a
            lift.{' '}
            <Link to="/about#facilities" className={inlineLink}>
              See every facility and accessibility detail
            </Link>{' '}
            or{' '}
            <Link to="/contact" className={inlineLink}>
              get directions and contact details
            </Link>
            .
          </p>
        </div>
        <div className="m-reveal grid content-start gap-2 md:gap-3">
          <h2 className="text-h3 text-burgundy-deep">What does a room cost?</h2>
          <p className="max-w-[56ch] text-sm text-walnut md:text-base">
            Rooms start from {formatINR(hotel.priceFrom)} a night. The Deluxe Room has a king-size bed and the Super Deluxe Room a bed
            larger than king-size, both for up to 2 adults with AC, Wi-Fi, TV, a balcony and a geyser. Taxes and any extra bed are added at
            confirmation.{' '}
            <Link to="/rooms" className={inlineLink}>
              Compare the Deluxe and Super Deluxe rooms
            </Link>{' '}
            or browse{' '}
            <Link to="/gallery" className={inlineLink}>
              photos of the lobby, corridors and banquet hall
            </Link>
            .
          </p>
        </div>
      </section>
      <BookingBar />
      <RoomsTeaser />
      <PropertyExplorerSection />
      <DiningTeaser />
      <WeddingsTeaser />
      <Facilities />
      <Reviews />
      <LocationStrip />
    </>
  )
}
