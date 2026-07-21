import { useRef, useCallback, useMemo } from 'react'
import { useToastStore } from './useToast'
import type { TxStep, TxStepStatus } from './useToast'
import { useTranslations } from '@/lib/i18n'

// One-shot signal for the next confirmed block from a user mutation.
let __armedForNextSync = false
export function armSyncSignal() { __armedForNextSync = true }
export function consumeSyncSignal(): boolean {
  const v = __armedForNextSync
  __armedForNextSync = false
  return v
}

export function useTxToast() {
  const { t } = useTranslations()
  const { addProgressToast, updateToast, removeToast } = useToastStore()
  const idRef = useRef<string | null>(null)
  const stepsRef = useRef<TxStep[]>([])

  const start = useCallback((label: string, prefixSteps?: TxStep[]) => {
    const steps: TxStep[] = [
      ...(prefixSteps || []),
      { label: t.tx.waitingSignature, status: prefixSteps?.length ? 'waiting' : 'active' },
      { label: t.tx.confirmingOnChain, status: 'waiting' },
      { label: t.tx.indexing, status: 'waiting' },
    ]
    stepsRef.current = steps
    idRef.current = addProgressToast(label, steps)
    return idRef.current
  }, [t, addProgressToast])

  const advanceToSigning = useCallback(() => {
    if (!idRef.current) return
    stepsRef.current = stepsRef.current.map(s => {
      if (s.label === t.tx.waitingSignature) return { ...s, status: 'active' as TxStepStatus }
      if (s.status === 'active') return { ...s, status: 'done' as TxStepStatus }
      return s
    })
    updateToast(idRef.current, { steps: [...stepsRef.current] })
  }, [t, updateToast])

  const onHash = useCallback((hash: string) => {
    if (!idRef.current) return
    stepsRef.current = stepsRef.current.map(s => {
      if (s.label === t.tx.confirmingOnChain) return { ...s, status: 'active' as TxStepStatus }
      if (s.label === t.tx.indexing) return s
      return { ...s, status: 'done' as TxStepStatus }
    })
    updateToast(idRef.current, { txHash: hash, steps: [...stepsRef.current] })
  }, [t, updateToast])

  const onConfirmed = useCallback((message: string, dismissMs = 8000) => {
    if (!idRef.current) return
    stepsRef.current = stepsRef.current.map(s => {
      if (s.label === t.tx.indexing) return { ...s, status: 'active' as TxStepStatus }
      return { ...s, status: 'done' as TxStepStatus }
    })
    updateToast(idRef.current, { type: 'success', message, steps: [...stepsRef.current] })
    // Let DataPreloader show one sync toast for the mutation.
    armSyncSignal()
    const tid = idRef.current
    setTimeout(() => {
      removeToast(tid)
      if (idRef.current === tid) idRef.current = null
    }, dismissMs)
  }, [t, updateToast, removeToast])

  const onError = useCallback((err: Error | string) => {
    if (!idRef.current) return
    const msg = typeof err === 'string' ? err : err.message
    if (msg.includes('User rejected') || msg.includes('User denied')) {
      removeToast(idRef.current)
    } else {
      updateToast(idRef.current, { type: 'error', message: msg, steps: undefined })
      const tid = idRef.current
      setTimeout(() => removeToast(tid), 5000)
    }
    idRef.current = null
  }, [updateToast, removeToast])

  return useMemo(
    () => ({ start, advanceToSigning, onHash, onConfirmed, onError }),
    [start, advanceToSigning, onHash, onConfirmed, onError],
  )
}
