import { cn } from '@/lib/utils'
import { fallbackSrc, srcset, type SiteImage } from '@/data/images'

interface PictureProps {
  image: SiteImage
  /** The `sizes` attribute. Defaults to full viewport width. */
  sizes?: string
  /** LCP image: eager + high fetch priority. */
  priority?: boolean
  className?: string
  imgClassName?: string
  /** Show the "Representative image" / illustration caption when the image has one. */
  showCaption?: boolean
  /** Use 'span' when the picture sits inside a button or link (phrasing content only). */
  as?: 'figure' | 'span'
}

/** AVIF + WebP <picture> with explicit dimensions (no layout shift). */
export function Picture({ image, sizes = '100vw', priority, className, imgClassName, showCaption = true, as = 'figure' }: PictureProps) {
  const caption = showCaption ? image.caption : undefined
  const Wrap = as
  const Caption = as === 'figure' ? 'figcaption' : 'span'
  return (
    <Wrap className={cn('relative block', className)}>
      <picture>
        <source type="image/avif" srcSet={srcset(image, 'avif')} sizes={sizes} />
        <source type="image/webp" srcSet={srcset(image, 'webp')} sizes={sizes} />
        <img
          src={fallbackSrc(image)}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn('block h-full w-full object-cover', imgClassName)}
        />
      </picture>
      {caption ? (
        <Caption className="absolute bottom-2 left-2 rounded-sm bg-ink/75 px-2 py-1 text-xs font-medium text-ivory">{caption}</Caption>
      ) : null}
    </Wrap>
  )
}

/** Wraps content in the cusped jharokha arch mask (see `jharokha` utility in index.css). */
export function JharokhaFrame({
  children,
  className,
  'aria-hidden': ariaHidden,
}: {
  children: React.ReactNode
  className?: string
  'aria-hidden'?: boolean
}) {
  return (
    <div className={cn('@container', className)} aria-hidden={ariaHidden}>
      <div className="jharokha h-full overflow-hidden">{children}</div>
    </div>
  )
}
