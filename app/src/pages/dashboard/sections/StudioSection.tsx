import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Briefcase, Key, ShoppingCart, Scale, FileText, Eye, Edit3, PieChart, Percent, Unlock, Trash2, Clock, CheckCircle, XCircle, ShieldCheck, ShieldOff, ScrollText, MoreHorizontal, Image, Music, Film, Code, Drama, Send, Inbox, Activity, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import { AssetCard } from '../components/AssetCard'
import { toastError } from '@/hooks/useToast'
import { useTxToast } from '@/hooks/useTxToast'
import {
  useBurnIP,
  useSetRoyaltyRate,
  useUnwrapNFT,
  useSetLicensePenaltyRate,
  useMarkExpired,
  useConcludeLicense,
  useRevokeForMissedPayments,
  useGrantPrivateAccess,
  useRevokePrivateAccess,
  useGrantPrivateAccessIP,
  useRevokePrivateAccessIP,
  useSetPrivateMetadata,
  type UserIPAsset,
  type UserLicense,
} from '@/hooks/useContracts'
import { useInvalidateIndexedQueries, useIndexedReceivedOffers } from '@/hooks/useIndexed'
import { formatEther } from 'viem'
import type { ListingItem } from '@/hooks/useIndexed'
import { BLOCK_EXPLORER_URL, formatPrice, shortenAddress } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { timeAgo } from '@/lib/timeAgo'
import type { UserDispute } from '../types'
import { StatCard } from '../components/StatCard'
import { EmptyState } from '../components/EmptyState'
import { SkeletonCard } from '../components/SkeletonCard'
import { MyOffersPanel } from '../components/MyOffersPanel'
import { ReceivedOffersPanel } from '../components/ReceivedOffersPanel'
import { PivotTab } from '@/components/PivotTab'
import { LicenseContractModal } from '../components/LicenseContractModal'
import { ContextMenu } from '../components/ContextMenu'
import { PrivateAccessEditor } from '../components/PrivateAccessEditor'
import { SectionHead } from '../components/SectionHead'
import { useNow } from '@/hooks/useNow'
import { isOfferAcceptable } from '@/lib/marketplace-state'

const IP_SUB_CAT_ICONS: Record<string, typeof FileText | null> = {
  all: null,
  literary: FileText,
  artistic: Image,
  musical: Music,
  audiovisual: Film,
  software: Code,
  dramatic: Drama,
}

type IPSubCategory = 'all' | 'literary' | 'artistic' | 'musical' | 'audiovisual' | 'software' | 'dramatic'

interface MenuItem {
  icon: LucideIcon
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  copyright: 'literary', artwork: 'artistic', music: 'musical', video: 'audiovisual',
}

function resolveCategory(raw: string): string {
  return LEGACY_CATEGORY_MAP[raw] || raw
}

export function StudioSection({ colors, assets, pendingAssets, licenses, heldLicenses, allListings, disputes, offers, isLoadingOffers, isLoading, onCreateLicense, onCreateListing, onConfigureRevenue, onUpdateMetadata, onGenerateCertificate, refetch, searchTerm, revenueBalance }: { colors: ThemeColors; assets: UserIPAsset[]; pendingAssets: UserIPAsset[]; licenses: UserLicense[]; heldLicenses: UserLicense[]; allListings: ListingItem[]; disputes: UserDispute[]; offers: Array<{ offerId: `0x${string}`; buyer: `0x${string}`; nftContract: `0x${string}`; tokenId: bigint; price: bigint; isActive: boolean; expiryTime: bigint }>; isLoadingOffers: boolean; isLoading: boolean; onCreateLicense: (ipAssetId?: string) => void; onCreateListing: (ipAssetId?: string) => void; onConfigureRevenue: (asset: UserIPAsset) => void; onUpdateMetadata: (asset: UserIPAsset) => void; onGenerateCertificate: (asset: UserIPAsset) => void; refetch: () => void; searchTerm?: string; revenueBalance?: bigint }) {
  const nowMs = useNow()
  const { t } = useTranslations()
  const { address: walletAddress } = useAuth()
  const txToast = useTxToast()
  const navigateTo = useNavigate()
  const ipSubCategories = [
    { id: 'all' as const, label: t.marketplace.filters.all },
    { id: 'literary' as const, label: t.registry.categories.literary, icon: IP_SUB_CAT_ICONS.literary },
    { id: 'artistic' as const, label: t.registry.categories.artistic, icon: IP_SUB_CAT_ICONS.artistic },
    { id: 'musical' as const, label: t.registry.categories.musical, icon: IP_SUB_CAT_ICONS.musical },
    { id: 'audiovisual' as const, label: t.registry.categories.audiovisual, icon: IP_SUB_CAT_ICONS.audiovisual },
    { id: 'software' as const, label: t.registry.categories.software, icon: IP_SUB_CAT_ICONS.software },
    { id: 'dramatic' as const, label: t.registry.categories.dramatic, icon: IP_SUB_CAT_ICONS.dramatic },
  ]
  const [subCategory, setSubCategory] = useState<IPSubCategory>('all')
  const [confirmBurn, setConfirmBurn] = useState<string | null>(null)
  const [viewContract, setViewContract] = useState<{ licenseId: string; uri: string } | null>(null)

  // Inline form state — these render as panels below the card action bar
  const [royaltyInput, setRoyaltyInput] = useState<string | null>(null)
  const [penaltyInput, setPenaltyInput] = useState<string | null>(null)
  const [royaltyBps, setRoyaltyBps] = useState('500')
  const [penaltyBps, setPenaltyBps] = useState('1000')
  const [privateAccessInput, setPrivateAccessInput] = useState<string | null>(null)
  const [privateAccessAddress, setPrivateAccessAddress] = useState('')
  const [ipPrivateAccessInput, setIpPrivateAccessInput] = useState<string | null>(null)
  const [ipPrivateAccessAddress, setIpPrivateAccessAddress] = useState('')
  const [privateMetaInput, setPrivateMetaInput] = useState<string | null>(null)
  const [privateMetaURI, setPrivateMetaURI] = useState('')

  // Write hooks with hash/isSuccess for progress toasts
  const { burnIP, hash: burnHash, isPending: isBurning, isSuccess: burnSuccess } = useBurnIP()
  const { setRoyaltyRate, hash: royaltyHash, isPending: isSettingRoyalty, isSuccess: royaltySuccess } = useSetRoyaltyRate()
  const { unwrapNFT, hash: unwrapHash, isPending: _isUnwrapping, isSuccess: unwrapSuccess } = useUnwrapNFT()
  const { setPenaltyRate, hash: penaltyHash, isPending: isSettingPenalty, isSuccess: penaltySuccess } = useSetLicensePenaltyRate()
  const { markExpired, hash: expiredHash, isPending: _isMarkingExpired, isSuccess: expiredSuccess } = useMarkExpired()
  const { concludeLicense, hash: concludeHash, isPending: _isConcluding, isSuccess: concludeSuccess } = useConcludeLicense()
  const { revokeForMissedPayments, hash: missedHash, isPending: _isRevokingMissed, isSuccess: missedSuccess } = useRevokeForMissedPayments()
  const { grantPrivateAccess, hash: grantAccessHash, isPending: isGrantingAccess, isSuccess: grantAccessSuccess } = useGrantPrivateAccess()
  const { revokePrivateAccess, hash: revokeAccessHash, isPending: isRevokingAccess, isSuccess: revokeAccessSuccess } = useRevokePrivateAccess()
  const { grantPrivateAccessIP, hash: grantIPHash, isPending: isGrantingIPAccess, isSuccess: grantIPSuccess } = useGrantPrivateAccessIP()
  const { revokePrivateAccessIP, hash: revokeIPHash, isPending: isRevokingIPAccess, isSuccess: revokeIPSuccess } = useRevokePrivateAccessIP()
  const { setPrivateMetadata, hash: privateMetaHash, isPending: isSettingPrivateMeta, isSuccess: privateMetaSuccess } = useSetPrivateMetadata()
  const invalidateIndexed = useInvalidateIndexedQueries()

  // Offers band: made (preloaded ?buyer= data via props) vs received (?seller=)
  const [searchParams, setSearchParams] = useSearchParams()
  const offersView: 'made' | 'received' = searchParams.get('offers') === 'received' ? 'received' : 'made'
  const setOffersView = (v: 'made' | 'received') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v === 'received') next.set('offers', 'received')
      else next.delete('offers')
      return next
    }, { replace: true })
  }
  const { offers: receivedOffers, isLoading: isLoadingReceived, refetch: refetchReceived } = useIndexedReceivedOffers(walletAddress)


  // ── Burn effects ──
  useEffect(() => { if (burnHash) txToast.onHash(burnHash) }, [burnHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (burnSuccess) { txToast.onConfirmed(t.ipSection.messages.burned); invalidateIndexed(); refetch() } }, [burnSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Royalty effects ──
  useEffect(() => { if (royaltyHash) txToast.onHash(royaltyHash) }, [royaltyHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (royaltySuccess) { txToast.onConfirmed(t.ipSection.messages.royaltyUpdated); invalidateIndexed(); refetch() } }, [royaltySuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unwrap effects ──
  useEffect(() => { if (unwrapHash) txToast.onHash(unwrapHash) }, [unwrapHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (unwrapSuccess) { txToast.onConfirmed(t.ipSection.messages.unwrapped); invalidateIndexed(); refetch() } }, [unwrapSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Penalty rate effects ──
  useEffect(() => { if (penaltyHash) txToast.onHash(penaltyHash) }, [penaltyHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (penaltySuccess) { txToast.onConfirmed(t.ipSection.messages.penaltyRateSet); invalidateIndexed(); refetch() } }, [penaltySuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark expired effects ──
  useEffect(() => { if (expiredHash) txToast.onHash(expiredHash) }, [expiredHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (expiredSuccess) { txToast.onConfirmed(t.ipSection.messages.markedExpired); invalidateIndexed(); refetch() } }, [expiredSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Conclude license effects ──
  useEffect(() => { if (concludeHash) txToast.onHash(concludeHash) }, [concludeHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (concludeSuccess) { txToast.onConfirmed(t.ipSection.messages.licenseConcluded); invalidateIndexed(); refetch() } }, [concludeSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Revoke missed effects ──
  useEffect(() => { if (missedHash) txToast.onHash(missedHash) }, [missedHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (missedSuccess) { txToast.onConfirmed(t.ipSection.messages.revokedMissed); invalidateIndexed(); refetch() } }, [missedSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grant license private access effects ──
  useEffect(() => { if (grantAccessHash) txToast.onHash(grantAccessHash) }, [grantAccessHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (grantAccessSuccess) { txToast.onConfirmed(t.ipSection.messages.accessGranted); invalidateIndexed() } }, [grantAccessSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Revoke license private access effects ──
  useEffect(() => { if (revokeAccessHash) txToast.onHash(revokeAccessHash) }, [revokeAccessHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (revokeAccessSuccess) { txToast.onConfirmed(t.ipSection.messages.accessRevoked); invalidateIndexed() } }, [revokeAccessSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grant IP private access effects ──
  useEffect(() => { if (grantIPHash) txToast.onHash(grantIPHash) }, [grantIPHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (grantIPSuccess) { txToast.onConfirmed(t.ipSection.messages.accessGranted); invalidateIndexed() } }, [grantIPSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Revoke IP private access effects ──
  useEffect(() => { if (revokeIPHash) txToast.onHash(revokeIPHash) }, [revokeIPHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (revokeIPSuccess) { txToast.onConfirmed(t.ipSection.messages.accessRevoked); invalidateIndexed() } }, [revokeIPSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Set private metadata effects ──
  useEffect(() => { if (privateMetaHash) txToast.onHash(privateMetaHash) }, [privateMetaHash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (privateMetaSuccess) { txToast.onConfirmed(t.ipSection.messages.privateMetadataSet); invalidateIndexed() } }, [privateMetaSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} colors={colors} />
      ))}
    </div>
  )

  const licensesByAsset = licenses.reduce((acc, lic) => {
    const key = lic.ipAssetId.toString()
    if (!acc[key]) acc[key] = []
    acc[key].push(lic)
    return acc
  }, {} as Record<string, UserLicense[]>)

  const searchLower = searchTerm?.toLowerCase() ?? ''
  const matchesSearch = (a: UserIPAsset) => !searchLower || a.title.toLowerCase().includes(searchLower)

  const filteredAssets = (subCategory === 'all' ? assets : assets.filter(a => {
    const resolved = resolveCategory(a.category)
    return resolved === subCategory
  })).filter(matchesSearch)
  const filteredPending = pendingAssets.filter(a => {
    if (subCategory !== 'all' && resolveCategory(a.category) !== subCategory) return false
    return matchesSearch(a)
  })
  const indexedIds = new Set(filteredAssets.map(a => a.tokenId.toString()))
  const uniquePending = filteredPending.filter(a => !indexedIds.has(a.tokenId.toString()))
  const mergedAssets = [...uniquePending, ...filteredAssets]
  const pendingTokenIds = new Set(uniquePending.map(p => p.tokenId.toString()))
  const heldLicenseIds = new Set(heldLicenses.map(license => license.licenseId.toString()))

  // Count active listings per asset token ID — the Offerings tally renders a
  // real count, not a listed/unlisted flag (an asset can have several lots).
  const listingCountByAsset = allListings
    .filter(l => l.isERC721 && l.isActive)
    .reduce<Record<string, number>>((acc, l) => {
      const id = l.tokenId.toString()
      acc[id] = (acc[id] ?? 0) + 1
      return acc
    }, {})

  // Helper to close any inline form panels for a specific asset
  const closeAssetForms = (tokenId: string) => {
    if (royaltyInput === tokenId) { setRoyaltyInput(null) }
    if (ipPrivateAccessInput === tokenId) { setIpPrivateAccessInput(null); setIpPrivateAccessAddress('') }
    if (privateMetaInput === tokenId) { setPrivateMetaInput(null); setPrivateMetaURI('') }
    if (confirmBurn === tokenId) { setConfirmBurn(null) }
  }

  // Helper to close any inline form panels for a specific license
  const closeLicenseForms = (licenseId: string) => {
    if (penaltyInput === licenseId) { setPenaltyInput(null) }
    if (privateAccessInput === licenseId) { setPrivateAccessInput(null); setPrivateAccessAddress('') }
  }

  // Determine which inline form is active for an asset
  const getActiveAssetForm = (tokenId: string): string | null => {
    if (royaltyInput === tokenId) return 'royalty'
    if (ipPrivateAccessInput === tokenId) return 'ipAccess'
    if (privateMetaInput === tokenId) return 'privateMeta'
    if (confirmBurn === tokenId) return 'burn'
    return null
  }

  // Determine which inline form is active for a license
  const getActiveLicenseForm = (licenseId: string): string | null => {
    if (penaltyInput === licenseId) return 'penalty'
    if (privateAccessInput === licenseId) return 'licAccess'
    return null
  }

  // Build ContextMenu items for an asset's overflow menu
  const buildAssetMenuItems = (asset: UserIPAsset): MenuItem[] => {
    const tokenId = asset.tokenId.toString()
    const items: MenuItem[] = [
      { label: t.common.viewDetails, icon: Eye, onClick: () => navigateTo(`/assets/${asset.tokenId}?from=studio`) },
      { label: t.ipSection.updateMetadata, icon: Edit3, onClick: () => onUpdateMetadata(asset) },
      { label: t.ipSection.revenueSplit, icon: PieChart, onClick: () => onConfigureRevenue(asset) },
      { label: t.ipSection.setRoyaltyRate, icon: Percent, onClick: () => { closeAssetForms(tokenId); setRoyaltyInput(tokenId) } },
      { label: t.ipSection.assetActions.privateAccess, icon: ShieldCheck, onClick: () => { closeAssetForms(tokenId); setIpPrivateAccessAddress(''); setIpPrivateAccessInput(tokenId) } },
      { label: t.ipSection.assetActions.setPrivateMetadata, icon: FileText, onClick: () => { closeAssetForms(tokenId); setPrivateMetaInput(tokenId) } },
      { label: t.ipSection.unwrapNFT, icon: Unlock, onClick: async () => { txToast.start(t.tx.unwrappingNFT); try { await unwrapNFT(asset.tokenId) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } } },
      { label: t.ipSection.burnIP, icon: Trash2, danger: true, disabled: asset.activeLicenseCount > 0n, onClick: () => { closeAssetForms(tokenId); setConfirmBurn(tokenId) } },
    ]
    return items
  }

  // Build ContextMenu items for a license's overflow menu
  const buildLicenseMenuItems = (lic: UserLicense): MenuItem[] => {
    const licId = lic.licenseId.toString()
    const items: MenuItem[] = [
      { label: t.common.viewDetails, icon: Eye, onClick: () => navigateTo(`/licenses/${lic.licenseId}?from=studio`) },
    ]

    if (lic.publicMetadataURI) {
      items.push({ label: t.ipSection.licenseActions.viewContract, icon: ScrollText, onClick: () => setViewContract({ licenseId: licId, uri: lic.publicMetadataURI }) })
    }

    if (lic.isActive && lic.paymentInterval > 0n) {
      items.push({ label: t.ipSection.licenseActions.setPenaltyRate, icon: Percent, onClick: () => { closeLicenseForms(licId); setTimeout(() => setPenaltyInput(licId), 0) } })
    }

    // LicenseToken grants are holder-managed. The Studio collection is an
    // issuer view, so expose this only when the connected wallet also holds
    // this exact license token; otherwise the transaction would revert.
    if (lic.isActive && heldLicenseIds.has(licId)) {
      items.push({ label: t.ipSection.licenseActions.privateAccess, icon: ShieldCheck, onClick: () => { closeLicenseForms(licId); setPrivateAccessAddress(''); setTimeout(() => setPrivateAccessInput(licId), 0) } })
    }

    if (lic.isActive && lic.paymentInterval > 0n) {
      items.push({ label: t.ipSection.licenseActions.revokeMissedPmts, icon: ShieldOff, danger: true, onClick: async () => { txToast.start(t.tx.revokingMissed); try { await revokeForMissedPayments(lic.licenseId) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } } })
    }

    if (lic.isActive && lic.expiryTime !== 0n && lic.expiryTime < BigInt(Math.floor(nowMs / 1000))) {
      items.push({ label: t.ipSection.licenseActions.markExpired, icon: Clock, onClick: async () => { txToast.start(t.tx.markingExpired); try { await markExpired(lic.licenseId) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } } })
    }

    if (lic.isActive) {
      items.push({ label: t.ipSection.licenseActions.concludeLicense, icon: CheckCircle, onClick: async () => { txToast.start(t.tx.concludingLicense); try { await concludeLicense(lic.licenseId) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } } })
    }

    return items
  }

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null

  // Offers band counts (received list is active-only from the indexer; drop expired client-side)
  const nowS = BigInt(Math.floor(nowMs / 1000))
  const madeOffersCount = offers.filter(o => o.isActive).length
  const receivedOffersCount = receivedOffers.filter(o => isOfferAcceptable(o, nowS)).length

  return (
    <div className="space-y-3">
      {truncatedAddress && (
        <p className="display" style={{ fontSize: 'calc(22px * var(--type-scale))', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          {t.ipSection.welcome}, {truncatedAddress}
        </p>
      )}
      <SectionHead
        colors={colors}
        eyebrow={t.ipSection.eyebrow}
        title={t.ipSection.title}
        sub={t.ipSection.sub}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard colors={colors} label={t.ipSection.stats.recordedWorks} value={assets.length} icon={Briefcase} />
        <StatCard colors={colors} label={t.ipSection.stats.activeInstruments} value={licenses.filter(l => l.isActive).length} icon={Key} />
        <StatCard colors={colors} label={`${t.ipSection.stats.receivables} · PAS`} value={revenueBalance && revenueBalance > 0n ? `${parseFloat(formatEther(revenueBalance)).toFixed(2)}` : '—'} icon={ShoppingCart} accent={!!revenueBalance && revenueBalance > 0n} />
        <StatCard colors={colors} label={t.ipSection.stats.openDockets} value={disputes.filter(d => d.status === 0).length} icon={Scale} accent={disputes.filter(d => d.status === 0).length > 0} />
      </div>

      {/* Sub-category tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {ipSubCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSubCategory(cat.id)}
            className="chip"
            style={subCategory === cat.id ? {
              borderColor: 'var(--gold)',
              color: 'var(--gold-text)',
              background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
            } : undefined}
          >
            {cat.label}
          </button>
        ))}
        <button onClick={refetch} className="btn btn-icon ml-auto shrink-0"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {/* Assets with nested licenses — grid of cards */}
      {mergedAssets.length === 0 ? (
        searchLower ? (
          <EmptyState
            colors={colors}
            icon={Briefcase}
            title={t.common.noSearchMatches.replace('{query}', searchTerm ?? '')}
            subtitle={t.common.noSearchMatchesHint}
          />
        ) : (
          <EmptyState
            colors={colors}
            icon={Briefcase}
            title={t.ipSection.noAssets}
            subtitle={t.ipSection.noAssetsHint}
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {mergedAssets.map((asset, index) => {
            const assetLicenses = licensesByAsset[asset.tokenId.toString()] || []
            const isPending = pendingTokenIds.has(asset.tokenId.toString())
            const tokenId = asset.tokenId.toString()
            const _resolvedCat = resolveCategory(asset.category)
            const listingCount = listingCountByAsset[tokenId] ?? 0
            const activeForm = getActiveAssetForm(tokenId)

            const extensionContent = (
              <>
                {/* Inline form panels — triggered from ContextMenu */}
                {activeForm && (
                  <div className="px-2.5 pb-2">
                    <div className="p-2 space-y-1.5" style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)', borderRadius: 2 }}>
                      {activeForm === 'royalty' && (
                        <div className="flex items-center gap-1">
                          <input type="number" value={royaltyBps} onChange={(e) => setRoyaltyBps(e.target.value)} placeholder="BPS" className="input text-[11px]" style={{ width: 64, padding: '4px 6px' }} />
                          <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>BPS</span>
                          <button onClick={async () => { txToast.start(t.tx.settingRoyalty); try { await setRoyaltyRate(asset.tokenId, BigInt(royaltyBps)) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } setRoyaltyInput(null) }} disabled={isSettingRoyalty} className="px-1.5 py-1 rounded text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--gold) 20%, transparent)', color: 'var(--gold-text)' }}>
                            <CheckCircle className="w-3 h-3" />
                          </button>
                          <button onClick={() => setRoyaltyInput(null)} className="px-1.5 py-1 rounded text-[10px]" style={{ color: 'var(--ink-4)' }}>
                            <XCircle className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {activeForm === 'ipAccess' && (
                        <PrivateAccessEditor
                          scope="asset"
                          compact
                          value={ipPrivateAccessAddress}
                          onChange={setIpPrivateAccessAddress}
                          isGranting={isGrantingIPAccess}
                          isRevoking={isRevokingIPAccess}
                          onClose={() => { setIpPrivateAccessInput(null); setIpPrivateAccessAddress('') }}
                          onGrant={async (account) => {
                            txToast.start(t.tx.grantingAccess)
                            try {
                              await grantPrivateAccessIP(asset.tokenId, account)
                              setIpPrivateAccessInput(null)
                              setIpPrivateAccessAddress('')
                            } catch (err) {
                              txToast.onError(err instanceof Error ? err : new Error(String(err)))
                            }
                          }}
                          onRevoke={async (account) => {
                            txToast.start(t.tx.revokingAccess)
                            try {
                              await revokePrivateAccessIP(asset.tokenId, account)
                              setIpPrivateAccessInput(null)
                              setIpPrivateAccessAddress('')
                            } catch (err) {
                              txToast.onError(err instanceof Error ? err : new Error(String(err)))
                            }
                          }}
                        />
                      )}
                      {activeForm === 'privateMeta' && (
                        <>
                          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--warn)' }}>
                            {t.ipSection.privateFileAccess.metadataWarning}
                          </p>
                          <input type="text" value={privateMetaURI} onChange={(e) => setPrivateMetaURI(e.target.value)} placeholder={t.ipSection.assetActions.metadataURIPlaceholder} className="input text-[11px]" style={{ padding: '4px 6px' }} />
                          <div className="flex gap-1">
                            <button onClick={async () => { if (!privateMetaURI.trim()) return toastError(t.ipSection.messages.failed); txToast.start(t.tx.settingPrivateMetadata); try { await setPrivateMetadata(asset.tokenId, privateMetaURI.trim()) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } setPrivateMetaInput(null); setPrivateMetaURI('') }} disabled={isSettingPrivateMeta} className="flex-1 px-1.5 py-1 rounded text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--gold) 20%, transparent)', color: 'var(--gold-text)' }}>
                              <CheckCircle className="w-3 h-3 inline mr-0.5" />
                              {t.common.save}
                            </button>
                            <button onClick={() => { setPrivateMetaInput(null); setPrivateMetaURI('') }} className="px-1.5 py-1 rounded text-[10px]" style={{ color: 'var(--ink-4)' }}>
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                      {activeForm === 'burn' && (
                        <div className="flex gap-1">
                          <button onClick={async () => { txToast.start(t.tx.burningIP); try { await burnIP(asset.tokenId) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) }; setConfirmBurn(null) }} disabled={isBurning || asset.activeLicenseCount > 0n} className="flex-1 px-2 py-1 rounded text-[11px] font-medium" style={{ background: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--danger)' }}>{t.ipSection.confirm}</button>
                          <button onClick={() => setConfirmBurn(null)} className="px-2 py-1 rounded text-[11px]" style={{ color: 'var(--ink-4)' }}>{t.common.cancel}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* License rows */}
                {assetLicenses.length > 0 && (
                  <div className="px-2.5 pb-2">
                    <div className="overflow-hidden" style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--line)', borderRadius: 2 }}>
                      {assetLicenses.map((lic) => {
                        const licId = lic.licenseId.toString()
                        const activeLicForm = getActiveLicenseForm(licId)
                        return (
                          <div key={licId} className="p-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <ScrollText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gold-text)' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{lic.title || `${t.modals.license} #${licId}`}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>#{licId}</span>
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium font-mono uppercase" style={{ borderRadius: 2, letterSpacing: '0.06em', background: lic.isExclusive ? 'color-mix(in srgb, var(--gold) 25%, transparent)' : 'rgba(156,163,175,0.1)', color: lic.isExclusive ? 'var(--gold-text)' : 'var(--ink-4)' }}>
                                    {lic.isExclusive ? t.ipSection.licenseLabels.exclusive : t.ipSection.licenseLabels.nonExclusive}
                                  </span>
                                  {/* This is the issuer view. `balance` belongs
                                      to an arbitrary joined holder row, not the
                                      connected IP owner, so showing x/y here
                                      falsely implied holder authority. */}
                                  <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
                                    {t.common.supply} {lic.supply.toString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lic.isActive ? 'var(--ok)' : lic.isRevoked ? 'var(--danger)' : lic.isConcluded ? 'var(--ink-3)' : 'var(--ink-4)' }} />
                                <span className="text-[10px]" style={{ color: lic.isActive ? 'var(--ok)' : lic.isRevoked ? 'var(--danger)' : lic.isConcluded ? 'var(--ink-3)' : 'var(--ink-4)' }}>
                                  {lic.isActive ? t.ipSection.licenseLabels.active : lic.isRevoked ? t.ipSection.licenseLabels.revoked : lic.isConcluded ? t.ipSection.licenseLabels.concluded : t.ipSection.licenseLabels.expired}
                                </span>
                              </div>
                              {lic.penaltyRateBps !== undefined && lic.penaltyRateBps > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 font-mono" style={{ borderRadius: 2, background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}>
                                  {(lic.penaltyRateBps / 100).toFixed(1)}% {t.ipSection.penaltyRate}
                                </span>
                              )}
                              {lic.publicMetadataURI && (
                                <button onClick={() => setViewContract({ licenseId: licId, uri: lic.publicMetadataURI })} className="p-1 rounded hover:opacity-80 transition-opacity" style={{ color: 'var(--gold-text)' }} title={t.ipSection.licenseActions.viewContract}>
                                  <ScrollText className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <ContextMenu compact items={buildLicenseMenuItems(lic)} trigger={<MoreHorizontal style={{ width: 14, height: 14, color: 'var(--ink-4)' }} />} />
                            </div>
                            {activeLicForm && (
                              <div className="mt-1.5 p-1.5 rounded" style={{ backgroundColor: 'var(--bg-elev)' }}>
                                {activeLicForm === 'penalty' && (
                                  <div className="flex items-center gap-1">
                                    <input type="number" value={penaltyBps} onChange={(e) => setPenaltyBps(e.target.value)} placeholder="BPS" className="input text-[11px]" style={{ width: 64, padding: '4px 6px' }} />
                                    <span className="text-[10px]" style={{ color: 'var(--ink-4)' }}>BPS</span>
                                    <button onClick={async () => { txToast.start(t.tx.settingPenalty); try { await setPenaltyRate(lic.licenseId, parseInt(penaltyBps)) } catch (err) { txToast.onError(err instanceof Error ? err : new Error(String(err))) } setPenaltyInput(null) }} disabled={isSettingPenalty} className="px-1.5 py-1 rounded text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--gold) 20%, transparent)', color: 'var(--gold-text)' }}>
                                      <CheckCircle className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setPenaltyInput(null)} className="px-1.5 py-1 rounded text-[10px]" style={{ color: 'var(--ink-4)' }}>
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                {activeLicForm === 'licAccess' && (
                                  <PrivateAccessEditor
                                    scope="license"
                                    compact
                                    value={privateAccessAddress}
                                    onChange={setPrivateAccessAddress}
                                    isGranting={isGrantingAccess}
                                    isRevoking={isRevokingAccess}
                                    isInactiveLicense={!lic.isActive}
                                    onClose={() => { setPrivateAccessInput(null); setPrivateAccessAddress('') }}
                                    onGrant={async (account) => {
                                      txToast.start(t.tx.grantingAccess)
                                      try {
                                        await grantPrivateAccess(lic.licenseId, account)
                                        setPrivateAccessInput(null)
                                        setPrivateAccessAddress('')
                                      } catch (err) {
                                        txToast.onError(err instanceof Error ? err : new Error(String(err)))
                                      }
                                    }}
                                    onRevoke={async (account) => {
                                      txToast.start(t.tx.revokingAccess)
                                      try {
                                        await revokePrivateAccess(lic.licenseId, account)
                                        setPrivateAccessInput(null)
                                        setPrivateAccessAddress('')
                                      } catch (err) {
                                        txToast.onError(err instanceof Error ? err : new Error(String(err)))
                                      }
                                    }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )

            return (
              <div
                key={tokenId}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 0.05, 0.6)}s` }}
              >
                <AssetCard
                  asset={{
                    tokenId: asset.tokenId,
                    title: asset.title,
                    category: asset.category,
                    imageUrl: asset.imageUrl,
                    animationUrl: asset.animationUrl,
                    metadataURI: asset.metadataURI,
                    owner: asset.creator ?? '',
                    royaltyRate: asset.royaltyBps,
                    // Severity order: a voided registration outranks an open
                    // dispute, which outranks a stuck wrapped-NFT escrow.
                    status: isPending ? 'indexing'
                      : asset.isInvalidated ? 'invalidated'
                      : asset.hasActiveDispute ? 'disputed'
                      : asset.wrappedNftStuck ? 'stuck'
                      : 'active',
                  }}
                  licenses={assetLicenses.length}
                  listings={listingCount}
                  colors={colors}
                  onClick={() => navigateTo(`/assets/${asset.tokenId}?from=studio`)}
                  onCreateLicense={() => onCreateLicense(tokenId)}
                  onCreateListing={() => onCreateListing(tokenId)}
                  onFileNotice={() => navigateTo(`/judicial?assetId=${tokenId}`)}
                  actionExtras={
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ flex: '1 1 0', minWidth: 96 }}
                        onClick={(e) => { e.stopPropagation(); onGenerateCertificate(asset) }}
                      >
                        <FileText style={{ width: 12, height: 12 }} /> {t.ipSection.assetButtons.certificate}
                      </button>
                      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                        <ContextMenu compact items={buildAssetMenuItems(asset)} trigger={<MoreHorizontal style={{ width: 16, height: 16, color: 'var(--ink-4)' }} />} />
                      </div>
                    </>
                  }
                  extensionContent={extensionContent}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Offers — made (you → other works) vs received (on your works) */}
      <div className="mt-8">
        <div className="flex" style={{ gap: 0, border: '1px solid var(--line)', marginBottom: 12 }}>
          <PivotTab
            active={offersView === 'made'}
            onClick={() => setOffersView('made')}
            label={t.ipSection.offers.madeLabel}
            sub={`${madeOffersCount} ${t.ipSection.offers.madeSub}`}
            icon={Send}
          />
          <PivotTab
            active={offersView === 'received'}
            onClick={() => setOffersView('received')}
            label={t.ipSection.offers.receivedLabel}
            sub={`${receivedOffersCount} ${t.ipSection.offers.receivedSub}`}
            icon={Inbox}
            alert={receivedOffersCount}
            alertLabel={t.ipSection.offers.actionBadge}
          />
        </div>
        {offersView === 'made' ? (
          <MyOffersPanel offers={offers} isLoading={isLoadingOffers} refetch={refetch} defaultOpen />
        ) : (
          <ReceivedOffersPanel offers={receivedOffers} isLoading={isLoadingReceived} refetch={refetchReceived} assets={assets} />
        )}
      </div>

      <MyTransactionsPanel />

      {viewContract && (
        <LicenseContractModal
          colors={colors}
          licenseId={viewContract.licenseId}
          publicMetadataURI={viewContract.uri}
          onClose={() => setViewContract(null)}
        />
      )}

    </div>
  )
}

// ── My Transactions panel ─────────────────────────────────────────────────
//
// Shows the most recent account transactions returned by the indexer.

function MyTransactionsPanel() {
  const { t } = useTranslations()
  const { transactions, isLoadingTx } = usePreloadedData()
  const [expanded, setExpanded] = useState(false)

  if (!isLoadingTx && transactions.length === 0) return null

  const recent = transactions.slice(0, 12)
  const remaining = transactions.length - recent.length

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ border: '1px solid var(--line)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        style={{ backgroundColor: 'var(--bg-elev)' }}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--gold-text)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            {t.ipSection.transactions.title}
          </span>
          <span className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>
            · {transactions.length}
          </span>
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
          : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
        }
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {isLoadingTx ? (
            <p className="text-[10px] mono p-3" style={{ color: 'var(--ink-4)' }}>
              {t.ipSection.transactions.loading}
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--line-2)' }}>
              {recent.map((tx) => {
                const valueEth = (() => {
                  try { return formatPrice(BigInt(tx.value || '0')) } catch { return '0' }
                })()
                const txHref = `${BLOCK_EXPLORER_URL}/tx/${tx.hash}`
                return (
                  <div key={tx.hash} className="flex items-center gap-2 px-3 py-2 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {tx.status ? (
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ok)' }} />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
                    )}
                    <span className="font-medium shrink-0" style={{ color: 'var(--ink)' }}>
                      {tx.method}
                    </span>
                    <span className="mono shrink-0" style={{ color: 'var(--ink-4)' }}>
                      ·#{tx.blockNumber}
                    </span>
                    <span className="shrink-0" style={{ color: 'var(--ink-4)' }}>
                      {timeAgo(tx.timestamp)}
                    </span>
                    <span className="flex-1 min-w-0" />
                    <span className="mono shrink-0" style={{ color: 'var(--ink-2)' }}>
                      {valueEth} PAS
                    </span>
                    <a
                      href={txHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1"
                      style={{ color: 'var(--gold-text)' }}
                      title={tx.hash}
                    >
                      <span className="mono">{shortenAddress(tx.hash)}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )
              })}
            </div>
          )}
          {remaining > 0 && (
            <div className="px-3 py-2 text-[10px] mono" style={{ color: 'var(--ink-4)', borderTop: '1px solid var(--line-2)' }}>
              {t.ipSection.transactions.more.replace('{n}', String(remaining))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
