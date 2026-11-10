import { Check } from 'lucide-react'
import React from 'react'
import { motion } from 'framer-motion'

export const STATUS_STEPS = [
  { id: 'placed', label: 'Order Placed' },
  { id: 'preparing', label: 'In the Kitchen' },
  { id: 'ready', label: 'Ready' },
  { id: 'served', label: 'Served — Enjoy!' },
] as const

interface OrderStatusStepperProps {
  activeStepIndex: number
  reducedMotion: boolean | null
}

export function OrderStatusStepper({
  activeStepIndex,
  reducedMotion,
}: OrderStatusStepperProps) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 p-5 bg-white shadow-2xs space-y-4">
      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
          Live Kitchen Status
        </span>
        <p className="text-lg font-black text-neutral-900">
          {STATUS_STEPS[activeStepIndex]?.label ?? 'Processing Order'}
        </p>
      </div>

      <div className="space-y-3 pt-2">
        {STATUS_STEPS.map((step, idx) => {
          const isDone = idx <= activeStepIndex
          const isCurrent = idx === activeStepIndex
          return (
            <div key={step.id} className="flex items-center gap-3">
              <motion.div
                animate={
                  isCurrent && !reducedMotion ? { scale: [1, 1.1, 1] } : {}
                }
                transition={{ repeat: Infinity, duration: 2 }}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isDone ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {isDone && <Check className="w-3.5 h-3.5 text-white" />}
              </motion.div>
              <span
                className={`text-[13.5px] ${
                  isDone ? 'font-semibold text-neutral-900' : 'text-neutral-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
