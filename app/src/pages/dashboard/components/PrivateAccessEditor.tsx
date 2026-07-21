import { ShieldCheck, UserMinus, UserPlus, X } from 'lucide-react'
import { isAddress, type Address } from 'viem'
import { useTranslations } from '@/lib/i18n'

interface PrivateAccessEditorProps {
  scope: 'asset' | 'license'
  value: string
  onChange: (value: string) => void
  onGrant: (account: Address) => void | Promise<void>
  onRevoke: (account: Address) => void | Promise<void>
  isGranting?: boolean
  isRevoking?: boolean
  isInactiveLicense?: boolean
  onClose?: () => void
  compact?: boolean
}

/**
 * Edits explicit encrypted-file shares. These grants control decryption, not
 * ownership or legal license rights.
 */
export function PrivateAccessEditor({
  scope,
  value,
  onChange,
  onGrant,
  onRevoke,
  isGranting = false,
  isRevoking = false,
  isInactiveLicense = false,
  onClose,
  compact = false,
}: PrivateAccessEditorProps) {
  const { t } = useTranslations()
  const copy = t.ipSection.privateFileAccess
  const validAddress = isAddress(value)
  const busy = isGranting || isRevoking
  const title = scope === 'asset' ? copy.assetTitle : copy.licenseTitle
  const help = scope === 'asset' ? copy.assetHelp : copy.licenseHelp
  const lifecycle = scope === 'asset' ? copy.assetLifecycle : copy.licenseLifecycle

  const submit = async (operation: 'grant' | 'revoke') => {
    if (!validAddress || busy) return
    const account = value as Address
    if (operation === 'grant') await onGrant(account)
    else await onRevoke(account)
  }

  return (
    <div
      role="group"
      aria-label={title}
      className="space-y-2"
      style={{
        padding: compact ? 8 : 10,
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--line)',
      }}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--gold-text)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
          <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--ink-3)' }}>{help}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t.common.close} className="p-0.5 shrink-0" style={{ color: 'var(--ink-4)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {scope === 'license' && isInactiveLicense && (
        <p
          role="note"
          className="text-[10px] leading-relaxed px-2 py-1.5"
          style={{
            color: 'var(--warn)',
            background: 'color-mix(in srgb, var(--warn) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
          }}
        >
          {copy.inactiveWarning}
        </p>
      )}

      <label className="block">
        <span className="allcaps mono block mb-1" style={{ fontSize: 9, color: 'var(--ink-4)' }}>
          {copy.walletAddress}
        </span>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t.common.addressPlaceholder}
          aria-invalid={value.length > 0 && !validAddress}
          className="input w-full text-[11px]"
          style={{ padding: compact ? '5px 7px' : '7px 9px' }}
        />
      </label>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={!validAddress || busy}
          onClick={() => { void submit('grant') }}
          className="btn btn-primary btn-sm text-[10px]"
        >
          <UserPlus className="w-3 h-3" />
          {t.ipSection.licenseActions.grant}
        </button>
        <button
          type="button"
          disabled={!validAddress || busy}
          onClick={() => { void submit('revoke') }}
          className="btn btn-ghost btn-sm text-[10px]"
          style={{ color: 'var(--danger)' }}
        >
          <UserMinus className="w-3 h-3" />
          {t.ipSection.licenseActions.revoke}
        </button>
      </div>

      <div className="space-y-0.5" style={{ color: 'var(--ink-4)' }}>
        <p className="text-[9px] leading-relaxed">{lifecycle}</p>
        <p className="text-[9px] leading-relaxed font-medium">{copy.rightsDisclaimer}</p>
      </div>
    </div>
  )
}
