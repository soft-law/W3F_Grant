import { useState } from 'react'
import { Lock, Download, Loader2, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/Button'
import { useTheme } from '@/hooks/useTheme'
import { useTranslations } from '@/lib/i18n'
import { usePrivateContentDecrypt, usePrivateContentDecryptForAsset } from '@/hooks/usePrivateContent'
import type { PrivateContentSubject } from '@/lib/private-content-domain'

function triggerBrowserDownload(bytes: Uint8Array, fileName: string) {
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues
  const buf = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buf).set(bytes)
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function PrivateContentDownload({ subject, licenseId, cid, fileName }: { subject?: PrivateContentSubject; licenseId?: number; cid: string; fileName?: string }) {
  const { colors } = useTheme()
  const { t } = useTranslations()
  const pc = t.privateContent

  const resolved: PrivateContentSubject = subject
    ?? { kind: 'license', id: licenseId ?? 0 }
  const isAsset = resolved.kind === 'asset'
  const subjectId = resolved.id

  const licenseHook = usePrivateContentDecrypt()
  const assetHook = usePrivateContentDecryptForAsset()
  const { decrypt, isDecrypting, error: hookError } = isAsset ? assetHook : licenseHook

  const [done, setDone] = useState(false)
  const [localError, setLocalError] = useState<string>('')

  const error = localError || (hookError ? hookError.message : '')
  const displayName = fileName || pc.privateFile

  const handleDownload = async () => {
    setLocalError('')
    setDone(false)
    try {
      const bytes = await decrypt(subjectId, cid)
      const defaultName = isAsset ? `ip-${subjectId}-private` : `license-${subjectId}-content`
      triggerBrowserDownload(bytes, fileName || defaultName)
      setDone(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : pc.decryptError
      if (!msg.includes('User rejected') && !msg.includes('user rejected')) {
        setLocalError(msg)
      }
    }
  }

  return (
    <div className="rounded-sm p-3 space-y-2" style={{ backgroundColor: colors.background.tertiary, border: `1px solid ${colors.border.primary}` }}>
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 flex-shrink-0" style={{ color: colors.accent.goldText }} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate" style={{ color: colors.text.primary }}>{displayName}</p>
          <p className="text-[10px]" style={{ color: colors.text.muted }}>{pc.downloadDescription}</p>
        </div>
        <Button size="sm" onClick={handleDownload} isLoading={isDecrypting} disabled={isDecrypting}
          leftIcon={isDecrypting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}>
          {isDecrypting ? pc.decrypting : pc.decryptDownload}
        </Button>
      </div>

      {done && !error && (
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: colors.status.success }}>
          <Check className="w-3.5 h-3.5" />
          {pc.uploaded}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-[11px]" style={{ color: '#ef4444' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
