/**
 * Indexer client with health reporting and genesis-partitioned caching.
 * Successful responses populate the cache; availability failures may use a
 * matching cached response after chain verification.
 */

import { indexerHealth } from '@/lib/indexer-health'
import { cacheGet, cacheSet } from '@/lib/durable-cache'

const rawUrl = import.meta.env.VITE_INDEXER_URL || 'http://localhost:3001'
export const INDEXER_URL = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

/**
 * Cache partition selected after PapiProvider verifies the chain.
 */
let verifiedGenesisHash: string | null = null
export type IndexerResponseSource = 'live' | 'cache' | 'unknown'
const responseSources = new Map<string, IndexerResponseSource>()

export function setVerifiedGenesisHash(hash: string | null): void {
  verifiedGenesisHash = hash
  if (!hash) responseSources.clear()
}

/** Source of the most recently resolved request for this exact API path. */
export function getIndexerResponseSource(path: string): IndexerResponseSource {
  return responseSources.get(path) ?? 'unknown'
}

export async function fetchIndexer<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${INDEXER_URL}${path}`)
  } catch (networkErr) {
    indexerHealth.recordFailure()
    if (verifiedGenesisHash) {
      const cached = await cacheGet<T>(verifiedGenesisHash, path)
      if (cached) {
        responseSources.set(path, 'cache')
        return cached.data
      }
    }
    responseSources.set(path, 'unknown')
    throw new Error(
      `Indexer unreachable: ${networkErr instanceof Error ? networkErr.message : 'network error'}`,
      { cause: networkErr },
    )
  }
  if (!res.ok) {
    const retryableAvailabilityFailure = res.status >= 500 || res.status === 408 || res.status === 429
    if (retryableAvailabilityFailure) {
      indexerHealth.recordFailure()
      if (verifiedGenesisHash) {
        const cached = await cacheGet<T>(verifiedGenesisHash, path)
        if (cached) {
          responseSources.set(path, 'cache')
          return cached.data
        }
      }
    } else {
      // A deliberate 4xx (not found, unauthorized, invalid request) proves the
      // service is reachable. Never replace it with stale cache: doing so can
      // mask authorization changes or make a missing record look present.
      indexerHealth.recordSuccess()
    }
    responseSources.set(path, 'unknown')
    throw new Error(`Indexer error: ${res.status} ${res.statusText}`)
  }
  let data: T
  try {
    data = await res.json() as T
  } catch (parseError) {
    indexerHealth.recordFailure()
    if (verifiedGenesisHash) {
      const cached = await cacheGet<T>(verifiedGenesisHash, path)
      if (cached) {
        responseSources.set(path, 'cache')
        return cached.data
      }
    }
    responseSources.set(path, 'unknown')
    throw new Error('Indexer returned malformed JSON', { cause: parseError })
  }
  indexerHealth.recordSuccess()
  responseSources.set(path, 'live')
  if (verifiedGenesisHash) {
    void cacheSet(verifiedGenesisHash, path, data)
  }
  return data
}
