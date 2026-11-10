import { z } from 'zod'
import { isIndianMobile, PHONE_ERROR } from './buildWhatsAppUrl'

// Kept apart from buildWhatsAppUrl so the site layout (footer, WhatsApp buttons) does not pull zod into every page.
export const phoneSchema = z.string().refine(isIndianMobile, PHONE_ERROR)
