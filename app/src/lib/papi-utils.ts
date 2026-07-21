import { RPC_PROVIDERS, type RpcProvider } from '@/lib/rpcProviders'

export const DEFAULT_WS_URL = RPC_PROVIDERS.length > 0 ? RPC_PROVIDERS[0].url : 'wss://sys.turboflakes.io/asset-hub-paseo'
export const PROBE_INTERVAL_MS = 60_000
export const PROBE_TIMEOUT_MS = 5_000
export const SMOLDOT_INIT_TIMEOUT_MS = 90_000
export const FAILURE_STREAK_LIMIT = 3
export const RECREATE_BACKOFF_MS = 5_000
export const AUTO_CURSOR_STORAGE_KEY = 'sl_rpc_autocursor'
export const PAPI_TRANSPORT_STORAGE_KEY = 'papi-transport'

/**
 * Transport policy: automatic WS rotation with smoldot fallback, or an
 * explicitly selected WS/smoldot transport.
 */
export type PapiTransportPolicy = 'auto' | 'ws' | 'smoldot'

/** Resolve WS URL precedence: user, environment, provider pool, then default. */
export function resolveActiveWsUrl(
  customRpcUrl: string,
  autoCursor: number,
  envUrl: string | undefined,
  pool: RpcProvider[] = RPC_PROVIDERS,
): string {
  if (customRpcUrl) return customRpcUrl
  if (envUrl) return envUrl
  if (pool.length > 0) {
    return pool[autoCursor % pool.length].url
  }
  return DEFAULT_WS_URL
}

/** Read the persisted auto-rotation cursor. Crash-safe: missing/garbage → 0. */
export function getStoredAutoCursor(): number {
  try {
    const raw = localStorage.getItem(AUTO_CURSOR_STORAGE_KEY)
    if (!raw) return 0
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return 0
    return n
  } catch {
    return 0
  }
}

/**
 * Compute the next cursor index after a failover rotation.
 * Returns the same index if rotation is not applicable.
 */
export function nextCursor(
  current: number,
  poolLength: number,
): number {
  if (poolLength <= 1) return current
  return (current + 1) % poolLength
}

/**
 * Check whether auto-rotation should fire given the current pin state.
 * Returns true only when no user/operator pin is set and the pool has >1 option.
 */
export function shouldAutoRotate(
  customRpcUrl: string,
  envUrl: string | undefined,
  poolLength: number,
): boolean {
  return !customRpcUrl && !envUrl && poolLength > 1
}

/**
 * Enable smoldot after an unpinned automatic transport exhausts the WS pool.
 */
export function shouldAutoFallbackToSmoldot(params: {
  transport: PapiTransportPolicy
  customRpcUrl: string
  envUrl: string | undefined
  rotationAttempts: number
  poolLength: number
}): boolean {
  const { transport, customRpcUrl, envUrl, rotationAttempts, poolLength } = params
  if (transport !== 'auto') return false
  if (customRpcUrl || envUrl) return false
  return rotationAttempts >= poolLength
}

/**
 * Normalize a stored transport string into the PapiTransportPolicy enum.
 * Defaults to 'auto' for unrecognized/missing values.
 */
export function normalizeTransport(raw: string | null | undefined): PapiTransportPolicy {
  if (raw === 'ws' || raw === 'smoldot') return raw
  return 'auto'
}
