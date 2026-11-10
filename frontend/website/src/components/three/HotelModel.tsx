import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ContactShadows } from '@react-three/drei'
import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import type { HotspotId } from './hotspots'

// Architectural Levels (y = 0 is grade/ground level)
// Building increased by +20% in height, width, and depth!
const BASEMENT = -3.8
const PLINTH = 1.25
const L1 = 5.8      // Ground floor (Restaurant & Grand Reception Lobby) ceiling
const L2 = 9.8      // 1st floor slab (Deluxe Rooms)
const L3 = 13.8     // 2nd floor slab (Super Deluxe Rooms)
const L4 = 17.8     // 3rd floor slab (Royal Suites)
const ROOF = 21.6   // 4th floor / Rooftop Sky Lounge & Viewing Terrace
const TOWER_TOP = 25.5 // Walnut Sign Tower & Parapet Crest

// Site Boundaries
// Expansive, solid grounds with continuous foundation plinth:
// - BUILDING: +20% bigger footprint [x: -7.2 to 13.8, z: -24.0 to 3.8]
// - LAWN: Expansive 2X lawn [x: -56.0 to -7.5, z: -24.0 to 6.0]
// - BASE: Continuous solid architectural terrain slab [y: -4.2 to -0.05]
// - BOUNDARIES: Crisp continuous perimeter walls with zero gaps or clipping
const SITE = { x: [-58.0, 28.0] as R, z: [-28.0, 22.0] as R }
const BLDG = { x: [-7.2, 13.8] as R, z: [-24.0, 3.8] as R }
const COURT = { x: [8.0, 13.5] as R, z: [3.8, 9.2] as R } // sunken court for basement banquet entrance
const LAWN = { x: [-56.0, -7.5] as R, z: [-24.0, 6.0] as R } // 2X Lawn
const POOL = { x: [16.0, 25.0] as R, z: [-14.0, -5.0] as R } // Luxury pool
const EV = { x: [15.5, 22.0] as R, z: [7.0, 13.5] as R }     // EV charging

type R = [number, number]
type V3 = [number, number, number]

// Reusable primitive geometries
const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(0.5, 0.5, 1, 24)
const BALL = new SphereGeometry(0.5, 12, 10)
const BLOB = new IcosahedronGeometry(0.5, 1)
const PYRAMID = new ConeGeometry(0.5, 1, 4)
const PARASOL = new ConeGeometry(0.5, 1, 12)
const DISC = new CircleGeometry(0.5, 48)
const PLANE = new PlaneGeometry(1, 1)

const std = (color: string, extra: MeshStandardMaterialParameters = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.8, ...extra })

// Module-level permanent materials (Pure luxurious daylight, ZERO re-instantiation churn)
const M = {
  // Solid architectural model base & ground terrain
  foundation: std('#322e29', { roughness: 0.95 }),
  podiumBevel: std('#1c1916', { roughness: 0.9 }),
  groundSoil: std('#443c33', { roughness: 1.0 }),

  // Paving & Ground
  paving: std('#ded5c5', { roughness: 0.9 }),
  kerb: std('#beb4a4', { roughness: 0.7 }),
  asphalt: std('#56524b', { roughness: 0.95 }),
  roadLine: std('#ffffff', { roughness: 0.5 }),
  graniteSteps: std('#1e1e1e', { roughness: 0.35, metalness: 0.2 }),
  terrace: std('#d7cec0', { roughness: 0.65 }),
  courtStone: std('#756e64', { roughness: 0.8 }),
  plinth: std('#2c2825', { roughness: 0.5 }),

  // Building walls & Facade
  wallCream: std('#ede5d4', { roughness: 0.75 }),
  wallTan: std('#c89e5c', { roughness: 0.55 }),
  stoneCorner: std('#867f74', { roughness: 0.65 }),
  walnut: std('#553926', { roughness: 0.65 }),
  walnutDeep: std('#2b1c13', { roughness: 0.55 }),
  woodUnderside: std('#7c502d', { roughness: 0.7 }),
  gold: std('#c99f48', { metalness: 0.6, roughness: 0.3 }),
  goldBright: std('#ebc46a', { metalness: 0.7, roughness: 0.2 }),
  burgundy: std('#681b26', { roughness: 0.55 }),

  // Glazing
  glassBlue: new MeshStandardMaterial({
    color: '#28589e',
    metalness: 0.55,
    roughness: 0.1,
    emissive: '#112b54',
    emissiveIntensity: 0.45,
  }),
  glassClear: new MeshStandardMaterial({
    color: '#dbeaf5',
    transparent: true,
    opacity: 0.32,
    roughness: 0.08,
    depthWrite: false,
  }),
  glassLightBlue: new MeshStandardMaterial({
    color: '#3b78be',
    metalness: 0.4,
    roughness: 0.15,
  }),
  frame: std('#1f1c19', { roughness: 0.45 }),

  // Interior & Lighting
  interiorWarm: std('#fce5b5', { emissive: '#e29738', emissiveIntensity: 0.8 }),
  interiorWall: std('#e8d8be', { roughness: 0.8 }),
  glow: new MeshBasicMaterial({ color: '#fff0cb' }),
  glowWarm: new MeshBasicMaterial({ color: '#ffda8b' }),
  marble: std('#f2ede4', { roughness: 0.2, metalness: 0.1 }),
  floorWood: std('#aa7845', { roughness: 0.6 }),
  linen: std('#f8f4ec', { roughness: 0.85 }),

  // Landscape
  lawn: std('#6b8d42', { roughness: 1 }),
  lawnStripe: std('#77994c', { roughness: 1 }),
  hedge: std('#4b6732', { roughness: 0.95, flatShading: true }),
  palm: std('#588939', { roughness: 0.85, flatShading: true }),
  leafLight: std('#749948', { roughness: 0.9, flatShading: true }),
  trunk: std('#4a3322', { roughness: 0.9 }),
  planter: std('#221e1b', { roughness: 0.6 }),

  // Pool & EV
  water: new MeshStandardMaterial({
    color: '#2ea1cf',
    roughness: 0.06,
    metalness: 0.1,
    emissive: '#125c80',
    emissiveIntensity: 0.45,
  }),
  poolDeck: std('#e8e0d2', { roughness: 0.7 }),
  poolTile: std('#19769f', { roughness: 0.2 }),
  evGreen: new MeshBasicMaterial({ color: '#32e078' }),
  evPaint: std('#3da868', { roughness: 0.7 }),
  solar: new MeshStandardMaterial({ color: '#25374d', metalness: 0.65, roughness: 0.2 }),

  // Vehicles
  carWhite: std('#f0f2f5', { metalness: 0.35, roughness: 0.25 }),
  carNavy: std('#1b3154', { metalness: 0.5, roughness: 0.25 }),
  carGrey: std('#4f555d', { metalness: 0.45, roughness: 0.3 }),
  carRed: std('#7d1d28', { metalness: 0.4, roughness: 0.3 }),
  tyre: std('#1c1917', { roughness: 0.85 }),
  carGlass: std('#1f2933', { roughness: 0.1, metalness: 0.2 }),
}

export interface HotelModelProps {
  onSelectArea?: (id: HotspotId) => void
}

export function HotelModel({ onSelectArea }: HotelModelProps) {
  return (
    <group>
      <Site />
      <HotelBuilding onSelect={onSelectArea} />
      <FunctionLawn onSelect={onSelectArea} />
      <PoolArea onSelect={onSelectArea} />
      <EvChargingStation onSelect={onSelectArea} />

      {/* Realistic Parked Cars in the spacious front parking forecourt */}
      <Car x={-16.0} z={11.0} color={M.carWhite} isSuv={true} />
      <Car x={-10.5} z={11.0} color={M.carNavy} />
      <Car x={-5.0} z={11.0} color={M.carGrey} />
      <Car x={2.5} z={11.0} color={M.carRed} />

      {/* Contact Shadow sized to full 2X grounds */}
      <ContactShadows
        position={[(SITE.x[0] + SITE.x[1]) / 2, 0.082, (SITE.z[0] + SITE.z[1]) / 2]}
        scale={[SITE.x[1] - SITE.x[0], SITE.z[1] - SITE.z[0]]}
        opacity={0.38}
        blur={2.4}
        far={15}
        frames={1}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Helpers

const range = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i))

interface Item {
  p: V3
  s?: V3
  r?: V3
}

const ext = (x: R, y: R, z: R): Item => ({
  p: [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2],
  s: [x[1] - x[0], y[1] - y[0], z[1] - z[0]],
})

function Box({
  x,
  y,
  z,
  m,
  onClick,
}: {
  x: R
  y: R
  z: R
  m: Material
  onClick?: () => void
}) {
  const { p, s } = ext(x, y, z)
  return (
    <mesh
      geometry={BOX}
      material={m}
      position={p}
      scale={s}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation()
          onClick()
        }
      }}
    />
  )
}

function Many({ items, g = BOX, m }: { items: readonly Item[]; g?: BufferGeometry; m: Material }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.scale.set(...(it.s ?? [1, 1, 1]))
      const [rx, ry, rz] = it.r ?? [0, 0, 0]
      o.rotation.set(rx, ry, rz, 'YXZ')
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[g, m, items.length]} />
}

function festoon(from: V3, to: V3, count: number, sag: number): Item[] {
  return range(count, (i) => {
    const t = (i + 0.5) / count
    return {
      p: [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t - Math.sin(Math.PI * t) * sag,
        from[2] + (to[2] - from[2]) * t,
      ],
      s: [0.18, 0.18, 0.18],
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Procedural Canvas Textures for Signage, Brand Logos, and Paver Patterns

const SIGN_FONTS = [
  '700 40px Montserrat',
  '700 40px Manrope',
  '600 40px "Cormorant Garamond"',
  'italic 600 44px "Cormorant Garamond"',
]

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function useCanvasTexture(draw: Draw, w: number, h: number, repeat?: [number, number]): CanvasTexture | null {
  const [texture, setTexture] = useState<CanvasTexture | null>(null)
  useEffect(() => {
    let live = true
    let made: CanvasTexture | undefined
    const paint = () => {
      if (!live) return
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      draw(ctx, w, h)
      made = new CanvasTexture(canvas)
      made.colorSpace = SRGBColorSpace
      made.anisotropy = 4
      if (repeat) {
        made.wrapS = RepeatWrapping
        made.wrapT = RepeatWrapping
        made.repeat.set(repeat[0], repeat[1])
      }
      setTexture(made)
    }
    void Promise.allSettled(SIGN_FONTS.map((f) => document.fonts.load(f))).then(paint)
    return () => {
      live = false
      made?.dispose()
    }
  }, [draw, w, h, repeat])
  return texture
}

/** Vertical walnut tower sign: HOTEL / DREAM HEAVENS (vertical gold) / & / RESTAURANT */
const drawSignColumn: Draw = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, '#2e1c12')
  g.addColorStop(0.5, '#4e3321')
  g.addColorStop(1, '#2e1c12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Vertical wood slat lines
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 3
  for (let x = 16; x < w; x += 22) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // "HOTEL" at top
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 42px Montserrat, Manrope, sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 8
  ctx.fillText('HOTEL', w / 2, 80)

  // "DREAM HEAVENS" stacked vertically in bright gold with 3D drop shadow
  ctx.fillStyle = '#f7cb59'
  ctx.font = '800 78px Montserrat, Manrope, sans-serif'
  const letters = 'DREAMHEAVENS'.split('')
  const startY = 200
  const letterSpacing = (h - 380) / letters.length
  letters.forEach((ch, i) => {
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 3
    ctx.fillText(ch, w / 2, startY + i * letterSpacing)
  })

  // "& RESTAURANT" at the bottom
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.shadowBlur = 6
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 58px Montserrat, Manrope, sans-serif'
  ctx.fillText('&', w / 2, h - 110)
  ctx.font = '700 28px Montserrat, Manrope, sans-serif'
  ctx.fillText('RESTAURANT', w / 2, h - 50)
}

/** Top script fascia board: "Hotel Dream Heavens" */
const drawGlassBand: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#1c140f'
  ctx.fillRect(0, 0, w, h)

  // Gold ornamental border
  ctx.strokeStyle = '#c99f48'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, w - 20, h - 20)

  // Side decorative gold medallions
  ctx.fillStyle = '#ebc46a'
  for (const x of [90, w - 90]) {
    ctx.beginPath()
    ctx.arc(x, h / 2, 36, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#352317'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'italic 600 108px "Cormorant Garamond", Georgia, serif'
  ctx.fillStyle = '#fae19c'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 10
  ctx.fillText('Hotel Dream Heavens', w / 2, h / 2 + 4)
}

/** Round DH DREAM HEAVENS medallion badge */
const drawBadge: Draw = (ctx, w, h) => {
  const cx = w / 2
  const cy = h / 2

  // Outer dark mahogany/walnut wood bezel
  ctx.fillStyle = '#382114'
  ctx.beginPath()
  ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2)
  ctx.fill()

  // Wood grain rings
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 2
  for (let r = cx - 18; r < cx - 4; r += 4) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Outer gold metallic bevel
  ctx.strokeStyle = '#c99f48'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(cx, cy, cx - 20, 0, Math.PI * 2)
  ctx.stroke()

  // Inner white ivory disc
  ctx.fillStyle = '#faf8f2'
  ctx.beginPath()
  ctx.arc(cx, cy, cx - 26, 0, Math.PI * 2)
  ctx.fill()

  // Gold inner trim
  ctx.strokeStyle = '#deb765'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, cy, cx - 32, 0, Math.PI * 2)
  ctx.stroke()

  // "DH" Monogram
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '800 125px Montserrat, Manrope, sans-serif'

  // Gold 'D'
  ctx.fillStyle = '#caa34e'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 4
  ctx.fillText('D', cx - 38, cy - 22)

  // Navy 'H'
  ctx.fillStyle = '#162238'
  ctx.fillText('H', cx + 36, cy - 22)

  // Gold swoosh arc with 4-point star
  ctx.strokeStyle = '#d4ad52'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.arc(cx, cy - 10, 70, 0.45 * Math.PI, 1.85 * Math.PI, false)
  ctx.stroke()

  // Star sparkle
  ctx.fillStyle = '#ebc46a'
  const sx = cx + 60
  const sy = cy - 80
  ctx.beginPath()
  ctx.arc(sx, sy, 8, 0, Math.PI * 2)
  ctx.fill()

  // "DREAM HEAVENS" bold serif text
  ctx.shadowBlur = 0
  ctx.fillStyle = '#111827'
  ctx.font = '800 32px "Cormorant Garamond", Georgia, serif'
  ctx.fillText('D R E A M', cx, cy + 50)
  ctx.font = '800 38px "Cormorant Garamond", Georgia, serif'
  ctx.fillText('HEAVENS', cx, cy + 86)
}

/** "COMING SOON" luxury preview badge */
const drawComingSoon: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#181410'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#c99f48'
  ctx.lineWidth = 5
  ctx.strokeRect(6, 6, w - 12, h - 12)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 40px Montserrat, sans-serif'
  ctx.fillStyle = '#fce4a6'
  ctx.fillText('COMING SOON', w / 2, h / 2)
}

function Painted({
  draw,
  w,
  h,
  p,
  s,
  geometry = PLANE,
  emissiveIntensity = 0.45,
}: {
  draw: Draw
  w: number
  h: number
  p: V3
  s: V3
  geometry?: BufferGeometry
  emissiveIntensity?: number
}) {
  const map = useCanvasTexture(draw, w, h)
  if (!map) return null
  return (
    <mesh geometry={geometry} position={p} scale={s}>
      <meshStandardMaterial
        map={map}
        emissiveMap={map}
        emissive="#ffffff"
        emissiveIntensity={emissiveIntensity}
        roughness={0.4}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------------------------
// Site: Strictly Layered Elevations (ZERO Z-FIGHTING / BUFFERING on car parking or road)
// Layer heights:
// Foundation: [-4.2, -0.05]
// Asphalt Road: [-0.04, 0.05]
// Paving: [-0.04, 0.08]
// Road Lines: [0.054, 0.062]
// Parking Bay Lines: [0.084, 0.092]
// Kerb: [-0.04, 0.22]

const [SX0, SX1] = SITE.x
const [SZ0, SZ1] = SITE.z
const FORECOURT_Z: R = [3.8, 15.5]
const ROAD_Z: R = [15.5, SZ1]

// Parking bays layout in the front forecourt
const PARKING_BAYS_X = [-24, -20.0, -16.0, -12.0, -8.0, -4.0, 0.5, 4.5]
const BAY_LINES: Item[] = [
  ...PARKING_BAYS_X.flatMap((x) => [ext([x - 0.05, x + 0.05], [0.084, 0.092], [8.0, 14.0])]),
  ext([-24.05, 4.55], [0.084, 0.092], [13.95, 14.05]),
]

// Perimeter boundary walls (clean, continuous, no gaps)
const WALLS: Item[] = [
  ext([SX0, SX1], [0.08, 1.35], [SZ0, SZ0 + 0.4]), // full rear boundary wall at -28.0
  ext([SX0, SX0 + 0.4], [0.08, 1.35], [SZ0, ROAD_Z[0]]), // left boundary wall at -58.0
  ext([SX1 - 0.4, SX1], [0.08, 1.35], [SZ0, ROAD_Z[0]]), // right boundary wall at 28.0
  ext([SX0, -28], [0.08, 1.25], [ROAD_Z[0] - 0.4, ROAD_Z[0]]), // front left wall
  ext([22, SX1], [0.08, 1.25], [ROAD_Z[0] - 0.4, ROAD_Z[0]]), // front right wall
]

const WALL_PILLARS: Item[] = [
  ...range(20, (i) => ({ p: [SX0 + 1.2 + i * 4.4, 0.8, SZ0 + 0.2] as V3, s: [0.65, 1.55, 0.65] as V3 })),
  ...range(10, (i) => ({ p: [SX0 + 0.2, 0.8, SZ0 + 4.0 + i * 4.3] as V3, s: [0.65, 1.55, 0.65] as V3 })),
  ...range(10, (i) => ({ p: [SX1 - 0.2, 0.8, SZ0 + 4.0 + i * 4.3] as V3, s: [0.65, 1.55, 0.65] as V3 })),
  { p: [-28, 0.8, ROAD_Z[0] - 0.2], s: [0.75, 1.55, 0.75] },
  { p: [22, 0.8, ROAD_Z[0] - 0.2], s: [0.75, 1.55, 0.75] },
]

// Stately Ashoka & Neem shade trees strictly along boundaries
const TREE_SPOTS: [number, number][] = [
  // Behind 2X Lawn (left side rear)
  [-55, -26.2],
  [-48, -26.2],
  [-41, -26.2],
  [-34, -26.2],
  [-27, -26.2],
  [-20, -26.2],
  [-13, -26.2],
  // Behind pool & right side (right side rear)
  [16.0, -26.2],
  [20.5, -26.2],
  [25.0, -26.2],
  // Left perimeter line
  [-56.2, -20.5],
  [-56.2, -14.5],
  [-56.2, -8.5],
  [-56.2, -2.5],
  [-56.2, 3.5],
  [-56.2, 9.5],
  // Right perimeter line
  [26.2, -20.5],
  [26.2, -14.5],
  [26.2, -8.5],
  [26.2, -2.5],
  [26.2, 3.5],
  [26.2, 9.5],
]

const TREE_TRUNKS: Item[] = TREE_SPOTS.map(([x, z]) => ({ p: [x, 1.45, z], s: [0.45, 2.8, 0.45] }))
const TREE_CROWNS: Item[] = TREE_SPOTS.flatMap(([x, z], i) => {
  const k = 3.0 + (i % 3) * 0.5
  return [
    { p: [x, 3.45 + k * 0.35, z] as V3, s: [k, k * 0.9, k] as V3 },
    { p: [x + 0.4, 4.05 + k * 0.35, z - 0.3] as V3, s: [k * 0.75, k * 0.65, k * 0.75] as V3 },
  ]
})

// Potted royal palms in black granite planters at the grand entrance plinth
const PALM_POSITIONS: V3[] = [
  [-4.5, PLINTH, 4.2],
  [-1.8, PLINTH, 4.6],
  [8.5, PLINTH, 4.6],
  [11.2, PLINTH, 4.2],
  [-5.2, 0.08, 7.2],
  [12.0, 0.08, 7.2],
]

const PALM_TRUNKS: Item[] = PALM_POSITIONS.map(([x, y, z]) => ({ p: [x, y + 1.1, z], s: [0.2, 2.2, 0.2] }))
const PALM_FRONDS: Item[] = PALM_POSITIONS.flatMap(([x, y, z]) =>
  range(8, (i) => {
    const a = (i / 8) * Math.PI * 2
    return {
      p: [x + Math.sin(a) * 0.65, y + 2.1, z + Math.cos(a) * 0.65] as V3,
      s: [0.38, 0.1, 1.45] as V3,
      r: [0.55, a, 0] as V3,
    }
  }),
)

function Site() {
  return (
    <group>
      {/* ---------------- SOLID ARCHITECTURAL FOUNDATION PODIUM BASE ---------------- */}
      {/* Foundation block terminates at -0.05, safely UNDER all top surfaces */}
      <Box x={SITE.x} y={[-4.2, -0.05]} z={SITE.z} m={M.foundation} />
      {/* Pedestal bevel trim around the foundation bottom */}
      <Box
        x={[SITE.x[0] - 0.4, SITE.x[1] + 0.4]}
        y={[-4.3, -4.0]}
        z={[SITE.z[0] - 0.4, SITE.z[1] + 0.4]}
        m={M.podiumBevel}
      />

      {/* Front Forecourt & Parking Ground (Sits at y: 0.08, zero z-fighting with foundation) */}
      <Box x={SITE.x} y={[-0.04, 0.08]} z={FORECOURT_Z} m={M.paving} />
      {/* Kerb divider (y: 0.22) */}
      <Box x={SITE.x} y={[-0.04, 0.22]} z={[ROAD_Z[0], ROAD_Z[0] + 0.4]} m={M.kerb} />
      {/* Main road in front (y: 0.05) */}
      <Box x={SITE.x} y={[-0.04, 0.05]} z={[ROAD_Z[0] + 0.4, SZ1]} m={M.asphalt} />
      {/* Road centreline dashes (y: 0.058, sits ON TOP of road) */}
      <Many
        items={range(22, (i) => ext([SX0 + 1.8 + i * 3.8, SX0 + 4.2 + i * 3.8], [0.054, 0.062], [18.2, 18.5]))}
        m={M.roadLine}
      />
      {/* Parking bay stripes (y: 0.088, sits ON TOP of paving) */}
      <Many items={BAY_LINES} m={M.roadLine} />

      {/* Perimeter Boundary Walls & Pillars */}
      <Many items={WALLS} m={M.wallCream} />
      <Many items={WALL_PILLARS} m={M.stoneCorner} />

      {/* Trees & Foliage */}
      <Many items={TREE_TRUNKS} g={CYL} m={M.trunk} />
      <Many items={TREE_CROWNS.filter((_, i) => i % 2 === 0)} g={BLOB} m={M.hedge} />
      <Many items={TREE_CROWNS.filter((_, i) => i % 2 === 1)} g={BLOB} m={M.leafLight} />

      {/* Entrance Plinth Planters & Palms */}
      <Many
        items={PALM_POSITIONS.map(([x, y, z]) => ({ p: [x, y + 0.35, z] as V3, s: [0.85, 0.7, 0.85] as V3 }))}
        m={M.planter}
      />
      <Many items={PALM_TRUNKS} g={CYL} m={M.trunk} />
      <Many items={PALM_FRONDS} g={BLOB} m={M.palm} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The Unified Hotel Building (+20% LARGER IN ALL DIMENSIONS)
// ZERO Z-FIGHTING: Window surrounds project 0.45 units from the wall, glass sits 0.31 units outside

const REST_TABLES_Z = [-3.5, -7.0, -10.5, -14.0, -17.5, -21.0]
const REST_TABLE_TOPS: Item[] = REST_TABLES_Z.flatMap((z) => [
  { p: [-5.0, PLINTH + 0.82, z] as V3, s: [1.0, 0.05, 1.0] as V3 },
  { p: [-2.2, PLINTH + 0.82, z] as V3, s: [1.0, 0.05, 1.0] as V3 },
])
const REST_TABLE_LEGS: Item[] = REST_TABLES_Z.flatMap((z) => [
  { p: [-5.0, PLINTH + 0.41, z] as V3, s: [0.11, 0.82, 0.11] as V3 },
  { p: [-2.2, PLINTH + 0.41, z] as V3, s: [0.11, 0.82, 0.11] as V3 },
])
const REST_CHAIRS: Item[] = REST_TABLES_Z.flatMap((z) => [
  ext([-5.5, -4.5], [PLINTH, PLINTH + 0.95], [z - 0.6, z - 0.5]),
  ext([-5.5, -4.5], [PLINTH, PLINTH + 0.95], [z + 0.5, z + 0.6]),
  ext([-2.7, -1.7], [PLINTH, PLINTH + 0.95], [z - 0.6, z - 0.5]),
  ext([-2.7, -1.7], [PLINTH, PLINTH + 0.95], [z + 0.5, z + 0.6]),
])
const REST_PENDANTS: Item[] = REST_TABLES_Z.flatMap((z) => [
  { p: [-5.0, L1 - 1.1, z] as V3, s: [0.35, 0.35, 0.35] as V3 },
  { p: [-2.2, L1 - 1.1, z] as V3, s: [0.35, 0.35, 0.35] as V3 },
])

// Ground floor restaurant viewing windows along the side wall facing lawn
// Projecting cleanly out from wall [-7.65 to -7.18]
const REST_WINDOWS: Item[] = [
  ext([-7.54, -7.46], [PLINTH + 0.35, L1 - 0.35], [-6.5, -3.0]),
  ext([-7.54, -7.46], [PLINTH + 0.35, L1 - 0.35], [-11.5, -8.0]),
  ext([-7.54, -7.46], [PLINTH + 0.35, L1 - 0.35], [-16.5, -13.0]),
  ext([-7.54, -7.46], [PLINTH + 0.35, L1 - 0.35], [-22.0, -18.0]),
]
const REST_FRAMES: Item[] = [
  ext([-7.62, -7.16], [PLINTH + 0.25, L1 - 0.25], [-6.7, -2.8]),
  ext([-7.62, -7.16], [PLINTH + 0.25, L1 - 0.25], [-11.7, -7.8]),
  ext([-7.62, -7.16], [PLINTH + 0.25, L1 - 0.25], [-16.7, -12.8]),
  ext([-7.62, -7.16], [PLINTH + 0.25, L1 - 0.25], [-22.2, -17.8]),
]

// Upper floor guest room windows across 3 room floors (L1 to L4)
const ROOM_FLOOR_HEIGHTS = [
  (L1 + L2) / 2,
  (L2 + L3) / 2,
  (L3 + L4) / 2,
]
const ROOM_BAYS_Z: R[] = [
  [-6.5, -3.0],
  [-11.5, -8.0],
  [-16.5, -13.0],
  [-21.8, -18.0],
]

// Window glass placed at x = -7.51 (0.31 units away from cream wall, zero z-fighting)
const ROOM_WINDOWS_LEFT: Item[] = ROOM_FLOOR_HEIGHTS.flatMap((y) =>
  ROOM_BAYS_Z.flatMap(([z0, z1]) => [
    { p: [-7.52, y, (z0 * 2 + z1) / 3] as V3, s: [0.08, 1.8, 1.1] as V3 },
    { p: [-7.52, y, (z0 + z1 * 2) / 3] as V3, s: [0.08, 1.8, 1.1] as V3 },
  ]),
)
// Architectural walnut window surrounds projecting from wall
const ROOM_PANELS_LEFT: Item[] = ROOM_BAYS_Z.map(([z0, z1]) =>
  ext([-7.62, -7.16], [L1 + 0.1, L4 - 0.1], [z0 - 0.15, z1 + 0.15]),
)

// Balconies with glass railings on the upper floors
const ROOM_BALCONIES_LEFT: Item[] = ROOM_FLOOR_HEIGHTS.flatMap((y) =>
  ROOM_BAYS_Z.map(([z0, z1]) => ext([-8.35, -7.18], [y - 1.65, y - 1.55], [z0, z1])),
)
const ROOM_BALCONY_RAILS_LEFT: Item[] = ROOM_FLOOR_HEIGHTS.flatMap((y) =>
  ROOM_BAYS_Z.map(([z0, z1]) => ext([-8.38, -8.32], [y - 1.55, y - 0.65], [z0, z1])),
)

// Basement Banquet Hall setup
const BANQUET_TABLES: Item[] = [
  ...[-2.0, 3.0, 8.0].flatMap((x) =>
    [-5.5, -11.5, -17.5, -21.5].map((z) => ({
      p: [x, BASEMENT + 0.45, z] as V3,
      s: [1.25, 0.85, 1.25] as V3,
    })),
  ),
]
const CHANDELIERS: V3[] = [
  [3.0, -1.0, -6.0],
  [3.0, -1.0, -12.5],
  [3.0, -1.0, -19.0],
]

// Sunken courtyard stairs down to basement banquet hall
const STAIR_COUNT = 11
const BASEMENT_STAIRS: Item[] = range(STAIR_COUNT, (i) => {
  const t = i / STAIR_COUNT
  return ext(
    [COURT.x[0] + 0.25, COURT.x[1] - 0.25],
    [BASEMENT, BASEMENT + (t + 1 / STAIR_COUNT) * -BASEMENT],
    [COURT.z[1] - (i + 1) * 0.48, COURT.z[1] - i * 0.48],
  )
})

function HotelBuilding({
  onSelect,
}: {
  onSelect?: (id: HotspotId) => void
}) {
  return (
    <group>
      {/* ---------------- BASEMENT BANQUET HALL ---------------- */}
      <Box x={BLDG.x} y={[BASEMENT - 0.25, BASEMENT]} z={BLDG.z} m={M.marble} />
      <Box x={BLDG.x} y={[BASEMENT, 0]} z={[BLDG.z[0] - 0.25, BLDG.z[0]]} m={M.courtStone} />
      <Box x={[BLDG.x[0] - 0.25, BLDG.x[0]]} y={[BASEMENT, 0]} z={BLDG.z} m={M.courtStone} />
      <Box x={[BLDG.x[1], BLDG.x[1] + 0.25]} y={[BASEMENT, 0]} z={[BLDG.z[0], COURT.z[0]]} m={M.courtStone} />
      {/* Interior warm banquet walls */}
      <Box x={BLDG.x} y={[BASEMENT, 0]} z={[BLDG.z[0], BLDG.z[0] + 0.12]} m={M.interiorWarm} />
      <Box x={[BLDG.x[0], BLDG.x[0] + 0.12]} y={[BASEMENT, 0]} z={BLDG.z} m={M.interiorWarm} />
      {/* Banquet Stage & backdrop */}
      <Box x={[0.0, 6.0]} y={[BASEMENT, BASEMENT + 0.45]} z={[-23.5, -21.0]} m={M.burgundy} />
      <Box x={[0.5, 5.5]} y={[BASEMENT + 0.45, -0.4]} z={[-23.8, -23.5]} m={M.gold} />
      {/* Banquet tables */}
      <Many items={BANQUET_TABLES} g={CYL} m={M.linen} />
      {/* Crystal chandeliers */}
      <Many items={CHANDELIERS.map((p) => ({ p, s: [1.3, 1.0, 1.3] as V3 }))} g={BALL} m={M.glowWarm} />
      <Many items={CHANDELIERS.map(([x, y, z]) => ({ p: [x, y + 0.65, z] as V3, s: [1.6, 0.1, 1.6] as V3 }))} g={CYL} m={M.gold} />

      {/* Sunken entrance court stairs & retaining wall */}
      <Box
        x={COURT.x}
        y={[BASEMENT - 0.15, BASEMENT]}
        z={COURT.z}
        m={M.courtStone}
        onClick={() => onSelect?.('banquet')}
      />
      <Many items={BASEMENT_STAIRS} m={M.graniteSteps} />
      <Box x={[COURT.x[0], COURT.x[1] + 0.25]} y={[BASEMENT, 0]} z={[COURT.z[1], COURT.z[1] + 0.25]} m={M.courtStone} />
      <Box x={[COURT.x[1], COURT.x[1] + 0.25]} y={[BASEMENT, 0]} z={COURT.z} m={M.courtStone} />
      {/* Safety glass balustrade with walnut handrail */}
      <Box x={[COURT.x[0], COURT.x[1]]} y={[0, 1.05]} z={[COURT.z[1] + 0.05, COURT.z[1] + 0.12]} m={M.glassClear} />
      <Box x={[COURT.x[0], COURT.x[1]]} y={[1.05, 1.14]} z={[COURT.z[1] + 0.02, COURT.z[1] + 0.15]} m={M.walnut} />
      <Box x={[COURT.x[1] + 0.05, COURT.x[1] + 0.12]} y={[0, 1.05]} z={COURT.z} m={M.glassClear} />
      <Box x={[COURT.x[1] + 0.02, COURT.x[1] + 0.15]} y={[1.05, 1.14]} z={COURT.z} m={M.walnut} />
      {/* Banquet entry doors */}
      <Box x={[COURT.x[0], COURT.x[1]]} y={[BASEMENT, -0.2]} z={[COURT.z[0], COURT.z[0] + 0.08]} m={M.glassClear} />

      {/* ---------------- GROUND FLOOR: RESTAURANT & LOBBY ---------------- */}
      {/* Dark polished granite plinth base under entire building */}
      <Box x={BLDG.x} y={[0, PLINTH]} z={BLDG.z} m={M.plinth} />
      {/* Raised ground floor floorboards */}
      <Box x={BLDG.x} y={[PLINTH, PLINTH + 0.07]} z={BLDG.z} m={M.floorWood} />
      {/* Restaurant dining setup inside ground floor */}
      <Many items={REST_TABLE_TOPS} g={CYL} m={M.linen} />
      <Many items={REST_TABLE_LEGS} g={CYL} m={M.walnut} />
      <Many items={REST_CHAIRS} m={M.burgundy} />
      <Many items={REST_PENDANTS} g={BALL} m={M.glowWarm} />
      {/* Large Restaurant Viewing Windows facing the 2X lawn */}
      <Many items={REST_FRAMES} m={M.wallCream} />
      <Many items={REST_WINDOWS} m={M.glassClear} />
      {/* Ground floor walls */}
      <Box
        x={[BLDG.x[0], -4.5]}
        y={[PLINTH, L1]}
        z={[3.7, 3.8]}
        m={M.wallCream}
        onClick={() => onSelect?.('restaurant')}
      />
      <Box x={BLDG.x} y={[PLINTH, L1]} z={[BLDG.z[0], BLDG.z[0] + 0.3]} m={M.wallCream} />
      <Box x={[BLDG.x[1] - 0.3, BLDG.x[1]]} y={[PLINTH, L1]} z={BLDG.z} m={M.wallCream} />

      {/* Grand Hotel Reception Lobby */}
      <Box x={[0.5, 13.8]} y={[PLINTH, PLINTH + 0.06]} z={[-6.0, 3.8]} m={M.marble} />
      <Box x={[3.0, 7.8]} y={[PLINTH, PLINTH + 1.2]} z={[-2.2, -1.0]} m={M.walnutDeep} />
      <Box x={[2.9, 7.9]} y={[PLINTH + 1.2, PLINTH + 1.3]} z={[-2.3, -0.9]} m={M.marble} />
      <Box x={[3.4, 7.4]} y={[PLINTH + 1.5, L1 - 0.5]} z={[-3.8, -3.75]} m={M.gold} />
      {/* Lobby pendant chandelier */}
      <mesh geometry={BALL} material={M.glowWarm} position={[5.4, L1 - 1.2, 0.6]} scale={[0.9, 0.7, 0.9]} />

      {/* ---------------- GRAND ENTRANCE STAIRCASE & CANOPY ---------------- */}
      {/* Entrance terrace platform */}
      <Box x={[0.2, 12.6]} y={[0, PLINTH]} z={[3.8, 6.8]} m={M.terrace} />
      {/* Wide black polished granite steps cascading down to forecourt */}
      <Many
        items={range(9, (i) => {
          const t = i / 9
          return ext([0.2, 12.6], [0, PLINTH * (1 - t)], [6.8 + i * 0.38, 7.18 + i * 0.38])
        })}
        m={M.graniteSteps}
      />
      {/* Modern cantilevered entrance portico canopy */}
      <Box x={[0.0, 12.8]} y={[L1 - 0.4, L1]} z={[3.6, 9.2]} m={M.walnutDeep} />
      <Box x={[0.1, 12.7]} y={[L1, L1 + 0.15]} z={[3.7, 9.1]} m={M.wallCream} />
      {/* 4 Gold Columns supporting canopy */}
      <Many
        items={[
          { p: [0.7, (PLINTH + L1) / 2, 8.8] as V3, s: [0.25, L1 - PLINTH, 0.25] as V3 },
          { p: [12.2, (PLINTH + L1) / 2, 8.8] as V3, s: [0.25, L1 - PLINTH, 0.25] as V3 },
          { p: [0.7, (PLINTH + L1) / 2, 5.6] as V3, s: [0.25, L1 - PLINTH, 0.25] as V3 },
          { p: [12.2, (PLINTH + L1) / 2, 5.6] as V3, s: [0.25, L1 - PLINTH, 0.25] as V3 },
        ]}
        g={CYL}
        m={M.gold}
      />
      {/* Recessed canopy downlights illuminating the entrance steps */}
      <Many
        items={[1.8, 4.8, 8.0, 11.0].flatMap((x) =>
          [4.6, 6.8, 8.4].map((z) => ({ p: [x, L1 - 0.42, z] as V3, s: [0.3, 0.05, 0.3] as V3 })),
        )}
        g={CYL}
        m={M.glow}
      />
      {/* Double sliding glass lobby entrance doors */}
      <Box x={[1.5, 11.4]} y={[PLINTH, L1 - 0.35]} z={[3.78, 3.84]} m={M.glassClear} />
      <Many
        items={[
          ext([1.5, 11.4], [L1 - 0.45, L1 - 0.35], [3.76, 3.86]),
          ext([6.4, 6.5], [PLINTH, L1 - 0.35], [3.76, 3.86]),
          ext([3.4, 3.5], [PLINTH, L1 - 0.35], [3.76, 3.86]),
          ext([9.4, 9.5], [PLINTH, L1 - 0.35], [3.76, 3.86]),
        ]}
        m={M.frame}
      />

      {/* ---------------- UPPER FLOORS: TALLER HOTEL (+20% SIZE) ---------------- */}
      {/* Floor Slabs */}
      <Box x={BLDG.x} y={[L1, L1 + 0.24]} z={BLDG.z} m={M.terrace} />
      <Box x={BLDG.x} y={[L2, L2 + 0.24]} z={BLDG.z} m={M.terrace} />
      <Box x={BLDG.x} y={[L3, L3 + 0.24]} z={BLDG.z} m={M.terrace} />
      <Box x={BLDG.x} y={[L4, L4 + 0.24]} z={BLDG.z} m={M.terrace} />
      <Box x={BLDG.x} y={[ROOF, ROOF + 0.25]} z={BLDG.z} m={M.terrace} />
      {/* Main Building Wall Volume */}
      <Box
        x={BLDG.x}
        y={[L1, ROOF]}
        z={BLDG.z}
        m={M.wallCream}
        onClick={() => onSelect?.('rooms')}
      />

      {/* Left side guest room window bays & balconies facing 2X lawn */}
      <Many items={ROOM_PANELS_LEFT} m={M.walnut} />
      <Many items={ROOM_WINDOWS_LEFT.filter((_, i) => i % 3 !== 1)} m={M.glassLightBlue} />
      <Many items={ROOM_WINDOWS_LEFT.filter((_, i) => i % 3 === 1)} m={M.glowWarm} />
      <Many items={ROOM_BALCONIES_LEFT} m={M.terrace} />
      <Many items={ROOM_BALCONY_RAILS_LEFT} m={M.glassClear} />
      {/* Vertical dark fins between bays */}
      <Many
        items={[-7.0, -12.0, -17.0].map((z) => ext([-7.75, -7.18], [L1, ROOF], [z - 0.12, z + 0.12]))}
        m={M.walnutDeep}
      />

      {/* ---------------- 4th FLOOR: ROOFTOP SKY LOUNGE & VIEWING DECK ---------------- */}
      {/* Rooftop glass lounge structure */}
      <Box x={[-2.5, 13.2]} y={[ROOF + 0.25, ROOF + 3.6]} z={[-16.5, 3.0]} m={M.glassBlue} />
      {/* Rooftop lounge cantilevered roof */}
      <Box x={[-3.0, 13.7]} y={[ROOF + 3.6, ROOF + 4.0]} z={[-17.0, 3.5]} m={M.walnutDeep} />
      <Box x={[-3.1, 13.8]} y={[ROOF + 3.4, ROOF + 3.6]} z={[-17.1, 3.6]} m={M.woodUnderside} />
      {/* Rooftop viewing terrace safety glass balustrade */}
      <Box x={[-7.0, 13.5]} y={[ROOF + 0.25, ROOF + 1.4]} z={[3.3, 3.4]} m={M.glassClear} />
      <Box x={[-7.0, 13.5]} y={[ROOF + 1.4, ROOF + 1.48]} z={[3.25, 3.45]} m={M.walnut} />
      {/* Rooftop elevator penthouse */}
      <Box x={[0.0, 6.0]} y={[ROOF + 0.25, ROOF + 4.9]} z={[-12.0, -5.0]} m={M.wallCream} />
      <Box x={[-0.1, 6.1]} y={[ROOF + 4.9, ROOF + 5.15]} z={[-12.1, -4.9]} m={M.walnutDeep} />

      {/* ---------------- FRONT SIGNATURE FACADE ---------------- */}
      {/* 1. Left Corner Grey Stone Pilaster & Tall Walnut Sign Tower */}
      <Box x={[-7.3, -7.0]} y={[0, TOWER_TOP]} z={[3.5, 4.0]} m={M.stoneCorner} />
      <Box x={[-7.0, -4.6]} y={[0, TOWER_TOP]} z={[3.6, 4.0]} m={M.walnut} />
      <Box x={[-7.05, -4.55]} y={[TOWER_TOP, TOWER_TOP + 0.2]} z={[3.55, 4.05]} m={M.gold} />
      {/* Painted Vertical Sign: HOTEL / DREAM HEAVENS / & / RESTAURANT */}
      <Painted
        draw={drawSignColumn}
        w={220}
        h={2100}
        p={[-5.8, TOWER_TOP / 2, 4.04]}
        s={[2.35, TOWER_TOP, 1]}
      />

      {/* 2. Center Ochre Accent Panel with 4 Vertical Slit Windows */}
      <Box x={[-4.6, 0.7]} y={[L1, ROOF]} z={[3.65, 3.9]} m={M.wallTan} />
      <Many
        items={[-3.4, -2.2, -1.0, 0.1].map((x) => ext([x - 0.24, x + 0.24], [L1 + 0.7, ROOF - 0.7], [3.92, 3.96]))}
        m={M.glassBlue}
      />
      <Many
        items={[-3.4, -2.2, -1.0, 0.1].map((x) => ext([x - 0.3, x + 0.3], [L1 + 0.6, ROOF - 0.6], [3.9, 3.94]))}
        m={M.frame}
      />

      {/* 3. Blue Reflective Glass Curtain Wall with Grid Mullions */}
      <Box x={[0.7, 13.6]} y={[L1, ROOF]} z={[3.75, 3.9]} m={M.glassBlue} />
      {/* Vertical curtain wall mullions */}
      <Many
        items={range(9, (i) => {
          const x = 0.7 + (i * (13.6 - 0.7)) / 8
          return ext([x - 0.05, x + 0.05], [L1, ROOF], [3.92, 3.98])
        })}
        m={M.frame}
      />
      {/* Horizontal floor slab trims across curtain wall */}
      <Many
        items={[L2, L3, L4, ROOF - 1.0].map((y) => ext([0.7, 13.6], [y - 0.05, y + 0.05], [3.92, 3.98]))}
        m={M.frame}
      />

      {/* Iconic DH DREAM HEAVENS circular medallion emblem centered on glass curtain wall */}
      <Painted
        draw={drawBadge}
        w={512}
        h={512}
        p={[7.15, (L1 + ROOF) / 2, 4.02]}
        s={[2.8, 2.8, 1]}
        geometry={DISC}
      />

      {/* Top Illuminated Header Board: "Hotel Dream Heavens" */}
      <Painted
        draw={drawGlassBand}
        w={1400}
        h={240}
        p={[7.15, ROOF - 0.65, 4.01]}
        s={[9.8, 1.3, 1]}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Grand Function Lawn (2X SIZE)
// Lawn sits at y: 0.12, cleanly elevated above foundation slab (y: -0.05)

const LAWN_POLE_X = [-52, -43, -34, -25, -16, -8.5]
const LAWN_POLE_Z = [-21, -13, -5, 4.0]
const POLE_H = 4.5
const LAWN_POLES: Item[] = LAWN_POLE_X.flatMap((x) =>
  LAWN_POLE_Z.map((z) => ({ p: [x, 0.12 + POLE_H / 2, z] as V3, s: [0.16, POLE_H, 0.16] as V3 })),
)

const FESTOON_BULBS: Item[] = [
  ...LAWN_POLE_Z.flatMap((z) =>
    LAWN_POLE_X.slice(1).flatMap((x, i) => festoon([LAWN_POLE_X[i], 0.12 + POLE_H, z], [x, 0.12 + POLE_H, z], 10, 0.5)),
  ),
  ...LAWN_POLE_X.flatMap((x) =>
    LAWN_POLE_Z.slice(1).flatMap((z, i) => festoon([x, 0.12 + POLE_H, LAWN_POLE_Z[i]], [x, 0.12 + POLE_H, z], 10, 0.55)),
  ),
]

const MANDAP: V3 = [-31, 0.12, -9]
const FOUNTAIN: V3 = [-31, 0.12, 0]

// Banquet dining tables on the 2X lawn
const LAWN_TABLES: V3[] = [
  [-43, 0.12, -16],
  [-43, 0.12, -8],
  [-43, 0.12, 0],
  [-20, 0.12, -16],
  [-20, 0.12, -8],
  [-20, 0.12, 0],
  [-15, 0.12, -4.0],
  [-15, 0.12, -12.0],
]

function FunctionLawn({
  onSelect,
}: {
  onSelect?: (id: HotspotId) => void
}) {
  const [mx, my, mz] = MANDAP
  const [fx, fy, fz] = FOUNTAIN

  return (
    <group onClick={() => onSelect?.('lawn')}>
      {/* Manicured 2X Lawn Grass (Elevated at y: [-0.04, 0.12]) */}
      <Box x={LAWN.x} y={[-0.04, 0.12]} z={LAWN.z} m={M.lawn} />
      {/* Alternating Mowed Lawn Stripes (y: [0.122, 0.128], zero z-fighting) */}
      <Many
        items={range(10, (i) =>
          ext([LAWN.x[0] + 0.6 + i * 4.8, LAWN.x[0] + 3.4 + i * 4.8], [0.122, 0.128], [LAWN.z[0], LAWN.z[1]]),
        )}
        m={M.lawnStripe}
      />
      {/* Perimeter boxwood hedges */}
      <Many
        items={[
          ext([LAWN.x[0], LAWN.x[1]], [0.12, 0.85], [LAWN.z[0], LAWN.z[0] + 0.55]),
          ext([LAWN.x[0], LAWN.x[0] + 0.55], [0.12, 0.85], [LAWN.z[0], LAWN.z[1]]),
          ext([LAWN.x[0], LAWN.x[1]], [0.12, 0.85], [LAWN.z[1] - 0.55, LAWN.z[1]]),
        ]}
        m={M.hedge}
      />

      {/* Paved Walkway connecting Restaurant terrace to Wedding Mandap & Fountain */}
      <Box x={[-31.5, -7.0]} y={[0.122, 0.14]} z={[-9.8, -8.2]} m={M.terrace} />
      <Box x={[-31.5, -7.0]} y={[0.141, 0.148]} z={[-9.3, -8.7]} m={M.burgundy} />
      <Box x={[-31.8, -30.2]} y={[0.122, 0.14]} z={[-8.2, 0.8]} m={M.terrace} />

      {/* Festoon Light Poles & Glowing Fairy Bulbs */}
      <Many items={LAWN_POLES} g={CYL} m={M.walnut} />
      <Many items={FESTOON_BULBS} g={BALL} m={M.glowWarm} />

      {/* Royal Indian Wedding Mandap / Grand Pavilion */}
      <Box x={[mx - 3.5, mx + 3.5]} y={[my, my + 0.5]} z={[mz - 3.5, mz + 3.5]} m={M.marble} />
      <Box x={[mx - 3.1, mx + 3.1]} y={[my + 0.5, my + 0.54]} z={[mz - 3.1, mz + 3.1]} m={M.burgundy} />
      {/* 8 Fluted Gold Mandap Pillars */}
      <Many
        items={[
          [-2.4, -2.4],
          [2.4, -2.4],
          [-2.4, 2.4],
          [2.4, 2.4],
          [0, -2.6],
          [0, 2.6],
          [-2.6, 0],
          [2.6, 0],
        ].map(([dx, dz]) => ({ p: [mx + dx, my + 2.0, mz + dz] as V3, s: [0.24, 3.0, 0.24] as V3 }))}
        g={CYL}
        m={M.gold}
      />
      {/* Royal Burgundy & Gold Tiered Canopy */}
      <mesh
        geometry={PYRAMID}
        material={M.burgundy}
        position={[mx, my + 4.0, mz]}
        rotation-y={Math.PI / 4}
        scale={[6.8, 1.8, 6.8]}
      />
      <mesh geometry={BALL} material={M.goldBright} position={[mx, my + 5.1, mz]} scale={[0.45, 0.6, 0.45]} />
      {/* Ceremonial Royal Chairs on Stage */}
      <Box x={[mx - 1.4, mx + 1.4]} y={[my + 0.54, my + 1.5]} z={[mz - 2.4, mz - 1.8]} m={M.burgundy} />
      <Box x={[mx - 1.5, mx + 1.5]} y={[my + 0.54, my + 1.6]} z={[mz - 2.5, mz - 2.4]} m={M.gold} />

      {/* Centerpiece Royal Tiered Fountain */}
      <mesh geometry={CYL} material={M.marble} position={[fx, fy + 0.25, fz]} scale={[4.4, 0.45, 4.4]} />
      <mesh geometry={CYL} material={M.water} position={[fx, fy + 0.4, fz]} scale={[4.0, 0.1, 4.0]} />
      <mesh geometry={CYL} material={M.gold} position={[fx, fy + 1.0, fz]} scale={[0.45, 1.3, 0.45]} />
      <mesh geometry={CYL} material={M.marble} position={[fx, fy + 1.35, fz]} scale={[2.2, 0.28, 2.2]} />
      <mesh geometry={BALL} material={M.water} position={[fx, fy + 1.85, fz]} scale={[0.55, 0.75, 0.55]} />

      {/* Banquet Dining Tables on the 2X Lawn */}
      <Many
        items={LAWN_TABLES.map(([x, y, z]) => ({ p: [x, y + 0.45, z] as V3, s: [1.4, 0.8, 1.4] as V3 }))}
        g={CYL}
        m={M.linen}
      />
      {/* Surrounding Chairs for Lawn Tables */}
      <Many
        items={LAWN_TABLES.flatMap(([x, y, z]) =>
          range(4, (i) => {
            const a = (i / 4) * Math.PI * 2
            return {
              p: [x + Math.sin(a) * 1.05, y + 0.42, z + Math.cos(a) * 1.05] as V3,
              s: [0.45, 0.85, 0.45] as V3,
            }
          }),
        )}
        m={M.burgundy}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Luxury Swimming Pool (Right Side, "Coming Soon")

function PoolArea({
  onSelect,
}: {
  onSelect?: (id: HotspotId) => void
}) {
  const [px0, px1] = POOL.x
  const [pz0, pz1] = POOL.z
  const cx = (px0 + px1) / 2
  const cz = (pz0 + pz1) / 2

  return (
    <group onClick={() => onSelect?.('pool')}>
      {/* Travertine Pool Deck */}
      <Box x={POOL.x} y={[-0.04, 0.18]} z={POOL.z} m={M.poolDeck} />
      {/* Pool Basin with turquoise water */}
      <Box x={[px0 + 1.0, px1 - 2.2]} y={[0.1, 0.2]} z={[pz0 + 0.9, pz1 - 0.9]} m={M.water} />
      <Box x={[px0 + 0.8, px1 - 2.0]} y={[0.18, 0.22]} z={[pz0 + 0.7, pz1 - 0.7]} m={M.poolTile} />
      {/* Underwater glowing pool lights */}
      <Many
        items={[
          { p: [px0 + 1.8, 0.14, cz - 1.4] as V3, s: [0.25, 0.06, 0.25] as V3 },
          { p: [px0 + 1.8, 0.14, cz + 1.4] as V3, s: [0.25, 0.06, 0.25] as V3 },
          { p: [px1 - 2.8, 0.14, cz - 1.4] as V3, s: [0.25, 0.06, 0.25] as V3 },
          { p: [px1 - 2.8, 0.14, cz + 1.4] as V3, s: [0.25, 0.06, 0.25] as V3 },
        ]}
        g={BALL}
        m={M.glow}
      />

      {/* Sun Loungers along the deck */}
      <Many
        items={[-2.4, -0.8, 0.8, 2.4].map((dz) => ({
          p: [px1 - 1.0, 0.3, cz + dz] as V3,
          s: [1.6, 0.22, 0.65] as V3,
        }))}
        m={M.linen}
      />

      {/* Burgundy & Gold Parasols */}
      <Many
        items={[-1.6, 1.6].map((dz) => ({
          p: [px1 - 0.7, 0.18 + 1.1, cz + dz] as V3,
          s: [0.08, 2.2, 0.08] as V3,
        }))}
        g={CYL}
        m={M.gold}
      />
      <Many
        items={[-1.6, 1.6].map((dz) => ({
          p: [px1 - 0.7, 0.18 + 2.2, cz + dz] as V3,
          s: [1.8, 0.55, 1.8] as V3,
        }))}
        g={PARASOL}
        m={M.burgundy}
      />

      {/* Poolside modern cabana */}
      <Box x={[px0 + 0.4, px0 + 0.6]} y={[0.18, 2.42]} z={[pz0 + 0.4, pz1 - 0.4]} m={M.walnut} />
      <Box x={[px0 + 0.4, px1 - 0.4]} y={[2.37, 2.52]} z={[pz0 + 0.4, pz0 + 0.6]} m={M.walnut} />
      <Box x={[px0 + 0.4, px1 - 0.4]} y={[2.37, 2.52]} z={[pz1 - 0.6, pz1 - 0.4]} m={M.walnut} />

      {/* Architectural "COMING SOON" preview sign */}
      <Painted draw={drawComingSoon} w={400} h={120} p={[cx, 1.42, pz1 - 0.2]} s={[2.4, 0.7, 1]} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// EV Charging Station (Front Right Forecourt, "Coming Soon")

function EvChargingStation({
  onSelect,
}: {
  onSelect?: (id: HotspotId) => void
}) {
  const [ex0, ex1] = EV.x
  const [ez0, ez1] = EV.z
  const BAYS_Z = [ez0 + 1.4, ez0 + 3.4]

  return (
    <group onClick={() => onSelect?.('ev')}>
      {/* Green Painted Parking Bays (Elevated at y: [0.084, 0.092] on top of forecourt paving) */}
      <Many items={BAYS_Z.map((z) => ext([ex0 + 0.4, ex1 - 0.4], [0.084, 0.092], [z - 0.7, z + 0.7]))} m={M.evPaint} />
      <Many
        items={BAYS_Z.flatMap((z) => [
          ext([ex0 + 0.35, ex1 - 0.35], [0.093, 0.098], [z - 0.75, z - 0.7]),
          ext([ex0 + 0.35, ex1 - 0.35], [0.093, 0.098], [z + 0.7, z + 0.75]),
        ])}
        m={M.roadLine}
      />

      {/* Modern Cantilevered Solar Canopy */}
      <Many
        items={[ez0 + 0.6, ez1 - 0.6].map((z) => ({
          p: [ex1 - 0.2, 1.78, z] as V3,
          s: [0.22, 3.4, 0.22] as V3,
        }))}
        g={CYL}
        m={M.walnutDeep}
      />
      <Box x={[ex0 + 0.2, ex1 + 0.2]} y={[3.43, 3.63]} z={[ez0 + 0.3, ez1 - 0.3]} m={M.walnut} />
      {/* Photovoltaic Solar Panels on Canopy Roof */}
      <Box x={[ex0 + 0.3, ex1 + 0.1]} y={[3.63, 3.7]} z={[ez0 + 0.4, ez1 - 0.4]} m={M.solar} />

      {/* Rapid EV Charger Pedestals */}
      <Many
        items={BAYS_Z.map((z) => ext([ex1 - 0.5, ex1 - 0.1], [0.08, 1.48], [z - 0.25, z + 0.25]))}
        m={M.terrace}
      />
      <Many
        items={BAYS_Z.map((z) => ext([ex1 - 0.52, ex1 - 0.49], [0.98, 1.28], [z - 0.15, z + 0.15]))}
        m={M.frame}
      />
      <Many
        items={BAYS_Z.map((z) => ({
          p: [ex1 - 0.53, 1.36, z] as V3,
          s: [0.08, 0.08, 0.08] as V3,
        }))}
        g={CYL}
        m={M.evGreen}
      />

      {/* "COMING SOON" Sign for EV Station */}
      <Painted draw={drawComingSoon} w={360} h={100} p={[(ex0 + ex1) / 2, 2.38, ez1 - 0.4]} s={[2.0, 0.55, 1]} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Parked Cars for Scale and Forecourt Realism

interface CarProps {
  x: number
  z: number
  color: Material
  rotY?: number
  isSuv?: boolean
}

function Car({ x, z, color, rotY = 0, isSuv = false }: CarProps) {
  const h1 = isSuv ? 0.95 : 0.78
  const h2 = isSuv ? 1.45 : 1.24
  const w = isSuv ? 1.4 : 1.3
  const l = isSuv ? 2.9 : 2.7

  return (
    <group position={[x, 0.08, z]} rotation-y={rotY}>
      {/* Main Lower Body */}
      <Box x={[-w / 2, w / 2]} y={[0.22, h1]} z={[-l / 2, l / 2]} m={color} />
      {/* Cabin & Tinted Windows */}
      <Box x={[-w / 2 + 0.08, w / 2 - 0.08]} y={[h1, h2]} z={[-l / 2 + 0.65, l / 2 - 0.45]} m={M.carGlass} />
      {/* Roof */}
      <Box x={[-w / 2 + 0.12, w / 2 - 0.12]} y={[h2, h2 + 0.05]} z={[-l / 2 + 0.75, l / 2 - 0.55]} m={color} />
      {/* Headlights & Taillights */}
      <Many
        items={[
          { p: [-w / 2 + 0.22, h1 - 0.15, l / 2 + 0.02] as V3, s: [0.28, 0.12, 0.04] as V3 },
          { p: [w / 2 - 0.22, h1 - 0.15, l / 2 + 0.02] as V3, s: [0.28, 0.12, 0.04] as V3 },
        ]}
        m={M.glow}
      />
      <Many
        items={[
          { p: [-w / 2 + 0.22, h1 - 0.15, -l / 2 - 0.02] as V3, s: [0.28, 0.12, 0.04] as V3 },
          { p: [w / 2 - 0.22, h1 - 0.15, -l / 2 - 0.02] as V3, s: [0.28, 0.12, 0.04] as V3 },
        ]}
        m={M.burgundy}
      />
      {/* Wheels */}
      <Many
        items={[-w / 2 - 0.02, w / 2 + 0.02].flatMap((wx) =>
          [-l / 2 + 0.65, l / 2 - 0.65].map((wz) => ({
            p: [wx, 0.28, wz] as V3,
            s: [0.56, 0.2, 0.56] as V3,
            r: [0, 0, Math.PI / 2] as V3,
          })),
        )}
        g={CYL}
        m={M.tyre}
      />
    </group>
  )
}

export default HotelModel
