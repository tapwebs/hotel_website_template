import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Category } from '../../types/customer'

interface CategoryTabsProps {
  categories: Category[]
  activeCategoryId: string
  onSelect: (categoryId: string) => void
}

/**
 * Horizontal scroll-snap category bar.
 * Clean, zero vertical scrollbar chrome, smooth touch swipe,
 * and elegant animated active underline.
 */
export function CategoryTabs({ categories, activeCategoryId, onSelect }: CategoryTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Automatically scroll active category tab into view horizontally without moving page vertically
  useEffect(() => {
    if (!activeCategoryId || !containerRef.current) return
    const activeTab = tabRefs.current[activeCategoryId]
    if (activeTab) {
      const container = containerRef.current
      const tabLeft = activeTab.offsetLeft
      const tabWidth = activeTab.offsetWidth
      const containerScroll = container.scrollLeft
      const containerWidth = container.offsetWidth

      if (tabLeft < containerScroll || tabLeft + tabWidth > containerScroll + containerWidth) {
        container.scrollTo({
          left: tabLeft - containerWidth / 2 + tabWidth / 2,
          behavior: 'smooth',
        })
      }
    }
  }, [activeCategoryId])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Menu categories"
      className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar py-1 select-none scroll-smooth"
    >
      {categories.map((cat) => {
        const isActive = cat.id === activeCategoryId
        return (
          <button
            key={cat.id}
            ref={(el) => {
              tabRefs.current[cat.id] = el
            }}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(cat.id)}
            className="relative shrink-0 px-3.5 py-1.5 min-h-11 flex items-center text-sm font-semibold transition-colors duration-150 rounded-lg cursor-pointer whitespace-nowrap"
            style={{ color: isActive ? 'var(--customer-accent, #2563eb)' : undefined }}
          >
            <span className={isActive ? 'font-bold' : 'text-neutral-500 hover:text-neutral-800 font-medium'}>
              {cat.name}
            </span>
            {isActive && (
              <motion.span
                layoutId="category-underline"
                className="absolute left-2.5 right-2.5 -bottom-0.5 h-[2.5px] rounded-full"
                style={{ backgroundColor: 'var(--customer-accent, #2563eb)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
