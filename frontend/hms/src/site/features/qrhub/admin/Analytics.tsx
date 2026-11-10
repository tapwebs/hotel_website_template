import { AnalyticsView } from '@/site/features/qrhub/components/AnalyticsView'
import { PageHeader } from '@/site/features/qrhub/components/common'

export function Component() {
  return (
    <>
      <PageHeader title="Analytics" subtitle="Visits, scans and clicks for the hotel hub." />
      <AnalyticsView />
    </>
  )
}
