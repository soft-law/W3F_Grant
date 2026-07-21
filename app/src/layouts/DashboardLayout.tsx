import { useState, useEffect, useRef, useDeferredValue } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLogin } from '@privy-io/react-auth'
import { toastSuccess, toastError } from '@/hooks/useToast'
import { useBalance } from 'wagmi'
import {
  Briefcase, Scale, Compass, ScrollText, CreditCard, BookOpen,
  Wallet, Copy, Check, X, Droplets, User, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { XIcon, LinkedinIcon, InstagramIcon, GithubIcon } from '@/components/BrandIcons'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { SearchContext } from '@/contexts/search-context'
import { useActiveSection } from '@/hooks/useActiveSection'
import type { ActiveSection } from '@/hooks/useActiveSection'
import { ConnectionChip } from '@/components/ConnectionChip'
import { DashboardHeader } from '@/components/DashboardHeader'
import { ContractPausedBanner } from '@/components/ContractPausedBanner'
import { DegradedModeBanner } from '@/components/DegradedModeBanner'
import { PrivateContentRecoveryBanner } from '@/components/PrivateContentRecoveryBanner'
import { useInvalidateIndexedQueries } from '@/hooks/useIndexed'
import { formatEther } from 'viem'
import { shortenAddress, FAUCET_URL } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { RegisterIPModal } from '@/pages/dashboard/modals/RegisterIPModal'
import { CreateLicenseModal } from '@/pages/dashboard/modals/CreateLicenseModal'
import { ProfileDrawer } from '@/components/ProfileDrawer'

const SIDEBAR_W = 248
const SIDEBAR_W_COLLAPSED = 56

const SECTION_ICONS = {
  explorer: Compass,
  ip: Briefcase,
  licenses: ScrollText,
  judicial: Scale,
} as const

const SECTION_ROUTES: Record<ActiveSection, string> = {
  explorer: '/explorer',
  ip: '/studio',
  licenses: '/licenses',
  judicial: '/judicial',
}

const socialLinks = [
  { href: 'https://x.com/soft_law', icon: XIcon, label: 'X' },
  { href: 'https://www.linkedin.com/company/soft-law', icon: LinkedinIcon, label: 'LinkedIn' },
  { href: 'https://www.instagram.com/soft.law', icon: InstagramIcon, label: 'Instagram' },
  { href: 'https://github.com/soft-law', icon: GithubIcon, label: 'GitHub' },
]

function generateAvatarColors(address: string): [string, string] {
  const hash = address.toLowerCase().slice(2, 10)
  const hue1 = parseInt(hash.slice(0, 4), 16) % 360
  const hue2 = (hue1 + 40) % 360
  return [`hsl(${hue1}, 70%, 50%)`, `hsl(${hue2}, 70%, 40%)`]
}

export function DashboardLayout() {
  const { colors } = useTheme()
  const { isReady } = useAuth()
  const { t } = useTranslations()
  const { login } = useLogin({
    onComplete: () => toastSuccess(t.nav.connected),
    onError: (err) => {
      const code = String(err)
      if (code === 'exited_auth_flow' || code === 'user_cancelled') return
      toastError(t.nav.connectFailed)
    },
  })
  const activeSection = useActiveSection()
  const { pathname } = useLocation()
  // Public entity routes include compatibility redirects from Studio URLs.
  const isPublicEntityRoute =
    pathname.startsWith('/assets/') ||
    /^\/studio\/[^/]+/.test(pathname) ||
    /^\/licenses\/[^/]+/.test(pathname) ||
    /^\/judicial\/[^/]+/.test(pathname) ||
    /^\/disputes\/[^/]+/.test(pathname)

  const [copied, setCopied] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState<'new' | 'wrap' | false>(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearch = useDeferredValue(searchTerm)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W

  const {
    address,
    isConnected,
    heldLicenses,
    refetchAssets,
  } = usePreloadedData()

  const invalidateIndexed = useInvalidateIndexedQueries()
  const { data: walletBalance } = useBalance({ address })

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`)
    return () => { document.documentElement.style.removeProperty('--sidebar-w') }
  }, [sidebarWidth])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sections = [
    { id: 'explorer' as ActiveSection, label: t.dashboard.sections.explorer, icon: SECTION_ICONS.explorer },
    { id: 'ip' as ActiveSection, label: t.dashboard.sections.ip, icon: SECTION_ICONS.ip },
    { id: 'licenses' as ActiveSection, label: t.dashboard.sections.licenses, icon: SECTION_ICONS.licenses },
    { id: 'judicial' as ActiveSection, label: t.dashboard.sections.judicial, icon: SECTION_ICONS.judicial },
  ]

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const avatarColors = address ? generateAvatarColors(address) : ['#666', '#444']
  const formattedBalance = walletBalance ? parseFloat(formatEther(walletBalance.value)).toFixed(2) : '0'

  const renderSidebar = (collapsed: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      <nav style={{ padding: '8px 6px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {sections.map((section) => {
          const isActive = activeSection === section.id
          return (
            <Link
              key={section.id}
              to={SECTION_ROUTES[section.id]}
              onClick={() => setSidebarOpen(false)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingTop: 7,
                paddingBottom: 7,
                paddingLeft: collapsed ? 0 : (isActive ? 7 : 10),
                paddingRight: collapsed ? 0 : 10,
                justifyContent: collapsed ? 'center' : undefined,
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? 'var(--gold-text)' : 'var(--ink-2)',
                backgroundColor: isActive ? 'var(--hover)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                borderRadius: 0,
                transition: 'background-color 0.12s, color 0.12s',
                textAlign: 'left',
                textDecoration: 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--hover)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
              }}
              title={collapsed ? section.label : undefined}
            >
              <section.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
              {!collapsed && section.label}
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle — desktop only, pinned between nav and wallet */}
      {!sidebarOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); setSidebarCollapsed(c => !c) }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: collapsed ? '7px 0' : '7px 10px',
            fontSize: 11,
            color: 'var(--ink-4)',
            borderTop: '1px solid var(--line)',
            flexShrink: 0,
          }}
        >
          {collapsed
            ? <ChevronsRight style={{ width: 15, height: 15 }} />
            : <ChevronsLeft style={{ width: 15, height: 15 }} />
          }
          {!collapsed && 'Collapse'}
        </button>
      )}

      {/* Wallet / Connect */}
      <div style={{ borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        {isConnected && address ? (
          <div style={{ padding: collapsed ? '12px 0' : '12px 14px', display: 'flex', justifyContent: collapsed ? 'center' : undefined }}>
            {collapsed ? (
              <button
                onClick={() => setShowProfile(true)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${avatarColors[0]}, ${avatarColors[1]})`,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="View profile"
              >
                {address.slice(2, 4).toUpperCase()}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <button
                  onClick={() => setShowProfile(true)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${avatarColors[0]}, ${avatarColors[1]})`,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title="View profile"
                >
                  {address.slice(2, 4).toUpperCase()}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortenAddress(address)}
                    </span>
                    <button onClick={copyAddress} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: 2 }}>
                      {copied
                        ? <Check style={{ width: 11, height: 11, color: 'var(--gold-text)' }} />
                        : <Copy style={{ width: 11, height: 11, color: 'var(--ink-4)' }} />
                      }
                    </button>
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 1 }}>{formattedBalance} PAS</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          !collapsed && (
            <div style={{ padding: '10px 14px' }}>
              <button
                data-testid="connect-button"
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
                onClick={() => login()}
              >
                <Wallet style={{ width: 14, height: 14 }} />
                {t.nav.connect}
              </button>
            </div>
          )
        )}
      </div>

      {/* Version */}
      {!collapsed && (
        <div className="mono allcaps" style={{ padding: '6px 14px 8px', borderTop: '1px solid var(--line)', flexShrink: 0, fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
          v0.18 · testnet
        </div>
      )}
    </div>
  )

  return (
    <SearchContext.Provider value={{ searchTerm: deferredSearch }}>
      <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg)' }}>

        <DashboardHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchInputRef={searchInputRef}
          onOpenSidebar={() => setSidebarOpen(true)}
          onRegisterIP={() => setShowRegisterModal('new')}
          onCreateLicense={() => setShowLicenseModal(true)}
          onOpenProfile={() => setShowProfile(true)}
          isConnected={isConnected}
          login={login}
        />

        {/* Desktop sidebar */}
        <aside
          className="hidden md:flex"
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            flexDirection: 'column',
            borderRight: '1px solid var(--line)',
            backgroundColor: 'var(--bg-elev)',
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            paddingTop: 64,
            zIndex: 30,
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          }}
        >
          {renderSidebar(sidebarCollapsed)}
        </aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 md:hidden"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                className="fixed top-0 left-0 bottom-0 z-50 md:hidden flex flex-col"
                style={{
                  width: 'min(248px, calc(100vw - 48px))',
                  borderRight: '1px solid var(--line)',
                  backgroundColor: 'var(--bg-elev)',
                  paddingTop: 64,
                }}
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.22 }}
              >
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    position: 'absolute',
                    top: 70,
                    right: 10,
                    padding: 4,
                    color: 'var(--ink-4)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X style={{ width: 15, height: 15 }} />
                </button>
                {renderSidebar(false)}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main
          className="dashboard-main flex-1 min-w-0 pb-20 md:pb-6"
          style={{ paddingTop: 64, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ padding: '20px var(--pad-section) 24px', minWidth: 0 }}>
            {!isReady && activeSection !== 'explorer' && !isPublicEntityRoute ? (
              <div style={{
                padding: 48,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 120,
              }}>
                <div className="spinner" />
              </div>
            ) : !isConnected && activeSection !== 'explorer' && !isPublicEntityRoute ? (
              <div style={{
                padding: 24,
                textAlign: 'center',
                backgroundColor: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                borderRadius: 2,
              }}>
                <Wallet style={{ width: 40, height: 40, margin: '0 auto 8px', color: 'var(--gold-text)' }} />
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--ink)' }}>{t.dashboard.connectPrompt.title}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-4)' }}>{t.dashboard.connectPrompt.subtitle}</p>
              </div>
            ) : (
              <>
                <PrivateContentRecoveryBanner />
                {/* Degraded-mode banner — shown when the indexer (api.soft.law)
                    is unreachable. Chain operations remain available; discovery
                    and history may be stale. */}
                <DegradedModeBanner />
                {/* An operator-initiated pause takes priority over a
                    per-user payment warning. */}
                <ContractPausedBanner />

                {/* Payment warning banner */}
                {isConnected && heldLicenses.some(l => l.paymentInterval > 0n && !l.isRevoked && !l.isConcluded) && activeSection !== 'licenses' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 14px',
                      marginBottom: 14,
                      backgroundColor: 'color-mix(in srgb, var(--warn) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--warn) 25%, transparent)',
                      borderRadius: 2,
                      fontSize: 12,
                      color: 'var(--ink-2)',
                    }}
                  >
                    <CreditCard style={{ width: 14, height: 14, color: 'var(--warn)', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{t.heldLicenses.banner}</span>
                    <Link to="/licenses?view=held" className="btn btn-ghost btn-sm" style={{ fontSize: 11, flexShrink: 0 }}>
                      {t.heldLicenses.bannerCta}
                    </Link>
                  </div>
                )}

                <Outlet />
              </>
            )}
          </div>

          {/* Footer */}
          <footer
            className="hidden md:flex items-center gap-3 flex-wrap px-4"
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              height: 32,
              minHeight: 32,
              borderTop: '1px solid var(--line)',
              background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
              backdropFilter: 'blur(8px)',
              marginTop: 'auto',
            }}
          >
            <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--ink-4)', textDecoration: 'none' }}>
              <Droplets style={{ width: 10, height: 10 }} />
              {t.dashboard.sidebar.faucet}
            </a>
            <a href="https://docs.soft.law" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--ink-4)', textDecoration: 'none' }}>
              <BookOpen style={{ width: 10, height: 10 }} />
              {t.dashboard.sidebar.docs}
            </a>
            <ConnectionChip onClick={() => setShowProfile(true)} />

            <div className="flex-1" />

            <div className="flex items-center gap-0.5">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={{ padding: 3, color: 'var(--ink-4)', display: 'flex', alignItems: 'center' }}>
                  <Icon style={{ width: 10, height: 10 }} />
                </a>
              ))}
            </div>
            <span style={{ fontSize: 8, color: 'var(--ink-4)' }}>&copy; {new Date().getFullYear()} Softlaw S.A. de C.V.</span>
            <div className="hidden md:flex items-center gap-2">
              <Link to="/privacy" style={{ fontSize: 8, color: 'var(--ink-4)', textDecoration: 'none' }}>{t.dashboard.sidebar.privacyPolicy}</Link>
              <Link to="/terms" style={{ fontSize: 8, color: 'var(--ink-4)', textDecoration: 'none' }}>{t.dashboard.sidebar.termsConditions}</Link>
            </div>
          </footer>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
          style={{ backgroundColor: 'var(--bg-elev)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {sections.map((section) => (
            <Link
              key={section.id}
              to={SECTION_ROUTES[section.id]}
              onClick={() => setSidebarOpen(false)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 10,
                fontWeight: 500,
                color: activeSection === section.id ? 'var(--gold-text)' : 'var(--ink-4)',
                transition: 'color 0.12s',
                textDecoration: 'none',
              }}
            >
              <section.icon style={{ width: 20, height: 20 }} />
              <span>{section.label.split(' ')[0]}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--ink-4)',
            }}
          >
            <User style={{ width: 20, height: 20 }} />
            <span>{t.nav.profile}</span>
          </button>
        </nav>

        {showProfile && <ProfileDrawer onClose={() => setShowProfile(false)} />}

        {/* Layout-level modals (header CTAs) */}
        {showRegisterModal && address && (
          <RegisterIPModal
            colors={colors}
            address={address}
            initialMode={showRegisterModal}
            onClose={() => setShowRegisterModal(false)}
            onSuccess={() => {
              refetchAssets()
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
      </div>
    </SearchContext.Provider>
  )
}
