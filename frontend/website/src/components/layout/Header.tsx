import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigation } from 'react-router'
import { UserRound } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useAuth } from '@/features/auth/auth-context'
import { nav } from '@/data/hotel'
import { BookNowButton } from '@/components/booking/BookNowButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { play } from '@/lib/sounds'
import { Logo } from './Logo'
import { MobileNav } from './MobileNav'
import { SoundToggle } from './SoundToggle'

/** Gentle diagonal shine that sweeps across a solid button on hover (hidden for reduced motion). */
const shine =
  'relative overflow-hidden before:pointer-events-none before:absolute before:inset-y-0 before:-left-1/2 before:w-1/3 before:-skew-x-12 before:bg-linear-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700 before:ease-out hover:before:translate-x-[450%] motion-reduce:before:hidden'

/** True once the page is scrolled past the top. Hysteresis (on at 24px, off below 8px) avoids flicker as the header shrinks. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled((was) => (was ? window.scrollY > 8 : window.scrollY > 24))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

export function Header() {
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'
  const scrolled = useScrolled()

  return (
    <header data-scrolled={scrolled || undefined} className="sticky top-0 z-40">
      {/* Solid cream at the top, frosted glass + soft shadow once scrolled. Opacity-only crossfade. */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 bg-cream/95 transition-opacity duration-300 motion-reduce:transition-none',
          scrolled && 'opacity-0',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 bg-cream/75 opacity-0 shadow-[0_10px_30px_-18px_rgb(74_17_27/0.35)] backdrop-blur-md backdrop-saturate-150 transition-opacity duration-300 motion-reduce:transition-none',
          scrolled && 'opacity-100',
        )}
      />
      {/* Gold hairline along the bottom edge */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-gold/0 via-gold/70 to-gold/0" />
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 h-0.5 origin-left bg-gold transition-[transform,opacity] duration-500',
          loading ? 'scale-x-75 opacity-100' : 'scale-x-0 opacity-0',
        )}
      />
      <div
        className={cn(
          // Mobile stays h-14 (compact pass); md+ shrinks from 4.5rem to 4rem when scrolled.
          'mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] transition-[height] duration-300 motion-reduce:transition-none sm:px-6 lg:px-8',
          scrolled ? 'md:h-16' : 'md:h-[4.5rem]',
        )}
      >
        <Logo className={cn('origin-left transition-transform duration-300 motion-reduce:transition-none', scrolled && 'md:scale-95')} />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => play('tick')}
                  className={({ isActive }) =>
                    cn(
                      'relative flex min-h-11 items-center rounded-md px-3 text-sm font-medium tracking-wide text-walnut transition-colors hover:text-burgundy',
                      'after:absolute after:inset-x-3 after:bottom-2 after:h-px after:origin-center after:bg-linear-to-r after:from-gold/0 after:via-gold after:to-gold/0 after:transition-transform after:duration-300 after:ease-out motion-reduce:after:transition-none',
                      isActive
                        ? 'text-burgundy after:scale-x-100'
                        : 'after:scale-x-0 hover:after:scale-x-100 focus-visible:after:scale-x-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2 lg:gap-3">
          <AccountMenu />
          <SoundToggle />
          <BookNowButton
            size="sm"
            className={cn(
              'hidden shadow-[0_6px_18px_-10px_rgb(74_17_27/0.7)] hover:bg-burgundy-deep sm:inline-flex sm:h-11 sm:px-5',
              shine,
            )}
          />
          <MobileNav />
        </div>
      </div>
    </header>
  )
}

const accountLinks = [
  { to: '/login', label: 'Log in' },
  { to: '/signup', label: 'Sign up' },
] as const

/**
 * One person icon instead of separate Log in / Sign up buttons. Radix supplies the menu
 * semantics, arrow-key navigation, Escape and focus return. Phones use the links in MobileNav.
 */
function AccountMenu() {
  const { auth, logout } = useAuth()
  const user = auth.status === 'authenticated' ? auth.user : null
  const tick = () => play('tick')
  const itemClass =
    'flex min-h-11 w-full items-center rounded-sm px-3 text-sm font-medium text-walnut outline-none data-highlighted:bg-gold-soft/40 data-highlighted:text-burgundy'
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={user ? `Account menu for ${user.name}` : 'Account: log in or sign up'}
          className="hidden size-11 rounded-full text-burgundy hover:bg-gold-soft/40 data-[state=open]:bg-gold-soft/50 lg:inline-flex"
        >
          {user ? (
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-burgundy text-sm font-semibold text-ivory uppercase"
            >
              {user.name.trim().charAt(0) || '?'}
            </span>
          ) : (
            <UserRound className="size-5" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-44 rounded-md border border-gold/40 bg-ivory p-1 shadow-[0_18px_40px_-18px_rgb(74_17_27/0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {user ? (
            <>
              <DropdownMenu.Label className="max-w-64 truncate px-3 py-2 text-sm text-walnut">
                <span className="block truncate font-semibold">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-gold/30" />
              <DropdownMenu.Item asChild onSelect={tick}>
                <Link to="/account" className={itemClass}>
                  My account
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild onSelect={tick}>
                <Link to="/account/bookings" className={itemClass}>
                  My bookings
                </Link>
              </DropdownMenu.Item>
              {user.role === 'admin' ? (
                <DropdownMenu.Item asChild onSelect={tick}>
                  <Link to="/admin" className={itemClass}>
                    Admin dashboard
                  </Link>
                </DropdownMenu.Item>
              ) : null}
              <DropdownMenu.Item
                onSelect={() => {
                  tick()
                  void logout()
                }}
                className={cn(itemClass, 'cursor-pointer')}
              >
                Log out
              </DropdownMenu.Item>
            </>
          ) : (
            accountLinks.map((l) => (
              <DropdownMenu.Item key={l.to} asChild onSelect={tick}>
                <Link to={l.to} className={itemClass}>
                  {l.label}
                </Link>
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
