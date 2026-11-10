import type { CSSProperties } from 'react'
import { cn, container } from '@/lib/utils'
import { Picture } from '@/components/Picture'
import type { HeroDressing } from '@/components/heroArt'
import { Breadcrumbs } from './Breadcrumbs'

interface PageIntroProps extends Partial<HeroDressing> {
  title: React.ReactNode
  lede: React.ReactNode
  /** Current page label for the breadcrumb trail (from `nav` in hotel.ts). */
  breadcrumb?: string
  /** Short line beside the hairline above the h1. */
  eyebrow?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/** Stagger delay for the shared `.anim-rise` / `.anim-draw` classes (index.css). */
const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties

/**
 * Inner-page hero: breadcrumb, h1, lede and optional actions on the left, the page's own line-art
 * (components/heroArt) on the right. With an `image`, the photo sits behind a cream/maroon wash
 * and is the page's LCP image (eager, high priority). On phones the art shrinks behind the text.
 */
export function PageIntro({ title, lede, breadcrumb, eyebrow, art: Art, image, children, className }: PageIntroProps) {
  return (
    <header className={cn('relative isolate overflow-hidden', className)}>
      {image && (
        <>
          <div className="absolute inset-0 -z-30" aria-hidden="true">
            <Picture image={image} priority sizes="100vw" showCaption={false} className="h-full" imgClassName="anim-kenburns" />
          </div>
          {/* Cream wash keeps text AA on any photo; a maroon glow warms the art side; fades into the page below. */}
          <div
            className="absolute inset-0 -z-20 bg-cream/90 md:bg-transparent md:bg-gradient-to-r md:from-cream md:via-cream/90 md:to-cream/55"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_85%_35%,color-mix(in_oklab,var(--color-burgundy)_14%,transparent),transparent_65%)] after:absolute after:inset-x-0 after:bottom-0 after:h-12 after:bg-gradient-to-t after:from-cream"
            aria-hidden="true"
          />
        </>
      )}
      <div
        className={cn(
          container,
          'relative grid items-center gap-6 pt-6 pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10 md:pt-12 md:pb-12 lg:pt-16 lg:pb-16',
        )}
      >
        <div className="grid gap-3 md:gap-5">
          {breadcrumb && (
            <div className="anim-rise -mt-3 -mb-1 md:-mt-6 md:-mb-2" style={d(0)}>
              <Breadcrumbs current={breadcrumb} />
            </div>
          )}
          {eyebrow ? (
            <p className="anim-rise flex items-center gap-3 text-sm font-medium text-muted-foreground" style={d(0.08)}>
              <span className="hairline w-10 shrink-0" aria-hidden="true" />
              {eyebrow}
            </p>
          ) : (
            <div className="hairline anim-rise w-20" style={d(0.08)} aria-hidden="true" />
          )}
          <h1 className="anim-rise max-w-[18ch] text-h1 text-burgundy-deep" style={d(0.16)}>
            {title}
          </h1>
          <p className="anim-rise max-w-[60ch] text-lede text-walnut" style={d(0.26)}>
            {lede}
          </p>
          {children && (
            <div className="anim-rise grid gap-4" style={d(0.36)}>
              {children}
            </div>
          )}
        </div>
        {Art && (
          <div
            className="pointer-events-none absolute -top-2 -right-6 -z-10 w-36 opacity-20 sm:w-44 md:static md:z-auto md:w-56 md:opacity-100 lg:w-72"
            style={d(0.2)}
          >
            <Art className="h-auto w-full" />
          </div>
        )}
      </div>
    </header>
  )
}
