import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'

export function StatCard({ label, value, icon: Icon, accent, colors: _colors }: {
  label: string
  value: number | string
  icon: LucideIcon
  accent?: boolean
  colors?: ThemeColors
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className="w-4 h-4 flex-shrink-0"
          style={{ color: accent ? 'var(--gold-text)' : 'var(--ink-4)' }}
        />
        <span className="allcaps" style={{ color: 'var(--ink-3)' }}>{label}</span>
      </div>
      <p
        className="display"
        style={{ fontSize: 28, color: 'var(--ink)', margin: 0 }}
      >
        {value}
      </p>
    </div>
  )
}
