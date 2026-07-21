import type { ThemeColors } from '@/hooks/useTheme'
import type { ReactNode } from 'react'

interface SectionHeadProps {
  eyebrow: string
  title: ReactNode
  sub?: string
  actions?: ReactNode
  colors?: ThemeColors
}

export function SectionHead({ eyebrow, title, sub, actions }: SectionHeadProps) {
  return (
    <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div className="allcaps mono" style={{ color: 'var(--ink-3)', marginBottom: 8 }}>
          {eyebrow}
        </div>
        <h2
          className="display"
          style={{ margin: 0, fontSize: 28, color: 'var(--ink)', wordBreak: 'break-word' }}
        >
          {title}
        </h2>
        {sub && (
          <p style={{ margin: '12px 0 0', color: 'var(--ink-2)', maxWidth: 540, fontSize: 13.5, lineHeight: 1.5 }}>
            {sub}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
