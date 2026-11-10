import { Badge } from '@/site/components/ui/badge'
import { cn } from '@/site/lib/utils'
import { paymentLabel, statusLabel, type BookingStatus, type PaymentStatus } from './accountTypes'
const statusStyle: Record<BookingStatus, string> = {
  pending: 'border-gold bg-gold-soft text-ink',
  confirmed: 'bg-burgundy text-ivory',
  cancelled: 'bg-destructive text-white',
  completed: 'border-border bg-cream text-walnut',
}
export const BookingStatusBadge = ({ status }: { status: BookingStatus }) => (
  <Badge className={cn(statusStyle[status])}>{statusLabel[status]}</Badge>
)
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge variant="outline" className="border-border bg-ivory text-walnut">
    {paymentLabel[status]}
  </Badge>
)
