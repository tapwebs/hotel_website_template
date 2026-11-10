import { AlertCircle, ArrowLeft, Menu, Search, ShoppingBag, Table2, Utensils, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '../session/SessionContext'
import { api, ApiError } from '../../../services/api'
import type { Category, MenuItem, CartLine } from '../../../types/customer'
import { useCartStore } from '../cart/cartStore'
import { useSyncCartKey } from '../cart/useSyncCartKey'
import { useDebouncedValue } from '../../../lib/useDebouncedValue'
import { CustomerTheme } from '../../../components/customer/CustomerTheme'
import { MenuHeroBanner } from '../../../components/customer/MenuHeroBanner'
import { CategorySidebar } from '../../../components/customer/CategorySidebar'
import { CategoryTabs } from '../../../components/customer/CategoryTabs'
import { MenuItemCard } from '../../../components/customer/MenuItemCard'
import { FloatingCartBar } from '../../../components/customer/FloatingCartBar'
import { BrandFooter } from '../../../components/common/BrandFooter'
import { CustomerMenuSkeleton } from '../../../components/ui/Skeleton'
import {
  enrichCategories,
  enrichMenuItem,
  type EnrichedCategory,
  type EnrichedMenuItem,
} from './menuEnricher'
import { searchMenuItems } from './semanticSearch'

const CustomerNavigationDrawer = lazy(() =>
  import('../../../components/customer/CustomerNavigationDrawer').then((m) => ({ default: m.CustomerNavigationDrawer }))
)
const ItemSheet = lazy(() =>
  import('../../../components/customer/ItemSheet').then((m) => ({ default: m.ItemSheet }))
)

function estimateSubtotal(lines: CartLine[], itemById: Map<string, MenuItem>): number {
  let subtotal = 0
  for (const line of lines) {
    const item = itemById.get(line.itemId)
    if (!item) continue
    let unitPrice = item.price
    if (line.variantId) {
      const variant = item.variants?.find((v) => v.id === line.variantId)
      if (variant) unitPrice = variant.price
    }
    for (const addOnId of line.addOnIds) {
      const addOn = item.addOns?.find((a) => a.id === addOnId)
      if (addOn) unitPrice += addOn.price
    }
    subtotal += unitPrice * line.qty
  }
  return subtotal
}

export function MenuPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  useSyncCartKey()

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Search state & Expandable toggle
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 200)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Filters & Customisation
  const [activeCategoryId, setActiveCategoryId] = useState<string>('')
  const [openItem, setOpenItem] = useState<MenuItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const getScopedOrderToken = useCallback(() => {
    try {
      const raw = localStorage.getItem('tm_last_order')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.restaurantId === session?.restaurant?.id && parsed?.trackingToken) {
          if (!parsed.createdAt || Date.now() - parsed.createdAt < 24 * 60 * 60 * 1000) {
            return parsed.trackingToken
          }
        }
      }
      return null
    } catch {
      return null
    }
  }, [session?.restaurant?.id])

  const [activeOrderToken, setActiveOrderToken] = useState<string | null>(getScopedOrderToken)

  useEffect(() => {
    setActiveOrderToken(getScopedOrderToken())
  }, [getScopedOrderToken])

  useEffect(() => {
    function syncToken() {
      setActiveOrderToken(getScopedOrderToken())
    }
    window.addEventListener('storage', syncToken)
    return () => window.removeEventListener('storage', syncToken)
  }, [getScopedOrderToken])

  // Cart store
  const lines = useCartStore((s) => s.lines)
  const addLine = useCartStore((s) => s.addLine)
  const quickAdjust = useCartStore((s) => s.quickAdjust)
  const totalCount = useCartStore((s) => s.totalCount)

  // O(1) item & category lookups
  const itemById = useMemo(() => {
    const map = new Map<string, MenuItem>()
    for (const item of items) {
      map.set(item.id, item)
    }
    return map
  }, [items])

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const cat of categories) {
      map.set(cat.id, cat)
    }
    return map
  }, [categories])

  // O(1) quantity map lookup per dish instead of O(N) .filter().reduce() per card
  const quantityByItemId = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of lines) {
      map.set(line.itemId, (map.get(line.itemId) || 0) + line.qty)
    }
    return map
  }, [lines])

  const cartQuantityFor = useCallback(
    (itemId: string) => quantityByItemId.get(itemId) || 0,
    [quantityByItemId]
  )

  const cartTotal = useMemo(() => estimateSubtotal(lines, itemById), [lines, itemById])

  // Refs for right panel scrolling and scroll-spy
  const rightPanelRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const isScrollingProgrammatically = useRef(false)
  const activeCategoryIdRef = useRef(activeCategoryId)
  activeCategoryIdRef.current = activeCategoryId

  // Load menu data
  const loadMenu = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const res = await api.menu.get()
      setCategories(res.categories)
      setItems(res.items)
      setActiveCategoryId((prev) => prev || res.categories[0]?.id || '')
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : 'Could not load the menu. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMenu()
  }, [loadMenu])

  // Auto-focus search input when expanded
  useEffect(() => {
    if (searchOpen) {
      const raf = requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [searchOpen])

  // Enriched categories with images for the sidebar
  const enrichedCategories: EnrichedCategory[] = useMemo(() => {
    return enrichCategories(categories)
  }, [categories])

  // Enriched items with structured add-ons, kcal, and original strikethrough prices
  const enrichedItems: EnrichedMenuItem[] = useMemo(() => {
    return items.map((i) => enrichMenuItem(i, items))
  }, [items])

  // Filter items live by search query (the whole menu is vegetarian, so no dietary filter)
  const filteredItems = useMemo(() => {
    const query = debouncedSearch.trim()
    return query ? searchMenuItems(enrichedItems, query) : enrichedItems
  }, [enrichedItems, debouncedSearch])

  const isSearching = debouncedSearch.trim().length > 0

  // Single-pass category grouping (O(N) instead of O(C * N))
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, EnrichedMenuItem[]>()
    for (const item of filteredItems) {
      let list = map.get(item.categoryId)
      if (!list) {
        list = []
        map.set(item.categoryId, list)
      }
      list.push(item)
    }
    // Sold-out dishes sink to the bottom of their category (stable sort keeps menu order otherwise)
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.isAvailable === false) - Number(b.isAvailable === false))
    }
    const groups: Array<{ category: Category; items: EnrichedMenuItem[] }> = []
    for (const cat of categories) {
      const catItems = map.get(cat.id)
      if (catItems && catItems.length > 0) {
        groups.push({ category: cat, items: catItems })
      }
    }
    return groups
  }, [categories, filteredItems])

  const visibleEnrichedCategories = useMemo(() => {
    const visibleCategoryIds = new Set(groupedByCategory.map((g) => g.category.id))
    return enrichedCategories.filter((c) => visibleCategoryIds.has(c.id))
  }, [enrichedCategories, groupedByCategory])

  // Scroll-spy: update active category in sidebar as user scrolls the right panel
  useEffect(() => {
    if (isSearching || !rightPanelRef.current) return
    const panel = rightPanelRef.current
    let rafId: number | null = null

    const updateActiveCategory = () => {
      if (isScrollingProgrammatically.current || groupedByCategory.length === 0) return

      // 1. At-bottom detection: if user has scrolled to or near the bottom,
      // the last category MUST be active regardless of its section height.
      const scrollRemaining = panel.scrollHeight - panel.scrollTop - panel.clientHeight
      if (scrollRemaining <= 60) {
        const lastGroup = groupedByCategory[groupedByCategory.length - 1]
        if (lastGroup && lastGroup.category.id !== activeCategoryIdRef.current) {
          activeCategoryIdRef.current = lastGroup.category.id
          setActiveCategoryId(lastGroup.category.id)
        }
        return
      }

      // Read scroll position and compare using container-relative offsetTop
      // (avoiding synchronous layout reflow from getBoundingClientRect on every scroll frame)
      const currentScrollTop = panel.scrollTop
      const focalLine = Math.min(120, panel.clientHeight * 0.25)
      const targetPos = currentScrollTop + focalLine
      let currentCatId = groupedByCategory[0]?.category.id ?? ''

      for (const group of groupedByCategory) {
        const el = sectionRefs.current[group.category.id]
        if (el && el.offsetTop <= targetPos) {
          currentCatId = group.category.id
        }
      }

      // Special handling for the last category: if entered upper half
      const lastGroup = groupedByCategory[groupedByCategory.length - 1]
      if (lastGroup) {
        const lastEl = sectionRefs.current[lastGroup.category.id]
        if (lastEl && lastEl.offsetTop <= currentScrollTop + panel.clientHeight * 0.55) {
          currentCatId = lastGroup.category.id
        }
      }

      // Only trigger React state update if the category actually changed
      if (currentCatId && currentCatId !== activeCategoryIdRef.current) {
        activeCategoryIdRef.current = currentCatId
        setActiveCategoryId(currentCatId)
      }
    }

    const handleScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateActiveCategory)
    }

    panel.addEventListener('scroll', handleScroll, { passive: true })

    // Initial check
    updateActiveCategory()

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      panel.removeEventListener('scroll', handleScroll)
    }
  }, [groupedByCategory, isSearching])

  // Tapping a category scrolls right panel smoothly to that section
  const handleSelectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId)
    const el = sectionRefs.current[categoryId]
    if (el && rightPanelRef.current) {
      isScrollingProgrammatically.current = true
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Use scrollend event if supported, otherwise fall back to a debounced scroll listener
      const panel = rightPanelRef.current
      if ('onscrollend' in window) {
        panel.addEventListener('scrollend', () => { isScrollingProgrammatically.current = false }, { once: true })
      } else {
        let timer: ReturnType<typeof setTimeout>
        const fallback = () => {
          clearTimeout(timer)
          timer = setTimeout(() => {
            isScrollingProgrammatically.current = false
            panel.removeEventListener('scroll', fallback)
          }, 150)
        }
        panel.addEventListener('scroll', fallback, { passive: true })
      }
    }
  }

  const handleOpenItem = useCallback((item: MenuItem) => {
    setOpenItem(item)
  }, [])

  const handleQuickAdd = useCallback(
    (item: MenuItem) => {
      if (item.isAvailable === false) return
      addLine({ itemId: item.id, addOnIds: [], qty: 1 })
    },
    [addLine]
  )

  const handleQuickAdjust = useCallback(
    (itemId: string, delta: number) => {
      quickAdjust(itemId, delta)
    },
    [quickAdjust]
  )

  const handleSheetAdd = (
    item: MenuItem,
    selection: { variantId?: string; addOnIds: string[]; qty: number }
  ) => {
    if (item.isAvailable === false) return
    addLine({
      itemId: item.id,
      variantId: selection.variantId,
      addOnIds: selection.addOnIds,
      qty: selection.qty,
    })
    setOpenItem(null)
  }

  if (loading) {
    return <CustomerMenuSkeleton />
  }

  if (loadError || !session) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6 text-center gap-3">
        <AlertCircle className="w-8 h-8 text-neutral-400" />
        <p className="text-sm text-neutral-600">{loadError || 'Something went wrong.'}</p>
        <button
          type="button"
          onClick={() => void loadMenu()}
          className="mt-2 min-h-[44px] px-5 py-2 whitespace-normal rounded-xl bg-neutral-900 text-white font-bold text-xs cursor-pointer hover:bg-neutral-800 active:scale-95 transition-all"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <CustomerTheme
      accent={session.restaurant.accent}
      brandFont={session.restaurant.brandFont}
      pwaThemeColor={session.restaurant.pwaThemeColor}
      slug={session.restaurant.slug}
      name={session.restaurant.name}
      logo={session.restaurant.logo}
    >
      {/* select-none is intentionally restricted to the page root so it prevents text selection on scroll/swipe gestures but doesn't prevent copy from article text inside */}
      <div className="h-[100dvh] flex flex-col bg-[#faf9f7] text-neutral-900 overflow-hidden">
        {/* Sticky Header: Back/Menu Icon, Page Title, Search Icon */}
        <header className="shrink-0 z-30 bg-[#faf9f7]/95 backdrop-blur-md border-b border-neutral-200/80 px-3 sm:px-6 min-h-[3.375rem] py-1.5 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {searchOpen ? (
              /* Expanded Search Field */
              <motion.div
                key="search-open"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="w-full flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search
                   
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
                  />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search dishes, rolls, ramen..."
                    className="w-full min-h-11 pl-9 pr-8 rounded-xl bg-white border border-neutral-200/90 text-base sm:text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[var(--customer-accent,#2563eb)]/30"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setSearchOpen(false)
                  }}
                  className="min-h-[44px] px-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
              </motion.div>
            ) : (
              /* Standard Header: Menu icon, Title, Search & Cart */
              <motion.div
                key="header-standard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex items-center justify-between"
              >
                {/* Left: Back / Menu drawer icon */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="group relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex flex-col items-center justify-center gap-[3.5px] bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-2xs hover:shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-all duration-200 active:scale-92 cursor-pointer"
                    aria-label="Open navigation menu"
                  >
                    {/* Architectural Staggered Three Lines */}
                    <span className="w-4 h-[2px] rounded-full bg-neutral-800 dark:bg-neutral-200 group-hover:bg-[var(--customer-accent,#2563eb)] group-hover:w-4.5 transition-all duration-200 origin-left" />
                    <span className="w-2.5 h-[2px] rounded-full bg-neutral-800 dark:bg-neutral-200 group-hover:bg-[var(--customer-accent,#2563eb)] group-hover:w-4.5 transition-all duration-200 origin-left" />
                    <span className="w-3.5 h-[2px] rounded-full bg-neutral-800 dark:bg-neutral-200 group-hover:bg-[var(--customer-accent,#2563eb)] group-hover:w-4.5 transition-all duration-200 origin-left" />

                    {/* Active Order Live Beacon Pip */}
                    {activeOrderToken && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 ring-2 ring-white dark:ring-neutral-900" />
                      </span>
                    )}
                  </button>

                  {session?.restaurant?.logo && (
                    <div className="w-9 h-9 rounded-2xl overflow-hidden border border-neutral-200/80 bg-white shrink-0 shadow-2xs">
                      <img
                        src={session.restaurant.logo}
                        alt={session.restaurant.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-base font-black text-neutral-900 tracking-tight leading-tight truncate">
                      {session?.restaurant?.name || 'Menu'}
                    </h1>
                    <div className="flex items-center gap-1 text-[0.6875rem] font-mono text-neutral-500 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{session?.tableLabel || 'Table'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Search Icon + Cart Button */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 shadow-2xs hover:shadow-xs transition-all active:scale-92 cursor-pointer"
                    aria-label="Search dishes"
                  >
                    <Search className="w-4 h-4 text-neutral-800 dark:text-neutral-200" />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/dining/cart')}
                    className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl flex items-center justify-center text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 shadow-2xs hover:shadow-xs transition-all active:scale-92 cursor-pointer"
                    aria-label={`View cart with ${totalCount()} items`}
                  >
                    <ShoppingBag className="w-4 h-4 text-neutral-800 dark:text-neutral-200" />
                    <AnimatePresence>
                      {totalCount() > 0 && (
                        <motion.span
                          key={totalCount()}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="absolute -top-1 -right-1 text-white text-[0.625rem] font-bold min-w-[1.125rem] h-[1.125rem] px-1 rounded-full flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: 'var(--customer-accent, #2563eb)' }}
                        >
                          {totalCount()}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Mobile category switcher — the sidebar rail is hidden below sm, so
            categories move into a horizontally scrollable tab bar instead. */}
        {!isSearching && visibleEnrichedCategories.length > 0 && (
          <div className="sm:hidden shrink-0 border-b border-neutral-200/80 bg-[#faf9f7]/95 px-3">
            <CategoryTabs
              categories={visibleEnrichedCategories}
              activeCategoryId={activeCategoryId}
              onSelect={handleSelectCategory}
            />
          </div>
        )}

        {/* Split View: Left Sidebar (~20%) + Right Panel (~80%) */}
        <div className="flex-1 min-h-0 flex overflow-hidden max-w-5xl xl:max-w-7xl w-full mx-auto">
          {/* Left Sidebar: Independently scrollable category cards */}
          {!isSearching && (
            <CategorySidebar
              categories={visibleEnrichedCategories}
              activeCategoryId={activeCategoryId}
              onSelect={handleSelectCategory}
            />
          )}

          {/* Right Panel: Scrollable dish cards grouped by category */}
          <main
            ref={rightPanelRef}
            className={`relative flex-1 min-h-0 min-w-0 overflow-y-auto touch-scroll px-2.5 sm:px-4 py-1.5 sm:py-2 ${
              totalCount() > 0 ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-[calc(1rem+env(safe-area-inset-bottom))]'
            }`}
          >
            {!isSearching && session.restaurant.heroImage && (
              <MenuHeroBanner
                heroImage={session.restaurant.heroImage}
                restaurantName={session.restaurant.name}
                logo={session.restaurant.logo}
                accent={session.restaurant.accent}
              />
            )}

            {/* Live order shortcut: guests previously had to open the drawer to find tracking */}
            {activeOrderToken && (
              <button
                type="button"
                onClick={() => navigate(`/dining/order/${activeOrderToken}`)}
                className="w-full mb-3 min-h-11 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-2 active:scale-[0.99] cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <span className="truncate">You have an active order</span>
                </span>
                <span className="shrink-0">Track →</span>
              </button>
            )}

            {/* Empty state */}
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                  <Utensils className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-neutral-800">No dishes found</p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  {isSearching
                    ? `Nothing matches "${debouncedSearch.trim()}". Try another word.`
                    : 'The menu is empty right now.'}
                </p>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                    }}
                    className="mt-1 px-4 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 text-white active:scale-95 transition-all cursor-pointer"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : isSearching ? (
              /* Search results */
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                  <span className="min-w-0 truncate">{filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setSearchOpen(false)
                    }}
                    className="text-xs text-[var(--customer-accent,#2563eb)] hover:underline cursor-pointer lowercase first-letter:uppercase"
                  >
                    Clear search
                  </button>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-3 gap-2.5 [&>*]:min-w-0">
                  {filteredItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      quantity={quantityByItemId.get(item.id) || 0}
                      onOpen={handleOpenItem}
                      onQuickAdd={handleQuickAdd}
                      onQuickAdjust={handleQuickAdjust}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Category Sections with Horizontal Dish Cards */
              <div className="space-y-6">
                {groupedByCategory.map((group) => (
                  <section
                    key={group.category.id}
                    data-category-id={group.category.id}
                    ref={(el) => {
                      sectionRefs.current[group.category.id] = el
                    }}
                    className="pt-1 scroll-mt-14"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-neutral-200/50">
                      <h2 className="text-sm sm:text-base font-black text-neutral-900 tracking-tight">
                        {group.category.name}
                      </h2>
                      <span className="text-xs font-bold text-neutral-400 font-mono">
                        {group.items.length}
                      </span>
                    </div>

                    {/* Horizontal cards: single column on phones, multi-column from tablet up */}
                    <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-3 gap-2.5 [&>*]:min-w-0">
                      {group.items.map((item) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          quantity={quantityByItemId.get(item.id) || 0}
                          onOpen={handleOpenItem}
                          onQuickAdd={handleQuickAdd}
                          onQuickAdjust={handleQuickAdjust}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Universal Brand Footer */}
            <BrandFooter variant="customer" showCta={true} />
          </main>
        </div>

        {/* Lazy Loaded Secondary Sheets */}
        <Suspense fallback={null}>
          {/* Full-Screen Customisation Screen */}
          <AnimatePresence>
            {openItem && (
              <ItemSheet
                item={openItem}
                allItems={items}
                onClose={() => setOpenItem(null)}
                onAdd={(selection) => handleSheetAdd(openItem, selection)}
              />
            )}
          </AnimatePresence>

          {/* Customer Mobile Navigation Drawer */}
          <CustomerNavigationDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            restaurant={session?.restaurant}
            tableLabel={session?.tableLabel}
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={handleSelectCategory}
            activeOrderToken={activeOrderToken}
          />
        </Suspense>

        {/* Floating Cart Bar */}
        <FloatingCartBar
          itemCount={totalCount()}
          total={cartTotal}
          onClick={() => navigate('/dining/cart')}
        />
      </div>
    </CustomerTheme>
  )
}
