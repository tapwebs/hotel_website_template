import React from 'react'
import { CookingPot, Maximize2 as ArrowsOut, Minimize2 as ArrowsIn, Volume2, VolumeX } from 'lucide-react'

import { Button } from '../../../../components/ui/Button'

interface StationOption {
  id: string
  label: string
}

interface KDSHeaderProps {
  availableStations: StationOption[]
  selectedStation: string
  setSelectedStation: (st: string) => void
  isAudioMuted: boolean
  onToggleAudio: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  /** Dream Heavens: extra controls (sound settings, live status) rendered next to the toggles. */
  children?: React.ReactNode
}

export function KDSHeader({
  availableStations,
  selectedStation,
  setSelectedStation,
  isAudioMuted,
  onToggleAudio,
  isFullscreen,
  onToggleFullscreen,
  children,
}: KDSHeaderProps) {
  const canFullscreen = typeof document === 'undefined' || document.fullscreenEnabled !== false
  // Dream Heavens: the page already says "Restaurant & kitchen", so the KDS title is dropped and everything sits on one toolbar row.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {/* Station filter (hidden when the restaurant has a single kitchen station) */}
      <div role="group" aria-label="Kitchen station" hidden={availableStations.length <= 1} className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-gold-soft/20 p-1 no-scrollbar">
        <CookingPot aria-hidden className="mx-1.5 size-4 shrink-0 text-burgundy" />
        {availableStations.map((st) => (
          <button
            key={st.id}
            type="button"
            aria-pressed={selectedStation === st.id}
            onClick={() => setSelectedStation(st.id)}
            className={`min-h-9 shrink-0 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              selectedStation === st.id ? 'bg-ivory text-ink shadow-sm' : 'text-walnut hover:text-ink'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">

        {/* Audio Mute Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleAudio}
          className="px-2.5 text-xs font-semibold gap-1.5 shrink-0 touch:min-w-[44px]"
          title={isAudioMuted ? 'Unmute KDS chime alerts' : 'Mute KDS chime alerts'}
          aria-label={isAudioMuted ? 'Unmute KDS chime alerts' : 'Mute KDS chime alerts'}
        >
          {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
          <span className="hidden min-[26rem]:inline">{isAudioMuted ? 'Muted' : 'Chimes On'}</span>
        </Button>

        {/* Fullscreen Toggle (hidden where the Fullscreen API is unavailable, e.g. iOS Safari) */}
        {canFullscreen && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            className="px-2.5 text-xs font-semibold gap-1.5 shrink-0 touch:min-w-[44px]"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <ArrowsIn className="w-4 h-4" /> : <ArrowsOut className="w-4 h-4" />}
            <span className="hidden min-[26rem]:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </Button>
        )}
        {children}
      </div>
    </div>
  )
}
