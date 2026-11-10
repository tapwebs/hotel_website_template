import * as React from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/site/features/qrhub/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border bg-card p-4 shadow-xs sm:p-6', className)} {...props} />
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-h2 text-burgundy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const Icon = kind === 'success' ? CheckCircle2 : AlertTriangle
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        kind === 'error' && 'border-destructive/40 bg-destructive/5 text-destructive',
        kind === 'success' && 'border-gold bg-gold-soft/30 text-walnut',
        kind === 'info' && 'border-border bg-muted text-walnut',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl text-burgundy">{value}</p>
    </Card>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const good = value === 'active' || value === 'published'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        good ? 'bg-gold-soft text-ink' : value === 'draft' ? 'bg-muted text-walnut' : 'bg-burgundy/10 text-burgundy',
      )}
    >
      {value}
    </span>
  )
}
