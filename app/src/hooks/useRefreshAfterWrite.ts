import { useEffect, useRef } from 'react'

const ONE_BLOCK_MS = 7_000

interface RefreshAfterWriteOptions {
  refetches?: ReadonlyArray<() => void | Promise<unknown>>
  invalidateIndexed?: () => void
  onComplete?: () => void
  delayedMs?: number
}

export function useRefreshAfterWrite(isSuccess: boolean, opts: RefreshAfterWriteOptions): void {
  const ranForCurrentSuccess = useRef(false)
  const optsRef = useRef(opts)

  useEffect(() => {
    optsRef.current = opts
  }, [opts])

  useEffect(() => {
    if (!isSuccess) {
      ranForCurrentSuccess.current = false
      return
    }
    if (ranForCurrentSuccess.current) return
    ranForCurrentSuccess.current = true

    const { refetches = [], invalidateIndexed, onComplete, delayedMs = ONE_BLOCK_MS } = optsRef.current

    const fireRefetches = () => {
      for (const fn of refetches) {
        try {
          const r = fn()
          if (r && typeof (r as Promise<unknown>).catch === 'function') {
            (r as Promise<unknown>).catch(() => {})
          }
        } catch {
          // swallow — refetch errors shouldn't block the success flow
        }
      }
    }

    fireRefetches()
    invalidateIndexed?.()
    onComplete?.()

    const tid = window.setTimeout(fireRefetches, delayedMs)
    return () => window.clearTimeout(tid)
  }, [isSuccess])
}
