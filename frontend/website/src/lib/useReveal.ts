import { useEffect, useRef } from 'react'

// One observer for the whole app; each element is revealed once, then unobserved.
let observer: IntersectionObserver | null = null
function getObserver() {
  observer ??= new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        obs.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  )
  return observer
}

/**
 * Reveal-on-scroll. Attach the returned ref to a container: it and every `.reveal`
 * descendant get `.is-visible` when they enter the viewport (see `.reveal` in index.css).
 * Under reduced motion (or without IntersectionObserver) everything is shown at once.
 * Keep `.reveal` elements' className static, or React re-renders will drop `.is-visible`.
 */
export function useReveal<T extends Element = HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const els = [root, ...root.querySelectorAll('.reveal')].filter((el) => el.classList.contains('reveal'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      for (const el of els) el.classList.add('is-visible')
      return
    }
    const io = getObserver()
    for (const el of els) io.observe(el)
    return () => {
      for (const el of els) io.unobserve(el)
    }
  }, [])
  return ref
}
