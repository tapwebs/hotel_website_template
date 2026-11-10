import QRCode from 'qrcode'

const DARK = '#4a111b' // burgundy-deep: strong contrast on white, on brand
const LIGHT = '#ffffff'

export const qrPng = (text: string, width = 1024): Promise<string> =>
  QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: 'H', color: { dark: DARK, light: LIGHT } })

export const qrSvg = (text: string, width = 1024): Promise<string> =>
  QRCode.toString(text, { type: 'svg', width, margin: 2, errorCorrectionLevel: 'H', color: { dark: DARK, light: LIGHT } })

export interface PosterOptions {
  name: string
  url: string
  logo?: string
  /** "Room 101" style label when the QR belongs to a placement. */
  label?: string
  headline?: string
  cta?: string
  support?: string
}

export const POSTER_W = 1200
export const POSTER_H = 1600

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  ctx.letterSpacing = `${spacing}px`
  ctx.fillText(text, x, y)
  ctx.letterSpacing = '0px'
}

/** Branded 1200x1600 poster: burgundy and gold, hotel logo, Cormorant headline, large QR. Returns a PNG data URL. */
export async function posterPng(o: PosterOptions): Promise<string> {
  await Promise.all([
    document.fonts.load('600 80px "Cormorant Garamond"'),
    document.fonts.load('italic 500 64px "Cormorant Garamond"'),
    document.fonts.load('600 28px "Manrope"'),
  ]).catch(() => undefined)
  const canvas = document.createElement('canvas')
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  const cx = POSTER_W / 2

  const bg = ctx.createLinearGradient(0, 0, 0, POSTER_H)
  bg.addColorStop(0, '#6e1e2b')
  bg.addColorStop(1, '#4a111b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  ctx.strokeStyle = '#c6a15b'
  ctx.lineWidth = 3
  ctx.strokeRect(36, 36, POSTER_W - 72, POSTER_H - 72)
  ctx.lineWidth = 1
  ctx.strokeRect(52, 52, POSTER_W - 104, POSTER_H - 104)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  // Logo medallion
  const logo = o.logo ? await loadImage(o.logo) : null
  ctx.fillStyle = '#fbf7f0'
  ctx.beginPath()
  ctx.arc(cx, 200, 84, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#c6a15b'
  ctx.lineWidth = 3
  ctx.stroke()
  if (logo) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, 200, 78, 0, Math.PI * 2)
    ctx.clip()
    const s = Math.min(156 / logo.width, 156 / logo.height)
    ctx.drawImage(logo, cx - (logo.width * s) / 2, 200 - (logo.height * s) / 2, logo.width * s, logo.height * s)
    ctx.restore()
  } else {
    ctx.fillStyle = '#6e1e2b'
    ctx.font = '600 84px "Cormorant Garamond", Georgia, serif'
    ctx.fillText(o.name.trim().charAt(0).toUpperCase(), cx, 230)
  }

  ctx.fillStyle = '#fbf7f0'
  ctx.font = '600 76px "Cormorant Garamond", Georgia, serif'
  ctx.fillText(o.name, cx, 370, POSTER_W - 200)
  ctx.fillStyle = '#c6a15b'
  ctx.fillRect(cx - 90, 405, 180, 2)

  ctx.fillStyle = '#e3cf9f'
  ctx.font = 'italic 500 66px "Cormorant Garamond", Georgia, serif'
  const lines = (o.headline ?? 'Everything you need.\nOne scan away.').split('\n')
  lines.forEach((l, i) => ctx.fillText(l, cx, 500 + i * 74, POSTER_W - 200))

  // QR panel
  const qrSize = 640
  const panel = qrSize + 80
  const py = 640
  ctx.fillStyle = '#fbf7f0'
  ctx.beginPath()
  ctx.roundRect(cx - panel / 2, py, panel, panel, 28)
  ctx.fill()
  ctx.strokeStyle = '#c6a15b'
  ctx.lineWidth = 4
  ctx.stroke()
  const qr = await loadImage(await qrPng(o.url, 1024))
  if (qr) ctx.drawImage(qr, cx - qrSize / 2, py + 40, qrSize, qrSize)

  let y = py + panel + 80
  if (o.label) {
    ctx.fillStyle = '#c6a15b'
    ctx.font = '600 64px "Cormorant Garamond", Georgia, serif'
    ctx.fillText(o.label, cx, y, POSTER_W - 200)
    y += 70
  }
  ctx.fillStyle = '#fbf7f0'
  ctx.font = '600 28px "Manrope", system-ui, sans-serif'
  spaced(ctx, (o.cta ?? 'SCAN TO CONNECT').toUpperCase(), cx, y, 6)
  ctx.fillStyle = '#e3cf9f'
  ctx.font = '400 24px "Manrope", system-ui, sans-serif'
  ctx.fillText(o.support ?? 'Book a stay • WhatsApp • Offers • Directions • Wi-Fi', cx, y + 48, POSTER_W - 200)
  return canvas.toDataURL('image/png')
}
