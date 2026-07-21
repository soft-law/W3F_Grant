import { useState, useEffect, useRef } from 'react'
import { X, Check, XCircle } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import type { FullDispute } from '@/hooks/useContracts'
import { useResolveDispute, useGetDispute } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { useTxToast } from '@/hooks/useTxToast'
import { useTranslations } from '@/lib/i18n'
import { toastError } from '@/hooks/useToast'
import { DisputeStatus } from '@/lib/contracts'
import { Button } from '@/components/Button'

export function ResolveModal({ colors: _colors, dispute, onClose, onSuccess }: {
  colors: ThemeColors
  dispute: FullDispute
  onClose: () => void
  onSuccess: () => void
}) {
  const { t } = useTranslations()
  const { resolveDispute, hash, isPending, isSuccess, error } = useResolveDispute()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const txToast = useTxToast()
  // Resolve against fresh chain state.
  const { refetch: refetchChainDispute } = useGetDispute(dispute.disputeId, {
    staleTime: 0,
    enabled: false,
  })
  const [approve, setApprove] = useState(true)
  const [reason, setReason] = useState('')
  const messageRef = useRef('')

  useEffect(() => { if (hash) txToast.onHash(hash) }, [hash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isSuccess) {
      txToast.onConfirmed(messageRef.current)
      invalidateIndexed()
      onSuccess()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) { toastError(t.disputes.resolutionRequired); return }

    // Detect concurrent resolution before submitting.
    const fresh = await refetchChainDispute()
    if (fresh.status === 'error' || fresh.data === undefined) {
      toastError(t.disputes.connectionTemporarilyDown)
      return
    }
    if (fresh.data.status !== DisputeStatus.Pending) {
      toastError(t.disputes.alreadyResolved)
      return
    }

    messageRef.current = approve ? t.disputes.disputeApproved : t.disputes.disputeRejected
    txToast.start(t.tx.resolvingDispute)
    try {
      await resolveDispute(dispute.disputeId, approve, dispute.submitter as `0x${string}`, reason)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-panel modal-panel--compact" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center sticky top-0 z-10 px-6 py-4" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
          <h3 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>{t.disputes.resolveDispute} #{dispute.disputeId.toString()}</h3>
          <button onClick={onClose} className="btn-icon" style={{ background: 'var(--bg-elev)' }}>
            <X className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-3">
          <div className="p-3 rounded-sm text-sm" style={{ backgroundColor: 'var(--bg-elev-2)' }}>
            <p style={{ color: 'var(--ink-2)' }}>
              {dispute.disputeType === 1
                ? `${t.disputes.labels.ipAsset} #${dispute.ipAssetId.toString()}`
                : `${t.disputes.labels.license} #${dispute.licenseId.toString()}`}
            </p>
            <p style={{ color: 'var(--ink-4)' }}>{t.disputes.labels.reason}: {dispute.reason}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setApprove(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-medium"
                style={{ backgroundColor: approve ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--bg-elev-2)', color: approve ? 'var(--ok)' : 'var(--ink-4)', border: `1px solid ${approve ? 'var(--ok)' : 'var(--line)'}` }}>
                <Check className="w-4 h-4" /> {t.disputes.approve}
              </button>
              <button type="button" onClick={() => setApprove(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-medium"
                style={{ backgroundColor: !approve ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--bg-elev-2)', color: !approve ? 'var(--danger)' : 'var(--ink-4)', border: `1px solid ${!approve ? 'var(--danger)' : 'var(--line)'}` }}>
                <XCircle className="w-4 h-4" /> {t.disputes.reject}
              </button>
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.disputes.resolutionReason}
              className="input resize-none" rows={4}
            />
            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error.message}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" isLoading={isPending} disabled={!reason.trim()}>
                {approve ? t.disputes.approveDispute : t.disputes.rejectDispute}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
