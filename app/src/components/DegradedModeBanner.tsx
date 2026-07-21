import { useMemo } from 'react'
import { CloudOff, AlertTriangle, Lock } from 'lucide-react'
import { useResilience } from '@/contexts/resilience-context'
import { useTranslations } from '@/lib/i18n'

/**
 * Reports indexer, chain-transport, and backend-service degradation.
 */
function Banner({
  icon,
  title,
  body,
  color,
}: {
  icon: React.ReactNode
  title: string
  body: string
  color: 'gold' | 'danger' | 'warn'
}) {
  const borderColor = color === 'danger' ? 'var(--danger)' : color === 'warn' ? 'var(--warn)' : 'var(--gold)'
  const bgMix = color === 'danger' ? '8%' : color === 'warn' ? '8%' : '6%'
  const borderMix = color === 'danger' ? '30%' : color === 'warn' ? '30%' : '25%'
  const iconColor = color === 'danger' ? 'var(--danger)' : color === 'warn' ? 'var(--warn)' : 'var(--gold)'
  const titleColor = color === 'danger' ? 'var(--danger)' : 'var(--gold-deep)'

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 px-3 py-2.5 mb-2 rounded-sm"
      style={{
        backgroundColor: `color-mix(in srgb, ${borderColor} ${bgMix}, transparent)`,
        border: `1px solid color-mix(in srgb, ${borderColor} ${borderMix}, transparent)`,
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      <div className="flex-shrink-0 mt-0.5" style={{ color: iconColor }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: titleColor }}>{title}</p>
        <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--ink-2)' }}>{body}</p>
      </div>
    </div>
  )
}

export function DegradedModeBanner() {
  const { t } = useTranslations()
  const { indexerHealth, lastIndexedAt, papiReady, genesisError } = useResilience()

  const lastSyncedText = useMemo(() => {
    if (lastIndexedAt === null) return t.degradedMode.lastSyncedNever
    const date = new Date(lastIndexedAt)
    const hh = date.getHours().toString().padStart(2, '0')
    const mm = date.getMinutes().toString().padStart(2, '0')
    const ss = date.getSeconds().toString().padStart(2, '0')
    return t.degradedMode.lastSynced.replace('{time}', `${hh}:${mm}:${ss}`)
  }, [lastIndexedAt, t])

  const indexerDown = indexerHealth === 'down' || indexerHealth === 'degraded'
  const chainDown = !papiReady && !genesisError

  if (!indexerDown && !chainDown && !genesisError) return null

  return (
    <div className="mb-1">
      {/* Genesis mismatch */}
      {genesisError && (
        <Banner
          icon={<AlertTriangle className="w-4 h-4" />}
          color="danger"
          title={t.degradedMode.chainTitle}
          body={genesisError}
        />
      )}

      {/* Chain transport failure */}
      {chainDown && (
        <Banner
          icon={<AlertTriangle className="w-4 h-4" />}
          color="warn"
          title={t.degradedMode.chainTitle}
          body={t.degradedMode.chainBody}
        />
      )}

      {/* Indexer degradation */}
      {indexerDown && (
        <>
          <Banner
            icon={<CloudOff className="w-4 h-4" />}
            color="gold"
            title={t.degradedMode.title}
            body={
              papiReady
                ? `${t.degradedMode.indexerBody} ${t.degradedMode.writesAvailable}`
                : `${t.degradedMode.indexerBody} ${t.degradedMode.writesUnavailable}`
            }
          />
          <div className="px-3 pb-1">
            <span className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>
              {lastSyncedText}
            </span>
          </div>
        </>
      )}

      {/* Backend key and payment services */}
      {indexerDown && (
        <Banner
          icon={<Lock className="w-4 h-4" />}
          color="danger"
          title={t.degradedMode.backendTitle}
          body={t.degradedMode.backendBody}
        />
      )}
    </div>
  )
}
