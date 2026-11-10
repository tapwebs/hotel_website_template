import { X } from 'lucide-react'
import { useEffect, useRef, useId, type ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion, useDragControls } from 'framer-motion'

import { springPresets } from '../../lib/motion'
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scrollLock'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * Shared bottom-sheet primitive for the customer flow: ItemSheet,
 * UpsellSheet, CouponSheet all use this. Drag-to-dismiss, tap-outside,
 * and an explicit X all close it. Respects prefers-reduced-motion by
 * swapping the slide-up spring for a plain fade. Includes:
 * - Focus trap
 * - Body scroll lock
 * - Focus restoration on close
 * - iOS safe-area padding
 * - aria-labelledby for the title
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const reducedMotion = useReducedMotion()
  const dragControls = useDragControls()
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    lockBodyScroll()

    // Initial focus on the first focusable element or the close button
    const sheet = sheetRef.current
    if (sheet) {
      const focusable = sheet.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable[0] ?? sheet).focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Focus trap
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
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlockBodyScroll()
      if (previouslyFocused.current && document.contains(previouslyFocused.current)) {
        previouslyFocused.current.focus?.()
      }
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            drag={reducedMotion ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reducedMotion ? { duration: 0.15 } : springPresets.drawer}
            className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[88dvh] landscape:max-h-[94dvh] sm:max-h-[88dvh] overflow-y-auto p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] focus:outline-none"
          >
            {/* Drag handle — only this strip initiates the drag-to-dismiss
                gesture, so scrolling content below it works normally. */}
            <div
              className="sm:hidden -mt-1 mb-2 flex justify-center cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden="true"
            >
              <span className="w-10 h-1 rounded-full bg-neutral-200" />
            </div>
            <div className="flex items-center justify-between mb-1">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold text-neutral-900">{title}</h2>
              ) : (
                <span />
              )}
              <button
                onClick={onClose}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
