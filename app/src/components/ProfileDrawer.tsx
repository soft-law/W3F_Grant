import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { X, Copy, CheckCircle, Award, FileCheck, ShieldCheck, Mail, Zap, Wifi, Globe, RadioTower, LogOut } from 'lucide-react'
import { useLogout } from '@privy-io/react-auth'
import { useAuth } from '@/hooks/useAuth'
import { LanguageToggle } from './LanguageToggle'
import { usePapi, type PapiTransport } from '@/contexts/papi-context'
import { useStripeCheckout, type StripeServiceId } from '@/hooks/useStripeCheckout'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { shortenAddress, formatPrice } from '@/lib/contracts'
import { toastSuccess, toastError } from '@/hooks/useToast'
import { useTranslations } from '@/lib/i18n'
import { ACTIVE_CHAIN_ID } from '@/lib/wagmi-config'
import { useStore, type IptypeMode } from '@/lib/store'
import { RPC_PROVIDERS } from '@/lib/rpcProviders'

const TYPE_MAP: Record<string, string> = {
  literary: 'LIT', artistic: 'ART', musical: 'MUS',
  audiovisual: 'AV', software: 'SW', dramatic: 'DRAM',
}

type Tier = 'single' | 'pack3' | 'subscription'

const TIER_CONFIG: Record<Tier, { price: string; unit: string; serviceId: StripeServiceId }> = {
  single:       { price: '$5',  unit: 'USD',    serviceId: 'blockchain-single' },
  pack3:        { price: '$20', unit: 'USD',    serviceId: 'blockchain-pack3' },
  subscription: { price: '$15', unit: 'USD/mo', serviceId: 'blockchain-subscription' },
}

interface Props {
  onClose: () => void
}

export function ProfileDrawer({ onClose }: Props) {
  const { t } = useTranslations()
  const { address, isLoggedIn } = useAuth()
  const { logout } = useLogout({ onSuccess: () => toastSuccess(t.profileDrawer.logout) })
  const { data: balance } = useBalance({ address, chainId: ACTIVE_CHAIN_ID })
  const { assets, licenses, listings, revenueBalance } = usePreloadedData()
  const activeInstruments = licenses.filter(l => l.isActive).length
  const activeOfferingsCount = listings.filter(l => l.isActive).length

  const [copied, setCopied] = useState(false)
  const [tier, setTier] = useState<Tier>('single')
  const [email, setEmail] = useState('')
  const [showBuy, setShowBuy] = useState(false)
  const { checkout, isLoading, error } = useStripeCheckout()

  const tierLabels: Record<Tier, { label: string; badge?: string; extra?: string }> = {
    single:       { label: t.profileDrawer.registration1 },
    pack3:        { label: t.profileDrawer.registrations5, badge: t.profileDrawer.save17, extra: t.profileDrawer.each },
    subscription: { label: t.profileDrawer.unlimited,      badge: `${t.profileDrawer.proLabel} ✦`, extra: t.profileDrawer.monthly },
  }

  const current = TIER_CONFIG[tier]

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    toastSuccess(t.profileDrawer.addressCopied)
    setTimeout(() => setCopied(false), 2000)
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handlePay = () => {
    if (!emailValid || isLoading) return
    const ref = `SL-BC-${Date.now().toString(36).toUpperCase()}`
    checkout({
      serviceId: current.serviceId,
      customerEmail: email,
      orderRef: ref,
      walletAddress: address ?? '',
    })
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const pas = balance ? parseFloat(formatEther(balance.value)).toFixed(4) : '—'

  return (
    <div className="scrim" onClick={onClose}>
      {/* Drawer */}
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ width: 340 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t.profile.title}</span>
          <button onClick={onClose} className="btn-icon" style={{ width: 28, height: 28 }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Trust Account */}
          {isLoggedIn && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
                <span className="allcaps" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.profileDrawer.trustAccount}</span>
              </div>
              <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--line)' }}>
                {[
                  { label: t.profileDrawer.worksRecorded, value: String(assets.length) },
                  { label: t.profileDrawer.instrumentsIssued, value: String(activeInstruments) },
                  { label: t.profileDrawer.activeOfferings, value: String(activeOfferingsCount) },
                  { label: t.profileDrawer.receivables, value: revenueBalance ? `${formatPrice(revenueBalance)} PAS` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 p-3" style={{ background: 'var(--bg-elev)' }}>
                    <span className="allcaps" style={{ fontSize: 9, color: 'var(--ink-4)' }}>{label}</span>
                    <span className="tnum mono font-bold" style={{ fontSize: 14, color: 'var(--gold-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
              {assets.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)' }}>
                  {assets.slice(0, 3).map(asset => {
                    const year = new Date().getFullYear()
                    const folio = `SL-${year}-${asset.tokenId.toString().padStart(4, '0')}`
                    const kind = TYPE_MAP[asset.category?.toLowerCase()] || 'IP'
                    return (
                      <Link
                        key={asset.tokenId.toString()}
                        to={`/assets/${asset.tokenId}?from=studio`}
                        onClick={onClose}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 12px', textDecoration: 'none',
                          borderBottom: '1px solid var(--line-2)',
                        }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <span className="mono" style={{ fontSize: 10, color: 'var(--gold-text)', fontWeight: 600, flexShrink: 0 }}>{folio}</span>
                        <span className="chip" style={{ fontSize: 9, flexShrink: 0, padding: '1px 5px' }}>{kind}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {asset.title || `#${asset.tokenId}`}
                        </span>
                      </Link>
                    )
                  })}
                  {assets.length > 3 && (
                    <div style={{ padding: '5px 12px', fontSize: 10, color: 'var(--ink-4)', textAlign: 'right' }}>
                      +{assets.length - 3} {t.profileDrawer.moreWorks}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Wallet info */}
          <div className="card" style={{ padding: 16 }}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="allcaps text-[11px]" style={{ color: 'var(--ink-4)' }}>{t.profileDrawer.wallet}</span>
                <span className="chip" style={{ fontSize: 10 }}>
                  {t.nav.testnet}
                </span>
              </div>

              {address ? (
                <>
                  <button
                    onClick={copyAddress}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-sm hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}
                  >
                    <span className="mono text-xs" style={{ color: 'var(--ink)' }}>{shortenAddress(address)}</span>
                    {copied
                      ? <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ok)' }} />
                      : <Copy className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-4)' }} />
                    }
                  </button>

                  {/* Balance */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>{t.profileDrawer.balance}</span>
                    <span className="tnum text-sm font-bold" style={{ color: 'var(--gold-text)' }}>{pas} PAS</span>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: 'var(--ink-4)' }}>{t.profileDrawer.noWallet}</p>
              )}
            </div>
          </div>

          {/* Network toggle */}
          <NetworkToggle />

          {/* Buy Credits */}
          <div className="rounded-sm overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)' }}>
            {/* Card header */}
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 15%, transparent), color-mix(in srgb, var(--gold) 5%, transparent))', borderBottom: '1px solid color-mix(in srgb, var(--gold) 15%, transparent)' }}>
              <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--gold) 12%, transparent)' }}>
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{t.profileDrawer.buyCredits}</p>
                <p className="text-[10px]" style={{ color: 'var(--gold-text)' }}>{t.profileDrawer.buyCreditsSubtitle}</p>
              </div>
            </div>

            <div className="p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elev)' }}>
              {/* What you get */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { icon: Award,       text: t.profileDrawer.pdfCertificate },
                  { icon: FileCheck,   text: t.profileDrawer.ownershipNFT },
                  { icon: ShieldCheck, text: t.profileDrawer.countries181 },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex flex-col items-center gap-1 p-2 rounded-sm text-center" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--line)' }}>
                    <Icon className="w-3 h-3" style={{ color: 'var(--gold-text)' }} />
                    <p className="text-[9px] leading-tight" style={{ color: 'var(--ink-4)' }}>{text}</p>
                  </div>
                ))}
              </div>

              {/* Tier selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TIER_CONFIG) as Tier[]).map((id) => {
                  const cfg = TIER_CONFIG[id]
                  const labels = tierLabels[id]
                  const active = tier === id
                  return (
                    <button
                      key={id}
                      onClick={() => setTier(id)}
                      className="flex flex-col items-center gap-0.5 p-2 rounded-sm transition-all"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                        border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                      }}
                    >
                      {labels.badge && (
                        <span className="text-[8px] px-1 py-0.5 rounded-full font-semibold" style={{ background: active ? 'var(--gold)' : 'var(--bg-elev)', color: active ? 'var(--bg)' : 'var(--ink-4)' }}>
                          {labels.badge}
                        </span>
                      )}
                      <span className="text-[9px] font-medium leading-tight text-center" style={{ color: 'var(--ink)' }}>{labels.label}</span>
                      <span className="tnum text-sm font-bold" style={{ color: active ? 'var(--gold-text)' : 'var(--ink)' }}>{cfg.price}</span>
                      <span className="text-[9px]" style={{ color: 'var(--ink-4)' }}>{cfg.unit}</span>
                      {labels.extra && <span className="text-[8px]" style={{ color: 'var(--ink-4)' }}>{labels.extra}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Pay form */}
              {showBuy ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--ink-4)' }} />
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      placeholder="your@email.com"
                      className="input w-full pl-7 pr-2.5 py-1.5 text-xs"
                    />
                  </div>
                  {error && <p className="text-[10px]" style={{ color: 'var(--danger)' }}>{error}</p>}
                  <button
                    onClick={handlePay}
                    disabled={isLoading || !emailValid}
                    className="btn btn-primary w-full"
                  >
                    {isLoading ? t.profileDrawer.redirecting : `Pay ${current.price} ${current.unit} →`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBuy(true)}
                  className="btn btn-primary w-full"
                >
                  {t.profileDrawer.buy} — {current.price} {current.unit}
                </button>
              )}

              <p className="text-[9px] text-center" style={{ color: 'var(--ink-4)' }}>
                {t.profileDrawer.securePayment}
              </p>
            </div>
          </div>

          {/* Settings */}
          <div className="card" style={{ padding: 16 }}>
            <div className="space-y-3">
              <span className="allcaps text-[11px]" style={{ color: 'var(--ink-4)' }}>{t.profileDrawer.settings ?? 'Settings'}</span>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--ink)' }}>{t.profileDrawer.language ?? 'Language'}</span>
                <LanguageToggle />
              </div>

              {/* Density toggle */}
              <DensityToggle />

              {/* Type-rail mode toggle */}
              <IptypeModeToggle />

              {/* LFPDPPP §4.4 — explicit consent (Mexico). Persists to
                  localStorage and displays the state. No write-blocking
                  is performed here — that decision is owner-gated. */}
              <LfpdpppConsent />

              {isLoggedIn && (
                <button
                  onClick={async () => {
                    try {
                      await logout()
                      } catch (_err) {
                        toastError(t.profileDrawer.logoutFailed)
                      }
                    onClose()
                  }}
                  className="btn btn-ghost btn-sm w-full"
                  style={{ color: 'var(--danger)' }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t.profileDrawer.logout ?? 'Log out'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function DensityToggle() {
  const { t } = useTranslations()
  const { density, setDensity } = useStore()
  type Density = 'dense' | 'balanced' | 'spacious'
  const options: { id: Density; label: string }[] = [
    { id: 'dense',    label: t.profileDrawer.densityDense },
    { id: 'balanced', label: t.profileDrawer.densityBalanced },
    { id: 'spacious', label: t.profileDrawer.densitySpacious },
  ]
  return (
    <div className="space-y-1.5">
      <span className="text-xs" style={{ color: 'var(--ink)' }}>{t.profileDrawer.density}</span>
      <div className="grid grid-cols-3 gap-1">
        {options.map(({ id, label }) => {
          const active = density === id
          return (
            <button
              key={id}
              onClick={() => setDensity(id)}
              className="flex items-center justify-center py-1.5 rounded-sm transition-all text-[10px] font-medium"
              style={{
                background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                color: active ? 'var(--gold-text)' : 'var(--ink-3)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function IptypeModeToggle() {
  const { t } = useTranslations()
  const { iptypeMode, setIptypeMode } = useStore()
  const options: { id: IptypeMode; label: string }[] = [
    { id: 'off',    label: t.profileDrawer.typeRailOff },
    { id: 'subtle', label: t.profileDrawer.typeRailSubtle },
    { id: 'loud',   label: t.profileDrawer.typeRailLoud },
  ]
  return (
    <div className="space-y-1.5">
      <span className="text-xs" style={{ color: 'var(--ink)' }}>{t.profileDrawer.typeRail}</span>
      <div className="grid grid-cols-3 gap-1">
        {options.map(({ id, label }) => {
          const active = iptypeMode === id
          return (
            <button
              key={id}
              onClick={() => setIptypeMode(id)}
              className="flex items-center justify-center py-1.5 rounded-sm transition-all text-[10px] font-medium"
              style={{
                background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                color: active ? 'var(--gold-text)' : 'var(--ink-3)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const DEFAULT_WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) || 'wss://sys.turboflakes.io/asset-hub-paseo'

function truncateMid(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url
  const half = Math.floor((maxLen - 3) / 2)
  return url.slice(0, half) + '…' + url.slice(-half)
}

/** Derive which radio option is currently highlighted from `customRpcUrl`. */
type ProviderSelection = 'default' | 'custom' | string // string = provider url

function resolveSelection(customRpcUrl: string): ProviderSelection {
  if (!customRpcUrl) return 'default'
  const match = RPC_PROVIDERS.find(p => p.url === customRpcUrl)
  return match ? match.url : 'custom'
}

function NetworkToggle() {
  const { t } = useTranslations()
  const { transport, effectiveTransport, setTransport, papiState, customRpcUrl, setCustomRpcUrl, activeWsUrl } = usePapi()

  // draft/touched are only used when "Custom…" is selected
  const [draftInput, setDraftInput] = useState('')
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selection = resolveSelection(customRpcUrl)
  const showCustomInput = selection === 'custom'

  // Until the user edits the field, render the context value directly. This
  // keeps external changes visible without synchronizing props into state.
  const draft = touched ? draftInput : (showCustomInput ? customRpcUrl : '')

  // Focus the input when Custom option is first revealed
  useEffect(() => {
    if (showCustomInput) inputRef.current?.focus()
  }, [showCustomInput])

  const draftInvalid = touched && draft.length > 0 && !draft.startsWith('wss://')

  // Reflect the URL the client is ACTUALLY using, not the nominal default.
  // After auto-rotation, this can differ from `customRpcUrl || DEFAULT_WS_URL`.
  const activeUrl = activeWsUrl || DEFAULT_WS_URL
  const activeHost = activeUrl.replace(/^wss?:\/\//, '').replace(/\/$/, '')

  function applyDraft() {
    if (draft.length > 0 && !draft.startsWith('wss://')) return
    setCustomRpcUrl(draft)
    setTouched(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') applyDraft()
  }

  function selectProvider(url: string) {
    setDraftInput('')
    setTouched(false)
    setCustomRpcUrl(url)
  }

  function selectDefault() {
    setDraftInput('')
    setTouched(false)
    setCustomRpcUrl('')
  }

  function selectCustom() {
    // Switch to custom mode — if there was already a non-provider custom URL keep it;
    // otherwise start blank so user types a new one
    const existing = resolveSelection(customRpcUrl) === 'custom' ? customRpcUrl : ''
    setDraftInput(existing)
    setTouched(existing.length > 0)
    // If we're switching away from a named provider, clear it so input controls the URL
    if (customRpcUrl && resolveSelection(customRpcUrl) !== 'custom') {
      setCustomRpcUrl('')
    }
  }

  const transportOptions: { id: PapiTransport; icon: typeof Wifi; label: string; desc: string }[] = [
    { id: 'auto',    icon: RadioTower, label: t.profileDrawer.autoTransport, desc: t.profileDrawer.autoTransportDesc },
    { id: 'ws',      icon: Wifi,  label: t.profileDrawer.rpcNode,      desc: t.profileDrawer.rpcNodeDesc },
    { id: 'smoldot', icon: Globe, label: t.profileDrawer.lightClient, desc: t.profileDrawer.lightClientDesc },
  ]

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="space-y-2.5">
        <span className="allcaps text-[11px]" style={{ color: 'var(--ink-4)' }}>{t.profileDrawer.network}</span>

        {/* Transport selector: WS RPC Node | Light Client */}
        <div className="grid grid-cols-3 gap-1.5">
          {transportOptions.map(({ id, icon: Icon, label, desc }) => {
            const active = transport === id
            return (
              <button
                key={id}
                onClick={() => setTransport(id)}
                className="flex flex-col items-center gap-1 p-3 rounded-sm transition-all"
                style={{
                  background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                  border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color: active ? 'var(--gold-text)' : 'var(--ink-4)' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
                <span className="text-[9px]" style={{ color: 'var(--ink-4)' }}>{desc}</span>
              </button>
            )
          })}
        </div>

        {transport !== 'smoldot' && (
          <>
            {/* Active endpoint display */}
            <div className="flex items-center gap-1.5 px-0.5">
              <span className="text-[9px] font-medium" style={{ color: 'var(--ok)' }}>
                {effectiveTransport === 'smoldot' ? t.profileDrawer.lightClient : t.profileDrawer.customRpcCurrent}
              </span>
              <span
                className="mono text-[9px] flex-1 truncate"
                style={{ color: 'var(--ink-4)' }}
                title={activeUrl}
              >
                {truncateMid(activeHost)}
              </span>
            </div>

            {/* Provider list */}
            <div className="space-y-1">
              {/* Default option */}
              {(() => {
                const active = selection === 'default'
                return (
                  <button
                    onClick={selectDefault}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm transition-all text-left"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                    }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: active ? 'var(--gold-text)' : 'var(--ink)' }}>
                      {t.profileDrawer.rpcProviderDefault}
                    </span>
                  </button>
                )
              })()}

              {/* Named providers */}
              {RPC_PROVIDERS.map(provider => {
                const active = selection === provider.url
                const hostname = provider.url.replace(/^wss?:\/\//, '').replace(/\/$/, '')
                return (
                  <button
                    key={provider.url}
                    onClick={() => selectProvider(provider.url)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm transition-all text-left"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                    }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: active ? 'var(--gold-text)' : 'var(--ink)' }}>
                      {provider.label}
                    </span>
                    <span className="mono text-[9px] truncate ml-2" style={{ color: 'var(--ink-4)', maxWidth: 150 }}>
                      {hostname}
                    </span>
                  </button>
                )
              })}

              {/* Custom option */}
              {(() => {
                const active = selection === 'custom'
                return (
                  <button
                    onClick={selectCustom}
                    className="w-full flex items-center px-2.5 py-1.5 rounded-sm transition-all text-left"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--gold) 12%, transparent)' : 'var(--bg-elev-2)',
                      border: `1.5px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                    }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: active ? 'var(--gold-text)' : 'var(--ink)' }}>
                      {t.profileDrawer.rpcProviderCustom}
                    </span>
                  </button>
                )
              })()}
            </div>

            {/* Custom input — shown only when "Custom…" is selected */}
            {showCustomInput && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={e => { setDraftInput(e.target.value); setTouched(true) }}
                    onBlur={applyDraft}
                    onKeyDown={handleKeyDown}
                    placeholder={t.profileDrawer.customRpcPlaceholder}
                    className="input flex-1 text-[10px] py-1 px-2 mono"
                    style={{ borderColor: draftInvalid ? 'var(--danger)' : undefined }}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                {draftInvalid && (
                  <p className="text-[9px]" style={{ color: 'var(--danger)' }}>{t.profileDrawer.customRpcInvalid}</p>
                )}
              </div>
            )}
          </>
        )}

        {transport === 'smoldot' && papiState === 'connecting' && (
          <p className="text-[10px] text-center" style={{ color: 'var(--gold-text)' }}>{t.profileDrawer.syncing}</p>
        )}
      </div>
    </div>
  )
}

// LFPDPPP consent state is persisted locally and displayed to the user.
// It does not gate contract writes.
const LFPDPPP_STORAGE_KEY = 'softlaw-lfpdppp-consent-v1'

function LfpdpppConsent() {
  const { t } = useTranslations()
  const [grantedAt, setGrantedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(LFPDPPP_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  })

  function persist(ts: number) {
    try { window.localStorage.setItem(LFPDPPP_STORAGE_KEY, String(ts)) } catch {}
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      const now = Date.now()
      setGrantedAt(now)
      persist(now)
    } else {
      setGrantedAt(null)
      try { window.localStorage.removeItem(LFPDPPP_STORAGE_KEY) } catch {}
    }
  }

  return (
    <div
      className="rounded-sm p-3"
      style={{
        backgroundColor: 'var(--bg-elev)',
        border: `1px solid ${grantedAt ? 'color-mix(in srgb, var(--ok) 25%, transparent)' : 'var(--line)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="allcaps mono text-[10px] font-semibold" style={{ color: 'var(--ink-2)' }}>
          {t.lfpdpppConsent.sectionTitle}
        </p>
        <span
          className="chip mono"
          style={{
            fontSize: 9,
            backgroundColor: grantedAt
              ? 'color-mix(in srgb, var(--ok) 14%, transparent)'
              : 'color-mix(in srgb, var(--warn) 14%, transparent)',
            color: grantedAt ? 'var(--ok)' : 'var(--warn)',
          }}
        >
          {grantedAt ? t.lfpdpppConsent.grantedChip : t.lfpdpppConsent.pendingChip}
        </span>
      </div>
      <p className="text-[10px] leading-relaxed mb-2" style={{ color: 'var(--ink-3)' }}>
        {t.lfpdpppConsent.intro}{' '}
        <Link to="/privacy" onClick={() => { /* drawer will close on route change */ }} style={{ color: 'var(--gold-text)', textDecoration: 'underline' }}>
          {t.lfpdpppConsent.privacyLink}
        </Link>
      </p>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={grantedAt !== null}
          onChange={handleChange}
          className="mt-0.5"
        />
        <span className="text-[10px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {t.lfpdpppConsent.consentLabel}
        </span>
      </label>
      {grantedAt !== null && (
        <p className="mono text-[9px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
          {t.lfpdpppConsent.grantedOnPrefix} {new Date(grantedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      )}
    </div>
  )
}
