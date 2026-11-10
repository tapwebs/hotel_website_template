/** Hero line-art canvas size (square viewBox). */
export const VIEW = 240

/** `n` spokes around (cx, cy) from radius r1 to r2, rotated by `start` degrees. */
export function spokes(n: number, cx: number, cy: number, r1: number, r2: number, start = 0): string[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180
    const f = (r: number) => `${(cx + r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)}`
    return `M${f(r1)}L${f(r2)}`
  })
}

/** `n` almond petals around (cx, cy), from radius r1 out to r2, bulging by `w`. */
export function petals(n: number, cx: number, cy: number, r1: number, r2: number, w: number, start = 0): string[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180
    const [s, c] = [Math.sin(a), Math.cos(a)]
    const pt = (r: number, o = 0) => `${(cx + r * s + o * c).toFixed(1)} ${(cy - r * c + o * s).toFixed(1)}`
    const m = (r1 + r2) / 2
    return `M${pt(r1)}Q${pt(m, w)} ${pt(r2)}Q${pt(m, -w)} ${pt(r1)}Z`
  })
}
