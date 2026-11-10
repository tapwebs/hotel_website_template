export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  saveUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function saveUrl(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function saveText(text: string, filename: string, type: string) {
  saveBlob(new Blob([text], { type }), filename)
}

export const fileSafe = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'qr'
