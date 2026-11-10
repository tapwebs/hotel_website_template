import { cn } from '@/site/lib/utils'

export const selectClass =
  'h-11 w-full min-w-0 rounded-md border border-input bg-ivory px-3 text-base text-walnut shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  optional?: boolean
  className?: string
  /** Render prop receives the aria props to spread on the control. */
  children: (aria: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode
}

/** Label above, control, hint, inline error below (linked with aria-describedby). */
export function Field({ id, label, error, hint, optional, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('grid min-w-0 content-start gap-2', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-walnut">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId!}>{error}</FieldError> : null}
    </div>
  )
}

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-sm font-medium text-destructive">
      {children}
    </p>
  )
}
