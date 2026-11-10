import { Image } from 'lucide-react'
import { memo } from 'react'
import type { EnrichedCategory } from '../../features/customer/menu/menuEnricher'

interface CategorySidebarProps {
  categories: EnrichedCategory[]
  activeCategoryId: string
  onSelect: (id: string) => void
}

function CategorySidebarComponent({
  categories,
  activeCategoryId,
  onSelect,
}: CategorySidebarProps) {
  return (
    <aside
      className="self-start h-fit max-h-[calc(100dvh-5rem)] overflow-y-auto no-scrollbar w-[4.5rem] sm:w-[5.5rem] shrink-0 bg-[#f4f3ef] rounded-xl sm:rounded-2xl border border-neutral-200/80 p-1 sm:p-1.5 hidden sm:flex flex-col items-center space-y-1 sm:space-y-1.5 select-none my-1.5 ml-1.5 sm:my-2 sm:ml-2 shadow-2xs"
      aria-label="Menu categories"
    >
      {categories.map((cat) => {
        const isActive = cat.id === activeCategoryId

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`group relative w-full min-h-[58px] sm:min-h-[72px] py-1 sm:py-1.5 pl-2 sm:pl-2.5 pr-1 sm:pr-1.5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-center transition-all duration-150 active:scale-95 cursor-pointer overflow-hidden ${
              isActive
                ? 'bg-white shadow-xs border border-neutral-200/90 text-neutral-900 font-bold'
                : 'text-neutral-500 hover:text-neutral-800 hover:bg-white/60 border border-transparent font-medium'
            }`}
          >
            {/* Active Left Indicator Bar */}
            {isActive && (
              <span
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] sm:w-1 rounded-r-full animate-in fade-in duration-150"
                style={{ backgroundColor: 'var(--customer-accent, #2563eb)' }}
                aria-hidden="true"
              />
            )}

            {/* Category Image Thumbnail */}
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg overflow-hidden shrink-0 border transition-all duration-200 ease-out ${
                isActive
                  ? 'border-[var(--customer-accent,#2563eb)] ring-2 ring-[var(--customer-accent,#2563eb)]/25 shadow-2xs'
                  : 'border-neutral-200 bg-neutral-100 opacity-80 group-hover:opacity-100 group-hover:scale-105'
              }`}
            >
              <img
                src={cat.image}
                alt={cat.name}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop'
                }}
                className="w-full h-full object-cover transition-transform duration-200"
              />
            </div>

            {/* Category Label */}
            <span
              className={`text-[0.625rem] sm:text-[0.6875rem] leading-[1.15] line-clamp-2 w-full max-w-full break-words tracking-tight px-0.5 transition-colors duration-200 ${
                isActive ? 'text-neutral-900 font-extrabold' : 'text-neutral-600 group-hover:text-neutral-900'
              }`}
              style={isActive ? { color: 'var(--customer-accent, #2563eb)' } : undefined}
            >
              {cat.name}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

export const CategorySidebar = memo(CategorySidebarComponent)

