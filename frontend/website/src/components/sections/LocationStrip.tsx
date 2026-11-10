import { Link } from 'react-router'
import { MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { Chhatri } from '@/components/LineArt'
import { JharokhaFrame, Picture } from '@/components/Picture'
import { images } from '@/data/images'
import { hotel } from '@/data/hotel'
import { cn, container } from '@/lib/utils'

/** Location + the closing call to action. */
export function LocationStrip() {
  return (
    <section
      aria-labelledby="location-title"
      className={cn(container, 'relative isolate grid gap-8 py-10 md:py-16 md:gap-12 md:grid-cols-[0.7fr_1.3fr] md:items-center lg:py-28')}
    >
      {/* Line-art chhatri in the empty corner beside the call to action. */}
      <Chhatri className="absolute right-4 bottom-12 -z-10 hidden h-56 w-auto text-gold/80 lg:block lg:right-8" />
      <JharokhaFrame className="mx-auto aspect-[5/6] w-full max-w-md max-md:max-w-[15rem]">
        <Picture
          image={images.home.location}
          sizes="(max-width: 767px) 15rem, (min-width: 768px) 30vw, 448px"
          className="h-full"
          imgClassName="object-[82%_50%]"
        />
      </JharokhaFrame>
      <div className="m-reveal grid gap-7 max-md:gap-5">
        <h2 id="location-title" className="text-h1 text-burgundy-deep">
          Look for the lit sign opposite Bharat Petroleum
        </h2>
        <p className="flex max-w-[50ch] gap-3 text-lede text-walnut">
          <MapPin className="mt-1.5 size-5 shrink-0 text-burgundy" aria-hidden="true" />
          {hotel.address.street}, {hotel.address.city}. Easy to reach from the city and the highway, with parking right at the steps.
        </p>
        <div className="flex flex-wrap gap-3">
          <BookNowButton size="lg" />
          <Button asChild size="lg" variant="outline">
            <a href={hotel.directionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" /> Get Directions
            </a>
          </Button>
        </div>
        <Link
          to="/contact"
          className="inline-flex min-h-11 items-center justify-self-start font-semibold text-burgundy underline underline-offset-8 hover:text-burgundy-deep"
        >
          All contact details and map
        </Link>
      </div>
    </section>
  )
}
