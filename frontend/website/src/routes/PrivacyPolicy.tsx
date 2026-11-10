import { Link } from 'react-router'
import { Seo } from '@/components/Seo'
import { PageIntro } from '@/components/sections/PageIntro'
import { privacyHero } from '@/components/heroArt'
import { hotel } from '@/data/hotel'
import { googlePrivacyUrl, privacySections, privacyUpdated } from '@/data/privacy'
import { cn, container } from '@/lib/utils'
const link = 'font-semibold break-words text-burgundy underline underline-offset-4'
export default function PrivacyPolicy() {
  return (
    <>
      <Seo path="/privacy-policy" />
      <PageIntro
        {...privacyHero}
        breadcrumb="Privacy Policy"
        title="Privacy policy"
        lede="How Hotel Dream Heaven’s handles the details you share on this website and at the hotel. We only say what is true today."
      >
        <p className="text-sm text-muted-foreground">
          Last updated: <time dateTime={privacyUpdated.iso}>{privacyUpdated.label}</time>
        </p>
      </PageIntro>
      {/* Block-print buti in the wide side margins only; the reading column stays clean. */}
      <div className="pattern-buti [--pattern-fade:linear-gradient(90deg,#000,transparent_30%,transparent_70%,#000)]">
        <div className={cn(container, 'grid max-w-3xl gap-10 pb-20 max-md:gap-8 max-md:pb-12 lg:pb-28')}>
          {privacySections.map((s) => (
            <section key={s.id} aria-labelledby={s.id} className="grid gap-3 m-reveal">
              <h2 id={s.id} className="text-h3 text-burgundy-deep">
                {s.title}
              </h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="text-walnut">
                  {p}
                </p>
              ))}
              {s.id === 'third-parties' && (
                <a href={googlePrivacyUrl} target="_blank" rel="noopener noreferrer" className={link}>
                  Google Privacy Policy
                </a>
              )}
              {s.id === 'your-rights' && (
                <a href={`mailto:${hotel.email}`} className={link}>
                  {hotel.email}
                </a>
              )}
              {s.id === 'contact' && (
                <p className="text-walnut">
                  Phone or WhatsApp:{' '}
                  <a href={hotel.phoneHref} className={link}>
                    {hotel.phoneDisplay}
                  </a>{' '}
                  or{' '}
                  <a href={hotel.phoneHrefSecondary} className={link}>
                    {hotel.phoneDisplaySecondary}
                  </a>
                  . Email:{' '}
                  <a href={`mailto:${hotel.email}`} className={link}>
                    {hotel.email}
                  </a>
                  . Address, map and directions are on our{' '}
                  <Link to="/contact" className={link}>
                    contact and directions page
                  </Link>
                  .
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
