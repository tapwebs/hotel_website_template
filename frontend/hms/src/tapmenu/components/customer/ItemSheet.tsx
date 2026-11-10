import { ArrowLeft, Check, Image, Minus, Plus, Sparkles, Utensils } from 'lucide-react'
import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import type { MenuItem } from '../../types/customer'
import { enrichMenuItem, type StructuredAddOnItem } from '../../features/customer/menu/menuEnricher'
import { getAccurateFoodImage, originalImageUrl } from '../../features/customer/menu/dishImageHelper'
import { MenuBadge } from './MenuBadge'
import { formatVariantLabel } from '../../lib/variants'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

interface ItemSheetProps {
  item: MenuItem | null
  allItems?: MenuItem[]
  onClose: () => void
  onAdd: (selection: { variantId?: string; addOnIds: string[]; qty: number }) => void
  /** Real cart quantity so displayed count always matches cart state. */
  cartQuantityFor?: (itemId: string) => number
}

export function ItemSheet({
  item,
  allItems = [],
  onClose,
  onAdd,
  cartQuantityFor,
}: ItemSheetProps) {
  const [variantId, setVariantId] = useState<string | undefined>(undefined)
  const [addOnIds, setAddOnIds] = useState<string[]>([])
  const [selectedDrinkId, setSelectedDrinkId] = useState<string | null>(null)
  const [selectedSideIds, setSelectedSideIds] = useState<string[]>([])
  const [qty, setQty] = useState(1)
  const [imgError, setImgError] = useState(false)
  const [heroFallback, setHeroFallback] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Enrich item with structured extras, beverages, and sides
  const enrichedItem = useMemo(() => {
    if (!item) return null
    return enrichMenuItem(item, allItems)
  }, [item, allItems])

  // Reset state when opening a new item
  useEffect(() => {
    if (!item) return
    const defaultVariant = item.variants?.find((v) => v.isDefault) || item.variants?.[0]
    setVariantId(defaultVariant?.id)
    setAddOnIds([])
    setSelectedDrinkId(null)
    setSelectedSideIds([])
    setQty(1)
    setImgError(false)
  }, [item])

  // Escape key listener, body scroll lock & focus trap
  useEffect(() => {
    if (!item) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    lockBodyScroll()

    const timer = setTimeout(() => {
      if (sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        ;(focusable[0] ?? sheetRef.current).focus()
      }
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      unlockBodyScroll()
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [item, onClose])

  if (!item || !enrichedItem) return null

  const isSoldOut = item.isAvailable === false
  const heroThumb = getAccurateFoodImage(item)
  const heroImage = heroFallback ? originalImageUrl(heroThumb) : heroThumb
  const selectedVariant = item.variants?.find((v) => v.id === variantId)
  const basePrice = selectedVariant ? selectedVariant.price : item.price

  // Calculate extras cost
  const extrasTotal = addOnIds.reduce((sum, id) => {
    const found = enrichedItem.structuredAddOns.extras.find((e) => e.id === id)
    return sum + (found?.price ?? 0)
  }, 0)

  // Calculate upgraded drink cost
  const drinkItem = selectedDrinkId
    ? enrichedItem.structuredAddOns.beverages.find((b) => b.id === selectedDrinkId)
    : null
  const drinkPrice = drinkItem ? drinkItem.price : 0

  // Calculate sides cost
  const sidesTotal = selectedSideIds.reduce((sum, id) => {
    const found = enrichedItem.structuredAddOns.sides.find((s) => s.id === id)
    return sum + (found?.price ?? 0)
  }, 0)

  const unitPrice = basePrice + extrasTotal + drinkPrice + sidesTotal
  const finalTotal = unitPrice * qty

  // Original strikethrough price calculation (only if genuine originalPrice was set by restaurant)
  const originalUnitPrice = enrichedItem.originalPrice && enrichedItem.originalPrice > basePrice
    ? enrichedItem.originalPrice + extrasTotal + drinkPrice + sidesTotal
    : undefined
  const originalFinalTotal = originalUnitPrice ? originalUnitPrice * qty : undefined

  const toggleExtra = (id: string) => {
    setAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const toggleDrink = (id: string) => {
    setSelectedDrinkId((prev) => (prev === id ? null : id))
  }

  const toggleSide = (id: string) => {
    setSelectedSideIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleAddToCart = () => {
    if (isSoldOut) return
    // Combine all selected add-ons, filtering strictly to valid add-ons
    const validAddOnSet = new Set([
      ...(item.addOns || []).map((a) => a.id),
      ...enrichedItem.structuredAddOns.extras.map((e) => e.id),
      ...enrichedItem.structuredAddOns.beverages.map((b) => b.id),
      ...enrichedItem.structuredAddOns.sides.map((s) => s.id),
    ])
    // De-duplicated: the server accepts each add-on once per line.
    const allSelectedAddOns: string[] = [
      ...new Set([...addOnIds, ...(selectedDrinkId ? [selectedDrinkId] : []), ...selectedSideIds]),
    ].filter((id) => validAddOnSet.has(id))
    onAdd({
      variantId,
      addOnIds: allSelectedAddOns,
      qty,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs"
    >
      {/* Full-screen / Sheet Container */}
      <motion.div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Customise ${item.name}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative z-10 w-full sm:max-w-2xl h-full sm:h-[94dvh] sm:max-h-[94dvh] landscape:max-h-[96dvh] bg-[#faf9f6] sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-neutral-200/80"
      >
          {/* Top Bar: Back Arrow & Title */}
          <div className="sticky top-0 z-30 bg-[#faf9f6]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-neutral-200/70">
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white shadow-2xs border border-neutral-200/80 flex items-center justify-center text-neutral-800 hover:bg-neutral-50 active:scale-90 transition-transform cursor-pointer"
              aria-label="Back to menu"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-800" />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
              Customise Your Order
            </span>
            <div className="w-10" />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-3 pb-8 space-y-7 no-scrollbar">
            {/* 1. Large Hero Food Photo & Details */}
            <div className="w-full flex flex-col landscape:flex-row landscape:items-center landscape:justify-center landscape:gap-4 sm:landscape:flex-col items-center justify-center">
              <div className="w-full max-w-[min(17.5rem,100%)] sm:max-w-[320px] landscape:max-w-[140px] sm:landscape:max-w-[320px] aspect-[4/3] rounded-3xl overflow-hidden bg-white shadow-md border border-neutral-200/70 relative shrink-0">
                {heroImage && !imgError ? (
                  <img
                    src={heroImage}
                    alt={item.name}
                    onError={() => (!heroFallback && originalImageUrl(heroThumb) !== heroThumb ? setHeroFallback(true) : setImgError(true))}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300">
                    <Utensils className="w-12 h-12 text-neutral-300" />
                  </div>
                )}
              </div>

              {/* Product Title & Info */}
              <div className="flex flex-col items-center landscape:items-start sm:landscape:items-center w-full min-w-0">
                <h1 className="text-xl sm:text-3xl break-words [overflow-wrap:anywhere] max-w-full font-black text-neutral-900 tracking-tight text-center landscape:text-left sm:landscape:text-center uppercase mt-4 landscape:mt-0 sm:landscape:mt-4 px-2 leading-tight">
                  {item.name}
                </h1>

              {/* Dietary Badge, Price & Calories */}
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    item.isVeg
                      ? 'border-emerald-600/30 bg-emerald-50 text-emerald-700'
                      : 'border-rose-600/30 bg-rose-50 text-rose-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  />
                  {item.isVeg ? 'Veg' : 'Non-Veg'}
                </span>

                {enrichedItem.originalPrice && enrichedItem.originalPrice > basePrice ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold font-mono text-neutral-400 line-through">
                      ₹{enrichedItem.originalPrice}
                    </span>
                    <span className="text-lg font-black font-mono text-[var(--customer-accent,#2563eb)]">
                      ₹{basePrice}
                    </span>
                    <span className="text-[0.6875rem] font-extrabold font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                      {Math.round(((enrichedItem.originalPrice - basePrice) / enrichedItem.originalPrice) * 100)}% OFF
                    </span>
                  </div>
                ) : (
                  <span className="text-lg font-black font-mono text-[var(--customer-accent,#2563eb)]">
                    ₹{basePrice}
                  </span>
                )}

                {enrichedItem.kcal && (
                  <span className="text-xs font-bold font-mono text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
                    {enrichedItem.kcal} kcal
                  </span>
                )}
              </div>

              {item.description && (
                <p className="text-xs sm:text-sm [overflow-wrap:anywhere] text-neutral-500 text-center landscape:text-left sm:landscape:text-center max-w-[min(28rem,100%)] mt-2 leading-relaxed">
                  {item.description}
                </p>
              )}
              </div>
            </div>

            {/* 2. Portion / Variant Selection (if exists) */}
            {item.variants && item.variants.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                    Choose Portion Size
                  </h3>
                  <span className="text-[0.6875rem] text-neutral-400 font-bold uppercase tracking-wider">
                    Required
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {item.variants.map((v) => {
                    const isSelected = v.id === variantId
                    return (
                      <motion.button
                        key={v.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => setVariantId(v.id)}
                        className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-[var(--customer-accent,#2563eb)] bg-[var(--customer-accent,#2563eb)]/[0.06] shadow-xs'
                            : 'border-neutral-200/90 bg-white hover:border-neutral-300'
                        }`}
                      >
                        <span className="text-xs font-bold text-neutral-900 line-clamp-2 break-words max-w-full">
                          {v.name}
                        </span>
                        {v.value != null && v.unit && (
                          <span className="text-[0.6875rem] font-semibold text-neutral-500 font-mono mt-0.5">
                            {v.value} {v.unit}
                          </span>
                        )}
                        <span className="text-xs font-bold font-mono text-neutral-700 mt-1">
                          ₹{v.price}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border mt-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-[var(--customer-accent,#2563eb)] bg-[var(--customer-accent,#2563eb)]'
                              : 'border-neutral-300'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Section 1: Additional Items (Horizontal Rows with Image, Name, Price, "Add" button) */}
            {enrichedItem.structuredAddOns.extras.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                    Additional Items
                  </h3>
                  <span className="text-[0.6875rem] text-neutral-400 font-bold uppercase tracking-wider">
                    Customise
                  </span>
                </div>

                <div className="space-y-2">
                  {enrichedItem.structuredAddOns.extras.map((extra) => {
                    const isSelected = addOnIds.includes(extra.id)
                    return (
                      <div
                        key={extra.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {extra.image && (
                            <div className="w-11 h-11 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/60 shrink-0">
                              <img
                                src={extra.image}
                                alt={extra.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                              {extra.name}
                            </div>
                            <div className="text-xs font-mono font-semibold text-neutral-500 mt-0.5">
                              +₹{extra.price}
                            </div>
                          </div>
                        </div>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.92 }}
                          transition={{ duration: 0.12 }}
                          onClick={() => toggleExtra(extra.id)}
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-normal text-center transition-all duration-200 cursor-pointer shrink-0 flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-[var(--customer-accent,#2563eb)] text-white hover:opacity-90 shadow-2xs'
                          }`}
                        >
                          {isSelected ? 'Added ✓' : 'Add'}
                        </motion.button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Swap/Upgrade Drink (3-Column Radio Card Grid) */}
            {enrichedItem.structuredAddOns.beverages.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                    Swap / Upgrade Drink
                  </h3>
                  <span className="text-[0.6875rem] text-neutral-400 font-bold uppercase tracking-wider">
                    Pick 1
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {enrichedItem.structuredAddOns.beverages.map((drink) => {
                    const isSelected = selectedDrinkId === drink.id
                    return (
                      <motion.button
                        key={drink.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => toggleDrink(drink.id)}
                        className={`flex flex-col items-center text-center p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-[var(--customer-accent,#2563eb)] bg-[var(--customer-accent,#2563eb)]/[0.08] shadow-xs'
                            : 'border-neutral-200/90 bg-white hover:border-neutral-300'
                        }`}
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0 mb-1.5 border border-neutral-200/50">
                          {drink.image ? (
                            <img
                              src={drink.image}
                              alt={drink.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Utensils className="w-6 h-6 m-auto text-neutral-300" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-neutral-900 line-clamp-1">
                          {drink.name}
                        </span>
                        <span className="text-xs font-bold font-mono text-neutral-600 mt-0.5">
                          +₹{drink.price}
                        </span>
                        {/* Radio Indicator Circle */}
                        <span
                          className={`w-4 h-4 rounded-full border mt-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-[var(--customer-accent,#2563eb)] bg-[var(--customer-accent,#2563eb)]'
                              : 'border-neutral-300'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Section 4: Add Sides (3-Column Grid of Cards with Image, Name, Price, "Add" button) */}
            {enrichedItem.structuredAddOns.sides.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                    Add Sides
                  </h3>
                  <span className="text-[0.6875rem] text-neutral-400 font-bold uppercase tracking-wider">
                    Recommended
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {enrichedItem.structuredAddOns.sides.map((side) => {
                    const isSelected = selectedSideIds.includes(side.id)
                    return (
                      <motion.div
                        key={side.id}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col items-center text-center p-2.5 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0 mb-1.5 border border-neutral-200/50">
                          {side.image ? (
                            <img
                              src={side.image}
                              alt={side.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Utensils className="w-6 h-6 m-auto text-neutral-300" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-neutral-900 line-clamp-1">
                          {side.name}
                        </span>
                        <span className="text-xs font-bold font-mono text-neutral-600 mt-0.5">
                          +₹{side.price}
                        </span>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.94 }}
                          transition={{ duration: 0.12 }}
                          onClick={() => toggleSide(side.id)}
                          className={`w-full mt-2 min-h-[44px] flex items-center justify-center rounded-xl text-xs font-bold whitespace-normal text-center transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-[var(--customer-accent,#2563eb)] text-white hover:opacity-90 shadow-2xs'
                          }`}
                        >
                          {isSelected ? 'Added ✓' : 'Add'}
                        </motion.button>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Bar: Total Price + Add To Cart Button */}
          <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 px-4 sm:px-8 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg flex flex-wrap items-center justify-between gap-3">
            {/* Left: Final Calculated Price */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1.5">
                {originalFinalTotal && originalFinalTotal > finalTotal && (
                  <span className="text-xs text-neutral-400 line-through font-mono">
                    ₹{originalFinalTotal}
                  </span>
                )}
                <span className="text-xl sm:text-3xl font-black font-mono text-[var(--customer-accent,#2563eb)] leading-none">
                  ₹{finalTotal}
                </span>
                {originalFinalTotal && originalFinalTotal > finalTotal && (
                  <span className="text-[0.6875rem] font-bold font-mono text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                    {Math.round(((originalFinalTotal - finalTotal) / originalFinalTotal) * 100)}% OFF
                  </span>
                )}
              </div>
              <span className="text-[0.6875rem] font-medium text-neutral-400 uppercase tracking-tight mt-1">
                Price before tax
              </span>
            </div>

            {/* Stepper */}
            {!isSoldOut && (
              <div className="flex items-center gap-1.5 border border-neutral-300 rounded-xl px-1.5 h-12 shrink-0 bg-neutral-50 shadow-2xs">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="min-w-11 h-full flex items-center justify-center text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </motion.button>
                <div className="overflow-hidden flex items-center justify-center min-w-4 px-1">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={qty}
                      initial={{ y: -6, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 6, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="font-mono font-bold text-sm text-center text-neutral-900 inline-block"
                    >
                      {qty}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setQty((q) => q + 1)}
                  className="min-w-11 h-full flex items-center justify-center text-neutral-700 hover:text-neutral-900 transition-colors cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            )}

            {/* Right: Add To Cart or Sold Out Button */}
            {isSoldOut ? (
              <div className="flex-1 h-11 px-5 rounded-xl bg-neutral-200 text-neutral-500 font-bold text-sm sm:text-base flex items-center justify-center cursor-not-allowed">
                <span>Sold Out</span>
              </div>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.12 }}
                onClick={handleAddToCart}
                className="flex-1 min-w-[8rem] min-h-11 py-2 px-5 rounded-xl text-white font-black text-sm sm:text-base cursor-pointer shadow-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                style={{ backgroundColor: 'var(--customer-accent, #2563eb)' }}
              >
                <span className="whitespace-nowrap">Add To Cart</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
  )
}
