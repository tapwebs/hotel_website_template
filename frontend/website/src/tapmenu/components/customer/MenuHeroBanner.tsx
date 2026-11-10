import { Utensils } from 'lucide-react'
import { useState } from 'react'

interface MenuHeroBannerProps {
  heroImage?: string
  restaurantName: string
  logo?: string
  accent?: string
}

/**
 * Compact brand banner. Lives inside the scrolling menu panel so it scrolls
 * away instead of permanently eating phone screen height. The sticky header
 * already carries the restaurant name and table, so this is purely visual.
 */
export function MenuHeroBanner({ heroImage, restaurantName, logo, accent = '#00E599' }: MenuHeroBannerProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  if (!heroImage || imageError) return null

  return (
    <div className="relative w-full h-28 sm:h-44 overflow-hidden rounded-2xl mb-3 select-none bg-neutral-900">
      <img
        src={heroImage}
        alt=""
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          imageLoaded ? 'opacity-90' : 'opacity-0'
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ backgroundColor: accent }}
      />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex items-center gap-3">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain bg-white p-0.5 shadow-lg shrink-0"
          />
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/90 flex items-center justify-center shrink-0 text-neutral-800">
            <Utensils className="w-5 h-5" />
          </div>
        )}
        <p className="text-base sm:text-xl font-black text-white tracking-tight drop-shadow-md line-clamp-2 break-words">
          {restaurantName}
        </p>
      </div>
    </div>
  )
}
