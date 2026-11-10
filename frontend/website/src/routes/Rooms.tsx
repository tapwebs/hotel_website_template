import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { BedDouble, Check, Users } from 'lucide-react'
import { Seo } from '@/components/Seo'
import { Picture } from '@/components/Picture'
import { PageFaqs } from '@/components/sections/PageFaqs'
import { PageIntro } from '@/components/sections/PageIntro'
import { roomsHero } from '@/components/heroArt'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { FormSkeleton } from '@/components/booking/BookingProvider'
import { loadBookingForm } from '@/components/booking/booking-context'
import { images } from '@/data/images'
import { extraBedNote, roomAmenities, rooms } from '@/data/rooms'
import { hotel } from '@/data/hotel'
import { formatINR } from '@/lib/format'
import { cn, container, inlineLink } from '@/lib/utils'
import { PetalDecor } from '@/components/ui/PetalDecor'

const BookingForm = lazy(loadBookingForm)

export default function Rooms() {
  return (
    <>
      <Seo path="/rooms" />
      <RoomsHero />

      <section aria-labelledby="room-price-title" className={cn(container, 'relative isolate grid gap-3 pb-16 max-md:pb-10')}>
        <PetalDecor variant="dots" side="left" />
        <h2 id="room-price-title" className="text-h3 text-burgundy-deep">
          How much is a room at {hotel.name}?
        </h2>
        <p className="max-w-[64ch] text-walnut">
          At {hotel.name} on {hotel.address.street}, Jaipur, the {rooms[0].name} costs {formatINR(rooms[0].rate)} a night and the{' '}
          {rooms[1].name} costs {formatINR(rooms[1].rate)} a night. Each room sleeps up to 2 adults, an extra bed is available on request,
          and taxes are added at confirmation. Check-in and check-out are both at {hotel.checkIn}.
        </p>
        <p className="max-w-[64ch] text-walnut">
          Staying for a family function? See our{' '}
          <Link to="/weddings-events" className={inlineLink}>
            wedding stays for families
          </Link>
          , eat at the{' '}
          <Link to="/dining" className={inlineLink}>
            North Indian restaurant and room service
          </Link>
          , or browse{' '}
          <Link to="/gallery?category=Rooms%20%26%20Corridors" className={inlineLink}>
            photos of the rooms and corridors
          </Link>
          . A lift serves the guest floors, with on-site parking and power backup:{' '}
          <Link to="/about#facilities" className={inlineLink}>
            see all facilities at the hotel
          </Link>{' '}
          or{' '}
          <Link to="/contact" className={inlineLink}>
            get directions to Agra Road, Bassi
          </Link>
          .
        </p>
      </section>

      <div className={cn(container, 'relative isolate grid gap-20 pb-20 max-md:gap-12 max-md:pb-12 lg:gap-28')}>
        <PetalDecor variant="bottom" side="right" />
        {rooms.map((room, i) => (
          <article
            key={room.id}
            aria-labelledby={`${room.id}-title`}
            className="grid gap-8 max-md:gap-5 lg:grid-cols-12 lg:items-center lg:gap-12"
          >
            <Picture
              image={room.image}
              sizes="(max-width: 767px) calc(100vw - 2rem), (min-width: 1024px) 58vw, 100vw"
              imgClassName="m-parallax"
              className={cn(
                'aspect-[4/5] overflow-hidden rounded-md max-md:aspect-[4/3] lg:col-span-7 lg:aspect-square',
                i % 2 === 1 && 'lg:order-2',
              )}
            />
            <div className="m-reveal grid gap-5 max-md:gap-4 lg:col-span-5">
              <h2 id={`${room.id}-title`} className="text-h2 text-burgundy-deep">
                {room.name}
              </h2>
              <p className="font-display text-4xl text-burgundy tabular-nums max-md:text-3xl">
                {formatINR(room.rate)}
                <span className="ml-2 font-sans text-base text-muted-foreground">a night</span>
              </p>
              <p className="flex flex-wrap gap-x-6 gap-y-2 text-walnut">
                <span className="inline-flex items-center gap-2">
                  <BedDouble className="size-5 text-burgundy" aria-hidden="true" /> {room.bed}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="size-5 text-burgundy" aria-hidden="true" /> {room.occupancy}
                </span>
              </p>
              <p className="max-w-[48ch] text-walnut">{room.summary}</p>
              <p className="text-sm text-muted-foreground">{extraBedNote}.</p>
              <BookNowButton roomId={room.id} size="lg" className="justify-self-start max-md:w-full">
                Book {room.name}
              </BookNowButton>
            </div>
          </article>
        ))}
      </div>

      <section aria-labelledby="real-room-title" className="pattern-jali on-dark bg-walnut text-cream">
        <div className={cn(container, 'grid gap-10 py-20 max-md:gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-center')}>
          <div className="m-reveal grid gap-4">
            <h2 id="real-room-title" className="text-h2 text-ivory">
              An attached washroom in every room
            </h2>
            <p className="max-w-[46ch] text-cream/85">
              Marble-finish tiled walls, a rain shower with hot water from the geyser, a wall-mounted WC and a vessel basin.
            </p>
          </div>
          <Picture
            image={images.rooms.realRoom}
            sizes="(max-width: 767px) calc(100vw - 2rem), (min-width: 1024px) 55vw, 100vw"
            imgClassName="m-parallax"
            className="aspect-[3/4] overflow-hidden rounded-md max-md:aspect-[4/5] lg:mx-auto lg:max-w-md"
          />
        </div>
      </section>

      <section aria-labelledby="compare-title" className={cn(container, 'relative isolate py-10 md:py-20 lg:py-28')}>
        <PetalDecor variant="top" side="right" />
        <h2 id="compare-title" className="mb-5 text-h2 md:mb-10 text-burgundy-deep">
          Which room should I choose?
        </h2>
        <div className="m-stagger grid gap-3 md:hidden">
          {rooms.map((r) => (
            <article key={r.id} className="grid gap-3 rounded-md border border-border bg-ivory p-4 text-walnut">
              <h3 className="flex items-baseline justify-between gap-3 font-display text-xl font-semibold text-burgundy-deep">
                {r.name}
                <span className="text-base tabular-nums">
                  {formatINR(r.rate)}
                  <span className="text-sm font-normal text-muted-foreground"> / night</span>
                </span>
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
                {[
                  ['Bed', r.bed],
                  ['Guests', r.occupancy],
                  ['Extra bed', 'On request'],
                  ['Check-in / out', hotel.checkIn],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
          <div className="rounded-md border border-border bg-ivory p-4">
            <h3 className="mb-2 text-base font-semibold text-walnut">In every room</h3>
            <ul className="flex flex-wrap gap-1.5">
              {roomAmenities.map((a) => (
                <li key={a} className="inline-flex items-center gap-1 rounded-full border border-border bg-cream px-3 py-1.5 text-sm">
                  <Check className="size-3.5 text-burgundy" aria-hidden="true" /> {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div
          className="hidden overflow-x-auto rounded-md border border-border bg-ivory md:block"
          role="region"
          aria-label="Room comparison"
          tabIndex={0}
        >
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Deluxe Room and Super Deluxe Room compared</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-4 text-sm font-semibold text-muted-foreground">
                  <span className="sr-only">Feature</span>
                </th>
                {rooms.map((r) => (
                  <th key={r.id} scope="col" className="p-4 font-display text-2xl font-semibold text-burgundy-deep">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-walnut">
              <CompareRow label="Price per night" values={rooms.map((r) => formatINR(r.rate))} numeric />
              <CompareRow label="Bed" values={rooms.map((r) => r.bed)} />
              <CompareRow label="Guests" values={rooms.map((r) => r.occupancy)} />
              <CompareRow label="Extra bed" values={rooms.map(() => 'On request')} />
              <CompareRow label="Check-in and check-out" values={rooms.map(() => hotel.checkIn)} />
              <tr>
                <th scope="row" className="p-4 align-top text-sm font-semibold">
                  In every room
                </th>
                <td colSpan={2} className="p-4">
                  <ul className="flex flex-wrap gap-2">
                    {roomAmenities.map((a) => (
                      <li
                        key={a}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-cream px-3 py-1.5 text-sm"
                      >
                        <Check className="size-4 text-burgundy" aria-hidden="true" /> {a}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* bg-cream so the FAQ band does not merge with the ivory request band below. */}
      <PageFaqs path="/rooms" title="Questions about the rooms" className="bg-cream" />

      <section aria-labelledby="request-title" className="pattern-buti bg-ivory">
        <div className={cn(container, 'grid gap-6 pt-10 pb-28 max-md:pb-12 md:gap-10 md:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:py-28')}>
          <div className="grid content-start gap-4">
            <h2 id="request-title" className="text-h2 text-burgundy-deep">
              Request your room
            </h2>
            <p className="max-w-[44ch] text-walnut">
              Pick your dates and room. Your request opens in WhatsApp, ready to send. The hotel replies to confirm availability and the
              final price.
            </p>
            <p className="text-sm text-muted-foreground">
              Prefer to talk? Call{' '}
              <a href={hotel.phoneHref} className={inlineLink}>
                {hotel.phoneDisplay}
              </a>{' '}
              or{' '}
              <a href={hotel.phoneHrefSecondary} className={inlineLink}>
                {hotel.phoneDisplaySecondary}
              </a>
              .
            </p>
          </div>
          <Suspense fallback={<FormSkeleton />}>
            <BookingForm idPrefix="rooms" layout="wide" />
          </Suspense>
        </div>
      </section>
    </>
  )
}

function CompareRow({ label, values, numeric }: { label: string; values: string[]; numeric?: boolean }) {
  return (
    <tr>
      <th scope="row" className="p-4 text-sm font-semibold">
        {label}
      </th>
      {values.map((v, i) => (
        <td key={i} className={cn('p-4', numeric && 'font-semibold tabular-nums')}>
          {v}
        </td>
      ))}
    </tr>
  )
}

/**
 * Rooms page hero: shared PageIntro with the jharokha-and-bed line-art, and the two rooms as
 * quick price cards that jump to their details.
 */
function RoomsHero() {
  return (
    <PageIntro
      {...roomsHero}
      breadcrumb="Rooms"
      eyebrow={<>Two room types · Check-in {hotel.checkIn}</>}
      title={
        <>
          <span className="block">Rooms in Bassi, Jaipur,</span>
          <span className="block text-burgundy italic">made for a good night’s rest</span>
        </>
      }
      lede="Every room has a private balcony, AC, Wi-Fi, a TV and a hot-water geyser, and sleeps up to 2 adults. Choose the bed size that suits you."
    >
      <ul className="grid max-w-xl gap-3 sm:grid-cols-2">
        {rooms.map((r) => (
          <li key={r.id}>
            <a
              href={`#${r.id}-title`}
              className="group grid h-full gap-1 rounded-md border border-gold/50 bg-ivory/80 p-4 transition-colors hover:border-burgundy focus-visible:border-burgundy"
            >
              <span className="font-semibold text-walnut group-hover:text-burgundy">{r.name}</span>
              <span className="text-sm text-muted-foreground">{r.bed}</span>
              <span className="mt-1 font-display text-3xl text-burgundy tabular-nums">
                {formatINR(r.rate)}
                <span className="ml-1.5 font-sans text-sm text-muted-foreground">a night</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <BookNowButton size="lg" />
        <Button asChild size="lg" variant="outline" className="border-walnut/30 bg-transparent">
          <Link to="/gallery?category=Rooms%20%26%20Corridors">See room photos</Link>
        </Button>
      </div>
    </PageIntro>
  )
}
