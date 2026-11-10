import {
  Clock,
  CreditCard,
  FileText,
  Hash,
  RefreshCw,
  ShieldCheck,
  Store,
  Table2,
  Timer,
  User,
} from 'lucide-react'
import React from 'react'

interface OrderTrackingDetailsProps {
  order: {
    displayNumber: string
    referenceNumber?: string
    restaurantName?: string
    createdAt?: string
    estimatedReadyTime?: string
    customerName?: string
    table: string
    roomNumber?: string
    payment: 'online' | 'counter'
    status: string
    total: number
  }
  orderToken?: string
  isServed: boolean
  onOpenReceipt?: () => void
  onPayNowRazorpay?: () => void
  paying?: boolean
}

export function OrderTrackingDetails({
  order,
  orderToken,
  isServed,
  onOpenReceipt,
  onPayNowRazorpay,
  paying = false,
}: OrderTrackingDetailsProps) {
  const isAwaitingOnlinePayment =
    order.payment === 'online' && order.status === 'awaiting_payment'

  return (
    <div className="rounded-2xl border border-neutral-200/80 p-4 bg-white shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100">
        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 font-mono">
          Order Summary & Tracking
        </span>
        <span className="text-[11px] font-mono font-bold text-neutral-500">
          {order.referenceNumber || `REF-${orderToken?.slice(0, 8).toUpperCase()}`}
        </span>
      </div>

      {/* Online Payment Pending Callout */}
      {isAwaitingOnlinePayment && (
        <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 space-y-2 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Online Payment Pending
            </span>
            <span className="text-xs font-mono font-black text-amber-900">₹{order.total}</span>
          </div>
          <p className="text-[11px] text-amber-800">
            Your order is awaiting payment confirmation before the kitchen starts preparation.
          </p>
          {onPayNowRazorpay && (
            <button
              type="button"
              onClick={onPayNowRazorpay}
              disabled={paying}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {paying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5" />
              )}
              <span>Complete Payment with Razorpay</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-left">
        {/* 1. Restaurant Name */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
            <Store className="w-3 h-3" /> Restaurant
          </span>
          <p className="text-xs font-extrabold text-neutral-900 truncate">
            {order.restaurantName || 'TapMenu Restaurant'}
          </p>
        </div>

        {/* 2. Table / Room Number */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Location
          </span>
          <p className="text-xs font-extrabold text-neutral-900 font-mono">
            {order.table}{order.roomNumber ? ` (Room ${order.roomNumber})` : ''}
          </p>
        </div>

        {/* 3. Customer Name */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
            <User className="w-3 h-3" /> Customer
          </span>
          <p className="text-xs font-extrabold text-neutral-900 truncate">
            {order.customerName || `Guest (${order.table})`}
          </p>
        </div>

        {/* 4. Payment Method & Status */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> Payment Method
          </span>
          <p
            className={`text-xs font-extrabold flex items-center gap-1 ${
              order.payment === 'online'
                ? isAwaitingOnlinePayment
                  ? 'text-amber-600'
                  : 'text-emerald-600'
                : 'text-neutral-800'
            }`}
          >
            {/* Dream Heavens: table orders cook first and are paid at the counter; room orders go on the folio. */}
            {(order as { paymentMethod?: string }).paymentMethod === 'room' ? (
              'Charged to your room ✓'
            ) : order.payment === 'counter' ? (
              'Pay at Counter (show the code)'
            ) : order.payment === 'online' && (order as { paymentMethod?: string }).paymentMethod ? (
              `Paid · ${String((order as { paymentMethod?: string }).paymentMethod).toUpperCase()} ✓`
            ) : order.payment === 'online' ? (
              isAwaitingOnlinePayment ? (
                'Online (Pending)'
              ) : (
                <>
                  <span>Paid Online</span>
                  <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />
                </>
              )
            ) : order.status === 'awaiting_payment' ? (
              'Pay at Counter (Unpaid)'
            ) : (
              'Paid at Counter ✓'
            )}
          </p>
        </div>

        {/* 5. Order Time */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Order Time
          </span>
          <p className="text-xs font-bold text-neutral-800 font-mono">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Just now'}
          </p>
        </div>

        {/* 6. Estimated Ready Time */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
            <Timer className="w-3 h-3" /> Est. Ready Time
          </span>
          <p className="text-xs font-bold text-emerald-700 font-mono flex items-center gap-1">
            <span>
              {order.estimatedReadyTime
                ? new Date(order.estimatedReadyTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '~15 mins'}
            </span>
            {!isServed && order.estimatedReadyTime && order.createdAt && (
              <span className="text-[10px] text-neutral-400 font-normal">
                (~{Math.max(1, Math.round((new Date(order.estimatedReadyTime).getTime() - new Date(order.createdAt).getTime()) / 60000))}m prep)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Action: Tax Invoice / E-Receipt */}
      {onOpenReceipt && (
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenReceipt}
            className="w-full py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-neutral-500" />
            <span>View Tax Invoice &amp; Digital Receipt</span>
          </button>
        </div>
      )}
    </div>
  )
}
