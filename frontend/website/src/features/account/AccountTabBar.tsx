import { createPortal } from 'react-dom'
import { NavLink } from 'react-router'
import { CalendarDays, CircleHelp, House, Plus, UserRound } from 'lucide-react'
import { useBooking } from '@/components/booking/booking-context'
import { cn } from '@/lib/utils'

const item =
  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md'

/** App-style bottom tab bar for phones, replacing the Call / WhatsApp / Book bar on /account. */
export function AccountTabBar() {
  const { openBooking, preloadBooking } = useBooking()
  const tab = ({ isActive }: { isActive: boolean }) => cn(item, isActive ? 'text-burgundy' : 'text-walnut/70')
  // Portalled to <body>: the page-transition wrapper animates a transform, which would turn `fixed` into
  // "fixed to the page" and make the bar scroll away with the content.
  return createPortal(
    <nav
      aria-label="Account"
      className="m-bar-in fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-cream/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-[0_-8px_24px_-14px_rgb(74_17_27/0.35)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5 items-end px-2 pt-1">
        <NavLink to="/account" end className={tab}>
          <House className="size-5" aria-hidden="true" /> Home
        </NavLink>
        <NavLink to="/account/bookings" className={tab}>
          <CalendarDays className="size-5" aria-hidden="true" /> Stays
        </NavLink>
        <button
          type="button"
          onClick={() => openBooking()}
          onPointerEnter={preloadBooking}
          onFocus={preloadBooking}
          aria-haspopup="dialog"
          className="mx-auto -mt-5 mb-1 grid size-14 place-items-center rounded-full bg-burgundy text-ivory shadow-[0_8px_18px_-8px_rgb(74_17_27/0.9)] outline-none transition-transform active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus className="size-6" aria-hidden="true" />
          <span className="sr-only">Book a room</span>
        </button>
        <NavLink to="/account/help" className={tab}>
          <CircleHelp className="size-5" aria-hidden="true" /> Help
        </NavLink>
        <NavLink to="/account/profile" className={tab}>
          <UserRound className="size-5" aria-hidden="true" /> Profile
        </NavLink>
      </div>
    </nav>,
    document.body,
  )
}
