import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient, type PolkadotClient } from 'polkadot-api'
import { createWsClient } from 'polkadot-api/ws'
import { paseoAssetHub } from '@polkadot-api/descriptors'
import { RPC_PROVIDERS } from '@/lib/rpcProviders'
import {
  resolveActiveWsUrl,
  getStoredAutoCursor,
  AUTO_CURSOR_STORAGE_KEY,
  PROBE_INTERVAL_MS,
  PROBE_TIMEOUT_MS,
  SMOLDOT_INIT_TIMEOUT_MS,
  FAILURE_STREAK_LIMIT,
  RECREATE_BACKOFF_MS,
  PAPI_TRANSPORT_STORAGE_KEY,
  normalizeTransport,
  shouldAutoFallbackToSmoldot,
} from '@/lib/papi-utils'
import { enforceGenesisMatch, GenesisMismatchError } from '@/lib/genesis-guard'
import { importWithReload } from '@/lib/lazy-with-reload'
import {
  PapiContext,
  type EffectiveTransport,
  type PapiState,
  type PapiTransport,
  type PaseoAssetHubApi,
} from '@/contexts/papi-context'

function getStoredTransport(): PapiTransport {
  try {
    return normalizeTransport(localStorage.getItem(PAPI_TRANSPORT_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

function getStoredCustomRpcUrl(): string {
  try {
    return localStorage.getItem('sl_rpc_url') || ''
  } catch {
    return ''
  }
}

async function probeWithTimeout(api: PaseoAssetHubApi, timeoutMs = PROBE_TIMEOUT_MS): Promise<void> {
  await Promise.race([
    api.apis.ReviveApi.gas_price(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('probe timeout')), timeoutMs),
    ),
  ])
}

/** Verify genesis before typed reads; mismatches are fatal, connection errors retryable. */
async function verifyGenesis(client: PolkadotClient): Promise<string> {
  const expected = (import.meta.env.VITE_EXPECTED_GENESIS_HASH as string | undefined)?.toLowerCase()
  let spec: { genesisHash?: string }
  try {
    spec = await client.getChainSpecData()
  } catch (err) {
    throw new Error(
      `Cannot read chain spec: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
  const observed = spec.genesisHash?.toLowerCase() ?? undefined
  const result = enforceGenesisMatch(observed, expected, import.meta.env.PROD)
  if (!result.ok) {
    throw new GenesisMismatchError(result.reason ?? 'Genesis hash mismatch.')
  }
  if (!import.meta.env.PROD && !expected) {
    console.info(`[PapiProvider] connected genesis hash: ${observed} (set VITE_EXPECTED_GENESIS_HASH to enforce in production)`)
  }
  return observed ?? ''
}

export function PapiProvider({ children }: { children: ReactNode }) {
  const [rawClient, setClient] = useState<PolkadotClient | null>(null)
  const [rawApi, setApi] = useState<PaseoAssetHubApi | null>(null)
  const [rawPapiState, setPapiState] = useState<PapiState>('connecting')
  const [transport, setTransportState] = useState<PapiTransport>(getStoredTransport)
  const [effectiveTransport, setEffectiveTransport] = useState<EffectiveTransport>(() => {
    const stored = getStoredTransport()
    return stored === 'smoldot' ? 'smoldot' : 'ws'
  })
  const [customRpcUrl, setCustomRpcUrlState] = useState<string>(getStoredCustomRpcUrl)
  const [recreateNonce, setRecreateNonce] = useState(0)
  const [rawGenesisHash, setGenesisHash] = useState<string | null>(null)
  const [genesisError, setGenesisError] = useState<string | null>(null)
  const [publishedConnectionKey, setPublishedConnectionKey] = useState('')
  const failureStreak = useRef(0)
  const [autoCursor, setAutoCursor] = useState<number>(getStoredAutoCursor)
  const autoRotationCount = useRef(0)
  const smoldotFallbackActive = useRef(false)

  const connectionKey = `${recreateNonce}:${effectiveTransport}:${transport}:${customRpcUrl}:${autoCursor}`

  const setTransport = useCallback((t: PapiTransport) => {
    try { localStorage.setItem(PAPI_TRANSPORT_STORAGE_KEY, t) } catch { /* SSR/private */ }
    setTransportState(t)
    setEffectiveTransport(t === 'smoldot' ? 'smoldot' : 'ws')
    setGenesisError(null)
    smoldotFallbackActive.current = false
    autoRotationCount.current = 0
    setRecreateNonce((n) => n + 1)
  }, [])

  const setCustomRpcUrl = useCallback((url: string) => {
    try {
      if (url) {
        localStorage.setItem('sl_rpc_url', url)
      } else {
        localStorage.removeItem('sl_rpc_url')
      }
    } catch { /* SSR/private */ }
    setCustomRpcUrlState(url)
    if (transport !== 'smoldot') {
      // Choosing a WS endpoint is an explicit request to leave an automatic
      // light-client fallback while preserving the user's `auto` policy.
      setEffectiveTransport('ws')
      setGenesisError(null)
      smoldotFallbackActive.current = false
      autoRotationCount.current = 0
      setRecreateNonce((n) => n + 1)
    }
  }, [transport])

  useEffect(() => {
    let cancelled = false
    let createdClient: PolkadotClient | null = null
    let probeTimer: ReturnType<typeof setInterval> | null = null

    // If a fatal genesis error occurred, do not attempt initialization.
    if (genesisError) return

    const envUrl = import.meta.env.VITE_WS_URL as string | undefined
    const wsUrl = resolveActiveWsUrl(customRpcUrl, autoCursor, envUrl)

    // Publish the new generation asynchronously. Until then, the derived
    // context below masks the previous generation, so stale typed clients are
    // never exposed while an endpoint/transport change is connecting.
    queueMicrotask(() => {
      if (cancelled) return
      setPublishedConnectionKey(connectionKey)
      setPapiState('connecting')
      setClient(null)
      setApi(null)
      setGenesisHash(null)
    })

    function scheduleRecreate(reason: string) {
      console.error(`[PapiProvider] tearing down client for recreate (${reason})`)
      failureStreak.current = 0
      if (createdClient) {
        try { createdClient.destroy() } catch { /* ignore */ }
        createdClient = null
      }
      if (cancelled) return
      setPapiState('error')
      setApi(null)
      setClient(null)
      setGenesisHash(null)

      if (
        effectiveTransport === 'ws'
        && !customRpcUrl
        && !envUrl
        && transport !== 'smoldot'
        && RPC_PROVIDERS.length > 1
      ) {
        autoRotationCount.current++
        const fromIdx = autoCursor % RPC_PROVIDERS.length
        const toIdx = (fromIdx + 1) % RPC_PROVIDERS.length

        if (
          shouldAutoFallbackToSmoldot({
            transport,
            customRpcUrl,
            envUrl,
            rotationAttempts: autoRotationCount.current,
            poolLength: RPC_PROVIDERS.length,
          }) && !smoldotFallbackActive.current
        ) {
          smoldotFallbackActive.current = true
          console.warn(`[PapiProvider] auto: WS pool exhausted after ${autoRotationCount.current} rotations — falling back to smoldot`)
          // Preserve the user's transport policy while changing the active transport.
          setEffectiveTransport('smoldot')
          setRecreateNonce((n) => n + 1)
          return
        }

        const fromUrl = RPC_PROVIDERS[fromIdx].url
        const toUrl = RPC_PROVIDERS[toIdx].url
        console.warn(`[PapiProvider] auto-rotating WS endpoint: ${fromUrl} → ${toUrl} (reason: ${reason})`)
        setTimeout(() => {
          if (cancelled) return
          try { localStorage.setItem(AUTO_CURSOR_STORAGE_KEY, String(toIdx)) } catch { /* SSR/private */ }
          // Changing the cursor changes the connection generation and therefore
          // performs the recreate itself. Do not also increment recreateNonce.
          setAutoCursor(toIdx)
        }, RECREATE_BACKOFF_MS)
        return
      }

      setTimeout(() => {
        if (!cancelled) setRecreateNonce((n) => n + 1)
      }, RECREATE_BACKOFF_MS)
    }

    function startProbeLoop(
      typedApi: PaseoAssetHubApi,
      probeTimeoutMs = PROBE_TIMEOUT_MS,
      graceCeilingMs = 0,
    ) {
      const initTime = Date.now()
      probeTimer = setInterval(() => {
        if (cancelled) return
        if (genesisError) return
        probeWithTimeout(typedApi, probeTimeoutMs).then(
          () => {
            if (failureStreak.current > 0) {
              console.info(`[PapiProvider] recovery: probe succeeded after ${failureStreak.current} failure(s)`)
              failureStreak.current = 0
              if (!cancelled) setPapiState('ready')
            }
          },
          (err) => {
            failureStreak.current++
            console.warn(
              `[PapiProvider] probe failure ${failureStreak.current}/${FAILURE_STREAK_LIMIT}:`,
              err instanceof Error ? err.message : String(err),
            )
            if (!cancelled && failureStreak.current < FAILURE_STREAK_LIMIT) {
              setPapiState('reconnecting')
            }
            if (failureStreak.current >= FAILURE_STREAK_LIMIT) {
              if (graceCeilingMs > 0 && Date.now() - initTime < graceCeilingMs) {
                console.info(
                  `[PapiProvider] LC still in grace window (${Math.round((Date.now() - initTime) / 1000)}s / ${graceCeilingMs / 1000}s) — suppressing recreate`,
                )
                return
              }
              scheduleRecreate(`probe failed ${failureStreak.current} times`)
            }
          },
        )
      }, PROBE_INTERVAL_MS)
    }

    async function initWs() {
      createdClient = createWsClient(wsUrl, { timeout: 15_000 })
      if (cancelled) return

      // ── Step 1: verify genesis BEFORE any typed ReviveApi call ──
      try {
        const hash = await verifyGenesis(createdClient)
        if (cancelled) return
        setGenesisHash(hash)
        setGenesisError(null)
      } catch (err) {
        if (cancelled) return
        if (err instanceof GenesisMismatchError) {
          // Fatal — do not expose client, do not retry.
          console.error('[PapiProvider] FATAL:', err.message)
          setGenesisError(err.message)
          setPapiState('error')
          setClient(null)
          setApi(null)
          setGenesisHash(null)
          return
        }
        // Connection issue — schedule recreate.
        console.warn('[PapiProvider] genesis check failed (will retry):', err instanceof Error ? err.message : String(err))
        scheduleRecreate('genesis check (connection)')
        return
      }

      // Expose the client only after genesis verification.
      const typedApi = createdClient.getTypedApi(paseoAssetHub)
      setClient(createdClient)
      setApi(typedApi)

      // Confirm runtime responsiveness.
      try {
        await probeWithTimeout(typedApi)
        if (!cancelled) {
          setPapiState('ready')
          failureStreak.current = 0
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[PapiProvider] init probe failed (will retry):', err instanceof Error ? err.message : String(err))
          failureStreak.current = 1
        }
      }

      if (!cancelled) startProbeLoop(typedApi)
    }

    async function initSmoldot() {
      try {
        const [{ getSmProvider }, { createAssetHubChain }] = await Promise.all([
          importWithReload('sm-provider', () => import('polkadot-api/sm-provider')),
          importWithReload('smoldot-client', () => import('@/lib/smoldot-client')),
        ])
        const provider = getSmProvider(createAssetHubChain)
        createdClient = createClient(provider)
        if (cancelled) return

        // Verify genesis before creating the typed API.
        let hash: string
        try {
          hash = await verifyGenesis(createdClient)
          if (cancelled) return
          setGenesisHash(hash)
          setGenesisError(null)
        } catch (err) {
          if (cancelled) return
          if (err instanceof GenesisMismatchError) {
            console.error('[PapiProvider] FATAL:', err.message)
            setGenesisError(err.message)
            setPapiState('error')
            setClient(null)
            setApi(null)
            setGenesisHash(null)
            return
          }
          throw err
        }

        // Expose the client only after genesis verification.
        const typedApi = createdClient.getTypedApi(paseoAssetHub)
        setClient(createdClient)
        setApi(typedApi)

        // Confirm runtime responsiveness.
        await probeWithTimeout(typedApi, SMOLDOT_INIT_TIMEOUT_MS)
        if (!cancelled) {
          setPapiState('ready')
          failureStreak.current = 0
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof GenesisMismatchError) {
          // Already handled above, but guard against re-throws.
          setGenesisError(err.message)
          setPapiState('error')
          return
        }
        console.warn('[PapiProvider] smoldot init failed (will retry):', err instanceof Error ? err.message : String(err))
        scheduleRecreate('smoldot initialization')
        return
      }

      if (!cancelled && createdClient) {
        const typedApi = createdClient.getTypedApi(paseoAssetHub)
        startProbeLoop(typedApi, 30_000, 10 * 60 * 1000)
      }
    }

    if (effectiveTransport === 'smoldot') {
      initSmoldot()
    } else {
      try {
        initWs()
      } catch (err) {
        console.error('[PapiProvider] init failed:', err)
      }
    }

    return () => {
      cancelled = true
      if (probeTimer) clearInterval(probeTimer)
      if (createdClient) {
        try { createdClient.destroy() } catch { /* ignore */ }
      }
    }

  }, [connectionKey, recreateNonce, effectiveTransport, customRpcUrl, transport, genesisError, autoCursor])

  const isCurrentConnection = publishedConnectionKey === connectionKey && !genesisError
  const client = isCurrentConnection ? rawClient : null
  const api = isCurrentConnection ? rawApi : null
  const papiState: PapiState = genesisError
    ? 'error'
    : isCurrentConnection
      ? rawPapiState
      : 'connecting'
  const genesisHash = isCurrentConnection ? rawGenesisHash : null
  const isReady = papiState === 'ready' && !!client && !!api && !genesisError

  const envUrl = import.meta.env.VITE_WS_URL as string | undefined
  const activeWsUrl = useMemo(
    () => resolveActiveWsUrl(customRpcUrl, autoCursor, envUrl),
    [customRpcUrl, autoCursor, envUrl],
  )

  const value = useMemo(
    () => ({
      client, api, isReady, papiState,
      transport, effectiveTransport, setTransport,
      customRpcUrl, setCustomRpcUrl, activeWsUrl,
      genesisHash, genesisError,
    }),
    [client, api, isReady, papiState, transport, effectiveTransport, setTransport, customRpcUrl, setCustomRpcUrl, activeWsUrl, genesisHash, genesisError],
  )

  return <PapiContext.Provider value={value}>{children}</PapiContext.Provider>
}
