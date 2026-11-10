import * as React from 'react'
import { cn } from '@/site/features/qrhub/lib/utils'

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-semibold text-walnut', className)} {...props} />
}

const control =
  'h-11 w-full min-w-0 rounded-md border border-input bg-ivory px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(control, className)} {...props} />
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return <input type="checkbox" className={cn('size-5 shrink-0 accent-burgundy', className)} {...props} />
}

/** Label + control + optional hint, wired with htmlFor. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: (id: string) => React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
