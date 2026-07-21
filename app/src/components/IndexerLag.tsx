import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle } from 'lucide-react'
import { fetchIndexer } from '@/lib/indexer'

interface HealthResponse {
  status: string
  lastIndexedBlock: number
  chainHead: number
  lag: number
  // Unix seconds of the most recent indexed-block advance.
  lastIndexedBlockTimestamp?: number
}

const POLL_INTERVAL_MS = 15_000
const SLOW_POLL_INTERVAL_MS = 60_000
const ERROR_THRESHOLD = 3

// Tier thresholds (blocks): hidden ≤ 20, amber (warn) > 20, red (critical) > 100
const AMBER_LAG = 20
const RED_LAG = 100
// Catches the wedge case where chain quietly advances but indexer doesn't:
// `lag` would creep up over time, but staleness flips amber in 90s and red
// in 5min — much faster than waiting for `lag` to cross 20 blocks (~2min).
const AMBER_STALE_SEC = 90
const RED_STALE_SEC = 300

type Tier = 'hidden' | 'amber' | 'red' | 'unreachable'

/**
 * Indexer freshness indicator. It reflects lag and last-advance time without
 * gating writes, which use fresh chain preflight checks.
 */
export function IndexerLag() {
  const [tier, setTier] = useState<Tier>('hidden')
  const [lagBlocks, setLagBlocks] = useState(0)
  const [showUnreachable, setShowUnreachable] = useState(false)

  useEffect(() => {
    let cancelled = false
    let errorStreak = 0
    let unreachableTimeoutId: number | undefined

    const tick = async (): Promise<number> => {
      try {
        const h = await fetchIndexer<HealthResponse>('/api/health')
        if (cancelled) return POLL_INTERVAL_MS
        errorStreak = 0
        setShowUnreachable(false)
        if (unreachableTimeoutId) {
          window.clearTimeout(unreachableTimeoutId)
          unreachableTimeoutId = undefined
        }
        setLagBlocks(h.lag)
        // Use the higher severity of block lag and timestamp staleness.
        const stalenessSec = h.lastIndexedBlockTimestamp && h.lastIndexedBlockTimestamp > 0
          ? Math.max(0, Math.floor(Date.now() / 1000) - h.lastIndexedBlockTimestamp)
          : 0
        let nextTier: Tier
        if (h.lag <= AMBER_LAG && stalenessSec < AMBER_STALE_SEC) nextTier = 'hidden'
        else if (h.lag > RED_LAG || stalenessSec >= RED_STALE_SEC) nextTier = 'red'
        else nextTier = 'amber'
        setTier(nextTier)
        return POLL_INTERVAL_MS
      } catch {
        if (cancelled) return POLL_INTERVAL_MS
        errorStreak += 1
        setTier('unreachable')
        setShowUnreachable(true)
        // Auto-hide the "unreachable" badge after 5s if errors continue silently
        if (unreachableTimeoutId) window.clearTimeout(unreachableTimeoutId)
        unreachableTimeoutId = window.setTimeout(() => {
          if (!cancelled) setShowUnreachable(false)
        }, 5_000)
        return errorStreak >= ERROR_THRESHOLD ? SLOW_POLL_INTERVAL_MS : POLL_INTERVAL_MS
      }
    }

    let timeoutId: number | undefined
    const loop = async () => {
      const nextDelay = await tick()
      if (cancelled) return
      timeoutId = window.setTimeout(loop, nextDelay)
    }
    void loop()
    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
      if (unreachableTimeoutId) window.clearTimeout(unreachableTimeoutId)
    }
  }, [])

  if (tier === 'hidden') return null
  if (tier === 'unreachable' && !showUnreachable) return null

  const isUnreachable = tier === 'unreachable'
  const isRed = tier === 'red'
  const Icon = isRed || isUnreachable ? AlertCircle : AlertTriangle
  const color = isRed || isUnreachable ? 'var(--danger)' : 'var(--warn)'
  const bg = isRed || isUnreachable
    ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
    : 'color-mix(in srgb, var(--warn) 12%, transparent)'
  const border = isRed || isUnreachable
    ? 'color-mix(in srgb, var(--danger) 30%, transparent)'
    : 'color-mix(in srgb, var(--warn) 30%, transparent)'

  const label = isUnreachable
    ? 'Indexer unreachable'
    : `Lag ~${Math.max(6, lagBlocks * 6)}s`

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 mono text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
      title={isUnreachable
        ? 'Indexer health endpoint is unreachable. Writes still go through chain directly.'
        : 'Display data may be slightly behind chain. Writes still go through chain directly. Actions are safe.'}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}
