import { useAuth } from '@/hooks/useAuth'
import { useTranslations } from '@/lib/i18n'
import { useTheme } from '@/hooks/useTheme'
import { Menu, Search, Plus, ScrollText, Wallet, Settings } from 'lucide-react'
import { IndexerLag } from '@/components/IndexerLag'

interface DashboardHeaderProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onOpenSidebar: () => void
  onRegisterIP: () => void
  onCreateLicense: () => void
  onOpenProfile: () => void
  isConnected: boolean
  login: () => void
}

export function DashboardHeader({
  searchTerm,
  onSearchChange,
  searchInputRef,
  onOpenSidebar,
  onRegisterIP,
  onCreateLicense,
  onOpenProfile,
  isConnected,
  login,
}: DashboardHeaderProps) {
  const { t } = useTranslations()
  const { isLoggedIn: isAuthConnected, isReady } = useAuth()
  const { theme } = useTheme()

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{
        background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
        borderBottom: '1px solid var(--line)',
        height: 64,
      }}
    >
      <div className="h-full px-4 flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden btn-sandwich"
          onClick={onOpenSidebar}
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Brand — desktop only */}
        <div className="hidden md:flex items-center gap-2" style={{ flexShrink: 0 }}>
          {/* Inline gem SVG so bm* CSS animations reach the internal elements */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style={{ width: 24, height: 24 }} aria-hidden="true">
            <defs>
              <radialGradient id="hdr-fieldGlow" cx="0.5" cy="0.5" r="0.55">
                <stop offset="0%" stopColor="#FFD23F" stopOpacity="0.10"/>
                <stop offset="60%" stopColor="#FFD23F" stopOpacity="0.04"/>
                <stop offset="100%" stopColor="#FFD23F" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="hdr-coreGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#FFF4C5" stopOpacity="0.85"/>
                <stop offset="32%" stopColor="#FFD23F" stopOpacity="0.45"/>
                <stop offset="100%" stopColor="#FFD23F" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="hdr-sphere" cx="0.38" cy="0.34" r="0.62">
                <stop offset="0%" stopColor="#FFFCEC"/>
                <stop offset="35%" stopColor="#FFD23F"/>
                <stop offset="80%" stopColor="#B5810F"/>
                <stop offset="100%" stopColor="#5C420C"/>
              </radialGradient>
              <linearGradient id="hdr-cTop" x1="0" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#DCD9CC" stopOpacity="0.62"/>
              </linearGradient>
              <linearGradient id="hdr-cLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B9B6AB" stopOpacity="0.55"/>
                <stop offset="100%" stopColor="#46453F" stopOpacity="0.35"/>
              </linearGradient>
              <linearGradient id="hdr-cRight" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#7E7C70" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="#2A2925" stopOpacity="0.3"/>
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="64" height="64" rx="12" fill="#0A0B0F"/>
            <rect x="0" y="0" width="64" height="64" rx="12" fill="url(#hdr-fieldGlow)"/>
            {/* Lattice lines */}
            <g className="bm-lattice" stroke="#FFD23F" strokeWidth="0.4" opacity="0.18" strokeLinecap="round">
              <line x1="32" y1="6" x2="32" y2="58"/>
              <line x1="9.48" y1="19" x2="54.52" y2="45"/>
              <line x1="9.48" y1="45" x2="54.52" y2="19"/>
            </g>
            {/* Hex outline */}
            <polygon points="32,6 54.52,19 54.52,45 32,58 9.48,45 9.48,19" fill="none" stroke="#FFD23F" strokeWidth="1.15" strokeLinejoin="round" opacity="0.92"/>
            {/* Vertex ping nodes */}
            {([
              [32, 6], [54.52, 19], [54.52, 45],
              [32, 58], [9.48, 45], [9.48, 19],
            ] as [number, number][]).map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="1.7" fill="#FFD23F" className="bm-vertex-halo" style={{ '--i': i } as React.CSSProperties} />
            ))}
            {/* Core aura */}
            <circle cx="32" cy="32" r="13" fill="url(#hdr-coreGlow)" className="bm-core-aura"/>
            {/* Isometric cube */}
            <polygon points="32,22 40.66,27 32,32 23.34,27" fill="url(#hdr-cTop)"/>
            <polygon points="23.34,27 32,32 32,42 23.34,37" fill="url(#hdr-cLeft)"/>
            <polygon points="32,32 40.66,27 40.66,37 32,42" fill="url(#hdr-cRight)"/>
            {/* Edge highlights */}
            <g fill="none" stroke="#FFFFFF" strokeWidth="0.6" strokeLinejoin="round" opacity="0.95">
              <polyline points="23.34,27 32,22 40.66,27"/>
              <line x1="32" y1="22" x2="32" y2="32"/>
            </g>
            <g fill="none" stroke="#0E0E12" strokeWidth="0.45" strokeLinejoin="round" opacity="0.7">
              <polyline points="23.34,27 32,32 40.66,27"/>
              <line x1="32" y1="32" x2="32" y2="42"/>
              <polyline points="23.34,37 32,42 40.66,37"/>
            </g>
            {/* Core sphere */}
            <circle cx="32" cy="32" r="4.6" fill="#FFD23F" opacity="0.2" className="bm-core"/>
            <circle cx="32" cy="32" r="3.4" fill="url(#hdr-sphere)" className="bm-core"/>
            {/* Specular highlight */}
            <ellipse cx="30.7" cy="30.85" rx="1.05" ry="0.78" fill="#FFFFFF" opacity="0.85" className="bm-specular"/>
            <circle cx="30.35" cy="30.55" r="0.35" fill="#FFFFFF"/>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <img
              src={theme === 'dark' ? '/brand/logo_white.png' : '/brand/logo_black.png'}
              alt="Soft.Law"
              style={{ height: 18, width: 'auto' }}
            />
            <span className="mono allcaps" style={{ fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.14em', lineHeight: 1 }}>
              // STUDIO · POLKADOT
            </span>
          </div>
        </div>

        {/* Search — centered, takes available space */}
        <div className="relative flex-1" style={{ maxWidth: 480 }}>
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-4)' }}
          />
          <label htmlFor="global-search" className="sr-only">
            {t.dashboard.header.search ?? 'Search'}
          </label>
          <input
            id="global-search"
            ref={searchInputRef}
            type="search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input w-full text-xs"
            style={{ paddingLeft: 32, paddingRight: 48, height: 34 }}
            placeholder={t.dashboard.header.search ?? 'Search...'}
          />
          <span
            className="mono absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none hidden sm:inline"
            style={{ color: 'var(--ink-4)' }}
          >
            ⌘K
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Indexer lag telemetry (hidden when in sync) */}
        <IndexerLag />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              {/* + IP — desktop only */}
              <button
                className="btn btn-primary btn-sm hidden md:inline-flex"
                onClick={onRegisterIP}
              >
                <Plus className="w-3.5 h-3.5" />
                {t.dashboard.header.ip}
              </button>

              {/* + License — desktop only */}
              <button
                className="btn btn-ghost btn-sm hidden md:inline-flex"
                onClick={onCreateLicense}
              >
                <ScrollText className="w-3.5 h-3.5" />
                {t.dashboard.header.license}
              </button>

              {/* Profile / Settings */}
              <button
                className="btn-icon"
                onClick={onOpenProfile}
                aria-label="Profile & settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          ) : !isReady ? (
            <button
              disabled
              className="btn btn-primary btn-sm opacity-50 cursor-not-allowed"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.connect}</span>
            </button>
          ) : !isAuthConnected ? (
            <button
              onClick={() => login()}
              className="btn btn-primary btn-sm"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{t.nav.connect}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
