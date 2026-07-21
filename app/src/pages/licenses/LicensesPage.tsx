import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, KeyRound } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { useSearchContext } from '@/contexts/search-context'
import { useTranslations } from '@/lib/i18n'
import { LicensesSection } from '@/pages/dashboard/sections/LicensesSection'
import { HeldLicensesSection } from '@/pages/dashboard/sections/HeldLicensesSection'

type PivotView = 'issued' | 'held'

const NOW_S = () => BigInt(Math.floor(Date.now() / 1000))
const THIRTY_DAYS_S = BigInt(30 * 86400)

function isExpiringSoon(expiryTime: bigint): boolean {
  if (expiryTime === 0n) return false
  const now = NOW_S()
  return expiryTime > now && expiryTime < now + THIRTY_DAYS_S
}

function PivotTab({ active, onClick, label, sub, icon: Icon, alert }: {
  active: boolean
  onClick: () => void
  label: string
  sub: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  alert?: number
  alertLabel?: string
}) {
  const { t } = useTranslations()
  return (
    <button onClick={onClick} className="flex items-center gap-3" style={{
      flex: 1, padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
      background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'transparent',
      borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
      color: active ? 'var(--ink)' : 'var(--ink-2)',
    }}>
      <Icon style={{ width: 18, height: 18, color: active ? 'var(--gold-text)' : 'var(--ink-3)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
          {!!alert && alert > 0 && (
            <span className="mono" style={{
              padding: '1px 6px', fontSize: 10, background: 'var(--danger)',
              color: 'white', fontWeight: 700, letterSpacing: '0.06em',
            }}>{alert} {t.heldLicenses.pivot.renewalBadge}</span>
          )}
        </div>
        <div className="allcaps mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}

export default function LicensesPage() {
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { searchTerm } = useSearchContext()
  const { t } = useTranslations()

  const view: PivotView = searchParams.get('view') === 'held' ? 'held' : 'issued'
  const setView = (v: PivotView) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v === 'held') next.set('view', 'held')
      else next.delete('view')
      return next
    }, { replace: true })
  }

  const {
    assets,
    licenses,
    isLoadingAssets,
    isLoadingLicenses,
    revenueBalance,
    heldLicenses,
    isLoadingHeldLicenses,
    refetchHeldLicenses,
  } = usePreloadedData()

  // The tab badge uses locally available expiry data.
  const renewalAlertCount = heldLicenses.filter(l =>
    !l.isRevoked && !l.isConcluded && isExpiringSoon(l.expiryTime)
  ).length

  // Held-license tab summary.
  const heldSub = renewalAlertCount > 0
    ? `${heldLicenses.length} ${t.heldLicenses.pivot.heldSub} · ${renewalAlertCount} ${t.heldLicenses.stats.expiringSoon}`
    : `${heldLicenses.length} ${t.heldLicenses.pivot.heldSub}`

  return (
    <div>
      {/* Pivot: Issued vs Held */}
      <div className="flex" style={{ gap: 0, border: '1px solid var(--line)', marginBottom: 18 }}>
        <PivotTab
          active={view === 'issued'}
          onClick={() => setView('issued')}
          label={t.heldLicenses.pivot.issuedLabel}
          sub={`${licenses.length} ${t.heldLicenses.pivot.issuedSub}`}
          icon={Sparkles}
        />
        <PivotTab
          active={view === 'held'}
          onClick={() => setView('held')}
          label={t.heldLicenses.pivot.heldLabel}
          sub={heldSub}
          icon={KeyRound}
          alert={renewalAlertCount}
        />
      </div>

      {view === 'issued' ? (
        <LicensesSection
          colors={colors}
          assets={assets}
          licenses={licenses}
          isLoading={isLoadingAssets || isLoadingLicenses}
          revenueBalance={revenueBalance}
          onCreateLicense={() => navigate('/studio')}
          searchTerm={searchTerm}
        />
      ) : (
        <HeldLicensesSection
          colors={colors}
          heldLicenses={heldLicenses}
          isLoading={isLoadingHeldLicenses}
          refetchHeldLicenses={refetchHeldLicenses}
          searchTerm={searchTerm}
        />
      )}
    </div>
  )
}
