import { useState } from 'react'
import { useLocation } from 'react-router'
import { cn } from '@/lib/utils'
/**
 * Soft fade/rise on route change (CSS animation; reduced motion is handled in index.css).
 * The first (prerendered/hydrated) page never animates, so its HTML is visible before JS.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const [firstPath] = useState(pathname)
  return (
    <div key={pathname} className={cn(pathname !== firstPath && 'animate-page-in')}>
      {children}
    </div>
  )
}
