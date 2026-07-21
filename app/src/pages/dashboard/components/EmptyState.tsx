import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'

export function EmptyState({ icon: Icon, title, subtitle, action, colors: _colors }: {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
  colors?: ThemeColors
}) {
  return (
    <div
      className="p-8 text-center"
      style={{
        background: 'var(--bg-elev)',
        border: '2px dashed var(--line)',
        borderRadius: 2,
      }}
    >
      <Icon
        className="w-16 h-16 mx-auto mb-3"
        style={{ color: 'var(--ink-4)', animation: 'gentle-float 3s ease-in-out infinite' }}
      />
      <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{title}</p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary btn-sm mt-4">
          {action.label}
        </button>
      )}
    </div>
  )
}
