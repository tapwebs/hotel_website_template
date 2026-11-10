import { Clock, MapPin, MessageCircle } from 'lucide-react'
import { Breadcrumbs } from '@/components/sections/Breadcrumbs'
import { fallbackSrc, srcset, type SiteImage } from '@/data/images'
import { cn, container } from '@/lib/utils'

const perks = [
  { icon: MessageCircle, text: 'Book by WhatsApp or phone' },
  { icon: Clock, text: 'Check-in and check-out at 11:00 AM' },
  { icon: MapPin, text: '100 Hospitality Boulevard, Metropolis' },
]

interface AuthShellProps {
  breadcrumb: string
  eyebrow: string
  title: string
  intro: string
  tagline: string
  image: SiteImage
  /** object-position for the photo's focal point. */
  focal?: string
  wide?: boolean
  children: React.ReactNode
}

/** Unified split panel: form half (heading + form) beside a full-bleed hotel photo with a caption block. */
export function AuthShell({ breadcrumb, eyebrow, title, intro, tagline, image, focal = '50% 50%', wide, children }: AuthShellProps) {
  const sizes = '(min-width: 1024px) 560px, 100vw'
  return (
    <div className={cn(container, 'pb-10 lg:pb-14')}>
      <Breadcrumbs current={breadcrumb} className="-mt-1" />
      <section className="anim-rise mx-auto grid max-w-[1120px] overflow-hidden rounded-3xl border border-border bg-ivory shadow-[0_30px_70px_-30px_rgb(74_17_27/0.45)] lg:grid-cols-2">
        <div className={cn('p-6 max-sm:p-5 sm:p-8 lg:px-10 lg:py-9', wide && 'lg:py-8')}>
          <p className="flex items-center gap-3 text-sm font-semibold tracking-[0.16em] text-burgundy uppercase">
            <span className="hairline w-8" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="mt-2 text-4xl text-burgundy-deep max-sm:text-[2rem] max-sm:leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-2 mb-5 max-w-[44ch] text-walnut">{intro}</p>
          {children}
        </div>
        <div className="relative isolate h-56 overflow-hidden bg-burgundy-deep max-sm:h-44 sm:h-64 lg:h-auto" aria-hidden="true">
          <picture>
            <source type="image/avif" srcSet={srcset(image, 'avif')} sizes={sizes} />
            <source type="image/webp" srcSet={srcset(image, 'webp')} sizes={sizes} />
            <img
              src={fallbackSrc(image)}
              alt=""
              width={image.width}
              height={image.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              style={{ objectPosition: focal }}
              className="anim-kenburns absolute inset-0 size-full object-cover"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-burgundy-deep/90 via-burgundy-deep/30 to-transparent lg:from-burgundy-deep/95 lg:via-burgundy-deep/45" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-ivory max-md:p-5 lg:p-8">
            <p className="font-display text-2xl leading-tight sm:text-3xl">{tagline}</p>
            <div className="my-4 flex items-center gap-2 text-gold-soft max-md:mb-0 max-md:mt-3 lg:my-5">
              <span className="h-px w-10 bg-gold" />
              <span className="size-1.5 rotate-45 bg-gold" />
              <span className="h-px w-10 bg-gold" />
            </div>
            <ul className="hidden gap-2.5 text-sm lg:grid">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-gold-soft" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
