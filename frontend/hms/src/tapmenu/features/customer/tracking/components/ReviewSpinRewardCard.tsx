import { AlertCircle, CheckCircle, Phone, Star, User } from 'lucide-react'
import React, { Suspense, lazy } from 'react'
import { motion } from 'framer-motion'

import { StarRating } from './StarRating'
import type { RewardItem } from '../../../../types/customer'
import type { SpinPrize } from '../SpinWheel'

const SpinWheel = lazy(() =>
  import('../SpinWheel').then((m) => ({ default: m.SpinWheel }))
)

export const QUICK_TAGS = [
  'Great Food',
  'Fast Service',
  'Nice Ambience',
  'Value for Money',
  'Friendly Staff',
]

const LABEL = 'text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-mono'
const INPUT =
  'w-full h-11 pl-9 pr-8 rounded-xl border border-neutral-200 bg-neutral-50 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-400'

interface ReviewSpinRewardCardProps {
  isReviewsEnabled: boolean
  isSpinWheelEnabled: boolean
  /** Order has been served: the reward wheel can only be spun after this. */
  isServed: boolean
  rating: number
  setRating: (val: number) => void
  selectedTags: string[]
  onToggleTag: (tag: string) => void
  comment: string
  setComment: (val: string) => void
  commentError: string | null
  reviewName: string
  setReviewName: (val: string) => void
  nameError: string | null
  reviewPhone: string
  setReviewPhone: (val: string) => void
  phoneError: string | null
  reviewError: string | null
  reviewSubmitting: boolean
  reviewSubmitted: boolean
  accent: string
  onSubmitReview: () => void
  spinPlayed: boolean
  spinConfig: { enabled: boolean; rewards: RewardItem[] } | null
  onSpin: () => Promise<SpinPrize | null>
  onSpinComplete: (prize: SpinPrize) => void
  savedSpinPrize: SpinPrize | null
}

export function ReviewSpinRewardCard({
  isReviewsEnabled,
  isSpinWheelEnabled,
  isServed,
  rating,
  setRating,
  selectedTags,
  onToggleTag,
  comment,
  setComment,
  commentError,
  reviewName,
  setReviewName,
  nameError,
  reviewPhone,
  setReviewPhone,
  phoneError,
  reviewError,
  reviewSubmitting,
  reviewSubmitted,
  accent,
  onSubmitReview,
  spinPlayed,
  spinConfig,
  onSpin,
  onSpinComplete,
  savedSpinPrize,
}: ReviewSpinRewardCardProps) {
  const showWheel = isSpinWheelEnabled && (!isReviewsEnabled || reviewSubmitted)

  return (
    <div className="space-y-6">
      {isReviewsEnabled && (
        <div className="rounded-2xl border border-neutral-200/80 p-5 bg-white shadow-2xs space-y-5">
          <div className="space-y-1">
            <span className={LABEL}>Your Feedback</span>
            <p className="text-lg font-black text-neutral-900">
              {reviewSubmitted ? 'Thank you for your review' : 'How was your experience?'}
            </p>
            {!reviewSubmitted && (
              <p className="text-[12.5px] text-neutral-500">
                You can review at any time, even before your order arrives.
              </p>
            )}
          </div>

          {reviewSubmitted ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <span>
                Your review has been shared with the team.
                {isSpinWheelEnabled && ' Your reward wheel is below.'}
              </span>
            </div>
          ) : (
            <>
              <StarRating value={rating} onChange={setRating} />

              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggleTag(tag)}
                      className={`min-h-9 px-3 rounded-full text-xs font-semibold border transition-colors active:scale-95 cursor-pointer ${
                        active
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything else to tell us? (optional)"
                  rows={3}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-400 resize-none"
                />
                {commentError && <p className="text-[11px] text-amber-700">{commentError}</p>}
              </div>

              <div className="space-y-2">
                <span className={LABEL}>Contact (optional)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      className={INPUT}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={reviewPhone}
                      onChange={(e) => setReviewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Mobile number"
                      autoComplete="tel-national"
                      className={`${INPUT} font-mono`}
                    />
                  </div>
                </div>
                {(nameError || phoneError) && (
                  <p className="text-[11px] text-amber-700">{nameError || phoneError}</p>
                )}
              </div>

              {reviewError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={onSubmitReview}
                disabled={reviewSubmitting || rating === 0}
                className="w-full min-h-12 rounded-xl text-white font-bold text-sm transition-opacity disabled:opacity-40 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: accent }}
              >
                {reviewSubmitting ? (
                  <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <>
                    <Star size={16} />
                    {rating === 0 ? 'Tap a star to rate' : 'Submit review'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {showWheel && (
        <div className="rounded-2xl border border-neutral-200/80 p-5 bg-white shadow-2xs space-y-4">
          <div className="space-y-1">
            <span className={LABEL}>Reward Wheel</span>
            <p className="text-lg font-black text-neutral-900">
              {spinPlayed ? 'Reward claimed' : isServed ? 'Spin for a reward' : 'Opens once your meal is served'}
            </p>
          </div>

          <div className="flex flex-col items-center">
            {!spinPlayed ? (
              <Suspense fallback={null}>
                <SpinWheel
                  locked={!isServed}
                  slices={spinConfig?.rewards}
                  onSpin={onSpin}
                  onSpinComplete={onSpinComplete}
                />
              </Suspense>
            ) : (
              <div className="w-full p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 text-center space-y-2">
                <p className="text-sm font-bold text-neutral-800">
                  You have already used the wheel for this order.
                </p>
                {savedSpinPrize?.coupon?.code && (
                  <div className="p-3 bg-white border border-emerald-300 rounded-xl space-y-1">
                    <p className={LABEL}>Your coupon</p>
                    <p className="text-2xl font-black font-mono text-emerald-600 tracking-widest">
                      {savedSpinPrize.coupon.code}
                    </p>
                    <p className="text-xs font-semibold text-emerald-800">
                      {savedSpinPrize.coupon.description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
