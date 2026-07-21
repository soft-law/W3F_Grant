import { createContext, useContext } from 'react'
import type { IndexerHealth } from '@/lib/indexer-health'
import type { DataState } from '@/lib/data-state'
import type {
  OptimisticAsset,
  OptimisticLicense,
  OptimisticListing,
  OptimisticDispute,
} from '@/lib/optimistic-state'

export interface ResilienceContextValue {
  indexerHealth: IndexerHealth
  lastIndexedAt: number | null
  genesisHash: string | null
  genesisError: string | null
  isCacheAvailable: boolean
  aggregateState: DataState
  papiReady: boolean
  optimistic: {
    assets: OptimisticAsset[]
    licenses: OptimisticLicense[]
    listings: OptimisticListing[]
    disputes: OptimisticDispute[]
    add: (entities: {
      assets?: OptimisticAsset[]
      licenses?: OptimisticLicense[]
      listings?: OptimisticListing[]
      disputes?: OptimisticDispute[]
    }) => void
    reconcile: (ids: {
      assetIds?: bigint[]
      licenseIds?: bigint[]
      listingIds?: string[]
      disputeIds?: bigint[]
    }) => void
  }
}

export const ResilienceContext = createContext<ResilienceContextValue>({
  indexerHealth: 'healthy',
  lastIndexedAt: null,
  genesisHash: null,
  genesisError: null,
  isCacheAvailable: false,
  aggregateState: 'live-indexed',
  papiReady: false,
  optimistic: {
    assets: [],
    licenses: [],
    listings: [],
    disputes: [],
    add: () => {},
    reconcile: () => {},
  },
})

export function useResilience(): ResilienceContextValue {
  return useContext(ResilienceContext)
}
