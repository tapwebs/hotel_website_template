import { BadgeCheck, Flame, Sparkles, Star, Tag } from 'lucide-react'

import { motion } from 'framer-motion'

export type BadgeType = 'bestseller' | 'trending' | 'chef' | 'soldout' | 'discount' | 'combo'

interface MenuBadgeProps {
  type: BadgeType
  rank?: number
  discountPercent?: number
  comboSavings?: number
  text?: string
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

/**
 * Editorial Menu Badges with refined obsidian glassmorphism.
 * Replaces loud neon gradients with luxury fine-dining aesthetics.
 */
export function MenuBadge({
  type,
  rank = 1,
  discountPercent,
  comboSavings,
  text,
  className = '',
  size = 'xs',
}: MenuBadgeProps) {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[0.6875rem] gap-1',
    sm: 'px-2.5 py-0.5 text-[0.6875rem] gap-1.5',
    md: 'px-3 py-1 text-xs gap-1.5',
  }[size]

  if (type === 'bestseller') {
    return (
      <motion.span
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center font-semibold tracking-wider uppercase rounded-full bg-neutral-950/80 backdrop-blur-md text-amber-200 border border-amber-400/30 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
        <span>{text || 'Bestseller'}</span>
      </motion.span>
    )
  }

  if (type === 'trending') {
    return (
      <motion.span
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center font-semibold tracking-wider uppercase rounded-full bg-neutral-950/80 backdrop-blur-md text-rose-200 border border-rose-400/30 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <Flame className="w-2.5 h-2.5 text-rose-400 fill-rose-400 shrink-0" />
        <span>{text || (rank ? `Trending #${rank}` : 'Trending')}</span>
      </motion.span>
    )
  }

  if (type === 'chef') {
    return (
      <motion.span
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center font-semibold tracking-wider uppercase rounded-full bg-neutral-950/80 backdrop-blur-md text-amber-100 border border-amber-300/35 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300 shrink-0" />
        <span>{text || "Chef's Special"}</span>
      </motion.span>
    )
  }

  if (type === 'combo') {
    return (
      <span
        className={`inline-flex items-center font-semibold tracking-wider uppercase rounded-full bg-neutral-950/80 backdrop-blur-md text-emerald-200 border border-emerald-400/30 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <BadgeCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
        <span>{text || (comboSavings ? `Save ₹${comboSavings}` : 'Combo')}</span>
      </span>
    )
  }

  if (type === 'discount' && discountPercent) {
    return (
      <span
        className={`inline-flex items-center font-bold font-mono tracking-tight rounded-full bg-rose-950/80 backdrop-blur-md text-rose-200 border border-rose-500/35 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <Tag className="w-2.5 h-2.5 text-rose-400 shrink-0" />
        <span>{text || `${discountPercent}% OFF`}</span>
      </span>
    )
  }

  if (type === 'soldout') {
    return (
      <span
        className={`inline-flex items-center font-semibold tracking-wider uppercase rounded-full bg-neutral-950/85 backdrop-blur-md text-neutral-400 border border-neutral-700/60 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <span>Sold Out</span>
      </span>
    )
  }

  return null
}
