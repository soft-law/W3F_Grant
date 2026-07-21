import { useState, useEffect, useRef, useCallback } from 'react'

type PendingBlock = { blockNumber: number; txHashes: string[]; detectedAt: number }
type ConfirmedHandler = (blockNumber: number) => void

export type SseState = 'connected' | 'connecting' | 'disconnected'

function getIndexerUrl(): string | undefined {
  return import.meta.env.VITE_INDEXER_URL as string | undefined
}

export function buildSseUrl(indexerUrl: string | undefined): string | null {
  if (!indexerUrl) return null
  return `${indexerUrl.replace(/\/$/, '')}/api/events/stream`
}

/**
 * Parses indexer messages and owns confirmed-handler invocation.
 */
export type SseDispatchResult =
  | { kind: 'pending'; block: PendingBlock }
  | { kind: 'confirmed'; blockNumber: number }
  | { kind: 'malformed'; event: string; raw: string }
  | { kind: 'ignored' }

export interface SseDispatchState {
  pendingTxHashes: Set<string>
  confirmedHandlers: Set<ConfirmedHandler>
}

export function dispatchSseMessage(
  state: SseDispatchState,
  event: 'snapshot' | 'pending' | 'confirmed',
  raw: string,
): { result: SseDispatchResult; next: SseDispatchState } {
  try {
    if (event === 'confirmed') {
      const data = JSON.parse(raw) as { blockNumber: number }
      const handlers = Array.from(state.confirmedHandlers)
      for (const handler of handlers) {
        try { handler(data.blockNumber) } catch { /* handler errors must not crash */ }
      }
      return {
        result: { kind: 'confirmed', blockNumber: data.blockNumber },
        // Confirmed clears pending state — return a fresh empty set.
        next: { pendingTxHashes: new Set(), confirmedHandlers: state.confirmedHandlers },
      }
    }
    if (event === 'pending') {
      const blk = JSON.parse(raw) as PendingBlock
      const next = new Set(state.pendingTxHashes)
      for (const h of blk.txHashes) next.add(h.toLowerCase())
      return {
        result: { kind: 'pending', block: blk },
        next: { pendingTxHashes: next, confirmedHandlers: state.confirmedHandlers },
      }
    }
    // snapshot: array of blocks
    const blocks = JSON.parse(raw) as PendingBlock[]
    const next = new Set(state.pendingTxHashes)
    for (const blk of blocks) {
      for (const h of blk.txHashes) next.add(h.toLowerCase())
    }
    return {
      result: { kind: 'ignored' }, // snapshot is dispatched (one or more blocks), but
                                   // doesn't itself constitute a single invalidation event
      next: { pendingTxHashes: next, confirmedHandlers: state.confirmedHandlers },
    }
  } catch (_err) {
    return {
      result: { kind: 'malformed', event, raw },
      next: state,
    }
  }
}

type EventSourceCtor = new (url: string) => EventSource

function resolveEventSourceCtor(): EventSourceCtor | null {
  const w = window as unknown as { EventSource?: EventSourceCtor }
  return w.EventSource ?? null
}

export function useIndexerStream() {
  const [pendingTxHashes, setPendingTxHashes] = useState<Set<string>>(new Set())
  const [sseState, setSseState] = useState<SseState>(() =>
    getIndexerUrl() && typeof window !== 'undefined' && resolveEventSourceCtor()
      ? 'connecting'
      : 'disconnected',
  )
  const confirmedHandlers = useRef<Set<ConfirmedHandler>>(new Set())

  useEffect(() => {
    const url = getIndexerUrl()
    if (!url) return
    const Ctor = resolveEventSourceCtor()
    if (!Ctor) return

    const es = new Ctor(`${url}/api/events/stream`)

    es.onopen = () => {
      setSseState('connected')
    }

    es.addEventListener('snapshot', (e: Event) => {
      const m = e as MessageEvent
      const { result } = dispatchSseMessage(
        { pendingTxHashes: new Set(), confirmedHandlers: confirmedHandlers.current },
        'snapshot',
        m.data,
      )
      if (result.kind === 'malformed') {
        console.warn('[SSE] malformed snapshot:', m.data)
        return
      }
      // reflect pending-state into UI
      setPendingTxHashes((prev) => {
        const blocks = (() => {
          try { return JSON.parse(m.data) as PendingBlock[] } catch { return [] }
        })()
        const next = new Set(prev)
        for (const blk of blocks) for (const h of blk.txHashes) next.add(h.toLowerCase())
        return next
      })
    })

    es.addEventListener('pending', (e: Event) => {
      const m = e as MessageEvent
      const { result } = dispatchSseMessage(
        { pendingTxHashes: new Set(), confirmedHandlers: confirmedHandlers.current },
        'pending',
        m.data,
      )
      if (result.kind === 'malformed') {
        console.warn('[SSE] malformed pending:', m.data)
        return
      }
      setPendingTxHashes((prev) => {
        const next = new Set(prev)
        if (result.kind === 'pending') for (const h of result.block.txHashes) next.add(h.toLowerCase())
        return next
      })
    })

    es.addEventListener('confirmed', (e: Event) => {
      const m = e as MessageEvent
      // dispatchSseMessage is the SINGLE OWNER of confirmed-handler invocation.
      // Do not loop confirmedHandlers.current here — that would fire each
      // subscriber twice on every confirmed message.
      const { result } = dispatchSseMessage(
        { pendingTxHashes: new Set(), confirmedHandlers: confirmedHandlers.current },
        'confirmed',
        m.data,
      )
      if (result.kind === 'malformed') {
        console.warn('[SSE] malformed confirmed:', m.data)
        return
      }
      setPendingTxHashes(new Set())
    })

    es.onerror = () => {
      setSseState('disconnected')
    }

    return () => {
      es.close()
    }
  }, [])

  const onConfirmedBlock = useCallback((handler: ConfirmedHandler): () => void => {
    confirmedHandlers.current.add(handler)
    return () => { confirmedHandlers.current.delete(handler) }
  }, [])

  return {
    pendingTxHashes,
    onConfirmedBlock,
    isPendingTx: (txHash: string) => pendingTxHashes.has(txHash.toLowerCase()),
    sseState,
  }
}
