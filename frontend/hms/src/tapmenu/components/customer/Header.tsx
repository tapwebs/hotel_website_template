import { Info, ShoppingBag } from 'lucide-react'
import { useState } from 'react'

import { motion, AnimatePresence } from 'framer-motion'
import { springPresets } from '../../lib/motion'

interface HeaderProps {
  restaurantName: string
  restaurantLogo?: string
  tableLabel: string
  cartCount: number
  onCartClick: () => void
  sticky?: boolean
}

function getInitials(name: string): string {
  if (!name) return 'TM'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function Header({
  restaurantName,
  restaurantLogo,
  tableLabel,
  cartCount,
  onCartClick,
  sticky = true,
}: HeaderProps) {
  const [logoError, setLogoError] = useState(false)
  const initials = getInitials(restaurantName)

  return (
    <header
      className={
        sticky
          ? 'sticky top-0 z-30 bg-[#faf9f7]/95 backdrop-blur-md border-b border-neutral-200/70'
          : 'bg-transparent'
      }
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Restaurant Profile Logo + Info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Restaurant Logo with graceful Initials Fallback */}
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900/[0.04] border border-neutral-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            {restaurantLogo && !logoError ? (
              <img
                src={restaurantLogo}
                alt={restaurantName}
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className="font-extrabold text-xs tracking-wider"
                style={{ color: 'var(--customer-accent, #2563eb)' }}
              >
                {initials}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-bold text-neutral-900 tracking-tight truncate leading-tight">
              {restaurantName}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md font-mono"
                style={{
                  color: 'var(--customer-accent, #2563eb)',
                  backgroundColor: 'var(--customer-accent-soft, rgba(37,99,235,0.1))',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {tableLabel}
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                • TapMenu
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cart Button */}
        <button
          onClick={onCartClick}
          className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-neutral-800 bg-white border border-neutral-200/80 hover:bg-neutral-50 shadow-2xs transition-all active:scale-95"
          aria-label={`View cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
        >
          <ShoppingBag className="w-5 h-5 text-neutral-800" />
          <AnimatePresence>
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={springPresets.snappy}
                className="absolute -top-1 -right-1 text-white text-xs font-bold h-5 min-w-5 px-1 rounded-full flex items-center justify-center shadow-xs"
                style={{ backgroundColor: 'var(--customer-accent, #2563eb)' }}
              >
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </header>
  )
}
