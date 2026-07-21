import { usePapi, type EffectiveTransport, type PapiState } from '@/contexts/papi-context'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import type { SseState } from '@/hooks/useIndexerStream'
import { useTranslations } from '@/lib/i18n'

type StatusKey = 'live' | 'connecting' | 'reconnecting' | 'offline'

function deriveStatus(
  papiState: PapiState,
  sseState: SseState,
): { color: string; key: StatusKey; pulse: boolean } {
  if (papiState === 'error') return { color: 'var(--danger)', key: 'offline', pulse: false }
  if (papiState === 'connecting') return { color: 'var(--warn)', key: 'connecting', pulse: true }
  if (papiState === 'reconnecting') return { color: 'var(--warn)', key: 'reconnecting', pulse: true }
  if (sseState === 'disconnected') return { color: 'var(--warn)', key: 'reconnecting', pulse: true }
  if (sseState === 'connecting') return { color: 'var(--warn)', key: 'connecting', pulse: true }
  return { color: 'var(--ok)', key: 'live', pulse: true }
}

function transportLabel(t: EffectiveTransport): string {
  return t === 'smoldot' ? 'LC' : 'WS'
}

interface ConnectionChipProps {
  onClick?: () => void
  showChainName?: boolean
  className?: string
}

export function ConnectionChip({ onClick, showChainName, className }: ConnectionChipProps) {
  const { papiState, effectiveTransport } = usePapi()
  const { sseState } = usePreloadedData()
  const { t } = useTranslations()
  const { color, key, pulse } = deriveStatus(papiState, sseState)
  const label = t.connectionChip[key]

  const text = showChainName
    ? `${t.connectionChip.chainName} · ${label} · ${transportLabel(effectiveTransport)}`
    : `${label} · ${transportLabel(effectiveTransport)}`

  return (
    <span
      className={`chip ${className ?? ''}`}
      style={{ fontSize: showChainName ? 11 : 9, padding: showChainName ? '3px 8px' : '2px 6px', gap: 4, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
    >
      <span
        className={`chip-dot ${pulse ? 'pulse' : ''}`}
        style={{ width: 5, height: 5, background: color }}
      />
      <span style={{ color }}>{text}</span>
    </span>
  )
}
