import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
/** Password field with a show/hide toggle. Spread react-hook-form `register()` and the Field aria props. */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={shown ? 'text' : 'password'} className="h-12 pr-12" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-md text-walnut focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {shown ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  )
}
