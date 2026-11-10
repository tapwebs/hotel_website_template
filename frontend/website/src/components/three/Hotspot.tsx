import { useEffect, useRef, type RefObject } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Box3, Ray, Vector3 } from 'three'
import { cn } from '@/lib/utils'
import type { Hotspot as HotspotData } from './hotspots'

// Building bounding box for raycast occlusion testing
// Matches 20% larger BLDG dimensions [x: -7.2 to 13.8, y: -3.8 to 22.0, z: -24.0 to 4.0]
const BLDG_BOX = new Box3(new Vector3(-7.5, -0.5, -24.5), new Vector3(14.2, 23.0, 4.2))
const hitVec = new Vector3()
const dirVec = new Vector3()
const ray = new Ray()

interface HotspotProps {
  hotspot: HotspotData
  /** Stable element the pin is mounted into. */
  portal: RefObject<HTMLElement | null>
  active: boolean
  onSelect: () => void
}

/**
 * A sleek, modern 3D hotspot pin.
 * Automatically performs line-of-sight occlusion testing against the main building
 * so pins never glitch or render through the building when viewed from the backside or occluded angles.
 */
export function Hotspot({ hotspot, portal, active, onSelect }: HotspotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pinPos = useRef(new Vector3(...hotspot.position))

  useEffect(() => {
    pinPos.current.set(...hotspot.position)
  }, [hotspot.position])

  useFrame(({ camera }) => {
    // Check if the ray from camera to pin intersects the building volume before reaching the pin
    dirVec.subVectors(pinPos.current, camera.position).normalize()
    ray.set(camera.position, dirVec)
    const distToPin = camera.position.distanceTo(pinPos.current)
    const hit = ray.intersectBox(BLDG_BOX, hitVec)

    // If the ray hits the building significantly before reaching the pin, it is blocked
    const isBlocked = hit !== null && camera.position.distanceTo(hit) < distToPin - 0.7
    if (buttonRef.current) {
      buttonRef.current.style.opacity = isBlocked ? '0' : '1'
      buttonRef.current.style.pointerEvents = isBlocked ? 'none' : 'auto'
      buttonRef.current.style.transform = isBlocked ? 'scale(0.7)' : 'scale(1)'
    }
  })

  return (
    <Html
      position={hotspot.position}
      portal={portal as RefObject<HTMLElement>}
      center
      zIndexRange={[25, 10]}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-controls="explorer-panel"
        style={{
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}
        className={cn(
          'group flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold whitespace-nowrap shadow-[0_8px_22px_-6px_rgb(36_24_18/0.5)] transition-all select-none backdrop-blur-md',
          active
            ? 'scale-105 border-gold-soft bg-burgundy text-ivory ring-2 ring-gold/70'
            : 'border-gold/60 bg-ivory/95 text-walnut hover:border-gold hover:bg-ivory hover:scale-105',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative grid size-6 place-items-center rounded-full transition-transform group-hover:scale-110',
            active ? 'bg-gold-soft text-burgundy' : 'bg-burgundy text-gold-soft',
          )}
        >
          <span className={cn('size-2 rounded-full', active ? 'bg-burgundy' : 'bg-gold-soft')} />
          {active ? (
            <span className="absolute -inset-1 animate-ping rounded-full bg-gold/40 opacity-75" />
          ) : null}
        </span>
        <span className="tracking-tight">{hotspot.label}</span>
        {hotspot.comingSoon ? (
          <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-semibold text-walnut uppercase tracking-wider">
            Soon
          </span>
        ) : null}
      </button>
    </Html>
  )
}
