let lockCount = 0
let savedScrollY = 0
let originalOverflow = ''
let originalPosition = ''
let originalTop = ''
let originalWidth = ''

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return

  if (lockCount === 0) {
    savedScrollY = window.scrollY
    originalOverflow = document.body.style.overflow
    originalPosition = document.body.style.position
    originalTop = document.body.style.top
    originalWidth = document.body.style.width

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.width = '100%'
  }

  lockCount++
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return

  lockCount = Math.max(0, lockCount - 1)

  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow === 'hidden' ? '' : originalOverflow
    document.body.style.position = originalPosition === 'fixed' ? '' : originalPosition
    document.body.style.top = originalTop === `-${savedScrollY}px` ? '' : originalTop
    document.body.style.width = originalWidth === '100%' ? '' : originalWidth
    if (savedScrollY) {
      window.scrollTo(0, savedScrollY)
      savedScrollY = 0
    }
  }
}

export function forceResetBodyScroll(): void {
  if (typeof document === 'undefined') return
  lockCount = 0
  savedScrollY = 0
  originalOverflow = ''
  originalPosition = ''
  originalTop = ''
  originalWidth = ''
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.width = ''
}
