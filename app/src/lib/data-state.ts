/**
 * Data provenance for indexed, cached, direct-chain, and unavailable results.
 * A failed request with no usable cache is represented as `unavailable`, never
 * as an empty successful result.
 */

export type DataState =
  | 'live-indexed'
  | 'cached-indexed'
  | 'chain-direct-partial'
  | 'unavailable'

export interface DataStateMeta {
  state: DataState
  /** Epoch ms of the last successful fetch that produced the displayed data. */
  lastUpdated: number | null
  /** Human-readable provenance label for badges. */
  source: 'indexer' | 'cache' | 'chain' | 'none'
  /** Short error message when state ≠ live-indexed (for tooltips). */
  error?: string
}

/**
 * Aggregate multiple per-query data states into a single banner-level state.
 * Worst-case wins so the banner reflects the most degraded active source.
 */
export function aggregateDataState(states: DataState[]): DataState {
  if (states.length === 0) return 'live-indexed'
  if (states.includes('unavailable')) return 'unavailable'
  if (states.includes('cached-indexed')) return 'cached-indexed'
  if (states.includes('chain-direct-partial')) return 'chain-direct-partial'
  return 'live-indexed'
}

export interface DeriveQueryStateParams {
  isLoading: boolean
  isError: boolean
  /** Whether the query produced live data this fetch cycle. */
  hasData: boolean
  /** Whether a durable-cache fallback is available to show. */
  hasCachedFallback: boolean
}

/** Map a React Query result onto the live, cached, or unavailable data state. */
export function deriveQueryState(params: DeriveQueryStateParams): DataState {
  const { isLoading, isError, hasData, hasCachedFallback } = params

  if (!isError) return 'live-indexed'

  if (hasData || hasCachedFallback) return 'cached-indexed'

  if (!isLoading) return 'unavailable'

  return 'unavailable'
}

/**
 * Build a full DataStateMeta from a query result and optional cache metadata.
 */
export function buildDataStateMeta(params: {
  state: DataState
  lastUpdated: number | null
  error?: string
}): DataStateMeta {
  const sourceMap: Record<DataState, DataStateMeta['source']> = {
    'live-indexed': 'indexer',
    'cached-indexed': 'cache',
    'chain-direct-partial': 'chain',
    'unavailable': 'none',
  }
  return {
    state: params.state,
    lastUpdated: params.lastUpdated,
    source: sourceMap[params.state],
    error: params.error,
  }
}

/** Classify indexer health from the latest attempt and recent failures. */
export function classifyIndexerHealth(params: {
  failureCount: number
  lastSuccessAt: number | null
  lastFailureAt: number | null
  lastEvent?: 'success' | 'failure' | null
  now: number
  recoveryWindowMs: number
}): 'healthy' | 'degraded' | 'down' {
  const { failureCount, lastSuccessAt, lastFailureAt, lastEvent, now, recoveryWindowMs } = params

  if (failureCount === 0 && lastSuccessAt !== null) return 'healthy'

  // Determine whether the most recent event was a failure. When timestamps
  // collide (same ms), fall back to `lastEvent` to break the tie correctly.
  const lastWasFailure = lastEvent !== undefined && lastEvent !== null
    ? lastEvent === 'failure'
    : lastFailureAt !== null && (lastSuccessAt === null || lastFailureAt > lastSuccessAt)

  if (lastWasFailure) {
    if (lastSuccessAt !== null && lastEvent === 'failure') {
      return 'down'
    }
    if (lastSuccessAt === null) return 'down'
    return 'down'
  }

  // Recently recovered — show degraded until the recovery window passes.
  if (lastSuccessAt !== null && now - lastSuccessAt < recoveryWindowMs && failureCount > 0) {
    return 'degraded'
  }

  return 'healthy'
}
