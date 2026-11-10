import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { RotateCcw, Play, Pause, Maximize2, Minimize2 } from 'lucide-react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { play } from '@/lib/sounds'
import { HotelModel } from './HotelModel'
import { Hotspot } from './Hotspot'
import { HotspotList } from './HotspotList'
import { hotspots, type HotspotId } from './hotspots'

// Home Camera & Target framing the +20% larger hotel and 2X lawn
const HOME_CAMERA = new Vector3(24, 38, 52)
const HOME_TARGET = new Vector3(-11, 6.0, -1)

const PILL_LABELS: Record<HotspotId, string> = {
  rooms: 'Rooms',
  restaurant: 'Dining',
  banquet: 'Banquet',
  lawn: '2X Lawn',
  pool: 'Pool',
  ev: 'EV',
}

/** Smoothly flies the camera to the selected hotspot or back to overview. */
function CameraRig({ selected }: { selected: HotspotId | null }) {
  const controls = useThree((s) => s.controls) as { target: Vector3; update: () => void } | null
  const invalidate = useThree((s) => s.invalidate)
  const target = useRef(new Vector3())
  const camGoal = useRef(new Vector3())
  const last = useRef<HotspotId | null | undefined>(undefined)
  const flying = useRef(false)

  useFrame(({ camera }, delta) => {
    if (last.current !== selected) {
      last.current = selected
      const h = hotspots.find((x) => x.id === selected)
      camGoal.current.copy(h ? new Vector3(...h.camera) : HOME_CAMERA)
      target.current.copy(h ? new Vector3(...(h.target ?? h.position)) : HOME_TARGET)
      flying.current = true
    }
    if (!flying.current || !controls) return
    const k = 1 - Math.exp(-delta * 4.0)
    camera.position.lerp(camGoal.current, k)
    controls.target.lerp(target.current, k)
    controls.update()
    if (camera.position.distanceTo(camGoal.current) < 0.05) {
      flying.current = false
    } else {
      invalidate()
    }
  })
  return null
}

export default function PropertyExplorer({ inView }: { inView: boolean }) {
  const [selected, setSelected] = useState<HotspotId | null>(null)
  const [autoRotateUser, setAutoRotateUser] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const coarse = useMediaQuery('(pointer: coarse)')

  // User-driven view changes (pins, pills, model clicks, reset) whoosh; the list plays its own.
  const choose = (id: HotspotId | null) => {
    play('whoosh')
    setSelected(id)
  }
  // Idle drift only while visible, autoRotate enabled, and nothing is selected
  const idle = inView && selected === null && autoRotateUser

  // Pin portal layer element mounted into stable state
  const [pinLayer, setPinLayer] = useState<HTMLDivElement | null>(null)
  const portal = useMemo(() => (pinLayer ? { current: pinLayer } : null), [pinLayer])

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    play('tick')
    if (!isFullscreen) {
      if (pinLayer?.requestFullscreen) {
        pinLayer.requestFullscreen().catch(() => setIsFullscreen(true))
      }
      setIsFullscreen(true)
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => setIsFullscreen(false))
      }
      setIsFullscreen(false)
    }
  }, [isFullscreen, pinLayer])

  // Sync fullscreen change with native Esc key or browser controls
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div
        ref={setPinLayer}
        className={cn(
          'relative overflow-hidden rounded-xl border border-gold/40 bg-[radial-gradient(circle_at_70%_20%,#fef9ee,#eadcca)] shadow-2xl transition-all duration-300',
          isFullscreen
            ? 'fixed inset-0 z-50 h-screen w-screen rounded-none border-none'
            : 'aspect-[4/5] sm:aspect-[16/10]',
        )}
      >
        <p className="sr-only">
          An interactive 3D model of TapMenu Grand Resort & Spa. Features the taller &amp; larger main building with upper floor rooms, ground floor
          restaurant, basement banquet hall, and expansive 2X function lawn with wedding mandap and fountain.
        </p>

        {/* Floating Top-Right Controls: Fullscreen, Auto-Rotate & Reset */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-full border border-gold/40 bg-ivory/95 p-1.5 shadow-lg backdrop-blur-md">
          {/* Bigger Screen / Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Open Big Screen Mode'}
            title={isFullscreen ? 'Exit Fullscreen' : 'Big Screen View'}
            className="flex items-center gap-1.5 rounded-full bg-burgundy px-3 py-1 text-xs font-semibold text-ivory shadow-sm transition-all hover:bg-burgundy-deep hover:scale-105 active:scale-95"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="size-3.5" />
                <span className="hidden sm:inline">Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                <span>Big Screen</span>
              </>
            )}
          </button>

          {/* Auto-Rotate Play/Pause */}
          <button
            type="button"
            onClick={() => {
              play('tick')
              setAutoRotateUser(!autoRotateUser)
            }}
            aria-label={autoRotateUser ? 'Pause rotation' : 'Start rotation'}
            title={autoRotateUser ? 'Pause rotation' : 'Start rotation'}
            className={cn(
              'grid size-8 place-items-center rounded-full transition-colors',
              autoRotateUser ? 'bg-gold/25 text-walnut' : 'text-walnut/60 hover:text-walnut',
            )}
          >
            {autoRotateUser ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>

          {/* Reset Overview Camera */}
          {selected !== null ? (
            <button
              type="button"
              onClick={() => choose(null)}
              aria-label="Reset view to overview"
              title="Reset View"
              className="grid size-8 place-items-center rounded-full bg-gold/15 text-burgundy transition-colors hover:bg-burgundy hover:text-ivory"
            >
              <RotateCcw className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Quick Area Pill Selector Bar at Top-Left */}
        <div className="absolute top-3 left-3 z-30 hidden items-center gap-1 rounded-full border border-gold/40 bg-ivory/90 p-1 shadow-md backdrop-blur-md sm:flex">
          <button
            type="button"
            onClick={() => choose(null)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
              selected === null ? 'bg-burgundy text-ivory' : 'text-walnut hover:text-burgundy',
            )}
          >
            Overview
          </button>
          {hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => choose(selected === h.id ? null : h.id)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                selected === h.id ? 'bg-burgundy text-ivory' : 'text-walnut hover:text-burgundy',
              )}
            >
              {PILL_LABELS[h.id]}
            </button>
          ))}
        </div>

        {/* Progressive Loading Fallback Overlay */}
        {!isCanvasReady && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_70%_20%,#fef9ee,#eadcca)] transition-opacity duration-300">
            <div className="flex items-center gap-2.5 rounded-full border border-gold/40 bg-ivory/90 px-4 py-2 text-xs font-semibold text-walnut shadow-sm backdrop-blur-sm">
              <span className="size-3.5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              <span>Preparing 3D View...</span>
            </div>
          </div>
        )}

        {/* 3D WebGL Canvas: Daylight Only with Logarithmic Depth Buffer */}
        <Canvas
          dpr={[1, 1.5]}
          frameloop={idle ? 'always' : 'demand'}
          performance={{ min: 0.5 }}
          onCreated={() => setIsCanvasReady(true)}
          camera={{ position: HOME_CAMERA.toArray(), fov: 36, near: 0.5, far: 350 }}
          gl={{
            antialias: true,
            logarithmicDepthBuffer: true,
            powerPreference: 'high-performance',
          }}
        >
          {/* Pure Daylight Illumination */}
          <hemisphereLight args={['#fffbf2', '#867258', 2.1]} />
          <directionalLight position={[-22, 34, 26]} intensity={2.9} color="#fff1db" />
          <directionalLight position={[26, 16, -16]} intensity={0.85} color="#c8dbff" />

          {/* Detailed 3D Model with Click Interaction */}
          <HotelModel onSelectArea={(id) => choose(selected === id ? null : id)} />

          {/* Occluded, uncluttered Hotspots */}
          {portal
            ? hotspots.map((h) => (
                <Hotspot
                  key={h.id}
                  hotspot={h}
                  portal={portal}
                  active={selected === h.id}
                  onSelect={() => choose(selected === h.id ? null : h.id)}
                />
              ))
            : null}

          {/* Fully Unrestricted, Free-Moving Controls */}
          <OrbitControls
            makeDefault
            target={HOME_TARGET.toArray()}
            enablePan={true}
            screenSpacePanning={true}
            enableZoom={true}
            enableRotate={!coarse}
            panSpeed={1.2}
            rotateSpeed={0.9}
            zoomSpeed={1.0}
            minDistance={8}
            maxDistance={150}
            minPolarAngle={0.05}
            maxPolarAngle={1.52}
            enableDamping={true}
            dampingFactor={0.06}
            autoRotate={idle}
            autoRotateSpeed={0.35}
          />
          <CameraRig selected={selected} />
        </Canvas>

        {/* Bottom Status / Instructions Badge */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
          <p className="rounded-sm bg-ink/75 px-2.5 py-1 text-xs font-medium text-ivory backdrop-blur-sm">
            Drag to rotate • Right-click / 2 fingers to pan • Scroll to zoom
          </p>
        </div>
      </div>

      {/* Accessible Hotspot List & Interactive Detail Drawer */}
      <HotspotList selected={selected} onSelect={setSelected} />
    </div>
  )
}
