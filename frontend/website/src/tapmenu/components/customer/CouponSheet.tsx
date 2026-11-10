import { Tag } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

import { BottomSheet } from './BottomSheet'
import type { Coupon } from '../../types/customer'

interface CouponSheetProps {
  open: boolean
  onClose: () => void
  availableCoupons: Coupon[]
  subtotal: number
  onApply: (code: string) => void
}

/**
 * Coupons only ever appear here, in the cart — never as a pre-order
 * popup, per the product spec. Shows every available coupon with its
 * eligibility relative to the current subtotal (greyed out if below
 * minOrder) plus a manual code entry field.
 */
export function CouponSheet({ open, onClose, availableCoupons, subtotal, onApply }: CouponSheetProps) {
  const [manualCode, setManualCode] = useState('')

  return (
    <BottomSheet open={open} onClose={onClose} title="Apply coupon">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            className="flex-1 min-w-0 min-h-11 rounded-xl border border-neutral-200 px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 uppercase"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => manualCode.trim() && onApply(manualCode.trim())}
            disabled={!manualCode.trim()}
            className="min-h-11 px-4 rounded-xl whitespace-normal text-white text-sm font-semibold disabled:opacity-40 cursor-pointer shadow-2xs"
            style={{ backgroundColor: 'var(--customer-accent)' }}
          >
            Apply
          </motion.button>
        </div>

        <div className="space-y-2">
          {availableCoupons.map((coupon) => {
            const eligible = subtotal >= coupon.minOrder
            return (
              <motion.button
                key={coupon.code}
                whileHover={eligible ? { scale: 1.01 } : undefined}
                whileTap={eligible ? { scale: 0.98 } : undefined}
                onClick={() => eligible && onApply(coupon.code)}
                disabled={!eligible}
                className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-colors cursor-pointer shadow-2xs ${
                  eligible ? 'border-neutral-200 hover:border-neutral-300 bg-white' : 'border-neutral-100 opacity-50 bg-neutral-50 cursor-not-allowed'
                }`}
              >
                <Tag className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--customer-accent)' }} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold break-words text-neutral-900">{coupon.code}</div>
                  <div className="text-xs text-neutral-500 break-words">{coupon.description}</div>
                  {!eligible && (
                    <div className="text-xs text-neutral-400 mt-0.5">
                      Add ₹{coupon.minOrder - subtotal} more to use this
                    </div>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}
