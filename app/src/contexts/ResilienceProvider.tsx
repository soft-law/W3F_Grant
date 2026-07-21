/**
 * Provides indexer health, verified chain identity, transport readiness, and
 * session-scoped optimistic entities to data and banner consumers.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { indexerHealth, type IndexerHealth } from '@/lib/indexer-health'
import type { DataState } from '@/lib/data-state'
import { isDurableCacheAvailable, evictStalePartitions } from '@/lib/durable-cache'
import { setVerifiedGenesisHash } from '@/lib/indexer'
import { usePapi } from '@/contexts/papi-context'
import type { OptimisticAsset, OptimisticLicense, OptimisticListing, OptimisticDispute } from '@/lib/optimistic-state'
import { ResilienceContext, type ResilienceContextValue } from '@/contexts/resilience-context'

function deriveAggregateState(health: IndexerHealth): DataState {
  if (health === 'down') return 'cached-indexed'
  if (health === 'degraded') return 'cached-indexed'
  return 'live-indexed'
}

export function ResilienceProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    (cb) => indexerHealth.subscribe(cb),
    () => indexerHealth.snapshot(),
    () => indexerHealth.snapshot(),
  )

  const { genesisHash, genesisError, isReady: papiReady } = usePapi()
  const [isCacheAvailable] = useState(() => isDurableCacheAvailable())

  // The genesis hash is verified before cache partitions are selected.
  useEffect(() => {
    if (genesisHash) void evictStalePartitions(genesisHash)
  }, [genesisHash])

  // Scope indexer caching to the verified chain.
  useEffect(() => {
    setVerifiedGenesisHash(genesisHash)
    return () => setVerifiedGenesisHash(null)
  }, [genesisHash])

  // Optimistic entities — session-scoped, in-memory only.
  const [optimisticAssets, setOptimisticAssets] = useState<OptimisticAsset[]>([])
  const [optimisticLicenses, setOptimisticLicenses] = useState<OptimisticLicense[]>([])
  const [optimisticListings, setOptimisticListings] = useState<OptimisticListing[]>([])
  const [optimisticDisputes, setOptimisticDisputes] = useState<OptimisticDispute[]>([])

  const addOptimistic = useCallback((entities: {
    assets?: OptimisticAsset[]
    licenses?: OptimisticLicense[]
    listings?: OptimisticListing[]
    disputes?: OptimisticDispute[]
  }) => {
    if (entities.assets?.length) {
      setOptimisticAssets((prev) => {
        const existing = new Set(prev.map((a) => a.tokenId.toString()))
        return [...prev, ...entities.assets!.filter((a) => !existing.has(a.tokenId.toString()))]
      })
    }
    if (entities.licenses?.length) {
      setOptimisticLicenses((prev) => {
        const existing = new Set(prev.map((l) => l.licenseId.toString()))
        return [...prev, ...entities.licenses!.filter((l) => !existing.has(l.licenseId.toString()))]
      })
    }
    if (entities.listings?.length) {
      setOptimisticListings((prev) => {
        const existing = new Set(prev.map((l) => l.listingId))
        return [...prev, ...entities.listings!.filter((l) => !existing.has(l.listingId))]
      })
    }
    if (entities.disputes?.length) {
      setOptimisticDisputes((prev) => {
        const existing = new Set(prev.map((d) => d.disputeId.toString()))
        return [...prev, ...entities.disputes!.filter((d) => !existing.has(d.disputeId.toString()))]
      })
    }
  }, [])

  const reconcileOptimistic = useCallback((ids: {
    assetIds?: bigint[]
    licenseIds?: bigint[]
    listingIds?: string[]
    disputeIds?: bigint[]
  }) => {
    const removeMatched = <T,>(
      previous: T[],
      shouldRemove: (item: T) => boolean,
    ): T[] => {
      const next = previous.filter((item) => !shouldRemove(item))
      return next.length === previous.length ? previous : next
    }
    if (ids.assetIds?.length) {
      const set = new Set(ids.assetIds.map(String))
      setOptimisticAssets((prev) => removeMatched(prev, (a) => set.has(a.tokenId.toString())))
    }
    if (ids.licenseIds?.length) {
      const set = new Set(ids.licenseIds.map(String))
      setOptimisticLicenses((prev) => removeMatched(prev, (l) => set.has(l.licenseId.toString())))
    }
    if (ids.listingIds?.length) {
      const set = new Set(ids.listingIds)
      setOptimisticListings((prev) => removeMatched(prev, (l) => set.has(l.listingId)))
    }
    if (ids.disputeIds?.length) {
      const set = new Set(ids.disputeIds.map(String))
      setOptimisticDisputes((prev) => removeMatched(prev, (d) => set.has(d.disputeId.toString())))
    }
  }, [])

  const aggregateState = useMemo(
    () => deriveAggregateState(snapshot.health),
    [snapshot.health],
  )

  const value = useMemo<ResilienceContextValue>(() => ({
    indexerHealth: snapshot.health,
    lastIndexedAt: snapshot.lastSuccessAt,
    genesisHash,
    genesisError,
    isCacheAvailable,
    aggregateState,
    papiReady,
    optimistic: {
      assets: optimisticAssets,
      licenses: optimisticLicenses,
      listings: optimisticListings,
      disputes: optimisticDisputes,
      add: addOptimistic,
      reconcile: reconcileOptimistic,
    },
  }), [
    snapshot.health,
    snapshot.lastSuccessAt,
    genesisHash,
    genesisError,
    isCacheAvailable,
    aggregateState,
    papiReady,
    optimisticAssets,
    optimisticLicenses,
    optimisticListings,
    optimisticDisputes,
    addOptimistic,
    reconcileOptimistic,
  ])

  return (
    <ResilienceContext.Provider value={value}>
      {children}
    </ResilienceContext.Provider>
  )
}
