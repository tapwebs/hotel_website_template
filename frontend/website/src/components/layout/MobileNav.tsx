import { useState, type CSSProperties } from 'react'
import { Link, NavLink } from 'react-router'
import { Menu, MessageCircle, Phone } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { buildWhatsAppUrl } from '@/components/booking/buildWhatsAppUrl'
import { LineDivider } from '@/components/LineArt'
import { useAuth } from '@/features/auth/auth-context'
import { hotel, nav } from '@/data/hotel'
import { cn } from '@/lib/utils'

/** Stagger delay for the shared `.anim-rise` reveal (index.css handles reduced motion). */
const rise = (i: number) => ({ '--d': `${80 + i * 50}ms` }) as CSSProperties

/**
 * Full-height menu sheet. Radix Dialog supplies the focus trap, Escape to close, focus return
 * to the trigger, body scroll lock and aria-expanded/aria-controls on the trigger.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const { auth, logout } = useAuth()
  const user = auth.status === 'authenticated' ? auth.user : null
  const items = [{ to: '/', label: 'Home' }, ...nav]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 text-burgundy hover:bg-gold-soft/40 lg:hidden" aria-label="Open menu">
          <Menu className="size-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="h-dvh w-full gap-0 overflow-y-auto border-l-gold/40 bg-cream pb-[env(safe-area-inset-bottom)] sm:max-w-sm"
      >
        <div className="px-6 pt-6">
          <SheetTitle className="font-display text-2xl font-medium text-burgundy">Menu</SheetTitle>
          <SheetDescription className="sr-only">Pages of the TapMenu Grand Resort website</SheetDescription>
          <LineDivider className="draw-now mt-3 h-4 w-36 text-gold" />
        </div>
        <nav aria-label="Mobile" className="px-4 pt-3">
          <ul className="grid">
            {items.map((item, i) => (
              <li key={item.to} className="anim-rise" style={rise(i)}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={close}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex min-h-12 items-center rounded-md px-2 font-display text-2xl text-walnut transition-colors hover:text-burgundy',
                      isActive && 'text-burgundy',
                    )
                  }
                >
                  {({ isActive }) => (
                    <span className="relative">
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-x-0 -bottom-1 h-px origin-left bg-gold transition-transform duration-300 motion-reduce:transition-none',
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                        )}
                      />
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="anim-rise mt-auto grid gap-3 border-t border-gold/30 p-6" style={rise(items.length)}>
          <BookNowButton size="lg" onClickCapture={close} className="hover:bg-burgundy-deep" />
          {user ? (
            <div className="grid gap-3">
              <p className="truncate text-sm text-walnut">
                Signed in as <span className="font-semibold">{user.name}</span>
              </p>
              <Button asChild variant="outline" sound={false} className="h-12">
                <Link to="/account" onClick={close}>
                  My account
                </Link>
              </Button>
              <div className={cn('grid gap-3', user.role === 'admin' && 'grid-cols-2')}>
                {user.role === 'admin' ? (
                  <Button asChild variant="outline" sound={false} className="h-12">
                    <Link to="/admin" onClick={close}>
                      Admin dashboard
                    </Link>
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  sound={false}
                  className="h-12"
                  onClick={() => {
                    close()
                    void logout()
                  }}
                >
                  Log out
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" sound={false} className="h-12">
                <Link to="/login" onClick={close}>
                  Log in
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                sound={false}
                className="h-12 border-gold bg-transparent text-burgundy hover:border-burgundy hover:bg-burgundy hover:text-ivory"
              >
                <Link to="/signup" onClick={close}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" className="h-12">
              <a href={hotel.phoneHrefTertiary}>
                <Phone aria-hidden="true" /> Call
              </a>
            </Button>
            <Button asChild variant="outline" className="h-12">
              <a href={buildWhatsAppUrl('Hello, I have a question about the hotel.', hotel.whatsappNumberTertiary)} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
