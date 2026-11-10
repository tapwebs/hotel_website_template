import { Check, Clock, Copy, Lock, LockOpen, Phone, Sparkles, Trophy } from 'lucide-react'
import { useEffect, useRef, useState, useMemo } from 'react'

import { motion, AnimatePresence } from 'framer-motion'
import type { RewardItem } from '../../../types/customer'
import { soundEffects } from '../../../services/audio/soundEffects'

export interface SpinPrize {
  prizeIndex: number
  prize: {
    id: string
    label: string
    type: 'percent' | 'flat' | 'none' | 'free_item' | 'free_drink' | 'bogo' | 'loyalty'
    value?: number
  }
  coupon?: {
    code: string
    description: string
    expiresAt?: string
  }
}

interface SpinWheelProps {
  locked: boolean
  slices?: RewardItem[]
  onSpin: () => Promise<SpinPrize | null>
  onSpinComplete?: (prize: SpinPrize) => void
}

const DEFAULT_SEGMENTS: RewardItem[] = [
  { id: '1', label: 'Better Luck', emoji: '✨', color: '#475569', textColor: '#ffffff', type: 'none', value: 0, probability: 35 },
  { id: '2', label: '5% Off', emoji: '🏷️', color: '#2563EB', textColor: '#ffffff', type: 'percent', value: 5, probability: 25 },
  { id: '3', label: 'Free Drink', emoji: '🥤', color: '#059669', textColor: '#ffffff', type: 'free_drink', value: 100, probability: 15 },
  { id: '4', label: '₹50 Off', emoji: '💵', color: '#D97706', textColor: '#ffffff', type: 'flat', value: 50, probability: 10 },
  { id: '5', label: 'Free Dessert', emoji: '🍰', color: '#DB2777', textColor: '#ffffff', type: 'free_item', value: 150, probability: 8 },
  { id: '6', label: '10% Off', emoji: '🎉', color: '#7C3AED', textColor: '#ffffff', type: 'percent', value: 10, probability: 5 },
  { id: '7', label: '15% Off', emoji: '🔥', color: '#DC2626', textColor: '#ffffff', type: 'percent', value: 15, probability: 2 },
]

function adjustBrightness(hex: string, percent: number): string {
  if (!hex || hex.charAt(0) !== '#') return hex
  let clean = hex.slice(1)
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('')
  }
  if (clean.length !== 6) return hex
  const num = parseInt(clean, 16)
  let r = (num >> 16) + Math.round((255 * percent) / 100)
  let g = ((num >> 8) & 0x00ff) + Math.round((255 * percent) / 100)
  let b = (num & 0x0000ff) + Math.round((255 * percent) / 100)
  r = Math.min(255, Math.max(0, r))
  g = Math.min(255, Math.max(0, g))
  b = Math.min(255, Math.max(0, b))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

export function SpinWheel({ locked, slices, onSpin, onSpinComplete }: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spinning, setSpinning] = useState(false)
  const [currentDeg, setCurrentDeg] = useState(0)
  const [result, setResult] = useState<SpinPrize | null>(null)
  const [spinDone, setSpinDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [needleTick, setNeedleTick] = useState(false)

  const animFrameRef = useRef<number | null>(null)
  const lastPegIndexRef = useRef<number>(-1)

  const activeSegments = useMemo(() => {
    return slices && slices.length >= 2 ? slices : DEFAULT_SEGMENTS
  }, [slices])

  const numSegments = activeSegments.length
  const segmentAngle = 360 / numSegments
  const DISPLAY_SIZE = 300

  // Draw high-resolution wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1
    canvas.width = DISPLAY_SIZE * dpr
    canvas.height = DISPLAY_SIZE * dpr
    canvas.style.width = `${DISPLAY_SIZE}px`
    canvas.style.height = `${DISPLAY_SIZE}px`

    ctx.save()
    ctx.scale(dpr, dpr)
    drawWheel(ctx, DISPLAY_SIZE, currentDeg, locked)
    ctx.restore()
  }, [currentDeg, locked, activeSegments])

  function drawWheel(ctx: CanvasRenderingContext2D, size: number, rotation: number, isLocked: boolean) {
    const cx = size / 2
    const cy = size / 2
    const rimWidth = 14
    const outerRadius = size / 2 - 2
    const sliceRadius = outerRadius - rimWidth

    ctx.clearRect(0, 0, size, size)

    // Outer drop shadow on the whole wheel disc
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    ctx.fillStyle = isLocked ? '#e5e7eb' : '#1e1b4b'
    ctx.fill()
    ctx.restore()

    // 1. Draw Slices with Radial Depth
    activeSegments.forEach((seg, i) => {
      const startAngle = ((i * segmentAngle - 90 + rotation) * Math.PI) / 180
      const endAngle = (((i + 1) * segmentAngle - 90 + rotation) * Math.PI) / 180

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, sliceRadius, startAngle, endAngle)
      ctx.closePath()

      if (isLocked) {
        ctx.fillStyle = i % 2 === 0 ? '#e2e8f0' : '#cbd5e1'
      } else {
        const baseColor = seg.color || '#3B82F6'
        const radGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, sliceRadius)
        radGrad.addColorStop(0, adjustBrightness(baseColor, 18))
        radGrad.addColorStop(0.65, baseColor)
        radGrad.addColorStop(1, adjustBrightness(baseColor, -18))
        ctx.fillStyle = radGrad
      }
      ctx.fill()

      // Spoke divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      // 2. Text & Emoji Label
      ctx.save()
      ctx.translate(cx, cy)
      const midAngle = ((i * segmentAngle + segmentAngle / 2 - 90 + rotation) * Math.PI) / 180
      ctx.rotate(midAngle)

      // Measure & position text
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.font = `bold ${Math.max(11, Math.min(13, Math.floor(size * 0.042)))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.fillStyle = isLocked ? '#64748b' : seg.textColor || '#ffffff'

      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1

      const words = seg.label.trim().split(' ')
      if (words.length > 2) {
        const line1 = words.slice(0, 2).join(' ')
        const line2 = words.slice(2).join(' ')
        ctx.fillText(line1, sliceRadius * 0.88, -7)
        ctx.fillText(line2, sliceRadius * 0.88, 8)
      } else if (words.length === 2 && seg.label.length > 9) {
        ctx.fillText(words[0], sliceRadius * 0.88, -7)
        ctx.fillText(words[1], sliceRadius * 0.88, 8)
      } else {
        ctx.fillText(seg.label, sliceRadius * 0.88, 0)
      }

      // Draw Emoji
      if (seg.emoji) {
        ctx.shadowColor = 'transparent'
        ctx.font = `${Math.floor(size * 0.065)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
        ctx.fillText(seg.emoji, sliceRadius * 0.44, 0)
      }

      ctx.restore()
    })

    // 3. Luxurious Beveled Metallic Outer Rim
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2)
    ctx.arc(cx, cy, sliceRadius, 0, Math.PI * 2, true)
    ctx.closePath()

    if (isLocked) {
      ctx.fillStyle = '#94a3b8'
      ctx.fill()
    } else {
      const rimGrad = ctx.createLinearGradient(0, 0, size, size)
      rimGrad.addColorStop(0, '#FEF08A')
      rimGrad.addColorStop(0.25, '#F59E0B')
      rimGrad.addColorStop(0.5, '#78350F')
      rimGrad.addColorStop(0.75, '#F59E0B')
      rimGrad.addColorStop(1, '#FEF08A')
      ctx.fillStyle = rimGrad
      ctx.fill()

      ctx.strokeStyle = '#B45309'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.restore()

    // 4. Arcade Lights / Gold Studs around Rim
    const numStuds = Math.max(16, numSegments * 2)
    const studRadius = sliceRadius + rimWidth / 2
    for (let s = 0; s < numStuds; s++) {
      const studAngle = ((s * (360 / numStuds) - 90 + rotation) * Math.PI) / 180
      const sx = cx + studRadius * Math.cos(studAngle)
      const sy = cy + studRadius * Math.sin(studAngle)

      ctx.save()
      ctx.beginPath()
      ctx.arc(sx, sy, 3, 0, Math.PI * 2)
      if (isLocked) {
        ctx.fillStyle = '#cbd5e1'
        ctx.fill()
      } else {
        ctx.shadowColor = '#FDE047'
        ctx.shadowBlur = 3
        ctx.fillStyle = '#FFFBEB'
        ctx.fill()
        ctx.strokeStyle = '#B45309'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
      ctx.restore()
    }

    // 5. Multi-Layer Chrome & Gold 3D Center Hub
    const hubOuterRadius = 38
    const hubInnerRadius = 30

    // Hub Outer Ring (Gold Bevel)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, hubOuterRadius, 0, Math.PI * 2)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    if (isLocked) {
      ctx.fillStyle = '#94a3b8'
    } else {
      const goldGrad = ctx.createLinearGradient(cx - hubOuterRadius, cy - hubOuterRadius, cx + hubOuterRadius, cy + hubOuterRadius)
      goldGrad.addColorStop(0, '#FEF08A')
      goldGrad.addColorStop(0.5, '#D97706')
      goldGrad.addColorStop(1, '#92400E')
      ctx.fillStyle = goldGrad
    }
    ctx.fill()
    ctx.restore()

    // Hub Inner Disc (Dark Brushed Titanium)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, hubInnerRadius, 0, Math.PI * 2)
    const innerGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, hubInnerRadius)
    innerGrad.addColorStop(0, '#1E293B')
    innerGrad.addColorStop(1, '#0F172A')
    ctx.fillStyle = isLocked ? '#64748b' : innerGrad
    ctx.fill()

    ctx.strokeStyle = '#FDE047'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Gold Center Emblem (Star)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = isLocked ? '#cbd5e1' : '#FBBF24'
    ctx.shadowColor = 'rgba(251, 191, 36, 0.5)'
    ctx.shadowBlur = 6
    ctx.fillText('★', cx, cy)

    // Glass Reflection Highlight on top half
    ctx.beginPath()
    ctx.arc(cx, cy, hubInnerRadius - 1, Math.PI, 0)
    const glassGrad = ctx.createLinearGradient(cx, cy - hubInnerRadius, cx, cy)
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = glassGrad
    ctx.fill()
    ctx.restore()
  }

  async function handleSpin() {
    if (locked || spinning || spinDone) return
    setSpinning(true)
    soundEffects.cardFlip()

    const prize = await onSpin()
    if (!prize) {
      setSpinning(false)
      return
    }

    const targetSegmentCenter = prize.prizeIndex * segmentAngle + segmentAngle / 2
    const extraSpins = 6 * 360 // 6 full turns
    const targetDeg = extraSpins + (360 - (targetSegmentCenter % 360))

    const startDeg = currentDeg
    const totalDeg = targetDeg
    const duration = 4400 // ms
    const startTime = performance.now()
    lastPegIndexRef.current = -1

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 4)
    }

    function animate(now: number) {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(t)
      const deg = startDeg + totalDeg * eased
      setCurrentDeg(deg % 360)

      // Mechanical tick and needle flicker as pegs pass
      const pegSpan = 360 / Math.max(16, numSegments * 2)
      const currentPeg = Math.floor(deg / pegSpan)
      if (currentPeg !== lastPegIndexRef.current) {
        lastPegIndexRef.current = currentPeg
        setNeedleTick(true)
        setTimeout(() => setNeedleTick(false), 40)
        soundEffects.spinTick()
      }

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        setCurrentDeg(deg % 360)
        setResult(prize)
        setSpinDone(true)
        setSpinning(false)
        soundEffects.success()
        if (prize) onSpinComplete?.(prize)
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }

  const handleCopyCode = async () => {
    if (!result?.coupon?.code) return
    try {
      await navigator.clipboard.writeText(result.coupon.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {}
  }

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {/* Prize Preview Strip */}
      {!spinDone && (
        <div className="w-full max-w-[340px] text-center space-y-1.5">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5">
            <Sparkles size={13} className="text-amber-500 animate-pulse" />
            <span>Available Rewards</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
            {activeSegments
              .filter((s) => s.type !== 'none')
              .slice(0, 5)
              .map((s, i) => (
                <span
                  key={s.id || i}
                  className="px-2.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/10 text-neutral-800 dark:text-neutral-200 font-semibold border border-amber-500/20 shadow-2xs"
                >
                  {s.label}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Wheel Stage Container */}
      <div className="relative flex flex-col items-center">
        {/* Subtle Ambient Backlight Glow */}
        <div className="absolute inset-0 m-auto w-64 h-64 rounded-full bg-amber-500/15 dark:bg-amber-400/10 blur-2xl pointer-events-none" />

        {/* Precision 3D Faceted Needle Pointer */}
        <div className="relative z-30 -mb-3 flex flex-col items-center pointer-events-none">
          {/* Golden Pivot Mount Pin */}
          <div className="w-5 h-5 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-md border border-amber-300 flex items-center justify-center -mb-1 z-40">
            <div className="w-2 h-2 rounded-full bg-neutral-900 shadow-inner" />
          </div>

          {/* Faceted Ruby Arrow Needle with Twitch Animation */}
          <motion.div
            animate={needleTick ? { rotate: [-10, 8, -4, 0] } : { rotate: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="relative filter drop-shadow-md"
          >
            <svg width="28" height="34" viewBox="0 0 28 34" fill="none">
              {/* Left facet (lighter ruby highlight) */}
              <path
                d="M14 32L3 4C3 4 8 2 14 2V32Z"
                fill={locked ? '#9CA3AF' : 'url(#needle-light)'}
              />
              {/* Right facet (deep crimson shadow) */}
              <path
                d="M14 32L25 4C25 4 20 2 14 2V32Z"
                fill={locked ? '#6B7280' : 'url(#needle-dark)'}
              />
              {/* Gold border contour */}
              <path
                d="M3 4L14 32L25 4C20 2 8 2 3 4Z"
                stroke={locked ? '#4B5563' : '#D97706'}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              {/* Center spine highlight line */}
              <line x1="14" y1="2" x2="14" y2="31" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
              <defs>
                <linearGradient id="needle-light" x1="3" y1="4" x2="14" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#F87171" />
                  <stop offset="1" stopColor="#DC2626" />
                </linearGradient>
                <linearGradient id="needle-dark" x1="14" y1="2" x2="25" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#DC2626" />
                  <stop offset="1" stopColor="#991B1B" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </div>

        {/* Wheel Canvas Canvas Stage */}
        <div className="relative z-10 rounded-full p-1 bg-gradient-to-b from-amber-200/40 via-transparent to-amber-500/20">
          <canvas
            ref={canvasRef}
            className="rounded-full shadow-2xl transition-all duration-500"
            style={{
              filter: locked ? 'grayscale(0.9) brightness(0.9)' : 'none',
            }}
          />

          {/* Lock Overlay */}
          <AnimatePresence>
            {locked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/45 backdrop-blur-xs"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-2 shadow-lg border border-white/30">
                  <Lock className="w-7 h-7 text-white drop-shadow-md" />
                </div>
                <p className="text-white text-xs font-extrabold text-center px-6 leading-tight drop-shadow-md">
                  Opens once your<br />meal is served
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unlock Celebration Flash */}
          <AnimatePresence>
            {!locked && !spinDone && !spinning && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.25, 1] }}
                transition={{ duration: 0.85 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <LockOpen className="w-16 h-16 text-emerald-400 drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Deluxe Spin Action Button */}
      {!spinDone && (
        <button
          onClick={handleSpin}
          disabled={locked || spinning}
          className={`w-full max-w-[290px] h-12 rounded-2xl font-extrabold text-[15px] transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
            locked
              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed shadow-none'
              : spinning
              ? 'bg-neutral-900 text-white opacity-80 cursor-wait'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/30'
          }`}
        >
          {spinning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Spinning the Wheel…
            </span>
          ) : locked ? (
            <span className="flex items-center gap-1.5">
              <Lock size={16} /> Available after your meal is served
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-200" />
              Spin to Win!
            </span>
          )}
        </button>
      )}

      {/* Result Card with Coupon & Copy */}
      <AnimatePresence>
        {result && spinDone && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', bounce: 0.35 }}
            className="w-full max-w-[320px] rounded-2xl overflow-hidden shadow-xl"
          >
            {result.prize.type === 'none' ? (
              <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 text-center space-y-2">
                <p className="text-3xl">✨</p>
                <p className="font-bold text-neutral-800 dark:text-neutral-100 text-base">Better Luck Next Time!</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Thank you for sharing your dining experience with us today.
                </p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-amber-500/10 border border-emerald-500/30 p-5 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-black text-emerald-800 dark:text-emerald-300 text-lg leading-tight">
                    Congratulations! 🎉
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 font-bold text-sm mt-0.5">
                    {result.prize.label}
                  </p>
                </div>

                {result.coupon && (
                  <div className="space-y-2">
                    <div className="bg-white dark:bg-neutral-900 border border-emerald-500/30 rounded-xl p-3 shadow-xs">
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1">
                        Reward Coupon Code
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-black font-mono tracking-widest text-emerald-600 dark:text-emerald-400">
                          {result.coupon.code}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                          title="Copy Code"
                        >
                          {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-emerald-700 active:scale-98 transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check size={15} /> Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy size={15} /> Copy & Save to Phone
                        </>
                      )}
                    </button>

                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                      {result.coupon.description}
                    </p>
                    {result.coupon.expiresAt && (
                      <div className="flex items-center justify-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <Clock size={12} />
                        <span>
                          Valid until {new Date(result.coupon.expiresAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-neutral-400 pt-1">
                  Applicable on your next visit or online order
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
