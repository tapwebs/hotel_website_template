import { Button } from '@/components/ui/button'
import type { RoomId } from '@/data/rooms'
import { useBooking } from './booking-context'

type ButtonProps = React.ComponentProps<typeof Button>

interface BookNowButtonProps extends Omit<ButtonProps, 'onClick' | 'asChild'> {
  roomId?: RoomId
}

/** Opens the global booking sheet. Preloads the form chunk on hover/focus. */
export function BookNowButton({ roomId, children = 'Book Now', ...props }: BookNowButtonProps) {
  const { openBooking, preloadBooking } = useBooking()
  return (
    <Button
      type="button"
      aria-haspopup="dialog"
      onPointerEnter={preloadBooking}
      onFocus={preloadBooking}
      onClick={() => openBooking({ roomId })}
      {...props}
    >
      {children}
    </Button>
  )
}
