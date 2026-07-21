import { useState, useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { toastError } from '@/hooks/useToast'
import { useTxToast } from '@/hooks/useTxToast'
import { useConfigureRevenueSplit, useGetIPSplits, type UserIPAsset } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { useRefreshAfterWrite } from '@/hooks/useRefreshAfterWrite'
import { shortenAddress, isValidAddress } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { Modal } from '../components/Modal'

export function ConfigureRevenueSplitModal({ colors, asset, onClose, onSuccess }: { colors: ThemeColors; asset: UserIPAsset; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslations()
  const { configureRevenueSplit, hash, isPending, isSuccess, error } = useConfigureRevenueSplit()
  const { data: currentSplits } = useGetIPSplits(asset.tokenId)
  const [collaborators, setCollaborators] = useState([{ address: '', share: '' }])
  const txToast = useTxToast()
  const doneRef = useRef(false)
  const invalidateIndexed = useInvalidateIndexedQueries()

  useEffect(() => {
    if (hash) txToast.onHash(hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  useRefreshAfterWrite(isSuccess, {
    invalidateIndexed,
    onComplete: () => {
      if (doneRef.current) return
      doneRef.current = true
      txToast.onConfirmed(t.modals.revenueSplitConfigured)
      onSuccess()
    },
  })

  useEffect(() => {
    if (error) txToast.onError(error instanceof Error ? error : new Error(String(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const addCollaborator = () => setCollaborators([...collaborators, { address: '', share: '' }])
  const removeCollaborator = (idx: number) => setCollaborators(collaborators.filter((_, i) => i !== idx))
  const updateCollaborator = (idx: number, field: 'address' | 'share', value: string) => {
    const updated = [...collaborators]
    updated[idx][field] = value
    setCollaborators(updated)
  }

  // Live total of valid share inputs. Drives the running tally and the Save gate.
  const liveTotal = collaborators.reduce((sum, c) => {
    const n = parseInt(c.share)
    return sum + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)
  const validRows = collaborators.filter(c => isValidAddress(c.address) && parseInt(c.share) > 0)
  const seenAddresses = new Set<string>()
  let hasDuplicate = false
  for (const c of validRows) {
    const key = c.address.toLowerCase()
    if (seenAddresses.has(key)) { hasDuplicate = true; break }
    seenAddresses.add(key)
  }
  const canSubmit = !isPending && validRows.length > 0 && liveTotal === 100 && !hasDuplicate

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validRows.length === 0) { toastError(t.modals.addValidCollaborator); return }
    if (hasDuplicate) { toastError(t.modals.duplicateRecipient); return }
    if (liveTotal !== 100) { toastError(t.common.sharesTotalError.replace('{n}', String(liveTotal))); return }

    doneRef.current = false
    txToast.start(t.modals.configureRevenueSplit)
    try {
      await configureRevenueSplit(
        asset.tokenId,
        validRows.map(c => c.address as `0x${string}`),
        validRows.map(c => BigInt(parseInt(c.share) * 100))
      )
      // Success path takes over via the isSuccess effect above.
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return (
    <Modal colors={colors} title={t.modals.configureRevenueSplit} onClose={onClose}>
      <div className="mb-4 p-3 rounded-sm" style={{ backgroundColor: colors.background.tertiary }}>
        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{asset.title}</p>
        <p className="text-sm" style={{ color: colors.text.muted }}>IP #{asset.tokenId.toString()}</p>
        {(() => {
          // ipSplits returns (address[], uint256[]) — a positional tuple, not an object.
          const [recipients, shares] = currentSplits ?? [[] as readonly `0x${string}`[], [] as readonly bigint[]]
          if (!recipients.length) return null
          return (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium" style={{ color: colors.text.muted }}>{t.modals.currentSplit}</p>
              {recipients.map((r, i) => (
                <p key={r} className="text-xs" style={{ color: colors.text.muted }}>{shortenAddress(r)} — {Number(shares[i] ?? 0n) / 100}%</p>
              ))}
            </div>
          )
        })()}
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {collaborators.map((col, idx) => (
          <div key={idx} className="flex gap-2">
            <label htmlFor={`split-address-${idx}`} className="sr-only">
              Collaborator address (row {idx + 1})
            </label>
            <input
              id={`split-address-${idx}`}
              type="text"
              value={col.address}
              onChange={(e) => updateCollaborator(idx, 'address', e.target.value)}
              placeholder={t.common.addressPlaceholder}
              className="input flex-1"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <label htmlFor={`split-share-${idx}`} className="sr-only">
              Share % (row {idx + 1})
            </label>
            <input
              id={`split-share-${idx}`}
              type="number"
              value={col.share}
              onChange={(e) => updateCollaborator(idx, 'share', e.target.value)}
              placeholder="%"
              min={1}
              max={100}
              step={1}
              className="input"
              style={{ width: 80 }}
            />
            {collaborators.length > 1 && (
              <button
                type="button"
                onClick={() => removeCollaborator(idx)}
                aria-label={`Remove collaborator row ${idx + 1}`}
                className="p-2"
              >
                <X className="w-4 h-4" style={{ color: colors.text.muted }} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addCollaborator} className="w-full py-2.5 rounded-sm text-sm" style={{ backgroundColor: colors.background.tertiary, color: colors.text.muted, border: `1px dashed ${colors.border.primary}` }}>
          <Plus className="w-4 h-4 inline mr-1.5" /> {t.modals.addCollaborator}
        </button>
        <div className="flex items-center justify-between text-xs mono" style={{ paddingTop: 2 }}>
          <span style={{ color: 'var(--ink-4)' }}>
            {t.modals.shareTotal}
          </span>
          <span
            className="tnum"
            style={{
              color: liveTotal === 100 ? 'var(--ok)' : liveTotal > 100 ? 'var(--danger)' : 'var(--warn)',
              fontWeight: 600,
            }}
          >
            {liveTotal}% / 100%
          </span>
        </div>
        {hasDuplicate && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{t.modals.duplicateRecipient}</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            type="submit"
            className="flex-1"
            isLoading={isPending}
            disabled={!canSubmit}
            title={
              hasDuplicate
                ? t.modals.duplicateRecipient
                : validRows.length === 0
                  ? t.modals.addValidCollaborator
                  : liveTotal !== 100
                    ? t.common.sharesTotalError.replace('{n}', String(liveTotal))
                    : undefined
            }
          >
            {t.common.save}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
        </div>
      </form>
    </Modal>
  )
}
