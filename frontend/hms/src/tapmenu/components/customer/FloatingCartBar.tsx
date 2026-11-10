import { ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface FloatingCartBarProps {
  itemCount: number
  total: number
  onClick: () => void
}

/**
 * Full-width rounded bar, appears once the cart has items. Bounces
 * (scale 1 -> 1.06 -> 1, 200ms) whenever the item count increases, per the
 * product spec. Respects prefers-reduced-motion by skipping the bounce.
 */
export function FloatingCartBar({ itemCount, total, onClick }: FloatingCartBarProps) {
  const reducedMotion = useReducedMotion()
  const [bounceKey, setBounceKey] = useState(0)
  const prevCount = useRef(itemCount)

  useEffect(() => {
    if (itemCount > prevCount.current) {
      setBounceKey((k) => k + 1)
    }
    prevCount.current = itemCount
  }, [itemCount])

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 right-3 sm:left-6 sm:right-6 max-w-md sm:max-w-2xl mx-auto z-40"
        >
          <motion.button
            key={reducedMotion ? undefined : bounceKey}
            initial={false}
            animate={reducedMotion ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className="w-full min-h-[3.25rem] py-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 px-4 sm:px-5 text-white font-semibold active:scale-[0.98] transition-transform cursor-pointer"
            style={{ backgroundColor: 'var(--customer-accent, #2563eb)' }}
          >
            <span className="flex items-center gap-2.5 min-w-0 text-sm">
              <ShoppingBag className="w-5 h-5 shrink-0" />
              <span className="break-words text-left leading-tight">
                {itemCount} item{itemCount === 1 ? '' : 's'} · Subtotal ₹{total}
              </span>
            </span>
            <span className="text-sm font-semibold shrink-0 whitespace-nowrap">View Cart →</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
