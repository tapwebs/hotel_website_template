import { useNavigate } from 'react-router'
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { hotel } from '@/data/hotel'
import { formatINR } from '@/lib/format'
import { draftToSearch, type BookingDraft } from '@/features/reserve/draft'
import { BookingContext, loadBookingForm, type BookingPrefill } from './booking-context'

const BookingForm = lazy(loadBookingForm)

/** Global booking sheet. Any "Book Now" calls openBooking(); the form chunk loads on demand. */
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const [prefill, setPrefill] = useState<BookingPrefill>({})
  // Bump on every open so the form remounts with the new prefill and a clean state.
  const [session, setSession] = useState(0)
  // No Radix trigger here, so remember the opener and hand focus back on close.
  const opener = useRef<HTMLElement | null>(null)

  const openBooking = useCallback((p: BookingPrefill = {}) => {
    opener.current = document.activeElement as HTMLElement | null
    setPrefill(p)
    setSession((n) => n + 1)
    setOpen(true)
  }, [])
  // The selection travels in the URL, so it survives login/signup (see features/reserve/draft.ts).
  const reserveOnline = useCallback(
    (draft: BookingDraft) => {
      opener.current = null
      setOpen(false)
      void navigate(`/book?${draftToSearch(draft)}`)
    },
    [navigate],
  )
  const preloadBooking = useCallback(() => void loadBookingForm(), [])
  const value = useMemo(() => ({ openBooking, preloadBooking }), [openBooking, preloadBooking])

  return (
    <BookingContext value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            opener.current?.focus()
          }}
        >
          <SheetHeader className="border-b border-border px-6 pt-6 pb-5 pr-16">
            <SheetTitle className="font-display text-h3 font-medium text-burgundy">Request a room</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Rooms from {formatINR(hotel.priceFrom)} a night. Check-in and check-out at {hotel.checkIn}.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-6">
            <Suspense fallback={<FormSkeleton />}>
              <BookingForm key={session} defaultRoomId={prefill.roomId} idPrefix="sheet" onReserveOnline={reserveOnline} />
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
    </BookingContext>
  )
}

export function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading the booking form…">
      <div className="h-80 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-11 animate-pulse rounded-md bg-muted" />
        <div className="h-11 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-36 animate-pulse rounded-md bg-walnut/15" />
    </div>
  )
}
