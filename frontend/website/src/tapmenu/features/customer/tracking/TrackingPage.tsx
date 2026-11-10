import { AlertCircle, BadgeCheck, Store } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'

import { api, ApiError } from '../../../services/api'
import { apiUrl } from '../../../lib/env'
import type { CartLine, MenuItem, OrderStatus, RestaurantFeatures, RewardItem } from '../../../types/customer'
import { CustomerTrackingSkeleton } from '../../../components/ui/Skeleton'
import { CustomerTheme } from '../../../components/customer/CustomerTheme'
import type { SpinPrize } from './SpinWheel'
import { usePageMeta } from '../../../hooks/usePageMeta'
import {
  validateCustomerName,
  validateIndianMobile,
  validateReviewText,
} from '../../../lib/reviewValidation'
export { validateIndianMobile, validateCustomerName }
import { soundEffects } from '../../../services/audio/soundEffects'
import { BrandFooter } from '../../../components/common/BrandFooter'

// Modular Components
import { Confetti } from './components/Confetti'
import { OrderTrackingDetails } from './components/OrderTrackingDetails'
import { OrderStatusStepper } from './components/OrderStatusStepper'
import { ReviewSpinRewardCard } from './components/ReviewSpinRewardCard'
import { OrderItemsSummary } from './components/OrderItemsSummary'
import { CustomerReceiptModal } from './components/CustomerReceiptModal'
import { loadRazorpayCheckoutScript, type RazorpayOptions } from '../../../lib/razorpay'

type OrderDetail = {
  orderId?: string
  displayNumber: string
  referenceNumber?: string
  restaurantName?: string
  restaurantLogo?: string
  restaurantAddress?: string
  restaurantCity?: string
  restaurantState?: string
  restaurantPincode?: string
  gstin?: string
  fssaiLicense?: string
  createdAt?: string
  updatedAt?: string
  estimatedReadyTime?: string
  customerName?: string
  customerPhone?: string
  table: string
  roomNumber?: string
  lines: CartLine[]
  note?: string
  subtotal: number
  discount: number
  tax: number
  total: number
  payment: 'online' | 'counter'
  paymentMethod?: string
  status: OrderStatus
  counterToken?: string
  features?: RestaurantFeatures
}

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'placed':
      return 0
    case 'accepted':
    case 'preparing':
      return 1
    case 'ready':
      return 2
    case 'served':
      return 3
    default:
      return -1
  }
}

export function TrackingPage() {
  const { orderToken } = useParams<{ orderToken: string }>()
  const reducedMotion = useReducedMotion()

  const [order, setOrder] = useState<OrderDetail | null>(null)

  usePageMeta({
    title: order?.displayNumber ? `Order #${order.displayNumber} Status` : 'Order Status',
    noindex: true,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [accent, setAccent] = useState('#2563EB')
  const [spinConfig, setSpinConfig] = useState<{ enabled: boolean; rewards: RewardItem[] } | null>(null)

  // Confetti
  const [showConfetti, setShowConfetti] = useState(false)
  const celebratedRef = useRef(false)

  // Review state
  const [rating, setRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [reviewName, setReviewName] = useState('')
  const [reviewPhone, setReviewPhone] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Spin state
  const [spinPlayed, setSpinPlayed] = useState(false)
  const [savedSpinPrize, setSavedSpinPrize] = useState<SpinPrize | null>(null)

  // Receipt & Payment states
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [payingRazorpay, setPayingRazorpay] = useState(false)

  const handlePayNowRazorpay = async () => {
    if (!orderToken || !order) return
    setPayingRazorpay(true)
    try {
      const res = await api.orders.initRazorpayRetry(orderToken)
      if (res.alreadyPaid) {
        setOrder((prev) => (prev ? { ...prev, status: res.status } : null))
        setPayingRazorpay(false)
        return
      }

      if (res.razorpay) {
        const loaded = await loadRazorpayCheckoutScript()
        if (!loaded || !window.Razorpay) {
          alert('Could not connect to Razorpay. Please pay at the counter.')
          setPayingRazorpay(false)
          return
        }

        const options: RazorpayOptions = {
          key: res.razorpay.keyId,
          amount: res.razorpay.amount,
          currency: res.razorpay.currency || 'INR',
          name: res.razorpay.restaurantName || order.restaurantName || 'TapMenu Restaurant',
          description: `Order #${order.displayNumber}`,
          order_id: res.razorpay.orderId,
          handler: async (resp) => {
            try {
              await api.payments.verifyRazorpay({
                orderId: res.orderId,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpayOrderId: resp.razorpay_order_id,
                razorpaySignature: resp.razorpay_signature,
              })
              setOrder((prev) => (prev ? { ...prev, status: 'placed' } : null))
              soundEffects.success()
              setShowConfetti(true)
              setTimeout(() => setShowConfetti(false), 3500)
            } catch {
              alert('Payment verification failed. Please contact restaurant staff.')
            } finally {
              setPayingRazorpay(false)
            }
          },
          prefill: {
            name: order.customerName,
            contact: order.customerPhone,
          },
          theme: {
            color: accent || '#10b981',
          },
          modal: {
            ondismiss: () => {
              setPayingRazorpay(false)
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
      }
    } catch {
      alert('Could not initiate online payment. Please pay at counter.')
      setPayingRazorpay(false)
    }
  }

  const isServed = order?.status === 'served'

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Restore per-order state from sessionStorage
  useEffect(() => {
    if (!orderToken) return
    const key = `review_done_${orderToken}`
    if (sessionStorage.getItem(key) === '1') setReviewSubmitted(true)
    const spinKey = `spin_done_${orderToken}`
    if (sessionStorage.getItem(spinKey) === '1') setSpinPlayed(true)
    const prizeKey = `spin_prize_${orderToken}`
    const stored = sessionStorage.getItem(prizeKey)
    if (stored) {
      try {
        setSavedSpinPrize(JSON.parse(stored))
      } catch {}
    }
  }, [orderToken])

  // Fetch spin wheel slices & configuration when spin wheel is enabled
  useEffect(() => {
    if (!orderToken || order?.features?.spinWheel === false) return
    fetch(apiUrl(`/api/orders/${encodeURIComponent(orderToken)}/spin-config`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSpinConfig(data)
      })
      .catch(() => {})
  }, [orderToken, order?.features?.spinWheel])

  const fetchOrder = useCallback(async () => {
    if (!orderToken) return
    try {
      const res = await api.orders.get(orderToken)
      setOrder(res)
      if ((res as any).accent) {
        setAccent((res as any).accent)
      }
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your order. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [orderToken])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  useEffect(() => {
    api.menu.get().then((res) => setMenuItems(res.items)).catch(() => {})
  }, [])

  // Confetti on first "served" transition
  useEffect(() => {
    if (order?.status === 'served' && !celebratedRef.current) {
      const key = `celebrated_${orderToken}`
      if (!sessionStorage.getItem(key)) {
        celebratedRef.current = true
        sessionStorage.setItem(key, '1')
        setShowConfetti(true)
        soundEffects.success()
        setTimeout(() => setShowConfetti(false), 3500)
      } else {
        celebratedRef.current = true
      }
    }
  }, [order?.status, orderToken])

  // Polling order status until served
  useEffect(() => {
    if (!order || order.status === 'served') return
    const intervalMs = order.status === 'ready' ? 15000 : 5000
    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (typeof document !== 'undefined' && document.hidden) return
      pollRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        void fetchOrder()
      }, intervalMs)
    }

    startPolling()

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollRef.current) clearInterval(pollRef.current)
      } else {
        void fetchOrder()
        startPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [order?.status, fetchOrder])

  // Auto-fill review contact info if order already has customer details
  useEffect(() => {
    if (order?.customerName && !reviewName) setReviewName(order.customerName)
  }, [order?.customerName, reviewName])

  // Combined comment with tags
  const fullCommentText = useMemo(() => {
    const parts: string[] = []
    if (selectedTags.length > 0) parts.push(`Tags: ${selectedTags.join(', ')}`)
    if (comment.trim()) parts.push(comment.trim())
    return parts.join(' | ')
  }, [selectedTags, comment])

  // Only a star rating is required. Comment, name and phone are optional but validated when filled in.
  const commentError = useMemo(
    () => (comment.trim() ? validateReviewText(comment).error ?? null : null),
    [comment]
  )
  const nameError = useMemo(
    () => (reviewName.trim() ? validateCustomerName(reviewName).error ?? null : null),
    [reviewName]
  )
  const phoneError = useMemo(
    () => (reviewPhone.trim() ? validateIndianMobile(reviewPhone).error ?? null : null),
    [reviewPhone]
  )

  // Handlers
  const handleToggleTag = (tag: string) => {
    soundEffects.click()
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmitReview = async () => {
    if (!orderToken || reviewSubmitting) return
    if (rating === 0) {
      setReviewError('Please tap a star to rate your experience.')
      return
    }
    const firstError = commentError || nameError || phoneError
    if (firstError) {
      setReviewError(firstError)
      return
    }

    setReviewError(null)
    setReviewSubmitting(true)

    try {
      const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(orderToken)}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reviewName.trim() || undefined,
          phone: reviewPhone.trim() || undefined,
          rating,
          comment: fullCommentText,
          tags: selectedTags,
        }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (body.reviewSubmitted) {
          setReviewSubmitted(true)
          sessionStorage.setItem(`review_done_${orderToken}`, '1')
          return
        }
        throw new Error(body.error || 'Could not submit review')
      }

      setReviewSubmitted(true)
      sessionStorage.setItem(`review_done_${orderToken}`, '1')
      soundEffects.success()
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3500)
    } catch (err: any) {
      setReviewError(err.message)
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleSpin = async (): Promise<SpinPrize | null> => {
    if (!orderToken) return null
    try {
      let deviceId = localStorage.getItem('tm_device_id')
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
        localStorage.setItem('tm_device_id', deviceId)
      }

      const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(orderToken)}/spin`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: reviewPhone.trim(),
          deviceId,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as any

      if (!res.ok) {
        if (body.spinPlayed) {
          setSpinPlayed(true)
          sessionStorage.setItem(`spin_done_${orderToken}`, '1')
        }
        setReviewError(body.error || 'Reward wheel already played for this device or order.')
        return null
      }

      const data = body as SpinPrize
      sessionStorage.setItem(`spin_prize_${orderToken}`, JSON.stringify(data))
      setSavedSpinPrize(data)
      return data
    } catch {
      return null
    }
  }

  const handleSpinComplete = (prize: SpinPrize) => {
    sessionStorage.setItem(`spin_done_${orderToken}`, '1')
    sessionStorage.setItem(`spin_prize_${orderToken}`, JSON.stringify(prize))
    setSavedSpinPrize(prize)
    soundEffects.success()
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3500)
  }

  if (loading) {
    return <CustomerTrackingSkeleton />
  }

  if (loadError || !order) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-neutral-400" />
        <p className="text-sm text-neutral-600">{loadError || 'Order not found.'}</p>
      </div>
    )
  }

  const activeStepIndex = getStepIndex(order.status)
  const isReviewsEnabled = order.features?.reviews !== false
  const isSpinWheelEnabled =
    order.features?.spinWheel !== false && spinConfig?.enabled !== false
  const showReviewSpinSection = isReviewsEnabled || isSpinWheelEnabled

  return (
    <CustomerTheme accent={accent}>
      <div className="min-h-screen bg-[#faf9f7] text-neutral-900 pb-32">
        {showConfetti && <Confetti />}

        <main className="max-w-md mx-auto px-4 sm:px-6 pt-8 space-y-6">
          {/* Restaurant Header & TapWebs Verified Badge */}
          <div className="flex items-center justify-between pb-1 border-b border-neutral-200/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                <Store className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-neutral-900 leading-tight">
                  {order.restaurantName || 'TapMenu Partner Restaurant'}
                </h2>
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-medium">
                  <BadgeCheck className="w-3 h-3 text-emerald-600" />
                  <span>Verified TapMenu Order</span>
                </div>
              </div>
            </div>

            <a
              href="https://tapwebs.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700 transition-colors cursor-pointer border border-neutral-200"
            >
              <span>By TapWebs</span>
            </a>
          </div>

          {/* Order Header & Counter Token */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
                {order.table}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
                Order #{order.displayNumber}
              </h1>
            </div>
            {order.payment === 'counter' && order.counterToken && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono">
                  Counter Token
                </span>
                <div className="font-mono text-base font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                  {order.counterToken}
                </div>
              </div>
            )}
          </div>

          {/* 8 Enhanced Order Tracking Details */}
          <OrderTrackingDetails
            order={order}
            orderToken={orderToken}
            isServed={isServed}
            onOpenReceipt={() => setIsReceiptOpen(true)}
            onPayNowRazorpay={handlePayNowRazorpay}
            paying={payingRazorpay}
          />

          {/* Live Kitchen Status Stepper */}
          <OrderStatusStepper
            activeStepIndex={activeStepIndex}
            reducedMotion={reducedMotion}
          />

          {showReviewSpinSection && (
            <ReviewSpinRewardCard
              isReviewsEnabled={isReviewsEnabled}
              isSpinWheelEnabled={isSpinWheelEnabled}
              isServed={isServed}
              rating={rating}
              setRating={setRating}
              selectedTags={selectedTags}
              onToggleTag={handleToggleTag}
              comment={comment}
              setComment={setComment}
              commentError={commentError}
              reviewName={reviewName}
              setReviewName={setReviewName}
              nameError={nameError}
              reviewPhone={reviewPhone}
              setReviewPhone={setReviewPhone}
              phoneError={phoneError}
              reviewError={reviewError}
              reviewSubmitting={reviewSubmitting}
              reviewSubmitted={reviewSubmitted}
              accent={accent}
              onSubmitReview={handleSubmitReview}
              spinPlayed={spinPlayed}
              spinConfig={spinConfig}
              onSpin={handleSpin}
              onSpinComplete={handleSpinComplete}
              savedSpinPrize={savedSpinPrize}
            />
          )}

          {/* Order Items Summary */}
          <OrderItemsSummary
            lines={order.lines}
            menuItems={menuItems}
            note={order.note}
            total={order.total}
          />

          {/* Universal TapMenu / TapWebs Brand Footer */}
          <BrandFooter variant="customer" showCta={true} />
        </main>

        {isReceiptOpen && (
          <CustomerReceiptModal
            isOpen={isReceiptOpen}
            onClose={() => setIsReceiptOpen(false)}
            data={{
              ...order,
              orderId: order.orderId,
            }}
            menuItems={menuItems}
          />
        )}
      </div>
    </CustomerTheme>
  )
}

export default TrackingPage
