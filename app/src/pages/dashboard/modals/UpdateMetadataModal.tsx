import { useState, useEffect, useRef, useMemo } from 'react'
import { CloudUpload, X, FileText, Image, Music, Film, Code, Drama } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { Button } from '@/components/Button'
import { useTxToast } from '@/hooks/useTxToast'
import { useUpdateMetadata, type UserIPAsset } from '@/hooks/useContracts'
import { useIPFSUpload, isConfigured as isIPFSConfigured } from '@/hooks/useIPFS'
import { buildOwnershipLegal } from '@/lib/ipfs-storage'
import { useTranslations } from '@/lib/i18n'
import { Modal } from '../components/Modal'
import type { WorkType } from '../types'

const WORK_TYPE_ICONS: Record<WorkType, typeof FileText> = {
  literary: FileText,
  artistic: Image,
  musical: Music,
  audiovisual: Film,
  software: Code,
  dramatic: Drama,
}

export function UpdateMetadataModal({ colors, asset, address, onClose, onSuccess }: { colors: ThemeColors; asset: UserIPAsset; address: `0x${string}`; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslations()
  const workTypes: Array<{ id: WorkType; label: string; icon: typeof FileText }> = [
    { id: 'literary', label: t.registry.categories.literary, icon: WORK_TYPE_ICONS.literary },
    { id: 'artistic', label: t.registry.categories.artistic, icon: WORK_TYPE_ICONS.artistic },
    { id: 'musical', label: t.registry.categories.musical, icon: WORK_TYPE_ICONS.musical },
    { id: 'audiovisual', label: t.registry.categories.audiovisual, icon: WORK_TYPE_ICONS.audiovisual },
    { id: 'software', label: t.registry.categories.software, icon: WORK_TYPE_ICONS.software },
    { id: 'dramatic', label: t.registry.categories.dramatic, icon: WORK_TYPE_ICONS.dramatic },
  ]
  const { updateMetadata, hash, isPending, isSuccess, error } = useUpdateMetadata()
  const { upload, cleanupOnError: cleanupIPFS, isUploading } = useIPFSUpload()
  const fileRef = useRef<HTMLInputElement>(null)
  const txToast = useTxToast()
  const doneRef = useRef(false)

  // Normalize stored category values.
  const resolveWorkType = (cat: string): WorkType | '' => {
    const map: Record<string, WorkType> = {
      copyright: 'literary', artwork: 'artistic', music: 'musical', video: 'audiovisual',
      literary: 'literary', artistic: 'artistic', musical: 'musical', audiovisual: 'audiovisual',
      software: 'software', dramatic: 'dramatic',
    }
    return map[cat] || ''
  }

  const [form, setForm] = useState({ title: asset.title, description: '', category: resolveWorkType(asset.category) as string })
  const [file, setFile] = useState<File | null>(null)
  const filePreviewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file])
  useEffect(() => { return () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl) } }, [filePreviewUrl])
  const [manualURI, setManualURI] = useState('')
  const [useManualURI, setUseManualURI] = useState(false)

  // Multi-step progress toast lifecycle: hash → confirming, isSuccess → indexing → done
  useEffect(() => {
    if (hash) txToast.onHash(hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  useEffect(() => {
    if (!isSuccess || doneRef.current) return
    doneRef.current = true
    txToast.onConfirmed(t.modals.metadataUpdated)
    setTimeout(() => onSuccess(), 8000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  useEffect(() => {
    if (error) txToast.onError(error instanceof Error ? error : new Error(String(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    doneRef.current = false

    const willUploadIPFS = !useManualURI && file && isIPFSConfigured()
    if (willUploadIPFS) {
      txToast.start(t.modals.update, [{ label: t.tx.uploadingIPFS, status: 'active' }])
    } else {
      txToast.start(t.modals.update)
    }

    try {
      let uri: string

      if (useManualURI) {
        uri = manualURI
      } else if (file && isIPFSConfigured()) {
        const result = await upload(file, {
          name: form.title,
          description: form.description,
          workType: form.category,
          creator: address,
          copyrightDeclaration: true,
        })
        uri = result.metadataUri
        txToast.advanceToSigning()
      } else {
        let imageData = ''
        if (file) {
          const reader = new FileReader()
          imageData = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
        }
        const json = JSON.stringify({
          name: form.title,
          description: form.description,
          image: imageData,
          attributes: [
            { trait_type: 'Work Type', value: form.category },
            { trait_type: 'Creator', value: address },
          ],
          legal: buildOwnershipLegal(address),
        })
        uri = `data:application/json;base64,${btoa(json)}`
      }

      await updateMetadata(asset.tokenId, uri)
      // Success path takes over via the isSuccess effect above.
    } catch (err) {
      // PIN-C1: unpin uploaded CIDs if the tx didn't go through.
      void cleanupIPFS()
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const isLoading = isPending || isUploading

  return (
    <Modal colors={colors} title={t.modals.updateMetadata} onClose={onClose}>
      <div className="mb-4 p-3 rounded-sm" style={{ backgroundColor: colors.background.tertiary }}>
        <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{asset.title}</p>
        <p className="text-sm" style={{ color: colors.text.muted }}>IP #{asset.tokenId.toString()}</p>
      </div>

      {/* Toggle between upload and manual URI */}
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setUseManualURI(false)} className="flex-1 py-2.5 rounded-sm text-sm font-medium" style={{ backgroundColor: !useManualURI ? `${colors.accent.gold}20` : colors.background.tertiary, color: !useManualURI ? colors.accent.goldText : colors.text.muted, border: `1px solid ${!useManualURI ? colors.accent.gold : colors.border.primary}` }}>
          {t.modals.uploadNew}
        </button>
        <button type="button" onClick={() => setUseManualURI(true)} className="flex-1 py-2.5 rounded-sm text-sm font-medium" style={{ backgroundColor: useManualURI ? `${colors.accent.gold}20` : colors.background.tertiary, color: useManualURI ? colors.accent.goldText : colors.text.muted, border: `1px solid ${useManualURI ? colors.accent.gold : colors.border.primary}` }}>
          {t.modals.enterURI}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {useManualURI ? (
          <>
            <input type="text" value={manualURI} onChange={(e) => setManualURI(e.target.value)} placeholder={t.common.metadataUriPlaceholder} className="input" required disabled={isLoading} />
            <p className="text-sm" style={{ color: colors.text.muted }}>{t.modals.enterMetadataURI}</p>
          </>
        ) : (
          <>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t.registry.form.titleLabel} className="input" required disabled={isLoading} />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t.registry.form.descriptionLabel} rows={3} className="input resize-none" disabled={isLoading} />

            {/* Work Type Selection */}
            <div className="grid grid-cols-3 gap-1.5">
              {workTypes.map((wt) => (
                <button key={wt.id} type="button" onClick={() => setForm({ ...form, category: wt.id })} disabled={isLoading} className="flex flex-col items-center gap-1 p-2.5 rounded-sm text-xs" style={{ backgroundColor: form.category === wt.id ? `${colors.accent.gold}20` : colors.background.tertiary, border: `1px solid ${form.category === wt.id ? colors.accent.gold : colors.border.primary}`, color: form.category === wt.id ? colors.accent.goldText : colors.text.muted }}>
                  <wt.icon className="w-4 h-4" />{wt.label}
                </button>
              ))}
            </div>

            {/* Image Upload */}
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-sm" style={{ backgroundColor: colors.background.tertiary }}>
                <img src={filePreviewUrl!} alt="" className="w-11 h-11 object-cover rounded-lg" />
                <span className="flex-1 text-sm truncate" style={{ color: colors.text.primary }}>{file.name}</span>
                <button type="button" onClick={() => setFile(null)} disabled={isLoading}><X className="w-4 h-4" style={{ color: colors.text.muted }} /></button>
              </div>
            ) : (
              <div onClick={() => !isLoading && fileRef.current?.click()} className="border border-dashed rounded-sm p-4 text-center cursor-pointer" style={{ borderColor: colors.border.primary }}>
                <CloudUpload className="w-5 h-5 mx-auto mb-1" style={{ color: colors.accent.goldText }} />
                <p className="text-sm" style={{ color: colors.text.muted }}>{t.modals.uploadNewImage}</p>
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} className="hidden" />
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-500">{error.message}</p>}
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" isLoading={isLoading} disabled={useManualURI ? !manualURI : !form.title}>{t.modals.update}</Button>
          <Button type="button" variant="outline" onClick={onClose}>{t.common.cancel}</Button>
        </div>
      </form>
    </Modal>
  )
}
