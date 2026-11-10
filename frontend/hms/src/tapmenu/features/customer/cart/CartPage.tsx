import { AlertCircle, ArrowLeft, CheckCircle, Minus, Plus, Sparkles, Trash2, Utensils, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { motion } from 'framer-motion'
import { useSession } from '../session/SessionContext'
import { api, ApiError } from '../../../services/api'
import type { MenuItem, CartLine } from '../../../types/customer'
import { useCartStore } from './cartStore'
import { useSyncCartKey } from './useSyncCartKey'
import { CustomerTheme } from '../../../components/customer/CustomerTheme'
import { getAccurateFoodImage } from '../menu/dishImageHelper'
import { formatVariantLabel } from '../../../lib/variants'
import { MenuBadge } from '../../../components/customer/MenuBadge'
import { BrandFooter } from '../../../components/common/BrandFooter'

const QUICK_COOKING_NOTES = [
  'Less Spicy 🌶️',
  'No Onion/Garlic 🧅',
  'Extra Cutlery 🍴',
  'Serve Hot ♨️',
  'Pack Separately 📦',
]

function CartItemSkeleton() {
  return (
    <div className="py-3.5 flex items-center gap-3 animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-neutral-200/70 shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-4 bg-neutral-200/70 rounded w-32" />
        <div className="h-3 bg-neutral-200/50 rounded w-20" />
      </div>
      <div className="w-20 h-8 rounded-lg bg-neutral-200/70 shrink-0" />
    </div>
  )
}

function CartItemRow({
  line,
  item,
  index,
  onUpdateQty,
  onRemove,
}: {
  line: CartLine
  item?: MenuItem
  index: number
  onUpdateQty: (index: number, delta: number) => void
  onRemove: (index: number) => void
}) {
  if (!item) {
    return <CartItemSkeleton />
  }

  return (
    <CartItemRowLoaded
      line={line}
      item={item}
      index={index}
      onUpdateQty={onUpdateQty}
      onRemove={onRemove}
    />
  )
}

function CartItemRowLoaded({
  line,
  item,
  index,
  onUpdateQty,
  onRemove,
}: {
  line: CartLine
  item: MenuItem
  index: number
  onUpdateQty: (index: number, delta: number) => void
  onRemove: (index: number) => void
}) {
  const [imgError, setImgError] = useState(false)
  const itemImg = getAccurateFoodImage(item)
  const variant = item?.variants?.find((v) => v.id === line.variantId)
  const addOnNames = line.addOnIds
    .map((id) => item?.addOns?.find((a) => a.id === id)?.name)
    .filter(Boolean)
  const unitPrice =
    (variant?.price ?? item?.price ?? 0) +
    line.addOnIds.reduce((sum, id) => sum + (item?.addOns?.find((a) => a.id === id)?.price ?? 0), 0)

  const originalPrice = item?.originalPrice ?? (item as any)?.original_price
  const originalUnitPrice =
    originalPrice && originalPrice > (variant?.price ?? item?.price ?? 0)
      ? originalPrice +
        line.addOnIds.reduce((sum, id) => sum + (item?.addOns?.find((a) => a.id === id)?.price ?? 0), 0)
      : undefined

  const discountPercent = originalUnitPrice
    ? Math.round(((originalUnitPrice - unitPrice) / originalUnitPrice) * 100)
    : 0

  return (
    <div className="py-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/60 shrink-0 flex items-center justify-center">
        {itemImg && !imgError ? (
          <img
            src={itemImg}
            alt={item?.name ?? 'Dish'}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <Utensils className="w-5 h-5 text-neutral-400" />
        )}
      </div>
      <div className="flex-1 min-w-[9rem]">
        <div className="text-[0.875rem] font-semibold text-neutral-900 line-clamp-3 break-words">
          {item?.name ?? line.itemId}
        </div>
        {(variant || addOnNames.length > 0) && (
          <div className="text-xs text-neutral-500 line-clamp-3 break-words">
            {[variant ? formatVariantLabel(variant) : undefined, ...addOnNames].filter(Boolean).join(', ')}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          {originalUnitPrice && (
            <span className="text-[11px] font-mono text-neutral-400 line-through">
              ₹{originalUnitPrice}
            </span>
          )}
          <span className="text-[12.5px] font-bold font-mono text-neutral-800">
            ₹{unitPrice} each
          </span>
          {discountPercent > 0 && (
            <span className="text-[9.5px] font-extrabold font-mono text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200/60">
              {discountPercent}% OFF
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 border border-neutral-200 bg-white rounded-full px-1.5 min-h-11 shrink-0 shadow-2xs">
        <button
          onClick={() => onUpdateQty(index, -1)}
          className="w-9 min-h-11 flex items-center justify-center text-neutral-700 hover:text-neutral-900 active:scale-90 transition-transform cursor-pointer"
          aria-label="Decrease quantity"
        >
          {line.qty === 1 ? (
            <Trash2 className="w-3.5 h-3.5 text-neutral-500 hover:text-red-500" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
        </button>
        <span className="font-bold text-[13px] min-w-4 text-center font-mono">{line.qty}</span>
        <button
          onClick={() => onUpdateQty(index, 1)}
          className="w-9 min-h-11 flex items-center justify-center text-neutral-700 hover:text-neutral-900 active:scale-90 transition-transform cursor-pointer"
          aria-label="Increase quantity"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="w-11 h-11 flex items-center justify-center text-neutral-400 hover:text-neutral-700 shrink-0 cursor-pointer"
        aria-label="Remove item"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function CartPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  useSyncCartKey()

  const lines = useCartStore((s) => s.lines)
  const note = useCartStore((s) => s.note)
  const couponCode = useCartStore((s) => s.couponCode)
  const updateLineQty = useCartStore((s) => s.updateLineQty)
  const removeLine = useCartStore((s) => s.removeLine)
  const setNote = useCartStore((s) => s.setNote)
  const addLine = useCartStore((s) => s.addLine)

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  const [quote, setQuote] = useState<{
    subtotal: number
    discount: number
    tax: number
    total: number
    couponError?: string
  } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.menu.get()
        if (cancelled) return
        setMenuItems(res.items)
      } catch (err) {
        console.error('[CartPage] Failed to load menu items', err)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null)
      setQuoteLoading(false)
      return
    }
    let cancelled = false
    setQuoteLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await api.quote.get(lines, couponCode ?? undefined)
        if (cancelled) return
        setQuote(res)
        setQuoteError(null)
      } catch (err) {
        if (cancelled) return
        setQuoteError(err instanceof ApiError ? err.message : 'Could not calculate your total. Please try again.')
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lines, couponCode])

  const itemById = useMemo(() => {
    const map = new Map<string, MenuItem>()
    for (const item of menuItems) map.set(item.id, item)
    return map
  }, [menuItems])

  const itemFor = useCallback((itemId: string) => itemById.get(itemId), [itemById])

  // Savings calculation across items and coupon
  const itemSavings = useMemo(() => {
    let sum = 0
    for (const line of lines) {
      const item = itemFor(line.itemId)
      const orig = item?.originalPrice ?? (item as any)?.original_price
      const current = item?.variants?.find((v: any) => v.id === line.variantId)?.price ?? item?.price ?? 0
      if (orig && orig > current) {
        sum += (orig - current) * line.qty
      }
    }
    return sum
  }, [lines, menuItems])

  const totalSavings = itemSavings + (quote?.discount ?? 0)

  const addQuickNote = (noteTag: string) => {
    const current = note.trim()
    if (!current) {
      setNote(noteTag)
    } else if (!current.includes(noteTag)) {
      setNote(`${current}, ${noteTag}`)
    }
  }

  if (!session) return null

  return (
    <CustomerTheme accent={session.restaurant.accent}>
      <div className={`min-h-screen bg-[#faf9f7] text-neutral-900 ${lines.length > 0 ? 'pb-40' : 'pb-12'}`}>
        <header className="sticky top-0 z-30 bg-[#faf9f7]/95 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate('/dining/menu')}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-neutral-700 hover:bg-neutral-900/5 transition-colors cursor-pointer"
                aria-label="Back to menu"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
              <div>
                <h1 className="text-[17px] font-bold tracking-tight">Your Cart</h1>
                <div className="text-[11px] text-neutral-500 font-mono">
                  {session.restaurant.name} • {session.tableLabel}
                </div>
              </div>
            </div>

          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5 mt-2">
          {lines.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <p className="text-sm text-neutral-500">Your cart is empty.</p>
              <button
                onClick={() => navigate('/dining/menu')}
                className="text-sm font-semibold cursor-pointer"
                style={{ color: 'var(--customer-accent)' }}
              >
                Browse the menu
              </button>
            </div>
          ) : (
            <>
              {/* Savings Summary Banner */}
              {totalSavings > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-900 shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black tracking-tight flex items-center gap-1">
                      <span>You saved ₹{totalSavings} on this order!</span>
                      <span>🎉</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 font-medium">
                      {quote?.discount ? `₹${quote.discount} coupon discount • ` : ''}₹{itemSavings} item discount
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Cart Items List */}
              <div className="divide-y divide-neutral-900/[0.06] bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs">
                {lines.map((line, index) => (
                  <CartItemRow
                    key={`${line.itemId}-${line.variantId ?? ''}-${line.addOnIds.join(',')}`}
                    line={line}
                    item={itemFor(line.itemId)}
                    index={index}
                    onUpdateQty={updateLineQty}
                    onRemove={removeLine}
                  />
                ))}
              </div>

              {/* Special Cooking Instructions for Kitchen */}
              {session?.restaurant?.features?.specialInstructions !== false && (
                <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Special Instructions for the Kitchen</span>
                    </h2>
                    <span className="text-[10px] text-neutral-400 font-mono">{note.length}/300</span>
                  </div>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 300))}
                    placeholder="e.g. Please make the gravy less spicy, extra green chutney..."
                    rows={2}
                    className="w-full p-2.5 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:border-[var(--customer-accent)] resize-none bg-neutral-50/50"
                  />

                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {QUICK_COOKING_NOTES.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => addQuickNote(chip)}
                        className="text-xs font-semibold px-3 min-h-11 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer border border-neutral-200"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}


              {quote?.couponError && (
                <div className="flex items-start gap-2 text-[12.5px] text-amber-700 bg-amber-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{quote.couponError}</span>
                </div>
              )}

              {quoteError && (
                <div className="flex items-start gap-2 text-[12.5px] text-rose-700 bg-rose-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{quoteError}</span>
                </div>
              )}

              {/* Authoritative Price Breakdown */}
              <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 space-y-2 shadow-2xs">
                {quoteLoading ? (
                  <div className="h-16 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin" />
                  </div>
                ) : quote ? (
                  <>
                    <div className="flex items-center justify-between text-[13px] text-neutral-600">
                      <span>Item Subtotal</span>
                      <span className="font-mono font-medium">₹{quote.subtotal}</span>
                    </div>
                    {quote.discount > 0 && (
                      <div className="flex items-center justify-between text-[13px] text-emerald-600 font-semibold">
                        <span>Reward Discount</span>
                        <span className="font-mono">-₹{quote.discount}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[13px] text-neutral-600">
                      <span>
                        {quote.subtotal > 0
                          ? `Taxes & GST (${Math.round((quote.tax / quote.subtotal) * 100)}%)`
                          : 'Taxes & Fees'}
                      </span>
                      <span className="font-mono font-medium">₹{quote.tax}</span>
                    </div>
                    <div className="flex items-center justify-between text-[15px] font-black text-neutral-900 pt-2 border-t border-neutral-100">
                      <span>Total Amount</span>
                      <span className="font-mono text-lg text-[var(--customer-accent)]">₹{quote.total}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          )}

          {/* Universal Brand Footer */}
          <BrandFooter variant="customer" showCta={true} />
        </main>

        {lines.length > 0 && quote && !quoteLoading && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                  Grand Total
                </span>
                <div className="text-xl font-black font-mono text-neutral-900">₹{quote.total}</div>
              </div>
              {session?.restaurant?.features?.qrOrdering !== false ? (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/dining/checkout')}
                  className="flex-1 h-12 rounded-2xl text-white font-bold flex items-center justify-center gap-2 shadow-md hover:brightness-105 transition-all cursor-pointer"
                  style={{ backgroundColor: 'var(--customer-accent)' }}
                >
                  Proceed to Checkout →
                </motion.button>
              ) : (
                <div className="flex-1 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold text-center">
                  Direct QR ordering is paused. Please place your order with your table server.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </CustomerTheme>
  )
}
