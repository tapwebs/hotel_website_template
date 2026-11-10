import { useState } from 'react'
import { Picture } from '@/components/Picture'
import { images } from '@/data/images'
import { HotspotList } from './HotspotList'
import type { HotspotId } from './hotspots'

/** Static illustration + the same hotspot list, for no-WebGL, reduced motion or Save-Data. */
export function ExplorerFallback() {
  const [selected, setSelected] = useState<HotspotId | null>(null)
  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <Picture
        image={images.home.explorerFallback}
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="aspect-[16/10] overflow-hidden rounded-md bg-muted"
      />
      <HotspotList selected={selected} onSelect={setSelected} />
    </div>
  )
}
