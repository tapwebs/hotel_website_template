import { describe, expect, it, vi } from 'vitest'
import { buildMailtoUrl, buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { dispatchEnquiry } from './useEnquirySend'

const fakeWindow = (opened: { opener: unknown } | null = { opener: 'x' }) => ({ open: vi.fn(() => opened), location: { href: '' } })

describe('dispatchEnquiry', () => {
  it('opens WhatsApp in a new tab and returns both links', () => {
    const win = fakeWindow()
    const links = dispatchEnquiry('whatsapp', 'Hi there', 'Subject', win)
    expect(links).toEqual({ whatsappUrl: buildWhatsAppUrl('Hi there'), mailtoUrl: buildMailtoUrl('Subject', 'Hi there') })
    expect(win.open).toHaveBeenCalledWith(links.whatsappUrl, '_blank')
    expect(win.location.href).toBe('')
  })
  it('falls back to navigating this tab when the popup is blocked', () => {
    const win = fakeWindow(null)
    const links = dispatchEnquiry('whatsapp', 'Hi there', 'Subject', win)
    expect(win.location.href).toBe(links.whatsappUrl)
  })
  it('navigates to mailto for email without opening a window', () => {
    const win = fakeWindow()
    const links = dispatchEnquiry('email', 'Hi there', 'Subject', win)
    expect(win.location.href).toBe(links.mailtoUrl)
    expect(win.open).not.toHaveBeenCalled()
  })
})
