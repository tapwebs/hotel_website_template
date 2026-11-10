import { Badge } from '@/site/components/ui/badge'
import { cn } from '@/site/lib/utils'
import type { Role, Status } from './adminTypes'

const roleStyle: Record<Role, string> = {
  admin: 'bg-burgundy text-ivory',
  staff: 'bg-gold-soft text-ink',
  guest: 'border-border bg-cream text-walnut',
}
export const RoleBadge = ({ role }: { role: Role }) => <Badge className={cn('capitalize', roleStyle[role])}>{role}</Badge>

export const StatusBadge = ({ status }: { status: Status }) => (
  <Badge className={cn('capitalize', status === 'active' ? 'border-gold bg-ivory text-walnut' : 'bg-destructive text-white')}>
    <span aria-hidden="true" className={cn('size-1.5 rounded-full', status === 'active' ? 'bg-gold' : 'bg-white')} />
    {status}
  </Badge>
)
