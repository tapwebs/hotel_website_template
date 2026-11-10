import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Banknote as Money,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Heart,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

import { useSession } from '../session/SessionContext'
import { api, ApiError } from '../../../services/api'
import type { MenuItem, Coupon } from '../../../types/customer'
import { useCartStore } from '../cart/cartStore'
import { useSyncCartKey } from '../cart/useSyncCartKey'
import { CustomerTheme } from '../../../components/customer/CustomerTheme'
import { BrandFooter } from '../../../components/common/BrandFooter'
import { CouponSheet } from '../../../components/customer/CouponSheet'
import { formatVariantLabel } from '../../../lib/variants'
import { loadRazorpayCheckoutScript, type RazorpayOptions } from '../../../lib/razorpay'
import { newRequestId } from '../../../lib/requestId'

type PaymentMethod = 'online' | 'counter'

const DEFAULT_AVAILABLE_COUPONS: Coupon[] = [
  { id: 'c_welcome10', code: 'WELCOME10', type: 'percent', value: 10, minOrder: 0, description: '10% off your order' },
  { id: 'c_flat50', code: 'FLAT50', type: 'flat', value: 50, minOrder: 499, description: '₹50 off orders above ₹499' },
  { id: 'c_dessert20', code: 'DESSERT20', type: 'percent', value: 20, minOrder: 0, description: '20% off desserts' },
]

const TIP_OPTIONS = [0, 20, 50, 100]

const TIPS_ENABLED = false

export function CheckoutPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  useSyncCartKey()

  const lines = useCartStore((s) => s.lines)
  const note = useCartStore((s) => s.note)
  const couponCode = useCartStore((s) => s.couponCode)
  const setCouponCode = useCartStore((s) => s.setCouponCode)
  const clear = useCartStore((s) => s.clear)
  const removeLine = useCartStore((s) => s.removeLine)

  const [method, setMethod] = useState<PaymentMethod>('online')
  // One key per distinct basket: the same basket re-submitted gets the original order back; any change makes a new key.
  const requestId = useMemo(() => newRequestId(), [lines, note, couponCode, method]) // eslint-disable-line react-hooks/exhaustive-deps
  /** On a 409 ITEM_UNAVAILABLE, remove just the sold-out dishes from the cart and say which. */
  const dropUnavailable = (err: unknown): boolean => {
    if (!(err instanceof ApiError) || !err.unavailable?.length) return false
    const gone = new Set(err.unavailable.map((u) => u.itemId))
    const current = useCartStore.getState().lines
    for (let i = current.length - 1; i >= 0; i--) if (gone.has(current[i].itemId)) removeLine(i)
    setError(`${err.message} We took it out of your cart. Please check your order and try again.`)
    return true
  }
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [availableCoupons] = useState<Coupon[]>(DEFAULT_AVAILABLE_COUPONS)
  const [couponSheetOpen, setCouponSheetOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  // Customer Contact Details
  const [customerName, setCustomerName] = useState(() => {
    try {
      const saved = localStorage.getItem('tm_customer_info')
      return saved ? JSON.parse(saved).name || '' : ''
    } catch {
      return ''
    }
  })
  const [customerPhone, setCustomerPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('tm_customer_info')
      return saved ? JSON.parse(saved).phone || '' : ''
    } catch {
      return ''
    }
  })
  const [rememberDetails, setRememberDetails] = useState(true)

  // Real-time synchronization of customer details with localStorage
  useEffect(() => {
    if (rememberDetails) {
      try {
        localStorage.setItem(
          'tm_customer_info',
          JSON.stringify({
            name: customerName.trim(),
            phone: customerPhone.trim(),
          })
        )
      } catch {}
    } else {
      try {
        localStorage.removeItem('tm_customer_info')
      } catch {}
    }
  }, [customerName, customerPhone, rememberDetails])

  // Gratuity / Tip
  const [selectedTip, setSelectedTip] = useState<number>(0)
  const [customTip, setCustomTip] = useState<string>('')
  const [isCustomTipOpen, setIsCustomTipOpen] = useState(false)

  // Room delivery option
  const [roomNumber, setRoomNumber] = useState('')

  // Payment failure recovery tracking
  const [paymentFailedOrder, setPaymentFailedOrder] = useState<{
    orderId?: string
    trackingToken: string
    displayNumber: string
  } | null>(null)

  const [quote, setQuote] = useState<{
    subtotal: number
    discount: number
    tax: number
    total: number
    couponError?: string
  } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const orderCompletedRef = useRef(false)

  useEffect(() => {
    if (orderCompletedRef.current) return
    if (lines.length === 0) {
      navigate('/dining/cart', { replace: true })
      return
    }
    let cancelled = false
    async function fetchQuoteAndMenu() {
      setQuoteLoading(true)
      setQuoteError(null)
      try {
        const [quoteRes, menuRes] = await Promise.all([
          api.quote.get(lines, couponCode ?? undefined),
          api.menu.get().catch(() => null),
        ])
        if (!cancelled) {
          setQuote(quoteRes)
          if (menuRes) {
            setMenuItems(menuRes.items || [])
            if (menuRes.onlinePaymentEnabled !== undefined) {
              setOnlinePaymentEnabled(menuRes.onlinePaymentEnabled)
              if (!menuRes.onlinePaymentEnabled) {
                setMethod('counter')
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled && dropUnavailable(err)) return
        if (!cancelled) {
          setQuoteError(
            err instanceof ApiError
              ? err.message
              : 'Unable to calculate your order total. Please try again.'
          )
          setQuote(null)
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }
    fetchQuoteAndMenu()
    loadRazorpayCheckoutScript()
    return () => {
      cancelled = true
    }
  }, [lines, couponCode, navigate])

  const handleRetryQuote = () => {
    if (lines.length === 0) return
    setQuoteLoading(true)
    setQuoteError(null)
    api.quote
      .get(lines, couponCode ?? undefined)
      .then((res) => {
        setQuote(res)
      })
      .catch((err) => {
        if (dropUnavailable(err)) return
        setQuoteError(
          err instanceof ApiError
            ? err.message
            : 'Unable to calculate your order total. Please try again.'
        )
      })
      .finally(() => setQuoteLoading(false))
  }

  const itemFor = (itemId: string) => menuItems.find((m) => m.id === itemId)

  const itemSavings = useMemo(() => {
    let sum = 0
    for (const line of lines) {
      const item = itemFor(line.itemId)
      const orig = item?.originalPrice ?? (item as any)?.original_price
      const current = item?.variants?.find((v) => v.id === line.variantId)?.price ?? item?.price ?? 0
      if (orig && orig > current) {
        sum += (orig - current) * line.qty
      }
    }
    return sum
  }, [lines, menuItems])

  const totalSavings = itemSavings + (quote?.discount ?? 0)

  // Tip calculation
  const effectiveTip = !TIPS_ENABLED ? 0 : isCustomTipOpen
    ? Math.max(0, parseInt(customTip, 10) || 0)
    : selectedTip

  const grandTotal = (quote?.total ?? 0) + effectiveTip

  // Derived tax label from actual quote data
  const taxLabel = useMemo(() => {
    if (!quote || quote.subtotal <= 0) return 'Taxes & Fees'
    const pct = Math.round((quote.tax / quote.subtotal) * 100)
    return `Taxes & GST (${pct}%)`
  }, [quote])

  const handlePlaceOrder = async () => {
    if (!quote) return

    // Name is strictly mandatory to place an order
    if (!customerName.trim()) {
      setNameError('Please enter your name to place your order.')
      const el = document.getElementById('checkout-customer-name')
      el?.focus()
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setNameError(null)

    setPlacing(true)
    setError(null)
    setProcessingStatus('Creating order...')

    // Remember customer details for future orders
    if (rememberDetails) {
      try {
        localStorage.setItem(
          'tm_customer_info',
          JSON.stringify({
            name: customerName.trim(),
            phone: customerPhone.trim(),
          })
        )
      } catch {}
    }

    try {
      const order = await api.orders.create({
        lines,
        note: note || undefined,
        couponCode: couponCode ?? undefined,
        payment: method,
        roomNumber: roomNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        tip: effectiveTip > 0 ? effectiveTip : undefined,
        clientRequestId: requestId,
      })

      // Online Razorpay Payment Flow
      if (method === 'online' && order.razorpay) {
        setProcessingStatus('Connecting to Razorpay...')
        const loaded = await loadRazorpayCheckoutScript()
        if (!loaded || !window.Razorpay) {
          setError('Could not connect to Razorpay payment gateway. Please check your network or pay at counter.')
          setPlacing(false)
          setProcessingStatus('')
          return
        }

        const options: RazorpayOptions = {
          key: order.razorpay.keyId,
          amount: order.razorpay.amount,
          currency: order.razorpay.currency || 'INR',
          name: order.razorpay.restaurantName || session?.restaurant?.name || 'Restaurant Order',
          description: `Order #${order.displayNumber}`,
          order_id: order.razorpay.orderId,
          handler: async (response) => {
            try {
              setPlacing(true)
              setProcessingStatus('Verifying payment...')
              await api.payments.verifyRazorpay({
                orderId: order.orderId || '',
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              })

              if (session?.restaurant?.id) {
                try {
                  localStorage.setItem(
                    'tm_last_order',
                    JSON.stringify({
                      restaurantId: session.restaurant.id,
                      trackingToken: order.trackingToken,
                      createdAt: Date.now(),
                    })
                  )
                } catch {}
              }

              orderCompletedRef.current = true
              navigate(`/dining/order/${order.trackingToken}`, { replace: true })
              clear()
            } catch (verifyErr) {
              setError(
                verifyErr instanceof ApiError
                  ? verifyErr.message
                  : 'Payment confirmation pending. Please show receipt to staff.'
              )
              setPlacing(false)
              setProcessingStatus('')
            }
          },
          prefill: {
            name: customerName.trim() || (session?.tableLabel ? `Table ${session.tableLabel}` : undefined),
            contact: customerPhone.trim() ? (customerPhone.trim().startsWith('+91') ? customerPhone.trim() : `+91${customerPhone.trim()}`) : undefined,
          },
          theme: {
            color: session?.restaurant?.accent || '#10b981',
          },
          modal: {
            ondismiss: () => {
              setPlacing(false)
              setProcessingStatus('')
              setPaymentFailedOrder(order)
              setError('Payment window was closed before completion. You can retry paying online or switch to counter payment.')
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', (resp: any) => {
          setPlacing(false)
          setProcessingStatus('')
          setPaymentFailedOrder(order)
          setError(resp?.error?.description || 'Payment failed. Please retry or choose pay at counter.')
        })
        rzp.open()
        return
      }

      // Counter payment or direct flow
      if (session?.restaurant?.id) {
        try {
          localStorage.setItem(
            'tm_last_order',
            JSON.stringify({
              restaurantId: session.restaurant.id,
              trackingToken: order.trackingToken,
              createdAt: Date.now(),
            })
          )
        } catch {}
      }
      orderCompletedRef.current = true
      navigate(`/dining/order/${order.trackingToken}`, { replace: true })
      clear()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place your order. Please try again.')
      setPlacing(false)
      setProcessingStatus('')
    }
  }

  const handleRetryOnlinePayment = async () => {
    if (!paymentFailedOrder?.trackingToken) {
      handlePlaceOrder()
      return
    }
    setPlacing(true)
    setError(null)
    setProcessingStatus('Re-initiating payment...')
    try {
      const res = await api.orders.initRazorpayRetry(paymentFailedOrder.trackingToken)
      if (res.alreadyPaid) {
        orderCompletedRef.current = true
        navigate(`/dining/order/${paymentFailedOrder.trackingToken}`, { replace: true })
        clear()
        return
      }
      if (res.razorpay) {
        const loaded = await loadRazorpayCheckoutScript()
        if (!loaded || !window.Razorpay) {
          setError('Could not connect to Razorpay. Please pay at counter.')
          setPlacing(false)
          setProcessingStatus('')
          return
        }

        const options: RazorpayOptions = {
          key: res.razorpay.keyId,
          amount: res.razorpay.amount,
          currency: res.razorpay.currency || 'INR',
          name: res.razorpay.restaurantName || session?.restaurant?.name || 'Restaurant Order',
          description: `Order #${res.displayNumber}`,
          order_id: res.razorpay.orderId,
          handler: async (response) => {
            try {
              setProcessingStatus('Verifying payment...')
              await api.payments.verifyRazorpay({
                orderId: res.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              })
              orderCompletedRef.current = true
              navigate(`/dining/order/${res.trackingToken}`, { replace: true })
              clear()
            } catch (vErr) {
              setError(vErr instanceof ApiError ? vErr.message : 'Payment verification failed.')
              setPlacing(false)
              setProcessingStatus('')
            }
          },
          prefill: {
            name: customerName.trim() || undefined,
            contact: customerPhone.trim() || undefined,
          },
          theme: {
            color: session?.restaurant?.accent || '#10b981',
          },
          modal: {
            ondismiss: () => {
              setPlacing(false)
              setProcessingStatus('')
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
      }
    } catch (retryErr) {
      setError(retryErr instanceof ApiError ? retryErr.message : 'Could not re-initiate payment.')
      setPlacing(false)
      setProcessingStatus('')
    }
  }

  const handleSwitchToCounter = () => {
    setMethod('counter')
    setError(null)
    setPaymentFailedOrder(null)
  }

  if (!session || (!orderCompletedRef.current && lines.length === 0)) return null

  return (
    <CustomerTheme accent={session.restaurant.accent}>
      <div className="min-h-screen bg-[#faf9f7] text-neutral-900 pb-32">
        <header className="sticky top-0 z-30 bg-[#faf9f7]/95 backdrop-blur-sm border-b border-neutral-200/50">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate('/dining/cart')}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-neutral-700 hover:bg-neutral-900/5 transition-colors cursor-pointer"
              aria-label="Back to cart"
              disabled={placing}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight">Review & Checkout</h1>
              <p className="text-[11px] text-neutral-500 font-mono">
                {session.restaurant.name} • {session.tableLabel}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5 mt-4">
          {/* Quote error — blocks payment */}
          {quoteError && !quoteLoading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-rose-700">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <span>Unable to calculate your order total. {quoteError}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetryQuote}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer hover:bg-rose-700 transition-colors"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dining/cart')}
                  className="px-4 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-bold cursor-pointer hover:bg-neutral-200 transition-colors"
                >
                  Back to Cart
                </button>
              </div>
            </div>
          )}

          {/* Payment Recovery / Retry Alert Banner */}
          {paymentFailedOrder && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 space-y-3 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-800" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-amber-900">
                    Payment Incomplete for Order {paymentFailedOrder.displayNumber}
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Your cart items are saved. You can retry paying online via Razorpay or choose to pay at the counter.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRetryOnlinePayment}
                  disabled={placing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${placing ? 'animate-spin' : ''}`} />
                  <span>Retry Online Payment</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToCounter}
                  disabled={placing}
                  className="px-4 py-2 rounded-xl bg-white text-neutral-800 border border-neutral-300 text-xs font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <span>Switch to Pay at Counter</span>
                </button>
              </div>
            </div>
          )}

          {/* Total Savings Banner */}
          {totalSavings > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-3 text-emerald-900">
              <Sparkles size={18} className="text-emerald-600 shrink-0" />
              <div className="text-xs font-bold">
                You are saving ₹{totalSavings} on this order! 🎉
              </div>
            </div>
          )}

          {/* 1. Customer Contact Details */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4.5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>Guest Details (For Receipt &amp; Updates)</span>
              </h2>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Name is required *
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Your Name</span>
                  <span className="text-[10px] text-rose-500 font-bold">* Required</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="checkout-customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value)
                      if (nameError && e.target.value.trim()) {
                        setNameError(null)
                      }
                    }}
                    placeholder="Enter your name"
                    maxLength={50}
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none transition-colors ${
                      nameError
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                        : 'border-neutral-200 focus:border-[var(--customer-accent)] bg-neutral-50/50 text-neutral-900'
                    }`}
                  />
                </div>
                {nameError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{nameError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center justify-between">
                  <span>Mobile Number</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                      setCustomerPhone(val)
                    }}
                    placeholder="0000000000"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:border-[var(--customer-accent)] bg-neutral-50/50 font-mono"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={rememberDetails}
                onChange={(e) => setRememberDetails(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-[var(--customer-accent)] focus:ring-[var(--customer-accent)]"
              />
              <span className="text-[11px] text-neutral-500 font-medium">
                Save details on this phone for faster checkout next time
              </span>
            </label>
          </div>

          {/* 2. Room Service / Table Location */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400">Location</span>
                <p className="text-sm font-extrabold text-neutral-900 font-mono">
                  Table {session.tableLabel}
                </p>
              </div>
              {session.restaurant.features?.roomService !== false && (
                <div className="w-44 text-right">
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-0.5">
                    Room No. (Optional)
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Enter room number"
                    maxLength={10}
                    className="w-full px-2.5 py-1 text-xs text-right font-mono rounded-lg border border-neutral-200 focus:outline-none focus:border-[var(--customer-accent)] bg-neutral-50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3. Offers & Coupons */}
          {session.restaurant.features?.coupons !== false && session.restaurant.features?.discounts !== false && (
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Offers &amp; Benefits</span>
                </h2>
                {quote?.discount ? (
                  <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ₹{quote.discount} Saved
                  </span>
                ) : null}
              </div>

              {couponCode ? (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <span>Code Applied:</span>
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-700 font-extrabold">
                          {couponCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                        {quote?.discount ? `₹${quote.discount} discount applied to your order` : 'Coupon applied'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCouponCode(null)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0 ml-2"
                    aria-label="Remove coupon"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCouponSheetOpen(true)}
                  className="w-full p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-neutral-100/80 flex items-center justify-between transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-bold text-neutral-800">
                        Apply a Coupon or Reward
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        Save more with promo codes &amp; table rewards
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {quote?.couponError && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-xl p-2.5 border border-amber-200">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{quote.couponError}</span>
                </div>
              )}
            </div>
          )}

          {/* Dream Heavens: tips are not charged by the backend yet, so the tip picker is hidden (TIPS_ENABLED). */}
          {TIPS_ENABLED && (<>
          {/* 4. Staff Tip / Gratuity */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Tip Your Service Team
                </h2>
              </div>
              <span className="text-[10.5px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                100% goes to staff
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {TIP_OPTIONS.map((amt) => {
                const isSelected = !isCustomTipOpen && selectedTip === amt
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setIsCustomTipOpen(false)
                      setSelectedTip(amt)
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-[var(--customer-accent)] bg-[var(--customer-accent)] text-white shadow-xs'
                        : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {amt === 0 ? 'No Tip' : `₹${amt}`}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsCustomTipOpen(true)}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isCustomTipOpen
                    ? 'border-[var(--customer-accent)] bg-[var(--customer-accent)] text-white shadow-xs'
                    : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                Custom
              </button>
            </div>

            {isCustomTipOpen && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-bold text-neutral-500">₹</span>
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="Enter tip amount"
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:border-[var(--customer-accent)] font-mono"
                />
              </div>
            )}
          </div>
          </>)}

          {/* 5. Payment Method Selector */}
          <div className="space-y-3" role="radiogroup" aria-label="Payment method">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Choose Payment Method
            </h2>

            {onlinePaymentEnabled && (
              <div
                role="radio"
                aria-checked={method === 'online'}
                tabIndex={0}
                onClick={() => !placing && setMethod('online')}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !placing) {
                    e.preventDefault()
                    setMethod('online')
                  }
                }}
                className={`relative p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer shadow-xs ${
                  method === 'online'
                    ? 'border-[var(--customer-accent)] bg-[var(--customer-accent)]/5'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                  style={{
                    backgroundColor: method === 'online' ? 'var(--customer-accent)' : '#f3f4f6',
                    color: method === 'online' ? '#ffffff' : '#374151',
                  }}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-900">UPI / Cards / Netbanking</span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        method === 'online'
                          ? 'border-[var(--customer-accent)] bg-[var(--customer-accent)] text-white'
                          : 'border-neutral-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {method === 'online' && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Instant zero-contact payment via Google Pay, PhonePe, Paytm, or Credit/Debit Cards
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {['GPay', 'PhonePe', 'Paytm', 'UPI', 'Cards', 'Netbanking'].map((label) => (
                      <span key={label} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                        {label}
                      </span>
                    ))}
                    <span className="text-[10px] font-medium text-emerald-700 ml-auto flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Razorpay Secured
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div
              role="radio"
              aria-checked={method === 'counter'}
              tabIndex={0}
              onClick={() => !placing && setMethod('counter')}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !placing) {
                  e.preventDefault()
                  setMethod('counter')
                }
              }}
              className={`relative p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer shadow-xs ${
                method === 'counter'
                  ? 'border-[var(--customer-accent)] bg-[var(--customer-accent)]/5'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                style={{
                  backgroundColor: method === 'counter' ? 'var(--customer-accent)' : '#f3f4f6',
                  color: method === 'counter' ? '#ffffff' : '#374151',
                }}
              >
                <Money className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900">Pay at Counter</span>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      method === 'counter'
                        ? 'border-[var(--customer-accent)] bg-[var(--customer-accent)] text-white'
                        : 'border-neutral-300 bg-white'
                    }`}
                    aria-hidden="true"
                  >
                    {method === 'counter' && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Order will be sent to the kitchen; pay with cash, card or UPI at the billing counter
                </p>
                <div className="mt-2 text-[10.5px] font-medium text-amber-700 bg-amber-50 rounded-lg px-2 py-1 inline-block">
                  🧾 A 6-digit counter token will be shown on the next screen
                </div>
              </div>
            </div>
          </div>

          {/* 6. Order Summary Card */}
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4.5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                Order Summary
              </h2>
            </div>

            {/* Items List */}
            <div className="space-y-2 divide-y divide-neutral-100">
              {lines.map((line, idx) => {
                const item = itemFor(line.itemId)
                const variant = item?.variants?.find((v) => v.id === line.variantId)
                const unitPrice =
                  (variant?.price ?? item?.price ?? 0) +
                  line.addOnIds.reduce(
                    (sum, id) => sum + (item?.addOns?.find((a) => a.id === id)?.price ?? 0),
                    0
                  )
                const lineTotal = unitPrice * line.qty

                return (
                  <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className="font-mono font-bold text-neutral-400 shrink-0">{line.qty}x</span>
                      <div className="min-w-0 break-words">
                        <span className="font-semibold text-neutral-800">
                          {item?.name || line.itemId}
                        </span>
                        {variant && (
                          <span className="text-[11px] text-neutral-500 ml-1.5 font-normal">
                            ({formatVariantLabel(variant)})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-neutral-900 ml-2">
                      ₹{lineTotal}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Price Calculations */}
            <div className="pt-3 border-t border-neutral-100 space-y-1.5 text-xs text-neutral-600">
              {quoteLoading ? (
                <div className="h-12 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-transparent animate-spin" />
                </div>
              ) : quoteError ? (
                <p className="text-xs text-rose-600 font-semibold text-center py-2">
                  Total unavailable — quote failed
                </p>
              ) : quote ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Item Total</span>
                    <span className="font-mono">₹{quote.subtotal}</span>
                  </div>

                  {quote.discount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 font-semibold">
                      <span>Reward / Coupon Discount</span>
                      <span className="font-mono">-₹{quote.discount}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span>{taxLabel}</span>
                    <span className="font-mono">₹{quote.tax}</span>
                  </div>

                  {effectiveTip > 0 && (
                    <div className="flex items-center justify-between text-neutral-700">
                      <span>Staff Gratuity / Tip</span>
                      <span className="font-mono">₹{effectiveTip}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-base font-black text-neutral-900 pt-2 border-t border-neutral-100">
                    <span>Final Amount</span>
                    <span className="font-mono text-xl text-[var(--customer-accent)]">
                      ₹{grandTotal}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-neutral-400 text-center pt-1.5 font-medium">
                    Final total confirmed by server
                  </p>
                </>
              ) : null}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 rounded-xl p-3 border border-rose-200">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Universal Brand Footer */}
          <BrandFooter variant="customer" showCta={true} />
        </main>

        {/* Bottom Placement Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200/80 p-4 shadow-lg pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                To Pay
              </span>
              <div className="text-xl font-black font-mono text-neutral-900">
                {quoteLoading ? (
                  <span className="inline-block w-16 h-5 bg-neutral-200 animate-pulse rounded" />
                ) : quoteError ? (
                  <span className="text-rose-500 text-sm font-semibold">—</span>
                ) : (
                  `₹${grandTotal}`
                )}
              </div>
            </div>
            <motion.button
              whileHover={quote && !placing ? { scale: 1.01 } : undefined}
              whileTap={quote && !placing ? { scale: 0.98 } : undefined}
              onClick={handlePlaceOrder}
              disabled={placing || quoteLoading || !!quoteError || !quote}
              className="flex-1 h-12 rounded-2xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:brightness-105 transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--customer-accent)' }}
            >
              {placing ? (
                <div className="flex items-center gap-2">
                  <span className="w-4.5 h-4.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span className="text-xs">{processingStatus || 'Processing...'}</span>
                </div>
              ) : method === 'online' ? (
                `Pay ₹${grandTotal} online`
              ) : (
                'Confirm Order (Pay at Counter)'
              )}
            </motion.button>
          </div>
        </div>

        <CouponSheet
          open={couponSheetOpen}
          onClose={() => setCouponSheetOpen(false)}
          availableCoupons={availableCoupons}
          subtotal={quote?.subtotal ?? 0}
          onApply={(code) => {
            setCouponCode(code)
            setCouponSheetOpen(false)
          }}
        />
      </div>
    </CustomerTheme>
  )
}
