import { useEffect } from 'react'
import { useLocation } from 'react-router'

// The HMS app hosts the staff screens. Dev: its own port. Production: the staff console host (override with VITE_HMS_APP_URL).
const HMS_APP = ((import.meta.env.VITE_HMS_APP_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:5174' : 'https://hms.hoteldreamheavens.in')).replace(/\/+$/, '')

/** /admin/... -> <HMS app>/app/admin/...; /app/... -> <HMS app>/app/... (same sub-path and query). */
export function AdminRedirect() {
  const { pathname, search } = useLocation()
  const target = `${HMS_APP}${pathname.replace(/^\/admin/, '/app/admin')}${search}`
  useEffect(() => window.location.replace(target), [target])
  return (
    <p role="status" className="p-8 text-center text-walnut">
      Opening the staff console… <a className="font-semibold text-burgundy underline" href={target}>Continue</a>
    </p>
  )
}
