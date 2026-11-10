import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Reusable helper to render N skeleton items without repeating array literals
 */
function SkeletonItems({
  count,
  children,
}: {
  count: number
  children: (index: number) => ReactNode
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => children(i))}
    </>
  )
}

/**
 * Base Skeleton Component
 * Marked aria-hidden="true" to avoid polluting accessibility tree.
 * Uses compositor-friendly opacity pulse by default.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-muted/60 animate-skeleton-pulse rounded-xl', className)}
      {...props}
    />
  )
}

/**
 * Accessible Loading Spinner
 */
export function Spinner({
  size = 'md',
  className,
  label = 'Loading...',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'animate-spin rounded-full border-2 border-primary border-t-transparent',
        sizeClass,
        className
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}

export { Spinner as Loader2 }

/**
 * Owner Dashboard (/app) Skeleton
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonItems count={4}>
          {(i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-md" />
            </div>
          )}
        </SkeletonItems>
      </div>

      {/* Operations Quick Bar */}
      <div className="p-4 rounded-2xl border border-border/70 bg-card/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Main 2-Column Split: Revenue Chart & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl border border-border/70 bg-card/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

        <div className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-3">
            <SkeletonItems count={4}>
              {(i) => (
                <div key={i} className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24 rounded-md" />
                    <Skeleton className="h-4 w-14 rounded-md" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-32 rounded-md" />
                    <Skeleton className="h-3 w-12 rounded-md" />
                  </div>
                </div>
              )}
            </SkeletonItems>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Analytics Page (/app/analytics) Skeleton
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Date Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <SkeletonItems count={5}>
          {(i) => <Skeleton key={i} className="h-8 w-20 rounded-xl shrink-0" />}
        </SkeletonItems>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonItems count={4}>
          {(i) => (
            <div key={i} className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-2.5">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-7 w-36 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
          )}
        </SkeletonItems>
      </div>

      {/* 2 Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonItems count={2}>
          {(i) => (
            <div key={i} className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-4">
              <Skeleton className="h-5 w-44 rounded-md" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          )}
        </SkeletonItems>
      </div>

      {/* Table2 Skeleton */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        <SkeletonItems count={5}>
          {(i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Live Orders Page (/app/orders) Skeleton
 */
export function LiveOrdersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="h-4 w-52 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <SkeletonItems count={6}>
          {(i) => <Skeleton key={i} className="h-9 w-24 rounded-xl shrink-0" />}
        </SkeletonItems>
      </div>

      {/* Order Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SkeletonItems count={6}>
          {(i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-4 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between border-b border-border/50 pb-3">
                  <div className="space-y-1">
                    <Skeleton className="h-6 w-24 rounded-md" />
                    <Skeleton className="h-3.5 w-32 rounded-md" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="space-y-2 py-1">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
              </div>
              <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Kitchen KDS (/app/kds) Skeleton
 */
export function KDSSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-border/70 bg-card/60">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-6 w-44 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* 3 Preparation Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['New Courses', 'Preparing', 'Ready'].map((lane) => (
          <div
            key={lane}
            className="rounded-2xl border border-border/70 bg-card/40 p-4 flex flex-col min-h-[520px] space-y-3"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <SkeletonItems count={2}>
              {(card) => (
                <div
                  key={card}
                  className="p-4 rounded-xl border border-border/60 bg-card/80 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-4 w-12 rounded-md" />
                  </div>
                  <div className="space-y-1.5 py-1">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                  </div>
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              )}
            </SkeletonItems>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Tables & QR (/app/tables) Skeleton
 */
export function TablesGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-56 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Section / Filter Pills */}
      <div className="flex items-center gap-2">
        <SkeletonItems count={4}>
          {(i) => <Skeleton key={i} className="h-8 w-24 rounded-xl" />}
        </SkeletonItems>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <SkeletonItems count={8}>
          {(i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col justify-between h-48 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-14 w-14 rounded-xl mx-auto" />
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
                <Skeleton className="h-8 w-1/2 rounded-lg" />
                <Skeleton className="h-8 w-1/2 rounded-lg" />
              </div>
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Waiter Floor (/app/waiter) Skeleton
 */
export function WaiterFloorSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-44 rounded-lg" />
          <Skeleton className="h-4 w-60 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Quick Filter Bar */}
      <div className="flex items-center gap-2">
        <SkeletonItems count={4}>
          {(i) => <Skeleton key={i} className="h-8 w-24 rounded-xl" />}
        </SkeletonItems>
      </div>

      {/* Tables Floor Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <SkeletonItems count={8}>
          {(i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col justify-between h-40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Menu Catalog (/app/menu) Skeleton
 */
export function MenuCatalogSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <SkeletonItems count={5}>
            {(i) => <Skeleton key={i} className="h-9 w-24 rounded-xl shrink-0" />}
          </SkeletonItems>
        </div>
        <Skeleton className="h-10 w-full sm:w-64 rounded-xl" />
      </div>

      {/* Dishes List */}
      <div className="rounded-2xl border border-border/70 bg-card/60 divide-y divide-border/40 overflow-hidden">
        <SkeletonItems count={6}>
          {(i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-5 w-36 rounded-md" />
                  <Skeleton className="h-3.5 w-60 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Staff Directory (/app/staff or /app/members) Skeleton
 */
export function StaffDirectorySkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Role Counts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SkeletonItems count={6}>
          {(i) => (
            <div key={i} className="p-3.5 rounded-xl border border-border/60 bg-card/40 space-y-2">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-6 w-10 rounded-md" />
            </div>
          )}
        </SkeletonItems>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonItems count={6}>
          {(i) => (
            <div key={i} className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-44 rounded-md" />
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Coupons Directory (/app/coupons) Skeleton
 */
export function CouponsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SkeletonItems count={3}>
            {(i) => <Skeleton key={i} className="h-8 w-24 rounded-xl" />}
          </SkeletonItems>
        </div>
        <Skeleton className="h-9 w-60 rounded-xl" />
      </div>

      {/* Coupons Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonItems count={6}>
          {(i) => (
            <div key={i} className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-28 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3.5 w-1/2 rounded-md" />
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Settings Page (/app/settings) Skeleton
 */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2 border-b border-border/60 pb-4">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
      </div>

      {/* Section 1: Store Information */}
      <div className="p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
        <Skeleton className="h-5 w-36 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      {/* Section 2: Taxation & Currency */}
      <div className="p-6 rounded-2xl border border-border/70 bg-card/60 space-y-4">
        <Skeleton className="h-5 w-36 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Rewards Settings (/app/rewards) Skeleton
 */
export function RewardsSettingsSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-border/60 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Probability Gauge */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>

      {/* Wheel Slices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonItems count={6}>
          {(i) => (
            <div key={i} className="p-5 rounded-2xl border border-border/70 bg-card/60 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          )}
        </SkeletonItems>
      </div>
    </div>
  )
}

/**
 * Customer Menu (/menu) Skeleton
 * 100% pure component: Zero DOM side-effects, zero dark class toggling.
 * Clean, lightweight layout silhouette.
 */
export function CustomerMenuSkeleton() {
  return (
    <div className="h-[100dvh] flex flex-col bg-[#faf9f7] text-neutral-900 select-none overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-[#faf9f7]/95 border-b border-neutral-200/80 px-4 h-[54px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-lg !bg-neutral-200/80" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28 rounded-md !bg-neutral-200/80" />
            <Skeleton className="h-2.5 w-16 rounded-md !bg-neutral-200/60" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-10 h-10 rounded-2xl !bg-neutral-200/80" />
          <Skeleton className="w-10 h-10 rounded-2xl !bg-neutral-200/80" />
        </div>
      </header>

      {/* Main Split Layout: Left Sidebar + Right Dish Panel */}
      <div className="flex-1 flex overflow-hidden max-w-5xl mx-auto w-full">
        {/* Left Category Sidebar */}
        <aside className="self-start h-fit w-[74px] sm:w-[88px] shrink-0 bg-[#f4f3ef] rounded-2xl border border-neutral-200/80 p-1 sm:p-1.5 flex flex-col items-center space-y-1.5 my-2 ml-2 shadow-2xs">
          <SkeletonItems count={5}>
            {(i) => (
              <div
                key={i}
                className="w-[66px] sm:w-[78px] min-h-[66px] sm:min-h-[74px] p-1.5 rounded-xl flex flex-col items-center justify-center gap-1.5 bg-white/60 border border-neutral-200/50"
              >
                <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg !bg-neutral-200/80" />
                <Skeleton className="h-2.5 w-11 rounded !bg-neutral-200/70" />
              </div>
            )}
          </SkeletonItems>
        </aside>

        {/* Right Dish Panel */}
        <main className="flex-1 overflow-y-auto px-2.5 sm:px-4 py-2 space-y-3">
          {/* Filter pill bar */}
          <div className="pb-2 pt-0.5 border-b border-neutral-200/60 mb-3 flex items-center justify-between">
            <Skeleton className="h-8 w-44 rounded-full !bg-neutral-200/80" />
          </div>

          {/* Category Section Header */}
          <div className="pt-1">
            <Skeleton className="h-5 w-32 rounded-md !bg-neutral-300/80" />
          </div>

          {/* Dish Cards */}
          <div className="space-y-3">
            <SkeletonItems count={4}>
              {(i) => (
                <div
                  key={i}
                  className="flex flex-row bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden h-[134px] sm:h-[138px] w-full"
                >
                  {/* Left Food Image Skeleton */}
                  <Skeleton className="w-[112px] sm:w-[132px] h-full shrink-0 !bg-neutral-200/80 !rounded-none" />

                  {/* Right Details Skeleton */}
                  <div className="flex-1 p-3 sm:p-3.5 flex flex-col justify-between min-w-0">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-3/4 rounded-md !bg-neutral-200/90" />
                      <Skeleton className="h-3 w-5/6 rounded-md !bg-neutral-100" />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Skeleton className="h-5 w-16 rounded-md !bg-neutral-300/80" />
                      <Skeleton className="h-8 w-18 rounded-lg !bg-neutral-200/80" />
                    </div>
                  </div>
                </div>
              )}
            </SkeletonItems>
          </div>
        </main>
      </div>
    </div>
  )
}

/**
 * Customer Order Tracking (/order/:token) Skeleton
 */
export function CustomerTrackingSkeleton() {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-neutral-900 p-4 sm:p-6 max-w-xl mx-auto space-y-4 select-none">
      {/* Status Hero Card */}
      <div className="p-6 rounded-2xl border border-neutral-200/80 bg-white text-center space-y-3">
        <Skeleton className="w-14 h-14 rounded-full mx-auto bg-neutral-200/80" />
        <Skeleton className="h-6 w-40 rounded-md mx-auto bg-neutral-300/80" />
        <Skeleton className="h-3.5 w-60 rounded-md mx-auto bg-neutral-200/60" />
      </div>

      {/* Progress Timeline */}
      <div className="p-5 rounded-2xl border border-neutral-200/80 bg-white space-y-4">
        <Skeleton className="h-4 w-32 rounded-md bg-neutral-300/80" />
        <div className="space-y-3">
          <SkeletonItems count={4}>
            {(i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-full shrink-0 bg-neutral-200/80" />
                <Skeleton className="h-4 w-40 rounded-md bg-neutral-200/60" />
              </div>
            )}
          </SkeletonItems>
        </div>
      </div>

      {/* Bill Summary */}
      <div className="p-5 rounded-2xl border border-neutral-200/80 bg-white space-y-3">
        <Skeleton className="h-4 w-28 rounded-md bg-neutral-300/80" />
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-24 rounded bg-neutral-200/60" />
            <Skeleton className="h-3.5 w-16 rounded bg-neutral-200/60" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28 rounded bg-neutral-300/80" />
            <Skeleton className="h-4 w-20 rounded bg-neutral-300/80" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Full Dashboard Page Shell Skeleton (for Suspense and ProtectedRoute fallback)
 */
export function PageShellSkeleton() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg-canvas)] flex">
      {/* Sidebar Placeholder (Desktop) */}
      <aside className="hidden md:flex w-16 xl:w-64 border-r border-border/70 bg-card/50 p-4 flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
          <div className="space-y-2">
            <SkeletonItems count={7}>
              {(i) => <Skeleton key={i} className="h-9 w-full rounded-xl" />}
            </SkeletonItems>
          </div>
        </div>
        <div className="pt-4 border-t border-border/50 flex items-center gap-3 px-2">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border/70 bg-card/40 px-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-36 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-full" />
          </div>
        </header>

        {/* Page Body: Dashboard Skeleton */}
        <div className="flex-1 p-3.5 sm:p-5 lg:p-8 overflow-y-auto">
          <DashboardSkeleton />
        </div>
      </main>
    </div>
  )
}
