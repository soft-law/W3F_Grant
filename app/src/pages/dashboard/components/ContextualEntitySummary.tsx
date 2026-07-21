import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'

export function ContextualEntitySummary({
  label,
  title,
  subtitle,
  imageUrl,
  fallbackIcon: FallbackIcon,
  isLoading = false,
  unavailableText,
}: {
  label: string
  title?: string
  subtitle?: string
  imageUrl?: string
  fallbackIcon: LucideIcon
  isLoading?: boolean
  unavailableText: string
}) {
  return (
    <div data-testid="contextual-entity-summary">
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{label}</p>
      {isLoading ? (
        <div className="animate-pulse rounded-sm h-14" style={{ backgroundColor: 'var(--bg-elev-2)' }} />
      ) : title ? (
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-sm"
          style={{
            background: 'color-mix(in srgb, var(--gold) 7%, var(--bg-elev-2))',
            border: '1px solid var(--gold-deep)',
          }}
        >
          <div className="w-10 h-10 flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: 'var(--bg-elev)' }}>
            {imageUrl
              ? <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              : <FallbackIcon className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>{title}</p>
            {subtitle && <p className="text-[10px] truncate" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>}
          </div>
          <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" style={{ color: 'var(--gold-text)' }} />
        </div>
      ) : (
        <p role="alert" className="text-xs p-3" style={{ color: 'var(--danger)', border: '1px solid var(--danger)' }}>
          {unavailableText}
        </p>
      )}
    </div>
  )
}
