import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useIsPaused, type ContractName } from '@/hooks/useContracts'
import { useTranslations } from '@/lib/i18n'

// Informational only; contract checks remain authoritative.

const CONTRACT_LABELS: Record<ContractName, string> = {
  IPAsset: 'IPAsset',
  LicenseToken: 'LicenseToken',
  Marketplace: 'Marketplace',
  GovernanceArbitrator: 'GovernanceArbitrator',
  RevenueDistributor: 'RevenueDistributor',
}

export function ContractPausedBanner() {
  const { t } = useTranslations()
  const { paused, anyPaused, isLoading } = useIsPaused()

  const pausedContracts = useMemo(
    () => (Object.keys(paused) as ContractName[]).filter((c) => paused[c] === true),
    [paused],
  )

  if (isLoading || !anyPaused || pausedContracts.length === 0) return null

  const names = pausedContracts.map((c) => CONTRACT_LABELS[c]).join(' · ')

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-3 py-2.5 mb-3 rounded-sm"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
        borderLeft: '4px solid var(--danger)',
      }}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: 'var(--danger)' }}>
          {t.pausedBanner.title}
        </p>
        <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--ink-2)' }}>
          {t.pausedBanner.body} <span className="mono">{names}</span>
        </p>
      </div>
    </div>
  )
}
