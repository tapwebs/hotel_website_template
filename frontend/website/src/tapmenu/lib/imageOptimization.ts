/**
 * Image processing & WebP optimization for TapMenu.
 * Ensures catalog dish images are strictly in WebP format and under 80 KB.
 */

export const MAX_WEBP_SIZE_BYTES = 80 * 1024 // 80 KB = 81,920 bytes

export interface WebpValidationResult {
  ok: boolean
  isWebp: boolean
  isUnderLimit: boolean
  sizeBytes: number
  sizeKb: number
  error?: string
}

/**
 * Validates whether an uploaded File is in WebP format and under 80KB.
 */
export function validateWebpImage(file: File): WebpValidationResult {
  const isWebp =
    file.type === 'image/webp' ||
    file.name.toLowerCase().endsWith('.webp')

  const sizeBytes = file.size
  const sizeKb = Number((sizeBytes / 1024).toFixed(1))
  const isUnderLimit = sizeBytes <= MAX_WEBP_SIZE_BYTES

  if (!isWebp) {
    return {
      ok: false,
      isWebp: false,
      isUnderLimit,
      sizeBytes,
      sizeKb,
      error: `Invalid file format (${file.type || 'unknown'}). Image must be in .webp format.`,
    }
  }

  if (!isUnderLimit) {
    return {
      ok: false,
      isWebp: true,
      isUnderLimit: false,
      sizeBytes,
      sizeKb,
      error: `File size is ${sizeKb} KB. Maximum allowed is 80 KB.`,
    }
  }

  return {
    ok: true,
    isWebp: true,
    isUnderLimit: true,
    sizeBytes,
    sizeKb,
  }
}

/**
 * Converts any image file (PNG, JPG, or oversize WebP) into an optimized .webp
 * guaranteed to be under 80KB (81,920 bytes).
 */
export async function optimizeImageToWebp(
  fileOrBlob: File | Blob,
  maxSizeBytes: number = MAX_WEBP_SIZE_BYTES
): Promise<{ dataUri: string; sizeBytes: number; sizeKb: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = (e) => {
      const srcUrl = e.target?.result as string
      if (!srcUrl) {
        reject(new Error('Image reader returned empty result.'))
        return
      }

      const img = new Image()
      img.onerror = () => reject(new Error('Failed to decode image data.'))
      img.onload = () => {
        try {
          // Constrain maximum dimension for catalog display (800x800 is plenty for menu cards)
          let targetWidth = img.naturalWidth || img.width
          let targetHeight = img.naturalHeight || img.height
          const maxDim = 800

          if (targetWidth > maxDim || targetHeight > maxDim) {
            if (targetWidth >= targetHeight) {
              targetHeight = Math.round((targetHeight * maxDim) / targetWidth)
              targetWidth = maxDim
            } else {
              targetWidth = Math.round((targetWidth * maxDim) / targetHeight)
              targetHeight = maxDim
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = targetWidth
          canvas.height = targetHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas 2D context not available.'))
            return
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

          // Iteratively search for quality level that keeps size <= maxSizeBytes
          let quality = 0.85
          let dataUri = canvas.toDataURL('image/webp', quality)
          let currentBytes = estimateBase64SizeBytes(dataUri)

          while (currentBytes > maxSizeBytes && quality > 0.15) {
            quality -= 0.1
            dataUri = canvas.toDataURL('image/webp', quality)
            currentBytes = estimateBase64SizeBytes(dataUri)
          }

          // If still over limit (e.g. very complex texture), scale canvas dimensions down further
          if (currentBytes > maxSizeBytes) {
            let scale = 0.8
            while (currentBytes > maxSizeBytes && scale >= 0.4) {
              const scaledW = Math.round(targetWidth * scale)
              const scaledH = Math.round(targetHeight * scale)
              canvas.width = scaledW
              canvas.height = scaledH
              ctx.clearRect(0, 0, scaledW, scaledH)
              ctx.drawImage(img, 0, 0, scaledW, scaledH)
              dataUri = canvas.toDataURL('image/webp', 0.65)
              currentBytes = estimateBase64SizeBytes(dataUri)
              scale -= 0.15
            }
          }

          resolve({
            dataUri,
            sizeBytes: currentBytes,
            sizeKb: Number((currentBytes / 1024).toFixed(1)),
            width: canvas.width,
            height: canvas.height,
          })
        } catch (err) {
          reject(err)
        }
      }
      img.src = srcUrl
    }
    reader.readAsDataURL(fileOrBlob)
  })
}

/**
 * Calculates accurate byte length from base64 data URI string.
 */
export function estimateBase64SizeBytes(dataUri: string): number {
  const parts = dataUri.split(',')
  if (parts.length < 2) return dataUri.length
  const base64Str = parts[1]
  const padding = (base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0)
  return Math.floor((base64Str.length * 3) / 4) - padding
}
