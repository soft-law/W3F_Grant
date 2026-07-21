import { useState, useEffect, useRef, useMemo } from 'react'
import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { AlertTriangle, CloudUpload, X, FileText } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { useTxToast } from '@/hooks/useTxToast'
import { toastError } from '@/hooks/useToast'
import { useSubmitDispute, useDisputeBond } from '@/hooks/useContracts'
import { useIPFSUpload, isConfigured as isIPFSConfigured } from '@/hooks/useIPFS'
import { useIndexedLicenses, useIndexedHeldLicenses, useIndexedAllAssets } from '@/hooks/useIndexed'
import { useTranslations } from '@/lib/i18n'
import { Modal } from '../components/Modal'

export function SubmitDisputeModal({ colors, onClose, onSuccess, initialLicenseId }: {
  colors: ThemeColors
  onClose: () => void
  onSuccess: () => void
  initialLicenseId?: bigint
}) {
  const { t } = useTranslations()
  const { address } = useAccount()
  const txToast = useTxToast()
  const { submitDispute, hash: disputeHash, isPending, isConfirming, isSuccess, error } = useSubmitDispute()
  const { data: disputeBond, refetch: refetchDisputeBond } = useDisputeBond()
  const { upload, isUploading } = useIPFSUpload()
  // Disputes can be filed by either the IP owner OR the license holder
  // (see modal banner). Combine both lists so both roles see their
  // disputable licenses in the picker.
  const { licenses: ownedLicenses, isLoading: ownedLoading } = useIndexedLicenses(address)
  const { licenses: heldLicenses, isLoading: heldLoading } = useIndexedHeldLicenses(address)
  const { assets, isLoading: assetsLoading } = useIndexedAllAssets()
  const licensesLoading = ownedLoading || heldLoading
  const activeLicenses = useMemo(() => {
    const seen = new Set<string>()
    const out: typeof ownedLicenses = []
    for (const lic of [...ownedLicenses, ...heldLicenses]) {
      if (!lic.isActive) continue
      const key = lic.licenseId.toString()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(lic)
    }
    return out.sort((a, b) => Number(a.licenseId - b.licenseId))
  }, [ownedLicenses, heldLicenses])
  const disputeableAssets = assets.filter(a => a.owner?.toLowerCase() !== address?.toLowerCase())

  const fileRef = useRef<HTMLInputElement>(null)
  const [disputeType, setDisputeType] = useState<0 | 1>(0)
  const [selectedLicenseId, setSelectedLicenseId] = useState<bigint | null>(initialLicenseId ?? null)
  const [selectedAssetId, setSelectedAssetId] = useState<bigint | null>(null)
  const [cause, setCause] = useState<string>('')
  const [remedies, setRemedies] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const proofPreviewUrl = useMemo(() => proofFile ? URL.createObjectURL(proofFile) : null, [proofFile])
  useEffect(() => { return () => { if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl) } }, [proofPreviewUrl])
  const [proofURI, setProofURI] = useState('')

  const buildComposedReason = (c: string, r: string[], notes: string): string => {
    const parts: string[] = []
    if (c) parts.push(`${t.modals.disputeFormCausePrefix} ${c}.`)
    if (r.length > 0) parts.push(`${t.modals.disputeFormRemediesPrefix} ${r.join(', ')}.`)
    if (notes.trim()) parts.push(notes.trim())
    return parts.join(' ')
  }

  const disputeDoneRef = useRef(false)

  const handleTypeChange = (type: 0 | 1) => {
    setDisputeType(type)
    setSelectedLicenseId(null)
    setSelectedAssetId(null)
  }

  // Tx submitted — advance signing step
  useEffect(() => {
    if (disputeHash) txToast.onHash(disputeHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeHash])

  // Tx confirmed
  useEffect(() => {
    if (!isSuccess || disputeDoneRef.current) return
    disputeDoneRef.current = true
    txToast.onConfirmed(t.modals.disputeSubmitted)
    setTimeout(() => onSuccess(), 8000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  useEffect(() => {
    if (error) txToast.onError(error instanceof Error ? error : new Error(String(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetId = disputeType === 1 ? selectedAssetId : selectedLicenseId
    if (!targetId) return
    const composedReason = buildComposedReason(cause, remedies, reason)
    if (!composedReason.trim()) return
    disputeDoneRef.current = false

    // Re-read the bond at submission so governance changes fail cleanly.
    const fresh = await refetchDisputeBond()
    if (fresh.status === 'error' || fresh.data === undefined) {
      toastError(t.disputes.connectionTemporarilyDown)
      return
    }
    if (disputeBond !== undefined && fresh.data !== disputeBond) {
      toastError(t.disputes.bondChanged)
      return
    }
    const chainBond = fresh.data

    const willUpload = !!(proofFile && isIPFSConfigured())
    if (willUpload) {
      txToast.start(t.modals.submitDisputeTitle, [
        { label: t.tx.uploadingIPFS, status: 'active' },
      ])
    } else {
      txToast.start(t.modals.submitDisputeTitle)
    }

    try {
      let finalProofURI = proofURI

      if (proofFile && isIPFSConfigured()) {
        const result = await upload(proofFile, {
          name: `Dispute Proof - ${disputeType === 1 ? 'IP Asset' : 'License'} #${String(targetId)}`,
          description: composedReason,
          workType: 'dispute-proof',
          creator: 'dispute-submitter',
          copyrightDeclaration: false,
        })
        finalProofURI = result.metadataUri
        txToast.advanceToSigning()
      } else if (proofFile) {
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(proofFile)
        })
        const json = JSON.stringify({
          name: `Dispute Proof - ${disputeType === 1 ? 'IP Asset' : 'License'} #${String(targetId)}`,
          description: composedReason,
          image: base64,
          attributes: [{ trait_type: 'Type', value: 'Dispute Proof' }]
        })
        finalProofURI = `data:application/json;base64,${btoa(json)}`
      }

      await submitDispute(targetId, BigInt(disputeType), composedReason, finalProofURI, chainBond)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const isLoading = isPending || isConfirming || isUploading
  const hasSelection = disputeType === 1 ? !!selectedAssetId : !!selectedLicenseId
  const hasComposedContent = !!(cause || remedies.length > 0 || reason.trim())

  return (
    <Modal colors={colors} title={t.modals.submitDisputeTitle} onClose={onClose}>
      {disputeType === 0 ? (
        <div className="flex items-start gap-3 p-3 rounded-sm mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--warn) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)' }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
          <p className="text-sm leading-relaxed" style={{ color: 'var(--warn)' }}>{t.modals.disputeRequiresLicense}</p>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3 rounded-sm mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--warn) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)' }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
          <p className="text-sm leading-relaxed" style={{ color: 'var(--warn)' }}>{t.modals.disputeIPInfo}</p>
        </div>
      )}
      <div className="flex items-start gap-3 p-3 rounded-sm mb-3" style={{ backgroundColor: 'color-mix(in srgb, var(--warn) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)' }}>
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--warn)' }}>{t.modals.disputeRule21}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Dispute type toggle */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t.modals.disputeTypeLabel}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleTypeChange(0)}
              className="flex-1 py-2 rounded-sm text-xs font-medium transition-all"
              style={{
                backgroundColor: disputeType === 0 ? 'var(--gold)' : 'var(--bg-elev-2)',
                color: disputeType === 0 ? 'var(--bg)' : 'var(--ink-2)',
                border: `1px solid ${disputeType === 0 ? 'var(--gold)' : 'var(--line)'}`,
              }}
            >
              {t.disputes.disputeTypeLicense}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleTypeChange(1)}
              className="flex-1 py-2 rounded-sm text-xs font-medium transition-all"
              style={{
                backgroundColor: disputeType === 1 ? 'var(--gold)' : 'var(--bg-elev-2)',
                color: disputeType === 1 ? 'var(--bg)' : 'var(--ink-2)',
                border: `1px solid ${disputeType === 1 ? 'var(--gold)' : 'var(--line)'}`,
              }}
            >
              {t.disputes.disputeTypeIP}
            </button>
          </div>
        </div>

        {/* Picker — license or IP asset based on type */}
        {disputeType === 0 ? (
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t.disputes.licenseId}</p>
            {licensesLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map(i => <div key={i} className="animate-pulse rounded-sm h-10" style={{ backgroundColor: 'var(--bg-elev-2)' }} />)}
              </div>
            ) : activeLicenses.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: 'var(--ink-4)' }}>{t.modals.pickerNoLicenses}</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {activeLicenses.map(lic => {
                  const selected = selectedLicenseId === lic.licenseId
                  return (
                    <button
                      key={String(lic.licenseId)}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setSelectedLicenseId(lic.licenseId)}
                      className="w-full text-left px-3 py-2 rounded-sm flex items-center justify-between transition-all"
                      style={{
                        backgroundColor: selected ? 'color-mix(in srgb, var(--gold) 7%, transparent)' : 'var(--bg-elev-2)',
                        border: `1px solid ${selected ? 'var(--gold)' : 'var(--line)'}`,
                      }}
                    >
                      <div>
                        <p className="text-xs font-medium" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink)' }}>
                          License #{String(lic.licenseId)}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>IP #{String(lic.ipAssetId)}</p>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold-text)' }}>
                        {lic.terms || 'License'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t.disputes.labels.ipAsset}</p>
            {assetsLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map(i => <div key={i} className="animate-pulse rounded-sm h-10" style={{ backgroundColor: 'var(--bg-elev-2)' }} />)}
              </div>
            ) : disputeableAssets.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: 'var(--ink-4)' }}>{t.modals.pickerNoIPAssets}</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {disputeableAssets.map(asset => {
                  const selected = selectedAssetId === asset.tokenId
                  return (
                    <button
                      key={String(asset.tokenId)}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setSelectedAssetId(asset.tokenId)}
                      className="w-full text-left px-3 py-2 rounded-sm flex items-center justify-between transition-all"
                      style={{
                        backgroundColor: selected ? 'color-mix(in srgb, var(--gold) 7%, transparent)' : 'var(--bg-elev-2)',
                        border: `1px solid ${selected ? 'var(--gold)' : 'var(--line)'}`,
                      }}
                    >
                      <div>
                        <p className="text-xs font-medium" style={{ color: selected ? 'var(--gold-text)' : 'var(--ink)' }}>
                          {asset.title}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--ink-4)' }}>IP #{String(asset.tokenId)}</p>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--gold-text)' }}>
                        {asset.category}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Cause dropdown */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t.modals.disputeFormCauseLabel}</p>
          <select
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            className="input"
            disabled={isLoading}
          >
            <option value="">{t.modals.disputeFormCausePlaceholder}</option>
            <option value={t.modals.disputeFormCauses.infringement}>{t.modals.disputeFormCauses.infringement}</option>
            <option value={t.modals.disputeFormCauses.derivative}>{t.modals.disputeFormCauses.derivative}</option>
            <option value={t.modals.disputeFormCauses.forgery}>{t.modals.disputeFormCauses.forgery}</option>
            <option value={t.modals.disputeFormCauses.royaltyDefault}>{t.modals.disputeFormCauses.royaltyDefault}</option>
            <option value={t.modals.disputeFormCauses.licenseBreach}>{t.modals.disputeFormCauses.licenseBreach}</option>
            <option value={t.modals.disputeFormCauses.metadata}>{t.modals.disputeFormCauses.metadata}</option>
          </select>
        </div>

        {/* Remedy tags */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t.modals.disputeFormRemediesLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'takedown', label: t.modals.disputeFormRemedies.takedown },
              { id: 'revoke', label: t.modals.disputeFormRemedies.revoke },
              { id: 'damages', label: t.modals.disputeFormRemedies.damages },
              { id: 'transfer', label: t.modals.disputeFormRemedies.transfer },
              { id: 'attribution', label: t.modals.disputeFormRemedies.attribution },
              { id: 'freeze', label: t.modals.disputeFormRemedies.freeze },
            ] as const).map(({ id, label }) => {
              const selected = remedies.includes(label)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setRemedies(selected ? remedies.filter(r => r !== label) : [...remedies, label])}
                  className="text-xs px-2.5 py-1 rounded-sm transition-all"
                  style={{
                    backgroundColor: selected ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                    color: selected ? 'var(--gold-text)' : 'var(--ink-3)',
                    border: `1px solid ${selected ? 'var(--gold)' : 'var(--line)'}`,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes / free-text reason */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t.modals.disputeFormNotesLabel}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.modals.reasonForDispute}
            rows={3}
            className="input resize-none"
            disabled={isLoading}
          />
        </div>

        {/* Proof Upload */}
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-4)' }}>{t.modals.uploadProof}</p>
          {proofFile ? (
            <div className="flex items-center gap-3 p-3 rounded-sm" style={{ backgroundColor: 'var(--bg-elev-2)' }}>
              {proofFile.type.startsWith('image/') && proofPreviewUrl ? (
                <img src={proofPreviewUrl} alt="" className="w-11 h-11 object-cover rounded-lg" />
              ) : (
                <FileText className="w-11 h-11 p-2" style={{ color: 'var(--gold-text)' }} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--ink)' }}>{proofFile.name}</p>
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>{(proofFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button type="button" onClick={() => setProofFile(null)} disabled={isLoading}>
                <X className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
              </button>
            </div>
          ) : (
            <div onClick={() => !isLoading && fileRef.current?.click()} className="border border-dashed rounded-sm p-4 text-center cursor-pointer transition-colors hover:border-opacity-80" style={{ borderColor: 'var(--line)' }}>
              <CloudUpload className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--gold-text)' }} />
              <p className="text-sm" style={{ color: 'var(--ink-4)' }}>{t.modals.uploadProofFile}</p>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && setProofFile(e.target.files[0])} className="hidden" />
            </div>
          )}
        </div>

        {/* Or URI directly */}
        {!proofFile && (
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--ink-4)' }}>{t.modals.orEnterProofURI}</p>
            <input type="text" value={proofURI} onChange={(e) => setProofURI(e.target.value)} placeholder="ipfs://... or https://..." className="input" disabled={isLoading} />
          </div>
        )}

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error.message}</p>}

        {/* Required bond with refund guidance. */}
        <div
          className="rounded-sm px-3 py-2.5"
          style={{ background: 'color-mix(in srgb, var(--gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)' }}
        >
          <div className="flex items-center justify-between">
            <span className="allcaps mono text-[11px]" style={{ color: 'var(--gold-text)' }}>
              {t.disputes.requiredBond}
            </span>
            <span className="mono tnum font-bold text-sm" style={{ color: 'var(--gold-text)' }}>
              {disputeBond === undefined ? '—' : `${formatEther(disputeBond)} PAS`}
            </span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--ink-4)' }}>
            {t.disputes.bondRefundNote}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" isLoading={isLoading} disabled={!hasSelection || !hasComposedContent || disputeBond === undefined}>
            {t.common.submit}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
        </div>
      </form>
    </Modal>
  )
}
