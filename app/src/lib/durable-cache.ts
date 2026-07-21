/** IndexedDB cache partitioned by genesis hash and schema version. */

export const SCHEMA_VERSION = 1
const DB_NAME = 'softlaw-resilience-cache'
const STORE_NAME = 'responses'
const DB_VERSION = 1

export interface CachedEntry<T = unknown> {
  /** Composite partition key: `${genesisHash}:${schemaVersion}` */
  partition: string
  /** Query-specific key (e.g. the indexer path or a composite). */
  key: string
  /** The cached payload. */
  data: T
  /** Epoch ms when this entry was written. */
  timestamp: number
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: ['partition', 'key'] })
          store.createIndex('by_partition', 'partition')
          store.createIndex('by_timestamp', 'timestamp')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Build the composite partition key. All reads/writes within a partition are
 * isolated from other genesis/schema combinations.
 */
export function buildPartition(genesisHash: string, schemaVersion: number = SCHEMA_VERSION): string {
  return `${genesisHash}:${schemaVersion}`
}

/**
 * Check whether IndexedDB is available in the current environment.
 * Used by the resilience layer to decide whether caching is even possible.
 */
export function isDurableCacheAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

/**
 * Persist a response to the durable cache. Never throws.
 */
export async function cacheSet<T>(
  genesisHash: string,
  key: string,
  data: T,
): Promise<void> {
  const db = await openDB()
  if (!db) return
  const partition = buildPartition(genesisHash)
  const entry: CachedEntry<T> = {
    partition,
    key,
    data,
    timestamp: Date.now(),
  }
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(entry)
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } catch {
    /* swallow — cache is best-effort */
  } finally {
    db.close()
  }
}

/**
 * Read the most recent cached response for a key within the current partition.
 * Returns `null` if the cache is empty, unavailable, or the entry doesn't exist.
 */
export async function cacheGet<T>(
  genesisHash: string,
  key: string,
): Promise<CachedEntry<T> | null> {
  const db = await openDB()
  if (!db) return null
  const partition = buildPartition(genesisHash)
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get([partition, key])
    return await new Promise<CachedEntry<T> | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as CachedEntry<T> | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  } finally {
    db.close()
  }
}

/**
 * Remove entries outside the current genesis/schema partition.
 * Returns the number deleted.
 */
export async function evictStalePartitions(currentGenesisHash: string): Promise<number> {
  const db = await openDB()
  if (!db) return 0
  const currentPartition = buildPartition(currentGenesisHash)
  let deleted = 0
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const idx = store.index('by_partition')
    const cursorReq = idx.openCursor()
    await new Promise<void>((resolve) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) {
          resolve()
          return
        }
        const entry = cursor.value as CachedEntry
        if (entry.partition !== currentPartition) {
          cursor.delete()
          deleted++
        }
        cursor.continue()
      }
      cursorReq.onerror = () => resolve()
    })
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* swallow */
  } finally {
    db.close()
  }
  return deleted
}

/**
 * Clear all entries for the current partition. Used when the user explicitly
 * refreshes or when a schema migration invalidates the shape.
 */
export async function clearPartition(genesisHash: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  const partition = buildPartition(genesisHash)
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const idx = tx.objectStore(STORE_NAME).index('by_partition')
    const range = IDBKeyRange.only(partition)
    idx.openCursor(range).onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* swallow */
  } finally {
    db.close()
  }
}
