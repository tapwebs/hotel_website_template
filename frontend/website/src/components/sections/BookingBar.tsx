import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useBooking } from '@/components/booking/booking-context'
import { rooms, type RoomId } from '@/data/rooms'
import { hotel } from '@/data/hotel'
import { formatINR } from '@/lib/format'
import { cn, container, inlineLink } from '@/lib/utils'

/** Pick a room, then choose dates in the booking sheet (prefilled with the room). */
export function BookingBar() {
  const [roomId, setRoomId] = useState<RoomId>('deluxe')
  const { openBooking, preloadBooking } = useBooking()
  // Only the auth status is read: it is 'loading'/'anonymous' on the server and first client render, so hydration is safe.
  const signedIn = useAuth().auth.status === 'authenticated'

  return (
    <section aria-labelledby="booking-bar-title" className={cn(container, 'relative z-10 -mt-6 lg:-mt-12')}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          openBooking({ roomId })
        }}
        className="grid gap-4 rounded-md border border-gold/50 bg-ivory p-4 shadow-[0_24px_60px_-30px_rgb(59_42_32/0.45)] md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 md:p-6 max-md:gap-3"
      >
        <h2 id="booking-bar-title" className="font-display text-2xl text-burgundy md:max-w-[9rem] md:leading-tight max-md:text-xl">
          Plan your stay
        </h2>
        <fieldset className="grid gap-3 sm:grid-cols-2 max-md:grid-cols-2 max-md:gap-2">
          <legend className="sr-only">Room type</legend>
          {rooms.map((room) => (
            <label
              key={room.id}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-border bg-cream px-4 py-3 max-md:gap-2 max-md:px-3 max-md:py-2 transition-colors has-[:checked]:border-burgundy has-[:checked]:bg-[#f3e4df] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-burgundy"
            >
              <input
                type="radio"
                name="bar-room"
                value={room.id}
                checked={roomId === room.id}
                onChange={() => setRoomId(room.id)}
                className="size-4 accent-burgundy focus-visible:outline-none"
              />
              <span className="grid">
                <span className="font-semibold text-walnut max-md:text-sm max-md:leading-tight">{room.name}</span>
                <span className="text-sm text-muted-foreground tabular-nums max-md:text-xs">{formatINR(room.rate)} a night</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2">
          <Button type="submit" size="lg" onPointerEnter={preloadBooking} onFocus={preloadBooking} aria-haspopup="dialog">
            <CalendarDays aria-hidden="true" /> Choose Dates
          </Button>
          <p className="text-center text-xs text-muted-foreground">Check-in {hotel.checkIn}</p>
          <p className="text-center text-xs text-walnut">
            {signedIn ? (
              <Link to="/account/bookings" className={inlineLink}>
                My bookings
              </Link>
            ) : (
              <>
                <Link to="/login" className={inlineLink}>
                  Log in
                </Link>{' '}
                to manage your bookings
              </>
            )}
          </p>
        </div>
      </form>
    </section>
  )
}
