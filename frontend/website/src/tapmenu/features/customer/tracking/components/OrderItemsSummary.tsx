import React from 'react'
import type { CartLine, MenuItem } from '../../../../types/customer'
import { formatVariantLabel } from '../../../../lib/variants'

interface OrderItemsSummaryProps {
  lines: CartLine[]
  menuItems: MenuItem[]
  note?: string
  total: number
}

export function OrderItemsSummary({
  lines,
  menuItems,
  note,
  total,
}: OrderItemsSummaryProps) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 p-4 space-y-2.5 bg-white shadow-2xs">
      <h2 className="text-[13px] font-bold text-neutral-900 uppercase tracking-wider">
        Your Order Items
      </h2>
      <div className="space-y-1.5 divide-y divide-neutral-100">
        {lines.map((line, i) => {
          const item = menuItems.find((m) => m.id === line.itemId)
          const variant = item?.variants?.find((v) => v.id === line.variantId)
          const addOnNames = line.addOnIds
            .map((id) => item?.addOns?.find((a) => a.id === id)?.name)
            .filter(Boolean)
          return (
            <div
              key={i}
              className="pt-1.5 first:pt-0 flex items-center justify-between text-[13px] text-neutral-600"
            >
              <span>
                {line.qty}x {item?.name ?? line.itemId}
                {(variant || addOnNames.length > 0) && (
                  <span className="text-neutral-400">
                    {' '}
                    ({[variant ? formatVariantLabel(variant) : undefined, ...addOnNames].filter(Boolean).join(', ')})
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {note && (
        <div className="pt-2 border-t border-neutral-100 text-[12.5px] text-neutral-600">
          <span className="font-semibold text-neutral-800">Kitchen note:</span> {note}
        </div>
      )}
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[15px] font-bold text-neutral-900">
        <span>Total Paid / Payable</span>
        <span className="font-mono">₹{total}</span>
      </div>
    </div>
  )
}
