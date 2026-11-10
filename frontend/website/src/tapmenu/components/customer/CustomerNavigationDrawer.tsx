import { ArrowRight, CookingPot, Info, MapPin, Table2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { useNavigate } from 'react-router-dom'
import type { Category } from '../../types/customer'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

interface CustomerNavigationDrawerProps {
  isOpen: boolean
  onClose: () => void
  restaurant?: { id?: string; name?: string; logo?: string; accent?: string } | null
  tableLabel?: string
  categories: Category[]
  activeCategoryId?: string
  onSelectCategory: (categoryId: string) => void
  activeOrderToken?: string | null
}

export function CustomerNavigationDrawer({
  isOpen,
  onClose,
  restaurant,
  tableLabel,
  categories,
  activeCategoryId,
  onSelectCategory,
  activeOrderToken,
}: CustomerNavigationDrawerProps) {
  const navigate = useNavigate()
  const drawerRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    lockBodyScroll()

    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        ;(focusable[0] ?? drawerRef.current).focus()
      }
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
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
  }, [isOpen, onClose])

  const handleTrackOrder = () => {
    onClose()
    if (activeOrderToken) {
      navigate(`/dining/order/${activeOrderToken}`)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex overflow-hidden">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm cursor-pointer"
          />

          {/* Drawer Sheet (Warm Porcelain #faf9f7 theme matching menu) */}
          <motion.div
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            drag="x"
            dragConstraints={{ left: -320, right: 0 }}
            dragElastic={0.08}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -60 || info.velocity.x < -300) {
                onClose()
              }
            }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-[320px] sm:max-w-sm h-full bg-[#faf9f7] text-neutral-900 shadow-2xl flex flex-col z-10 border-r border-neutral-200/80 overflow-y-auto select-none"
          >
            {/* Header: Restaurant Branding & Close Button */}
            <div className="p-5 border-b border-neutral-200/70 bg-white/80 backdrop-blur-md">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Navigation
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200/80 flex items-center justify-center text-neutral-600 hover:text-neutral-900 shadow-2xs transition-all active:scale-92 cursor-pointer"
                  aria-label="Close menu drawer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Restaurant Identity */}
              <div className="flex items-center gap-3">
                {restaurant?.logo ? (
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-neutral-200 shadow-xs bg-white shrink-0">
                    <img
                      src={restaurant.logo}
                      alt={restaurant.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-black text-lg border border-neutral-800 shadow-xs shrink-0">
                    {restaurant?.name?.slice(0, 1) || 'T'}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-black text-neutral-950 line-clamp-3 break-words leading-tight tracking-tight">
                    {restaurant?.name || 'Restaurant Menu'}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{tableLabel || 'Table2'}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Order Live Banner (High Priority Feature Card) */}
            {activeOrderToken && (
              <div className="p-4 pb-1 border-b border-neutral-200/70">
                <button
                  type="button"
                  onClick={handleTrackOrder}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300/80 text-amber-950 flex items-center justify-between transition-all hover:shadow-xs active:scale-[0.98] cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                      <CookingPot size={20} className="text-amber-600 animate-bounce" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-neutral-900 flex items-center gap-1.5">
                        <span>Active Order Live</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      </div>
                      <div className="text-[11px] text-amber-800/90 font-medium truncate">
                        Tap to track kitchen status
                      </div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/80 border border-amber-200 flex items-center justify-center text-amber-800 group-hover:translate-x-0.5 transition-transform shrink-0">
                    <ArrowRight size={13} />
                  </div>
                </button>
              </div>
            )}

            {/* Menu Categories Links */}
            <div className="p-4 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2.5 px-1">
                Menu Categories
              </div>

              <div className="space-y-1">
                {categories.map((cat) => {
                  const isSelected = cat.id === activeCategoryId
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat.id)
                        onClose()
                      }}
                      className={`group w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all text-left cursor-pointer ${isSelected
                          ? 'bg-neutral-900 text-white shadow-xs'
                          : 'text-neutral-700 hover:text-neutral-950 hover:bg-white border border-transparent hover:border-neutral-200/60 active:scale-[0.99]'
                        }`}
                    >
                      <span className="line-clamp-2 break-words text-left">{cat.name}</span>
                      <ArrowRight
                        size={12}
                       
                        className={`transition-transform duration-200 ${isSelected
                            ? 'text-white'
                            : 'text-neutral-400 group-hover:text-neutral-800 group-hover:translate-x-0.5'
                          }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Restaurant Info Footer */}
            <div className="p-4 border-t border-neutral-200/70 bg-white/60 space-y-2 text-[11px] text-neutral-500">
              <div className="flex items-center gap-2 text-neutral-600">
                <MapPin size={14} className="text-neutral-400 shrink-0" />
                <span className="break-words min-w-0">
                  {restaurant?.name ? `${restaurant.name} • ${tableLabel || 'Dine-in'}` : 'Dine-in Instant Ordering'}
                </span>
              </div>
              <div className="pt-2 text-[10px] text-center text-neutral-400 font-medium">
                ⚡ Powered by TapMenu • Fast & Secure
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
