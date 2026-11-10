import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { play, setMuted, useMuted } from '@/lib/sounds'

/** Mutes or unmutes the small interface sounds. The choice is remembered in localStorage. */
export function SoundToggle() {
  const muted = useMuted()
  const Icon = muted ? VolumeX : Volume2
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      sound={false}
      aria-label="Mute sounds"
      aria-pressed={muted}
      title={muted ? 'Sounds off' : 'Sounds on'}
      onClick={() => {
        setMuted(!muted)
        if (muted) play('tick')
      }}
      className="size-11 text-burgundy hover:bg-gold-soft/40"
    >
      <Icon className="size-5" aria-hidden="true" />
    </Button>
  )
}
