import { Link } from 'react-router'
import { Seo } from '@/components/Seo'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { hotel, nav } from '@/data/hotel'
import { cn, container, inlineLink } from '@/lib/utils'

export default function NotFound() {
  return (
    <>
      {/* Seo emits "noindex, follow" for /404 from src/seo/routes.ts. */}
      <Seo path="/404" />
      <section
        className={cn(
          container,
          'grid min-h-[60svh] content-center gap-6 py-20 max-md:justify-items-center max-md:gap-5 max-md:text-center',
        )}
      >
        <div className="hairline w-20" aria-hidden="true" />
        <h1 className="text-h1 text-burgundy-deep">This page could not be found</h1>
        <p className="max-w-[50ch] text-lede text-walnut">
          The link may be old or mistyped. Head back home, request a room straight away, or pick a page below for rooms, dining, weddings,
          directions and FAQs.
        </p>
        <div className="flex flex-wrap gap-3 max-md:w-full max-md:max-w-sm max-md:flex-col">
          <Button asChild size="lg" variant="outline">
            <Link to="/">Go to Home</Link>
          </Button>
          <BookNowButton size="lg" />
        </div>
        <nav aria-label={`Pages at ${hotel.name}`} className="grid gap-2 m-reveal">
          <h2 className="text-sm font-semibold text-muted-foreground">Or visit one of these pages</h2>
          <ul className="flex flex-wrap gap-x-6 max-md:justify-center max-md:gap-x-5">
            {[...nav, { to: '/contact#faqs', label: 'Hotel policies & FAQs' }].map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={cn('inline-flex min-h-11 items-center', inlineLink)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </>
  )
}
