export interface RazorpayResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayErrorResponse {
  error: {
    code: string
    description: string
    source: string
    step: string
    reason: string
    metadata: {
      order_id: string
      payment_id?: string
    }
  }
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  image?: string
  order_id: string
  handler: (response: RazorpayResponse) => void | Promise<void>
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  notes?: Record<string, string>
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
    backdropclose?: boolean
    escape?: boolean
    handleback?: boolean
    confirm_close?: boolean
  }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void
      on: (event: string, handler: (data: any) => void) => void
      close: () => void
    }
  }
}

let scriptLoadingPromise: Promise<boolean> | null = null

/**
 * Loads the official Razorpay Checkout SDK dynamically if not already loaded.
 */
export function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)

  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
    if (existing) {
      if (window.Razorpay) {
        resolve(true)
      } else {
        existing.addEventListener('load', () => resolve(true))
        existing.addEventListener('error', () => resolve(false))
      }
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      scriptLoadingPromise = null
      resolve(false)
    }
    document.body.appendChild(script)
  })

  return scriptLoadingPromise
}
