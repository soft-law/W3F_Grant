import type { ThemeColors } from '@/hooks/useTheme'

export function SkeletonCard({ colors }: { colors: ThemeColors }) {
  return (
    <div className="rounded-sm overflow-hidden" style={{ backgroundColor: colors.background.secondary, border: `1px solid ${colors.border.primary}`, padding: 10 }}>
      <div className="aspect-square rounded-sm animate-skeleton" style={{ backgroundColor: colors.background.tertiary, animationDelay: '0s' }} />
      <div className="mt-3 space-y-2">
        <div className="h-3 rounded-sm animate-skeleton" style={{ backgroundColor: colors.background.tertiary, width: '100%', animationDelay: '0.1s' }} />
        <div className="h-3 rounded-sm animate-skeleton" style={{ backgroundColor: colors.background.tertiary, width: '60%', animationDelay: '0.2s' }} />
        <div className="h-3 rounded-sm animate-skeleton" style={{ backgroundColor: colors.background.tertiary, width: '40%', animationDelay: '0.3s' }} />
      </div>
      <div className="mt-3 h-8 rounded animate-skeleton" style={{ backgroundColor: colors.background.tertiary, animationDelay: '0.4s' }} />
    </div>
  )
}

/**
 * Responsive loading grid matching dashboard card dimensions.
 */
export function SkeletonGrid({ colors, count = 4 }: { colors: ThemeColors; count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} colors={colors} />
      ))}
    </div>
  )
}

/**
 * Loading rows for the Explorer activity feed.
 */
export function SkeletonEventRows({ colors, count = 5 }: { colors: ThemeColors; count?: number }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-sm animate-skeleton flex-shrink-0"
            style={{ backgroundColor: colors.background.tertiary, animationDelay: `${i * 0.08}s` }}
          />
          <div
            className="h-3 rounded-sm animate-skeleton flex-1"
            style={{ backgroundColor: colors.background.tertiary, animationDelay: `${i * 0.08 + 0.04}s` }}
          />
          <div
            className="h-3 rounded-sm animate-skeleton"
            style={{ backgroundColor: colors.background.tertiary, width: 56, animationDelay: `${i * 0.08 + 0.08}s` }}
          />
        </div>
      ))}
    </div>
  )
}
