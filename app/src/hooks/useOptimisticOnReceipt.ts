/**
 * Adds receipt-derived entities to the optimistic store until indexed data
 * reconciles them.
 */

import { useEffect, useRef } from 'react'
import { useResilience } from '@/contexts/resilience-context'
import { decodeOptimisticEntities } from '@/lib/optimistic-state'
import { ABIS } from '@/lib/contracts'

interface ReceiptLike {
  logs?: ReadonlyArray<{
    address: string
    topics: unknown
    data: string
  }>
}

export function useOptimisticOnReceipt(
  isSuccess: boolean,
  receipt: ReceiptLike | null | undefined,
): void {
  const { optimistic } = useResilience()
  const processedHash = useRef<string | null>(null)

  useEffect(() => {
    if (!isSuccess || !receipt?.logs) return

    // Build a stable fingerprint to avoid double-processing the same receipt
    // across StrictMode double-invocation or re-renders.
    const fingerprint = JSON.stringify(
      receipt.logs.map((l) => [l.address, l.topics, l.data]),
    )
    if (processedHash.current === fingerprint) return
    processedHash.current = fingerprint

    const entities = decodeOptimisticEntities(receipt.logs, ABIS)
    optimistic.add(entities)
  }, [isSuccess, receipt, optimistic])
}
