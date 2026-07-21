import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const CHUNK_RECOVERY_PREFIX = 'sl_chunk_reload:'

export interface ChunkRecoveryEnvironment {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  reload: () => void
}

export function isDynamicImportFailure(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return /(?:failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|chunkloaderror|loading chunk \S+ failed)/i.test(message)
}

function browserEnvironment(): ChunkRecoveryEnvironment | null {
  if (typeof window === 'undefined') return null
  return {
    storage: window.sessionStorage,
    reload: () => window.location.reload(),
  }
}

/**
 * Reload once when an open tab references a chunk from a previous deployment.
 * The marker prevents a broken deployment or network outage from causing an
 * infinite reload loop. A successful import clears it for future releases.
 */
export function recoverDynamicImport(
  error: unknown,
  chunkKey: string,
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
): boolean {
  if (!environment || !isDynamicImportFailure(error)) return false

  const marker = `${CHUNK_RECOVERY_PREFIX}${chunkKey}`
  try {
    if (environment.storage.getItem(marker)) return false
    environment.storage.setItem(marker, '1')
  } catch {
    // Without durable per-tab state, reloading could loop forever.
    return false
  }

  environment.reload()
  return true
}

export function clearDynamicImportRecovery(
  chunkKey: string,
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
): void {
  if (!environment) return
  try { environment.storage.removeItem(`${CHUNK_RECOVERY_PREFIX}${chunkKey}`) } catch { /* storage is optional */ }
}

export async function importWithReload<T>(
  chunkKey: string,
  loader: () => Promise<T>,
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
): Promise<T> {
  try {
    const module = await loader()
    clearDynamicImportRecovery(chunkKey, environment)
    return module
  } catch (error) {
    if (recoverDynamicImport(error, chunkKey, environment)) {
      // The browser is replacing this document. Keep consumers pending so
      // their retry/error state does not flash before navigation completes.
      return new Promise<never>(() => {})
    }
    throw error
  }
}

export function lazyWithReload<P extends object>(
  chunkKey: string,
  loader: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(() => importWithReload(chunkKey, loader))
}

/** Vite's browser-level signal for preload failures outside React.lazy. */
export function handleVitePreloadError(
  event: Event,
  environment: ChunkRecoveryEnvironment | null = browserEnvironment(),
): boolean {
  const payload = 'payload' in event
    ? (event as Event & { payload?: unknown }).payload
    : undefined
  const error = isDynamicImportFailure(payload)
    ? payload
    : new TypeError('Failed to fetch dynamically imported module during Vite preload')
  const recovered = recoverDynamicImport(error, 'vite-preload', environment)
  if (recovered) event.preventDefault()
  return recovered
}
