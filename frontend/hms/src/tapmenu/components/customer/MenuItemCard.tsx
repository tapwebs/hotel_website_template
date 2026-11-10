import { Image, Minus, Plus, Utensils } from 'lucide-react'
import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

  return (
    <article
      className={`group relative flex flex-row bg-white rounded-xl sm:rounded-2xl border border-neutral-200/80 shadow-2xs transition-all duration-150 overflow-hidden text-left min-h-[7.5rem] sm:min-h-[8.5rem] w-full content-deferred ${
        isSoldOut ? 'opacity-65' : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* Clickable Card Body (Image + Details) */}
      <div
        role="button"
        tabIndex={isSoldOut ? -1 : 0}
        onClick={isSoldOut ? undefined : () => onOpen(item)}
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
        className={`flex-1 flex flex-row min-w-0 self-stretch focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-accent,#2563eb)] ${
          isSoldOut ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        {/* Left: Edge-to-edge food image with fixed uniform dimensions */}
        <div className="relative w-[min(5.75rem,26vw)] sm:w-[7.75rem] self-stretch shrink-0 bg-neutral-100 overflow-hidden">
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 bg-neutral-200 animate-pulse" />
          )}

          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                if (!useOriginal && originalImageUrl(thumbUrl) !== thumbUrl) {
                  setUseOriginal(true)
                  return
                }
                setImgError(true)
                setImgLoaded(true)
              }}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300 bg-neutral-50">
              <Utensils className="w-7 h-7 text-neutral-300" />
            </div>
          )}

          {/* Editorial Badge */}
          <div className="absolute top-2 left-2 z-10">
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

        {/* Right: Content details */}
        <div className="flex-1 p-2 sm:p-2.5 flex flex-col justify-between gap-1 min-w-0">
          <div className="min-w-0 pr-7">
            <h3 className="text-sm sm:text-[0.9rem] font-bold text-neutral-900 leading-snug line-clamp-2 break-words group-hover:text-[var(--customer-accent,#2563eb)] transition-colors">
              {item.name}
            </h3>

            <div className="mt-0.5 space-y-0.5">
              {item.kcal && (
                <span className="text-[0.6875rem] font-medium text-neutral-400 font-mono inline-block mr-1.5">
                  {item.kcal} kcal
                </span>
              )}
              {item.description && (
                <p className="text-xs text-neutral-500 line-clamp-2 leading-[1.3] break-words">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          {/* Price Container */}
          <div className="flex flex-col leading-tight justify-end pt-1 min-h-11 border-t border-neutral-100 min-w-0 pr-[min(6.75rem,38vw)] sm:pr-[7.25rem]">
            {originalPrice && originalPrice > displayPrice ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="whitespace-nowrap text-[0.6875rem] text-neutral-400 line-through font-mono">
                  ₹{originalPrice}
                </span>
                <span className="text-[0.6875rem] font-extrabold text-rose-600 font-mono bg-rose-50 px-1 py-0.2 rounded border border-rose-200/60">
                  {Math.round(((originalPrice - displayPrice) / originalPrice) * 100)}% OFF
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="min-w-0 break-words text-[0.9rem] sm:text-[0.95rem] font-black font-mono text-[var(--customer-accent,#2563eb)]">
                {item.variants?.length ? `From ₹${displayPrice}` : `₹${displayPrice}`}
              </span>
              {item.variants && item.variants.length > 0 && (
                <span className="text-[0.6875rem] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {item.variants.length} sizes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top-Right Veg / Non-Veg Indicator */}
      <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
        {renderDietaryIndicator()}
      </div>

      {/* Action / Stepper Container (Outside role=button) */}
      <div className="absolute right-1.5 sm:right-2.5 bottom-1.5 sm:bottom-2.5 z-10 flex flex-col items-center justify-end shrink-0">
        {isSoldOut ? (
          <div className="min-h-11 px-2.5 sm:px-3 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-400 text-[0.6875rem] sm:text-xs font-bold flex items-center justify-center cursor-not-allowed select-none">
            <span>Sold Out</span>
          </div>
        ) : quantity > 0 ? (
          <div className="flex items-center rounded-lg shadow-2xs border border-neutral-900 text-white overflow-hidden min-h-11 bg-neutral-900">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => onQuickAdjust(item.id, -1)}
              className="w-10 sm:w-11 self-stretch flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
              aria-label={`Remove one ${item.name}`}
            >
              <Minus className="w-3.5 h-3.5" />
            </motion.button>
            <div className="overflow-hidden flex items-center justify-center min-w-6 px-0.5 sm:px-1">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={quantity}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 6, opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="text-sm font-bold font-mono text-center inline-block"
                >
                  {quantity}
                </motion.span>
              </AnimatePresence>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                if (hasCustomization) onOpen(item)
                else onQuickAdjust(item.id, 1)
              }}
              className="w-10 sm:w-11 self-stretch flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
              aria-label={`Add one more ${item.name}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.12 }}
              onClick={() => {
                if (hasCustomization) onOpen(item)
                else onQuickAdd(item)
              }}
              className="min-h-11 px-3 sm:px-5 rounded-lg bg-white border border-[var(--customer-accent,#2563eb)] text-[var(--customer-accent,#2563eb)] hover:bg-[var(--customer-accent,#2563eb)] hover:text-white shadow-2xs text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <span>Add +</span>
            </motion.button>
            {hasCustomization && (
              <span className="text-[0.6875rem] font-medium text-neutral-400 mt-0.5 tracking-tight leading-none">
                Customisable
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export const MenuItemCard = memo(MenuItemCardComponent)
