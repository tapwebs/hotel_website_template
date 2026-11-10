import type { Variants, Transition } from 'framer-motion'

export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const
export const EASE_EDITORIAL = [0.16, 1, 0.3, 1] as const

export const TRANSITION_FAST: Transition = { duration: 0.25, ease: EASE_SMOOTH }
export const TRANSITION_NORMAL: Transition = { duration: 0.38, ease: EASE_SMOOTH }
export const TRANSITION_EDITORIAL: Transition = { duration: 0.55, ease: EASE_EDITORIAL }
export const TRANSITION_SPRING: Transition = { type: 'spring', stiffness: 420, damping: 28 }
export const TRANSITION_BOUNCE: Transition = { type: 'spring', stiffness: 350, damping: 20 }

// ---------------------------------------------------------------------------
// Variants (used in the codebase — 0-hit exports removed)
// ---------------------------------------------------------------------------

export const blurFadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)', scale: 0.99 },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: TRANSITION_EDITORIAL },
}

export const blurFadeIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(8px)' },
  visible: { opacity: 1, filter: 'blur(0px)', transition: TRANSITION_EDITORIAL },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: TRANSITION_EDITORIAL },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: TRANSITION_NORMAL },
}

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

export const tabContentVariant: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: TRANSITION_FAST },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } },
}

export const accordionContent: Variants = {
  collapsed: { opacity: 0, height: 0, overflow: 'hidden' },
  expanded: { opacity: 1, height: 'auto', overflow: 'hidden', transition: { duration: 0.28, ease: EASE_SMOOTH } },
}

export const pulseDot: Variants = {
  animate: {
    scale: [1, 1.25, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

// ---------------------------------------------------------------------------
// Micro-interactions
// ---------------------------------------------------------------------------

export const cardHoverMotion = {
  whileHover: { y: -4, transition: { duration: 0.2, ease: EASE_SMOOTH } },
}

export const buttonPressMotion = {
  whileHover: { scale: 1.02, transition: { duration: 0.15 } },
  whileTap: { scale: 0.97, transition: { duration: 0.08 } },
}

export const iconNudgeHover = {
  whileHover: { scale: 1.15, rotate: 6, transition: { duration: 0.18 } },
}
