import { useId } from 'react'
import { Link } from 'react-router'
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { InstagramIcon } from '@/components/InstagramIcon'
import { ArchPanel, Chhatri } from '@/components/LineArt'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { developer, hotel, nav } from '@/data/hotel'
import { play } from '@/lib/sounds'
import { Logo } from './Logo'

const year = new Date().getFullYear()
const whatsapp = buildWhatsAppUrl('Hello, I would like to plan a stay at Hotel Dream Heaven’s.')

const label = (to: (typeof nav)[number]['to']) => nav.find((n) => n.to === to)?.label ?? to

// Every route appears here, so no page is an orphan.
const footerLinks = [
  ...(['/', '/rooms', '/dining', '/gallery', '/weddings-events', '/about', '/contact'] as const).map((to) => ({
    to,
    label: to === '/' ? 'Home' : label(to),
  })),
  { to: '/hotel-in-bassi-jaipur', label: 'Hotel in Bassi' },
  { to: '/hotel-near-dausa', label: 'Hotel near Dausa' },
  { to: '/wedding-venue-in-bassi', label: 'Wedding venue in Bassi' },
  // Policies and FAQs live on the Contact page.
  { to: '/contact#faqs', label: 'FAQs & Policies' },
]

export function Footer() {
  return (
    <footer className="on-dark relative isolate overflow-hidden max-md:pb-[calc(4.25rem+env(safe-area-inset-bottom))] bg-walnut bg-[linear-gradient(165deg,var(--color-burgundy-deep)_0%,var(--color-walnut)_55%,var(--color-ink)_100%)] text-cream">
      <div className="hairline" aria-hidden="true" />
      {/* Faint line-art skyline along the bottom-right (desktop only). */}
      <div className="absolute right-0 bottom-0 -z-10 hidden items-end gap-1 text-gold-soft/12 md:flex" aria-hidden="true">
        <Chhatri className="h-40 w-auto" />
        <ArchPanel className="h-72 w-auto" />
        <Chhatri className="h-52 w-auto" />
      </div>

      {/* CTA strip, md+ only: on phones the sticky MobileActionBar already offers Book / WhatsApp / Call. */}
      <section aria-labelledby="footer-cta" className="mx-auto max-w-7xl px-4 pt-6 max-md:hidden sm:px-6 md:pt-10 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-burgundy-deep/40 px-4 py-3 md:px-6 md:py-5">
          <div>
            <h2 id="footer-cta" className="font-display text-xl text-ivory md:text-3xl">
              Plan your stay
            </h2>
            <p className="hidden text-sm text-cream/80 md:block">Rooms from ₹{hotel.priceFrom} a night, on Agra Road, Bassi.</p>
          </div>
          <div className="flex gap-2">
            <BookNowButton variant="gold" className="h-11 px-4">
              Book
            </BookNowButton>
            <Button asChild variant="outline-light" className="h-11 px-4">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp the hotel (opens in a new tab)">
                <MessageCircle aria-hidden="true" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>

      <OrnamentBand />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-6 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] md:gap-10 md:pb-12 lg:px-8">
        <div className="grid content-start gap-3">
          <Logo tone="light" />
          <address className="text-sm not-italic text-cream/85">
            {hotel.address.street}, {hotel.address.city}, {hotel.address.region}
          </address>
          <p className="hidden text-sm text-cream/80 md:block">
            Check-in {hotel.checkIn}. Check-out {hotel.checkOut}.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="mb-1 hidden text-xs font-semibold tracking-[0.2em] text-gold-soft uppercase md:block">Explore</h2>
          <ul className="grid grid-cols-2 gap-x-4">
            {footerLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => play('tick')}
                  className="inline-flex min-h-11 items-center text-sm text-cream/90 transition-colors duration-200 hover:text-gold-soft motion-reduce:transition-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-3 hidden text-xs font-semibold tracking-[0.2em] text-gold-soft uppercase md:block">Get in touch</h2>
          <ul className="flex gap-2 md:flex-wrap" aria-label="Contact">
            <IconLink href={hotel.phoneHref} label={`Call ${hotel.phoneDisplay}`} icon={<Phone aria-hidden="true" className="size-5" />} />
            <IconLink href={`mailto:${hotel.email}`} label={`Email ${hotel.email}`} icon={<Mail aria-hidden="true" className="size-5" />} />
            <IconLink
              href={hotel.instagramUrl}
              external
              label={`Instagram ${hotel.instagramHandle} (opens in a new tab)`}
              icon={<InstagramIcon aria-hidden="true" className="size-5" />}
            />
            <IconLink
              href={hotel.directionsUrl}
              external
              label="Get directions (opens in a new tab)"
              icon={<MapPin aria-hidden="true" className="size-5" />}
            />
          </ul>
          <p className="mt-3 hidden text-sm text-cream/80 md:block">
            <a href={hotel.phoneHref} className="hover:text-gold-soft">
              {hotel.phoneDisplay}
            </a>
            <br />
            <a href={hotel.phoneHrefSecondary} className="hover:text-gold-soft">
              {hotel.phoneDisplaySecondary}
            </a>
            <br />
            <a href={`mailto:${hotel.email}`} className="break-all hover:text-gold-soft">
              {hotel.email}
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-cream/15">
        <p className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 px-4 py-1 text-xs text-cream/75 sm:px-6 md:py-2 lg:px-8">
          <span>
            © {year} {hotel.name}
          </span>
          <Link to="/privacy-policy" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-gold-soft hover:underline">
            Privacy
          </Link>
          <span className="inline-flex min-h-11 items-center gap-1">
            Designed &amp; Developed by
            <a
              href={developer.url}
              target="_blank"
              rel="noopener"
              aria-label={`${developer.name} (opens in a new tab)`}
              className="font-semibold underline-offset-4 hover:text-gold-soft hover:underline"
            >
              {developer.name}
            </a>
          </span>
        </p>
      </div>
    </footer>
  )
}

/** Thin gold-to-maroon line-art divider: rules, diamonds and a central lotus. Decorative. */
function OrnamentBand() {
  const id = useId()
  const grad = `footer-orn-${id.replace(/:/g, '')}`
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-8 lg:px-8" aria-hidden="true">
      <svg viewBox="0 0 480 28" className="h-5 w-full md:h-7" fill="none" focusable="false" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-burgundy)" stopOpacity="0" />
            <stop offset="0.2" stopColor="var(--color-burgundy)" />
            <stop offset="0.5" stopColor="var(--color-gold)" />
            <stop offset="0.8" stopColor="var(--color-burgundy)" />
            <stop offset="1" stopColor="var(--color-burgundy)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g stroke={`url(#${grad})`} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 14H200M280 14H480" />
          <path d="M0 18H190M290 18H480" strokeOpacity="0.5" />
          {[60, 110, 160, 320, 370, 420].map((x) => (
            <path key={x} d={`M${x} 14l4 -4l4 4l-4 4Z`} />
          ))}
          {/* Central lotus between scrolls. */}
          <path d="M240 3C232 9 232 19 240 25C248 19 248 9 240 3Z" />
          <path d="M240 25C228 24 222 16 224 8C232 10 237 16 240 25Z" />
          <path d="M240 25C252 24 258 16 256 8C248 10 243 16 240 25Z" />
          <path d="M200 14q10 -10 20 -2M280 14q-10 -10 -20 -2" />
          <path d="M200 14q10 10 20 2M280 14q-10 10 -20 2" />
        </g>
        <circle cx="240" cy="14" r="1.6" fill="var(--color-gold-soft)" />
      </svg>
    </div>
  )
}

function IconLink({ href, icon, label, external }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return (
    <li>
      <a
        href={href}
        aria-label={label}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="inline-flex size-11 items-center justify-center rounded-full border border-cream/25 text-gold-soft ring-gold ring-offset-2 ring-offset-walnut transition-[box-shadow,border-color,background-color] duration-200 hover:border-transparent hover:bg-cream/10 hover:ring-2 motion-reduce:transition-none"
      >
        {icon}
      </a>
    </li>
  )
}
