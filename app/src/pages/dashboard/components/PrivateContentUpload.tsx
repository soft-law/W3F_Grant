import { useRef, useState } from 'react'
import { Upload, Lock, Check, AlertCircle, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/Button'
import { useTheme } from '@/hooks/useTheme'
import { useTranslations } from '@/lib/i18n'
import { usePrivateContentUpload, usePrivateContentUploadForAsset } from '@/hooks/usePrivateContent'
import {
  privateContentFileIsValid,
  type PrivateContentSubject,
} from '@/lib/private-content-domain'

// Subject is either a license token (the existing buyer-deliverable flow) or
// an IP asset (creator-side encrypted notes / drafts the IP owner can recall
// later). Each path uses its own indexer routes + EIP-712 domain.
const ACCEPTED = '.pdf,.doc,.docx,.zip,.png,.jpg,.jpeg'

type Phase = 'idle' | 'encrypting' | 'uploaded' | 'storing' | 'done'

export type PreparedPrivateContent = {
  file: File
  cid: string
  aesKeyB64: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function shortenCid(cid: string): string {
  if (cid.length <= 16) return cid
  return `${cid.slice(0, 8)}...${cid.slice(-6)}`
}

// Back-compat: callers that pass `licenseId` straight through are wrapped
// into a license-kind subject.
export function PrivateContentUpload({ subject, licenseId, prepared, required = false, onDone }: {
  subject?: PrivateContentSubject
  licenseId?: number
  prepared?: PreparedPrivateContent
  required?: boolean
  onDone: () => void
}) {
  const { colors } = useTheme()
  const { t } = useTranslations()
  const pc = t.privateContent

  const resolved: PrivateContentSubject = subject
    ?? { kind: 'license', id: licenseId ?? 0 }
  const isAsset = resolved.kind === 'asset'
  const subjectId = resolved.id

  // Hook order must be stable across renders, so call both. Only the active
  // one is actually invoked through its closure.
  const licenseHook = usePrivateContentUpload(isAsset ? 0 : resolved.id)
  const assetHook = usePrivateContentUploadForAsset(isAsset ? resolved.id : 0)
  const { uploadEncrypted, storeKey, isEncrypting, isStoring, error: hookError } = isAsset ? assetHook : licenseHook

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(prepared?.file ?? null)
  const [cid, setCid] = useState<string>(prepared?.cid ?? '')
  const [aesKeyB64, setAesKeyB64] = useState<string>(prepared?.aesKeyB64 ?? '')
  const [phase, setPhase] = useState<Phase>(prepared ? 'uploaded' : 'idle')
  const [localError, setLocalError] = useState<string>('')

  const error = localError || (hookError ? hookError.message : '')

  const onPickFile = (f: File | null) => {
    setLocalError('')
    if (!f) {
      setFile(null)
      return
    }
    if (!privateContentFileIsValid(f)) {
      setLocalError(pc.tooLarge)
      setFile(null)
      return
    }
    setFile(f)
    setPhase('idle')
    setCid('')
    setAesKeyB64('')
  }

  const handleUpload = async () => {
    if (!file) return
    setLocalError('')
    setPhase('encrypting')
    try {
      const result = await uploadEncrypted(file)
      setCid(result.cid)
      setAesKeyB64(result.aesKeyB64)
      setPhase('uploaded')
    } catch (e) {
      setPhase('idle')
      const msg = e instanceof Error ? e.message : pc.genericError
      setLocalError(msg)
    }
  }

  const handleStoreKey = async () => {
    if (!aesKeyB64) return
    setLocalError('')
    setPhase('storing')
    try {
      await storeKey(aesKeyB64, cid)
      setPhase('done')
    } catch (e) {
      setPhase('uploaded')
      const msg = e instanceof Error ? e.message : pc.genericError
      // User rejected signature — keep silent
      if (!msg.includes('User rejected') && !msg.includes('user rejected')) {
        setLocalError(msg)
      }
    }
  }

  const containerStyle = {
    backgroundColor: colors.background.secondary,
    border: `1px solid ${colors.border.primary}`,
  }

  const subtleBoxStyle = {
    backgroundColor: colors.background.tertiary,
    border: `1px solid ${colors.border.primary}`,
  }

  return (
    <div className="rounded-sm p-3 space-y-3" style={containerStyle}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
        <h4 className="text-xs font-bold" style={{ color: colors.text.primary }}>{required ? pc.attachTitleRequired : pc.attachTitle}</h4>
      </div>
      <p className="text-[11px]" style={{ color: colors.text.muted }}>
        {(isAsset ? pc.attachIntroAsset : pc.attachIntro).replace('{id}', String(subjectId))}
      </p>
      {prepared && phase !== 'done' && (
        <p className="text-[11px] font-medium" role="status" style={{ color: 'var(--gold-text)' }}>
          {pc.finishSecureSetup}
        </p>
      )}

      {/* File picker */}
      {phase === 'idle' && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-sm text-xs transition-opacity hover:opacity-80"
            style={{
              ...subtleBoxStyle,
              borderStyle: 'dashed',
              color: file ? colors.text.primary : colors.text.muted,
            }}
          >
            {file ? (
              <>
                <FileText className="w-4 h-4" style={{ color: 'var(--gold-text)' }} />
                <span className="truncate">{file.name}</span>
                <span style={{ color: colors.text.muted }}>({formatBytes(file.size)})</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{pc.pickFile}</span>
              </>
            )}
          </button>
          <p className="text-[10px]" style={{ color: colors.text.muted }}>{pc.pickFileHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {/* Status: encrypting / uploaded */}
      {(phase === 'encrypting' || phase === 'uploaded' || phase === 'storing' || phase === 'done') && file && (
        <div className="rounded-sm p-2.5 space-y-1.5" style={subtleBoxStyle}>
          <div className="flex items-center gap-2 text-[11px]">
            <FileText className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
            <span className="truncate flex-1" style={{ color: colors.text.primary }}>{file.name}</span>
            <span style={{ color: colors.text.muted }}>{formatBytes(file.size)}</span>
          </div>

          {phase === 'encrypting' && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--gold-text)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {pc.encrypting}
            </div>
          )}

          {(phase === 'uploaded' || phase === 'storing' || phase === 'done') && cid && (
            <div className="flex items-center gap-2 text-[11px]">
              <Check className="w-3.5 h-3.5" style={{ color: colors.status.success }} />
              <span style={{ color: colors.text.secondary }}>{pc.uploaded}</span>
              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.background.primary, color: colors.text.muted }}>
                {pc.cidLabel}: {shortenCid(cid)}
              </span>
            </div>
          )}

          {phase === 'storing' && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--gold-text)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {pc.storingKey}
            </div>
          )}

          {phase === 'done' && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: colors.status.success }}>
              <Check className="w-3.5 h-3.5" />
              {pc.keyStored}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-1.5 text-[11px]" style={{ color: '#ef4444' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between gap-2 pt-1">
        {!required && phase !== 'done' && (
          <Button size="sm" variant="outline" onClick={onDone} disabled={isEncrypting || isStoring}>
            {pc.skip}
          </Button>
        )}

        {phase === 'idle' && (
          <Button size="sm" onClick={handleUpload} disabled={!file} isLoading={isEncrypting}>
            {pc.encryptUpload}
          </Button>
        )}

        {phase === 'uploaded' && (
          <Button size="sm" onClick={handleStoreKey} isLoading={isStoring}>
            {prepared ? pc.finishSetup : pc.storeKey}
          </Button>
        )}

        {phase === 'storing' && (
          <Button size="sm" disabled isLoading>
            {pc.storeKey}
          </Button>
        )}

        {phase === 'done' && (
          <Button size="sm" onClick={onDone}>
            {pc.done}
          </Button>
        )}
      </div>
    </div>
  )
}
