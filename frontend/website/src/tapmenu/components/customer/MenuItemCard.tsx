import { Minus, Plus, Utensils } from 'lucide-react'
import { useState, memo } from 'react'

import type { MenuItem } from '../../types/customer'
import { getAccurateFoodImage, originalImageUrl } from '../../features/customer/menu/dishImageHelper'
import { MenuBadge } from './MenuBadge'

interface MenuItemCardProps {
  item: MenuItem & { originalPrice?: number; kcal?: number }
  quantity: number
  onOpen: (item: MenuItem) => void
  onQuickAdd: (item: MenuItem) => void
  onQuickAdjust: (itemId: string, delta: number) => void
}

function MenuItemCardComponent({
  item,
  quantity,
  onOpen,
  onQuickAdd,
  onQuickAdjust,
}: MenuItemCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  const hasCustomization =
    (item.variants && item.variants.length > 0) ||
    (item.addOns && item.addOns.length > 0)

  const isSoldOut = item.isAvailable === false

  const displayPrice = item.variants?.length
    ? Math.min(...item.variants.map((v) => v.price))
    : item.price

  const originalPrice =
    item.originalPrice ?? (item as any).original_price ?? undefined

  const thumbUrl = getAccurateFoodImage(item)
  const [useOriginal, setUseOriginal] = useState(false)
  const imageUrl = useOriginal ? originalImageUrl(thumbUrl) : thumbUrl

  const renderDietaryIndicator = () => {
    const dietary = item.dietaryType || (item.isVeg ? 'veg' : 'non-veg')
    if (dietary === 'veg') {
      return (
        <span className="w-3.5 h-3.5 rounded-xs border border-emerald-600 flex items-center justify-center bg-white shrink-0 shadow-2xs" title="Vegetarian">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        </span>
      )
    }
    if (dietary === 'vegan') {
      return (
        <span className="w-3.5 h-3.5 rounded-xs border border-emerald-600 flex items-center justify-center bg-white shrink-0 shadow-2xs" title="Vegan">
          <span className="w-1.5 h-1.5 rounded-xs bg-emerald-600 rotate-45" />
        </span>
      )
    }
    if (dietary === 'egg') {
      return (
        <span className="w-3.5 h-3.5 rounded-xs border border-amber-500 flex items-center justify-center bg-white shrink-0 shadow-2xs" title="Contains Egg">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        </span>
      )
    }
    return (
      <span className="w-3.5 h-3.5 rounded-xs border border-rose-600 flex items-center justify-center bg-white shrink-0 shadow-2xs" title="Non-Vegetarian">
        <span className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-l-transparent border-r-transparent border-b-rose-600" />
      </span>
    )
  }

  const open = isSoldOut ? undefined : () => onOpen(item)
  const accent = 'var(--customer-accent,#2563eb)'

  return (
    <article
      className={`relative flex bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden text-left w-full min-h-[7.5rem] content-deferred ${
        isSoldOut ? 'opacity-65' : ''
      }`}
    >
      {/* Image: fixed-width box, photo absolutely filled so its aspect ratio never stretches the card */}
      <div
        onClick={open}
        aria-hidden="true"
        className={`relative w-[6.5rem] sm:w-[7.75rem] shrink-0 bg-neutral-100 ${isSoldOut ? '' : 'cursor-pointer'}`}
      >
        {imageUrl && !imgError ? (
          <img
            src={imageUrl}
            alt=""
            width={240}
            height={240}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              if (!useOriginal && originalImageUrl(thumbUrl) !== thumbUrl) {
                setUseOriginal(true)
                return
              }
              setImgError(true)
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <Utensils className="w-7 h-7" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 z-10">
          {isSoldOut ? (
            <MenuBadge type="soldout" size="xs" />
          ) : item.tags?.includes('bestseller') ? (
            <MenuBadge type="bestseller" size="xs" />
          ) : item.tags?.includes('trending') ? (
            <MenuBadge type="trending" rank={1} size="xs" />
          ) : item.tags?.includes('chef') ? (
            <MenuBadge type="chef" size="xs" />
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
        {/* Name + description (opens the item) */}
        <div
          role="button"
          tabIndex={isSoldOut ? -1 : 0}
          onClick={open}
          onKeyDown={
            isSoldOut
              ? undefined
              : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(item)
                  }
                }
          }
          aria-label={`${item.name}${isSoldOut ? ', Sold Out' : ''}, ₹${displayPrice}`}
          className={`min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isSoldOut ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[0.95rem] font-bold text-neutral-900 leading-snug line-clamp-2 break-words">
              {item.name}
            </h3>
            <span className="mt-0.5">{renderDietaryIndicator()}</span>
          </div>
          {item.kcal && (
            <span className="text-[0.6875rem] font-medium text-neutral-400 font-mono mr-1.5">{item.kcal} kcal</span>
          )}
          {item.description && (
            <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2 leading-snug break-words">{item.description}</p>
          )}
        </div>

        {/* Price + action share one row so there is no dead space under the text */}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col leading-tight min-w-0">
            {originalPrice && originalPrice > displayPrice ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[0.6875rem] text-neutral-400 line-through font-mono">₹{originalPrice}</span>
                <span className="text-[0.6875rem] font-extrabold text-rose-600 font-mono">
                  {Math.round(((originalPrice - displayPrice) / originalPrice) * 100)}% OFF
                </span>
              </span>
            ) : null}
            <span className="text-base font-black font-mono" style={{ color: accent }}>
              {item.variants?.length ? `From ₹${displayPrice}` : `₹${displayPrice}`}
            </span>
            {item.variants && item.variants.length > 0 && (
              <span className="text-[0.6875rem] text-neutral-500">{item.variants.length} sizes</span>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end">
            {isSoldOut ? (
              <span className="min-h-10 px-3 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-400 text-xs font-bold flex items-center select-none">
                Sold Out
              </span>
            ) : quantity > 0 ? (
              <div className="flex items-center rounded-xl border border-neutral-900 bg-neutral-900 text-white overflow-hidden min-h-10">
                <button
                  type="button"
                  onClick={() => onQuickAdjust(item.id, -1)}
                  className="w-10 self-stretch flex items-center justify-center text-neutral-300 active:bg-neutral-700 cursor-pointer"
                  aria-label={`Remove one ${item.name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-6 text-center text-sm font-bold font-mono">{quantity}</span>
                <button
                  type="button"
                  onClick={() => (hasCustomization ? onOpen(item) : onQuickAdjust(item.id, 1))}
                  className="w-10 self-stretch flex items-center justify-center text-neutral-300 active:bg-neutral-700 cursor-pointer"
                  aria-label={`Add one more ${item.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => (hasCustomization ? onOpen(item) : onQuickAdd(item))}
                  className="min-h-10 px-5 rounded-xl bg-white border text-sm font-bold active:scale-95 active:bg-neutral-50 transition-transform cursor-pointer"
                  style={{ borderColor: accent, color: accent }}
                >
                  Add +
                </button>
                {hasCustomization && (
                  <span className="text-[0.625rem] font-medium text-neutral-400 mt-0.5 leading-none">Customisable</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export const MenuItemCard = memo(MenuItemCardComponent)
