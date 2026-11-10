import { Link } from 'react-router'
import { Seo } from '@/components/Seo'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { PageIntro } from '@/components/sections/PageIntro'
import { galleryHero } from '@/components/heroArt'
import { gallery, type GalleryCategory } from '@/data/images'
import { hotel } from '@/data/hotel'
import { cn, container, inlineLink } from '@/lib/utils'

const link = inlineLink

// What each filter shows, written from the photos' alt text (src/data/images.ts). No new facts.
const areas: { category: GalleryCategory; body: string }[] = [
  { category: 'Exterior', body: 'The hotel building seen across its large paved forecourt, where guests park on site.' },
  { category: 'Lobby', body: 'A laser-cut wooden jali ceiling panel, an ivory glass chandelier and framed murals.' },
  {
    category: 'Rooms & Corridors',
    body: 'Wood-panelled guest corridors with brass wall lights, the lift landing, glass-railed staircases and a room window over open grounds.',
  },
  {
    category: 'Banquet',
    body: 'The indoor banquet hall end to end: carved jali ceiling, chandeliers, peacock and palm murals and a polished marble floor.',
  },
  { category: 'Lighting', body: 'A crystal pendant and a crystal and brass wall sconce from the guest floors.' },
  { category: 'Murals', body: 'A golden wishing tree, a sun rising over mountain peaks, palms and lotus flowers.' },
]

const countOf = (c: GalleryCategory) => gallery.filter((g) => g.category === c).length

export default function Gallery() {
  return (
    <>
      <Seo path="/gallery" />
      <PageIntro
        {...galleryHero}
        breadcrumb="Gallery"
        title="Photo gallery"
        lede={`Photographed at ${hotel.name}, ${hotel.address.street}, ${hotel.address.city}: facade, lobby, corridors, banquet hall, lights and murals.`}
      />
      <div className={`${container} pb-10 lg:pb-16`}>
        <GalleryGrid />
        <p className="mt-6 max-w-[64ch] text-walnut">
          Seen enough? Compare the{' '}
          <Link to="/rooms" className={link}>
            Deluxe and Super Deluxe rooms
          </Link>{' '}
          or plan a celebration in the{' '}
          <Link to="/weddings-events" className={link}>
            banquet hall and wedding lawn
          </Link>
          .
        </p>
      </div>

      <section aria-labelledby="gallery-guide-title" className={cn(container, 'grid gap-6 pb-20 max-md:gap-4 max-md:pb-12 lg:pb-28')}>
        <h2 id="gallery-guide-title" className="text-h3 text-burgundy-deep">
          What do the photos of {hotel.name} show?
        </h2>
        <p className="max-w-[64ch] text-walnut">
          These {gallery.length} photographs were taken at {hotel.name} on {hotel.address.street}, {hotel.address.city}, opposite Bharat
          Petroleum. They cover the exterior, the lobby, guest corridors and staircases, the indoor banquet hall, the light fittings and the
          wall murals. Choose a filter above to see one area, or open any photo to view it larger.
        </p>
        <dl className="m-stagger grid gap-x-10 gap-y-5 md:grid-cols-2 lg:grid-cols-3 max-md:gap-y-4">
          {areas.map((a) => (
            <div key={a.category} className="grid content-start gap-1 border-t border-border pt-4">
              <dt className="font-semibold text-walnut">
                {a.category} <span className="font-normal text-muted-foreground">({countOf(a.category)})</span>
              </dt>
              <dd className="text-walnut">{a.body}</dd>
            </div>
          ))}
        </dl>
        <p className="max-w-[64ch] text-walnut">
          For the story behind the interiors, read{' '}
          <Link to="/about" className={link}>
            about the hotel, its murals, wood and marble
          </Link>
          , see{' '}
          <Link to="/about#facilities" className={link}>
            every facility, from parking to the lift
          </Link>{' '}
          or browse the{' '}
          <Link to="/dining" className={link}>
            North Indian restaurant menu
          </Link>
          .
        </p>
      </section>
    </>
  )
}
