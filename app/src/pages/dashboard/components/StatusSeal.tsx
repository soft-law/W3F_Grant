import { AlertTriangle, Ban, Clock, Gavel, PackageX, XCircle } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { useTranslations } from '@/lib/i18n'

type Status = 'active' | 'indexing' | 'disputed' | 'expired' | 'revoked' | 'resolved' | 'awardGranted' | 'offered' | 'stuck' | 'invalidated'
type Context = 'asset' | 'license' | 'dispute'

const SEAL_CLASS: Record<Status, string> = {
  active:       'seal-registered',
  indexing:     'seal-pending',
  disputed:     'seal-disputed',
  expired:      'seal-disputed',
  revoked:      'seal-disputed',
  // Rejected dispute — proceeding concluded, no relief granted, license stands.
  resolved:     'seal-registered',
  // Approved dispute pre-enforcement — award exists, revocation not yet executed.
  awardGranted: 'seal-disputed',
  offered:      'seal-listed',
  // Wrapped external NFT failed to return on unwrap — escrow needs attention.
  stuck:        'seal-pending',
  // Arbitrator voided the registration — strongest negative state.
  invalidated:  'seal-disputed',
}

const ICON_MAP: Partial<Record<Status, typeof AlertTriangle>> = {
  disputed:     AlertTriangle,
  expired:      Clock,
  revoked:      XCircle,
  // Gavel (not AlertTriangle) so Approved reads distinct from Pending.
  awardGranted: Gavel,
  stuck:        PackageX,
  invalidated:  Ban,
}

export function StatusSeal({
  status,
  size = 'md',
  context,
  colors: _colors,
}: {
  status: Status
  size?: 'sm' | 'md'
  context?: Context
  colors?: ThemeColors
}) {
  const { t } = useTranslations()
  const seal = t.common.seal

  let label: string
  switch (status) {
    case 'active':
      label = context === 'asset' ? seal.registeredOnChain
            : context === 'license' ? seal.inForce
            : seal.registeredLegacy
      break
    case 'indexing':     label = seal.pendingConfirmation; break
    case 'disputed':     label = seal.subJudice; break
    case 'expired':      label = seal.expired; break
    case 'revoked':      label = seal.revoked; break
    // "No award", not "Res judicata" — Rule 2.4 permits refiling, so no claim
    // preclusion attaches; the seal states the outcome (no relief granted).
    case 'resolved':     label = seal.noAward; break
    case 'awardGranted': label = seal.awardGranted; break
    case 'offered':      label = seal.offered; break
    case 'stuck':        label = seal.stuck; break
    case 'invalidated':  label = seal.invalidated; break
    default:             label = status
  }

  const Icon = ICON_MAP[status]
  const iconSize = size === 'sm' ? 10.5 : 11.5
  const smPad = size === 'sm' ? '3px 7px 3px 5px' : undefined

  return (
    <span
      className={`seal ${SEAL_CLASS[status]}`}
      style={size === 'sm' ? { padding: smPad, fontSize: 9.5 } : undefined}
    >
      {Icon ? (
        <Icon style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />
      ) : (
        <span className={status === 'indexing' ? 'chip-dot pulse' : 'chip-dot'} />
      )}
      {label}
    </span>
  )
}
