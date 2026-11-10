import { Link } from 'react-router'
import { BedDouble, Users } from 'lucide-react'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { Picture } from '@/components/Picture'
import { images } from '@/data/images'
import { rooms } from '@/data/rooms'
import { formatINR } from '@/lib/format'
import { cn, container } from '@/lib/utils'

export function RoomsTeaser() {
  return (
    <section aria-labelledby="rooms-teaser-title" className="pattern-jali on-dark mt-20 bg-walnut text-cream lg:mt-28 max-md:mt-12">
      <div className={cn(container, 'grid gap-8 max-md:gap-6 py-10 md:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:py-28')}>
        <Picture
          image={images.home.roomsTeaser}
          sizes="(min-width: 1024px) 38vw, 100vw"
          className="aspect-[4/5] overflow-hidden rounded-md lg:-mt-40 lg:aspect-auto lg:h-[calc(100%+10rem)] max-md:aspect-[16/10]"
          imgClassName="m-parallax"
        />
        <div className="m-reveal grid content-center gap-6 md:gap-10">
          <div className="grid gap-4">
            <h2 id="rooms-teaser-title" className="text-h2 text-ivory">
              Two rooms, one standard of comfort
            </h2>
            <p className="max-w-[52ch] text-cream/85">
              Every room has a balcony, AC, Wi-Fi, a TV and a hot-water geyser. Choose the bed size that suits your stay.
            </p>
          </div>
          <ul className="m-stagger grid divide-y divide-cream/15 border-y border-cream/15">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="grid gap-5 py-5 sm:grid-cols-[1fr_auto] sm:items-end max-md:grid-cols-[1fr_auto] max-md:items-end max-md:gap-3 max-md:py-4"
              >
                <div className="grid gap-2">
                  <h3 className="text-h3 text-ivory max-md:text-xl">{room.name}</h3>
                  <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-cream/85 max-md:flex-col max-md:text-xs">
                    <span className="inline-flex items-center gap-2">
                      <BedDouble className="size-4 text-gold" aria-hidden="true" /> {room.bed}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Users className="size-4 text-gold" aria-hidden="true" /> {room.occupancy}
                    </span>
                  </p>
                </div>
                <div className="grid gap-3 sm:justify-items-end max-md:justify-items-end max-md:gap-2">
                  <p className="font-display text-4xl text-gold-soft tabular-nums max-md:text-2xl">
                    {formatINR(room.rate)}
                    <span className="ml-2 font-sans text-sm text-cream/80 max-md:ml-1 max-md:text-xs">a night</span>
                  </p>
                  <BookNowButton roomId={room.id} variant="gold" size="sm">
                    Book {room.name.replace(' Room', '')}
                  </BookNowButton>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/rooms"
            className="inline-flex min-h-11 items-center justify-self-start font-semibold text-gold-soft underline decoration-gold/60 underline-offset-8 hover:decoration-gold-soft"
          >
            Compare rooms and amenities
          </Link>
        </div>
      </div>
    </section>
  )
}
