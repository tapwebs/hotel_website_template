import { createContext, useContext } from 'react'
import { useAdminStats, type Resource } from './useAdminData'
import type { AdminStats } from './adminTypes'

export interface AdminOutletContext {
  stats: Resource<AdminStats>
}
const Ctx = createContext<AdminOutletContext | null>(null)

/** Loads the website numbers once and shares them with the website screens inside it (cached, so extra providers are cheap). */
export function WebsiteProvider({ children }: { children: React.ReactNode }) {
  const stats = useAdminStats()
  return <Ctx.Provider value={{ stats }}>{children}</Ctx.Provider>
}

export function useWebsite(): AdminOutletContext {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWebsite must be used inside <WebsiteProvider>')
  return v
}
