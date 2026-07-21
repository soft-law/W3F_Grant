import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '@privy-io/react-auth'
import { Briefcase, ScrollText, Compass, Scale, Activity, ExternalLink, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useTranslations } from '@/lib/i18n'
import { useIndexedAssets, useIndexedLicenses, useIndexedHeldLicenses, useIndexedDisputes, useIndexedExplorerEvents, useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { useGetRevenueBalance } from '@/hooks/useContracts'
import { toastError } from '@/hooks/useToast'
import { StatCard } from '@/pages/dashboard/components/StatCard'
import { RegisterIPModal } from '@/pages/dashboard/modals/RegisterIPModal'
import { CreateLicenseModal } from '@/pages/dashboard/modals/CreateLicenseModal'
import { shortenAddress, explorerUrlForEvent } from '@/lib/contracts'
import { formatEther } from 'viem'
import { getEventColor } from '@/lib/explorerEvents'
import { humanizeEvent } from '@/lib/humanizeEvent'
import { timeAgo } from '@/lib/timeAgo'
import { DisputeStatus } from '@/lib/contracts'

// ── Sign-in wall ─────────────────────────────────────────────────────────────

function SignInWall() {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const { login } = useLogin({
    onError: (err) => {
      const code = String(err)
      if (code === 'exited_auth_flow' || code === 'user_cancelled') return
      toastError(t.nav.connectFailed)
    },
  })

  return (
    <div style={{
      maxWidth: 520,
      margin: '0 auto',
      paddingTop: 48,
    }}>
      {/* Chamber header */}
      <div style={{
        padding: '9px 16px',
        background: 'color-mix(in srgb, var(--gold) 6%, var(--bg-elev))',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderTop: '1px solid var(--gold)',
        borderLeft: '1px solid var(--gold)',
        borderRight: '1px solid var(--gold)',
      }}>
        <span className="mono allcaps" style={{ fontSize: 10, color: 'var(--gold-text)', letterSpacing: '0.16em', fontWeight: 700 }}>
          § {t.studioLanding.authRequired}
        </span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
          {t.studioLanding.signInLegal}
        </span>
      </div>

      {/* Body */}
      <div style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--gold)',
        borderTop: 'none',
        padding: '32px 36px 20px',
        textAlign: 'center',
      }}>
        {/* Private seal SVG */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <PrivateSeal />
        </div>

        <div className="mono allcaps" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--ink-4)', marginBottom: 8 }}>
          {t.studioLanding.privateChamber}
        </div>

        <h1 className="display" style={{ margin: '0 0 4px', fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {t.studioLanding.heroSignedOut}
        </h1>
        <p style={{ margin: '12px auto 24px', maxWidth: 400, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {t.studioLanding.signInDesc}
        </p>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 14, fontWeight: 600, marginBottom: 12 }}
          onClick={() => login()}
        >
          <Wallet style={{ width: 15, height: 15 }} />
          {t.studioLanding.signIn}
        </button>

        <button
          onClick={() => navigate('/explorer')}
          style={{
            width: '100%',
            background: 'transparent',
            border: 0,
            padding: '8px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--gold-text)',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            textDecoration: 'underline dotted',
          }}
        >
          {t.studioLanding.browseExchange} →
        </button>
      </div>
    </div>
  )
}

// Minimal wax seal — private chamber variant
function PrivateSeal() {
  const size = 72
  const cx = size / 2, cy = size / 2
  const r1 = size * 0.46
  const r2 = size * 0.38
  const pathId = 'sl-private-seal'
  const ring = ' · CHAMBER PRIVATE · SOFT.LAW · '
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"
      style={{ display: 'block', filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--gold) 25%, transparent))' }}>
      <defs>
        <path id={pathId}
          d={`M ${cx - r1} ${cy} a ${r1} ${r1} 0 1 1 ${r1 * 2} 0 a ${r1} ${r1} 0 1 1 ${-r1 * 2} 0`} />
      </defs>
      <circle cx={cx} cy={cy} r={r1} fill="none" stroke="var(--gold)" strokeWidth="1.2" strokeDasharray="1.5 2" />
      <circle cx={cx} cy={cy} r={r2} fill="none" stroke="var(--gold)" strokeWidth="1" />
      <text style={{ fill: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: size * 0.09, letterSpacing: '0.12em' }}>
        <textPath href={`#${pathId}`} startOffset="0%">{ring}</textPath>
      </text>
      {/* padlock */}
      <g transform={`translate(${cx - 9}, ${cy - 11})`} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9V7a5 5 0 0 1 10 0v2" />
        <rect x="2" y="9" width="14" height="11" rx="1" />
        <circle cx="9" cy="14.5" r="1.2" fill="var(--gold)" stroke="none" />
      </g>
    </svg>
  )
}

// ── CTA tile ─────────────────────────────────────────────────────────────────

function CtaTile({ icon: Icon, title, desc, onClick }: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        padding: '18px 16px',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        border: '1px solid var(--line)',
        background: 'var(--bg-elev)',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)' }}
    >
      <div style={{
        width: 36,
        height: 36,
        background: 'color-mix(in srgb, var(--gold) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gold) 30%, var(--line))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon style={{ width: 16, height: 16, color: 'var(--gold-text)' }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>{desc}</div>
      </div>
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-4)' }}>→</span>
    </button>
  )
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ event }: { event: ReturnType<typeof useIndexedExplorerEvents>['events'][number] }) {
  const args = event.args as Record<string, unknown>
  const verb = humanizeEvent(event.eventName)
  const actor = (args.from ?? args.seller ?? args.buyer ?? args.submitter ?? args.operator ?? '') as string
  const subject = (args.title as string) || (args.tokenId !== undefined ? `#${String(args.tokenId)}` : '')
  const color = getEventColor(event.eventName)

  return (
    <a
      href={explorerUrlForEvent(event.transactionHash, event.blockNumber)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid var(--line-2)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        background: `${color}14`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Activity style={{ width: 13, height: 13 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', fontSize: 13 }}>
          {actor && (
            <span className="mono" style={{ color: 'var(--ink-2)' }}>{shortenAddress(actor)}</span>
          )}
          <span style={{ color: 'var(--ink-4)' }}>{verb}</span>
          {subject && (
            <span style={{ color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {subject}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontSize: 11, color: 'var(--ink-4)' }}>
          {event.blockTimestamp && <span>{timeAgo(new Date(event.blockTimestamp * 1000).toISOString())}</span>}
          <span className="mono">{shortenAddress(event.transactionHash)}</span>
        </div>
      </div>
      <ExternalLink style={{ width: 11, height: 11, color: 'var(--ink-4)', flexShrink: 0 }} />
    </a>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudioLandingPage() {
  const { t } = useTranslations()
  const { address, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const { colors } = useTheme()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const [showRegisterModal, setShowRegisterModal] = useState<'new' | 'wrap' | false>(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)

  // Stats data — only fetched when logged in
  const { assets } = useIndexedAssets(isLoggedIn ? address : undefined)
  const { licenses: issuedLicenses } = useIndexedLicenses(isLoggedIn ? address : undefined)
  const { licenses: heldLicenses } = useIndexedHeldLicenses(isLoggedIn ? address : undefined)
  const { disputes } = useIndexedDisputes(isLoggedIn ? address : undefined)
  const { data: revenueBalance } = useGetRevenueBalance(isLoggedIn && address ? address : undefined)

  // Instruments = deduplicated issued + held
  const allLicenseIds = new Set<number>()
  for (const l of issuedLicenses) allLicenseIds.add(Number(l.licenseId))
  for (const l of heldLicenses) allLicenseIds.add(Number(l.licenseId))
  const instrumentCount = allLicenseIds.size

  // Open dockets = pending disputes (status === 0)
  const openDockets = disputes.filter(d => d.status === DisputeStatus.Pending).length

  // Recent activity — all events, filter to user address
  const { events: allEvents, isLoading: eventsLoading } = useIndexedExplorerEvents('all', 50, isLoggedIn)
  const userEvents = isLoggedIn && address
    ? allEvents.filter(e => {
        const args = e.args as Record<string, unknown>
        const participants = [
          args.from, args.to, args.seller, args.buyer,
          args.submitter, args.operator, args.ipOwner, args.owner,
        ].filter(Boolean).map(v => String(v).toLowerCase())
        return participants.includes(address.toLowerCase())
      }).slice(0, 5)
    : []

  if (!isLoggedIn) {
    return (
      <div style={{ padding: '0 0 48px' }}>
        <SignInWall />
      </div>
    )
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Hero */}
      <div style={{
        padding: '20px 0 4px',
        borderBottom: '1px solid var(--line)',
        paddingBottom: 20,
      }}>
        <div className="mono allcaps" style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.14em', marginBottom: 6 }}>
          § {t.studioLanding.heroGreeting} {address ? shortenAddress(address) : ''}
        </div>
        <h1 className="display" style={{ margin: '0 0 6px', fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {t.studioLanding.heroTitle}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          {t.studioLanding.heroSubtitle}
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard
          label={t.studioLanding.stats.works}
          value={assets.length}
          icon={Briefcase}
          accent
        />
        <StatCard
          label={t.studioLanding.stats.instruments}
          value={instrumentCount}
          icon={ScrollText}
        />
        <StatCard
          label={t.studioLanding.stats.receivables}
          value={revenueBalance && revenueBalance > 0n ? parseFloat(formatEther(revenueBalance)).toFixed(2) : '—'}
          icon={Compass}
          accent={!!revenueBalance && revenueBalance > 0n}
        />
        <StatCard
          label={t.studioLanding.stats.dockets}
          value={openDockets}
          icon={Scale}
        />
      </div>

      {/* CTA grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <CtaTile
          icon={Briefcase}
          title={t.studioLanding.cta.registerIP}
          desc={t.studioLanding.cta.registerIPDesc}
          onClick={() => setShowRegisterModal('new')}
        />
        <CtaTile
          icon={ScrollText}
          title={t.studioLanding.cta.mintLicense}
          desc={t.studioLanding.cta.mintLicenseDesc}
          onClick={() => setShowLicenseModal(true)}
        />
        <CtaTile
          icon={Compass}
          title={t.studioLanding.cta.browseExchange}
          desc={t.studioLanding.cta.browseExchangeDesc}
          onClick={() => navigate('/explorer')}
        />
        <CtaTile
          icon={Scale}
          title={t.studioLanding.cta.viewDisputes}
          desc={t.studioLanding.cta.viewDisputesDesc}
          onClick={() => navigate('/judicial')}
        />
      </div>

      {/* Recent activity */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span className="mono allcaps" style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em' }}>
            § {t.studioLanding.activity.title}
          </span>
          <button
            onClick={() => navigate('/explorer')}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11 }}
          >
            {t.studioLanding.activity.viewAll} →
          </button>
        </div>

        <div style={{ border: '1px solid var(--line)', background: 'var(--bg-elev)' }}>
          {eventsLoading ? (
            <div style={{ padding: '24px 14px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : userEvents.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0 }}>
                {t.studioLanding.activity.empty}
              </p>
            </div>
          ) : (
            userEvents.map(event => (
              <ActivityRow key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

    </div>

      {/* Layout-level modals */}
      {showRegisterModal && address && (
        <RegisterIPModal
          colors={colors}
          address={address}
          initialMode={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            invalidateIndexed()
            setShowRegisterModal(false)
          }}
          onOptimisticMint={() => {}}
        />
      )}
      {showLicenseModal && address && (
        <CreateLicenseModal
          colors={colors}
          address={address}
          initialIpAssetId={undefined}
          onClose={() => setShowLicenseModal(false)}
          onSuccess={() => {
            invalidateIndexed()
            setShowLicenseModal(false)
          }}
        />
      )}
    </>
  )
}
