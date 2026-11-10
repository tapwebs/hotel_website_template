import { useParams, useSearchParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Loading, Notice, PageHeader, StatusBadge } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { HOTEL_SLUG } from '@/site/features/qrhub/lib/paths'
import { hubPath } from '@/site/features/qrhub/lib/qrUrl'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { cn } from '@/site/features/qrhub/lib/utils'
import { LinksTab } from './tabs/LinksTab'
import { OffersTab } from './tabs/OffersTab'
import { ProfileTab } from './tabs/ProfileTab'

const TABS = ['Profile', 'Links', 'Offers'] as const
type Tab = (typeof TABS)[number]

export function Component() {
  const { slug = HOTEL_SLUG } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.toLowerCase() === sp.get('tab')) ?? 'Profile'
  const { data: ws, error, loading, reload } = useLoad(() => api.getWorkspace(slug), [slug])

  if (loading && !ws) return <Loading />
  if (error || !ws) return <Notice kind="error">{error ?? 'Not found.'}</Notice>
  const org = ws.organization

  return (
    <>
      <PageHeader
        title="Hotel page"
        subtitle="What guests see after scanning: details, links and offers."
        actions={
          <>
            <StatusBadge value={org.qr_status} />
            <Button asChild variant="outline" size="sm">
              <a href={hubPath(org.slug)} target="_blank" rel="noreferrer">
                <ExternalLink /> Preview hub
              </a>
            </Button>
          </>
        }
      />
      <div role="tablist" aria-label="Hotel hub sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={t === tab}
            aria-controls="tab-panel"
            type="button"
            onClick={() => setSp({ tab: t.toLowerCase() }, { replace: true })}
            className={cn(
              'min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors',
              t === tab ? 'border-burgundy text-burgundy' : 'border-transparent text-muted-foreground hover:text-walnut',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'Profile' && <ProfileTab ws={ws} reload={reload} />}
        {tab === 'Links' && <LinksTab ws={ws} reload={reload} />}
        {tab === 'Offers' && <OffersTab ws={ws} reload={reload} />}
      </div>
    </>
  )
}
