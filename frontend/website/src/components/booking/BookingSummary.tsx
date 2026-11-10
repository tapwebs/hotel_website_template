import { formatDate, formatINR } from '@/lib/format'
import type { Room } from '@/data/rooms'
import { ESTIMATE_LABEL, estimateTotal, nightsBetween } from './buildWhatsAppUrl'

interface BookingSummaryProps {
  room: Room
  rooms: number
  checkIn?: Date
  checkOut?: Date
}

/** Live estimate: nights × rate × rooms. Announced politely as it changes. */
export function BookingSummary({ room, rooms, checkIn, checkOut }: BookingSummaryProps) {
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const total = estimateTotal(nights, room.rate, rooms)

  const ready = checkIn && checkOut && nights > 0
  return (
    <div role="group" aria-label="Stay summary" className="on-dark rounded-md bg-walnut p-4 text-cream">
      <div aria-live="polite" className="grid gap-2">
        {ready ? (
          <>
            <p className="text-sm text-cream/85">
              {formatDate(checkIn)} to {formatDate(checkOut)} · {nights} {nights === 1 ? 'night' : 'nights'} · {rooms}{' '}
              {rooms === 1 ? 'room' : 'rooms'}
            </p>
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm text-cream/85">
                {room.name}, {formatINR(room.rate)} / night
              </p>
              <p className="font-display text-2xl font-semibold text-gold-soft tabular-nums">{formatINR(total)}</p>
            </div>
            <p className="text-xs text-cream/80">{ESTIMATE_LABEL}</p>
          </>
        ) : (
          <p className="text-sm text-cream/90">Pick your check-in and check-out dates to see an estimate.</p>
        )}
      </div>
    </div>
  )
}
