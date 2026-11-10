import { useState } from 'react'
import { play } from '@/lib/sounds'
import { buildMailtoUrl, buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'

export type EnquiryChannel = 'whatsapp' | 'email'
export interface EnquiryLinks {
  whatsappUrl: string
  mailtoUrl: string
}
interface EnquiryWindow {
  open: (url: string, target: string) => { opener: unknown } | null
  location: { href: string }
}

/** Builds both links, opens the chosen channel, and returns the links. The window is injectable for tests. */
export function dispatchEnquiry(channel: EnquiryChannel, message: string, subject: string, win: EnquiryWindow = window): EnquiryLinks {
  const whatsappUrl = buildWhatsAppUrl(message)
  const mailtoUrl = buildMailtoUrl(subject, message)
  if (channel === 'whatsapp') {
    // No 'noopener' feature: it makes open() always return null. If a mobile browser blocks the popup
    // (we run after async validation), fall back to navigating this tab.
    const w = win.open(whatsappUrl, '_blank')
    if (w) w.opener = null
    else win.location.href = whatsappUrl
  } else win.location.href = mailtoUrl
  return { whatsappUrl, mailtoUrl }
}

/** Shared WhatsApp/email send flow: `open` dispatches and sets the "ready" state, `clear` returns to the form. */
export function useEnquirySend() {
  const [ready, setReady] = useState<EnquiryLinks | null>(null)
  return {
    ready,
    clear: () => setReady(null),
    open: (channel: EnquiryChannel, message: string, subject: string) => {
      setReady(dispatchEnquiry(channel, message, subject))
      play('success')
    },
  }
}
