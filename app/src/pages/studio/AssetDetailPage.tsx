import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Briefcase,
  FileText,
  Image,
  Music,
  Film,
  Code,
  Drama,
  Edit3,
  Award,
  Lock,
  DollarSign,
  Check,
  Printer,
  Key,
  Tag,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatEther } from 'viem'
import { useTheme } from '@/hooks/useTheme'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import {
  useInvalidateIndexedQueries,
  useIPRevenue,
  useIndexedExplorerEvents,
} from '@/hooks/useIndexed'
import type { ListingItem } from '@/hooks/useIndexed'
import { fetchIndexer } from '@/lib/indexer'
import { ipfsToHttp } from '@/lib/ipfs-storage'
import { CONTRACT_ADDRESSES, formatPrice, getTxUrl, explorerUrlForEvent } from '@/lib/contracts'
import { ACTIVE_CHAIN_ID } from '@/lib/wagmi-config'
import { useTranslations } from '@/lib/i18n'
import { canDecryptPrivateContent } from '@/lib/private-content-domain'
import { describeEvent } from '@/lib/humanizeEvent'
import type { UserIPAsset, UserLicense } from '@/hooks/useContracts'
import { useWithdrawRevenue, useGetRevenueBalance } from '@/hooks/useContracts'
import { useTxToast } from '@/hooks/useTxToast'
import { useDirectAsset } from '@/hooks/useDirectReads'
import { ChainDirectBadge } from '@/components/ChainDirectBadge'
import { useResilience } from '@/contexts/resilience-context'
import { useNow } from '@/hooks/useNow'
import { ConfigureRevenueSplitModal } from '@/pages/dashboard/modals/ConfigureRevenueSplitModal'
import { UpdateMetadataModal } from '@/pages/dashboard/modals/UpdateMetadataModal'
import { CertificateModal } from '@/pages/dashboard/modals/CertificateModal'
import { CreateLicenseModal } from '@/pages/dashboard/modals/CreateLicenseModal'
import { CreateListingModal } from '@/pages/dashboard/modals/CreateListingModal'
import { PrivateContentDownload } from '@/pages/dashboard/components/PrivateContentDownload'
import { PrivateContentUpload } from '@/pages/dashboard/components/PrivateContentUpload'
import { IncomingOffersPanel } from '@/pages/dashboard/components/IncomingOffersPanel'
import { StatusSeal } from '@/pages/dashboard/components/StatusSeal'
import { WaxSeal } from '@/components/WaxSeal'
import { WithdrawalHistory } from '@/components/WithdrawalHistory'
import { LegalCite } from '@/components/LegalCite'
import { OnChainProof } from '@/components/OnChainProof'
import {
  DetailActionRail,
  DetailBackLabel,
  DetailEmptyState,
  DetailErrorState,
  DetailLoadingState,
  EntityDetailShell,
} from '@/components/detail/EntityDetail'

const WORK_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  literary: FileText, artistic: Image, musical: Music, audiovisual: Film, software: Code, dramatic: Drama,
  copyright: FileText, artwork: Image, music: Music, video: Film,
}

interface IndexerAssetRow {
  token_id: number
  owner: string
  metadata_uri: string | null
  title: string | null
  description: string | null
  work_type: string | null
  image_url: string | null
  animation_url: string | null
  private_content_cid: string | null
  creator: string | null
  active_license_count: number
  has_active_dispute: number
  royalty_bps: number | null
  is_invalidated: number | null
  wrapped_nft_stuck: number | null
  block_number: number
  tx_hash: string
  licenses?: IndexerLicenseRow[]
}

interface IndexerLicenseRow {
  license_id: number
  ip_asset_id: number
  supply: number | null
  expiry_time: number | null
  terms: string | null
  payment_interval: number | null
  is_exclusive: number
  is_revoked: number
  is_expired: number
  is_concluded: number | null
  penalty_rate_bps: number | null
  public_metadata_uri: string | null
  title: string | null
  balance?: number
}

function mapAssetRow(row: IndexerAssetRow): UserIPAsset {
  return {
    tokenId: BigInt(row.token_id),
    metadataURI: row.metadata_uri ?? '',
    title: row.title || `IP Asset #${row.token_id}`,
    description: row.description ?? undefined,
    category: row.work_type || 'IP Asset',
    creator: row.creator ?? undefined,
    imageUrl: row.image_url ? ipfsToHttp(row.image_url) : undefined,
    animationUrl: row.animation_url ? ipfsToHttp(row.animation_url) : undefined,
    privateContentCid: row.private_content_cid ?? undefined,
    owner: row.owner,
    activeLicenseCount: BigInt(row.active_license_count),
    hasActiveDispute: row.has_active_dispute === 1,
    royaltyBps: row.royalty_bps ?? undefined,
    isInvalidated: row.is_invalidated === 1,
    wrappedNftStuck: row.wrapped_nft_stuck === 1,
    blockNumber: BigInt(row.block_number),
    txHash: row.tx_hash,
  }
}

function mapLicenseRow(row: IndexerLicenseRow): UserLicense {
  const isRevoked = row.is_revoked === 1
  const isExpired = row.is_expired === 1
  const isConcluded = row.is_concluded === 1
  return {
    licenseId: BigInt(row.license_id),
    ipAssetId: BigInt(row.ip_asset_id),
    supply: BigInt(row.supply ?? 0),
    expiryTime: BigInt(row.expiry_time ?? 0),
    terms: row.terms ?? '',
    paymentInterval: BigInt(row.payment_interval ?? 0),
    isExclusive: row.is_exclusive === 1,
    isRevoked,
    isExpired,
    isConcluded,
    isActive: !isRevoked && !isExpired && !isConcluded,
    penaltyRateBps: row.penalty_rate_bps ?? undefined,
    publicMetadataURI: row.public_metadata_uri ?? '',
    title: row.title || `License #${row.license_id}`,
    balance: BigInt(row.balance ?? row.supply ?? 0),
  }
}

// ── Local helpers ─────────────────────────────────────────────────────────

function CertCell({
  k,
  v,
  header,
  leftCol,
  last,
}: {
  k: string
  v?: string
  header?: boolean
  leftCol?: boolean
  last?: boolean
}) {
  return (
    <div
      style={{
        padding: '8px 14px',
        borderRight: leftCol ? '1px solid var(--line)' : 0,
        borderBottom: last ? 0 : '1px dashed var(--line-2)',
        fontFamily: 'var(--font-mono)',
        background: header ? 'var(--bg-elev-2)' : undefined,
      }}
    >
      <div
        className="allcaps"
        style={{
          fontSize: 9.5,
          color: header ? 'var(--gold-text)' : 'var(--ink-4)',
          letterSpacing: '0.12em',
          marginBottom: header ? 0 : 2,
        }}
      >
        {k}
      </div>
      {!header && v && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', wordBreak: 'break-all' }}>{v}</div>
      )}
    </div>
  )
}

function RevenueSchedule({
  tokenId,
  ownerAddress,
  address,
  withdrawRevenue,
  withdrawPending,
  revenueBalance,
}: {
  tokenId: bigint
  ownerAddress?: string
  address?: string
  withdrawRevenue: () => void
  withdrawPending: boolean
  revenueBalance?: bigint
}) {
  const { t } = useTranslations()
  const { totalRevenue, royaltyBps, payments, isLoading } = useIPRevenue(Number(tokenId))
  const nowMs = useNow()

  const sparkData = useMemo(() => {
    const now = nowMs / 1000
    const buckets = Array(6).fill(0)
    for (const p of payments) {
      const tsRaw = p.blockTimestamp ? parseInt(p.blockTimestamp, 10) : 0
      const ageSec = now - tsRaw
      const monthIdx = Math.min(5, Math.max(0, Math.floor(ageSec / (30 * 86400))))
      buckets[5 - monthIdx] += parseFloat(p.amount || '0')
    }
    return buckets
  }, [payments, nowMs])

  const maxVal = Math.max(...sparkData, 1)
  const W = 400
  const H = 80
  const pts = sparkData
    .map((v, i) => `${(i / (sparkData.length - 1)) * W},${H - (v / maxVal) * (H - 4)}`)
    .join(' ')
  const areaPath = `M0,${H} L${pts.split(' ').join(' L')} L${W},${H} Z`

  const isOwner = !!address && address.toLowerCase() === ownerAddress?.toLowerCase()

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="allcaps mono" style={{ color: 'var(--ink-3)', marginBottom: 12 }}>
        {t.assetDetail.revenue.title}
      </div>
      {isLoading ? (
        <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="animate-spin w-5 h-5 rounded-full border-2 border-current border-t-transparent"
            style={{ color: 'var(--gold-text)' }}
          />
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div className="allcaps mono" style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                {t.assetDetail.revenue.lifetimeReceivables}
              </div>
              <div
                className="display tnum"
                style={{ fontSize: 'calc(36px * var(--type-scale, 1))', color: 'var(--gold-text)' }}
              >
                {(() => { try { return Number(formatEther(BigInt(totalRevenue || '0'))).toFixed(2) } catch { return '0.00' } })()} PAS
              </div>
            </div>
            <div>
              <div className="allcaps mono" style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                {t.assetDetail.revenue.royaltyRate}
              </div>
              <div className="display tnum" style={{ fontSize: 'calc(36px * var(--type-scale, 1))' }}>
                {royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            {isOwner && (
              <div>
                <div className="allcaps mono" style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                  {t.assetDetail.revenue.availableToDraw}
                </div>
                <div
                  className="display tnum"
                  style={{
                    fontSize: 'calc(36px * var(--type-scale, 1))',
                    color: revenueBalance !== undefined && revenueBalance > 0n ? 'var(--ok)' : 'var(--ink-4)',
                  }}
                >
                  {revenueBalance === undefined
                    ? '—'
                    : revenueBalance === 0n
                      ? '0.0000 PAS'
                      : `${parseFloat(formatEther(revenueBalance)).toFixed(4)} PAS`}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              height: H + 24,
              position: 'relative',
              marginTop: 8,
              borderTop: '1px solid var(--line)',
              paddingTop: 12,
            }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              style={{ width: '100%', height: H }}
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#revGrad)" />
              <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <div
              className="mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: 'var(--ink-3)',
                marginTop: 4,
              }}
            >
              {t.assetDetail.revenue.sparkLabels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>

          {isOwner && revenueBalance !== undefined && revenueBalance > 0n && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={withdrawRevenue}
              disabled={withdrawPending}
            >
              {withdrawPending ? '…' : t.assetDetail.revenue.drawButton}
            </button>
          )}

          {isOwner && (
            <div style={{ marginTop: 16 }}>
              <WithdrawalHistory recipient={address} source="revenue" />
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface PrivateAccessRow {
  grantee: string
  isActive: boolean
  grantor: string | null
  grantedAt: number | null
  grantTx: string | null
  grantBlock: number
  revokedAt: number | null
  revokeTx: string | null
  revokeBlock: number | null
}

function AccessSchedule({ tokenId, ownerAddress }: { tokenId: bigint; ownerAddress: string }) {
  const { t } = useTranslations()
  const { data, isLoading, error } = useQuery({
    queryKey: ['private-access', tokenId.toString(), ownerAddress.toLowerCase()],
    queryFn: () =>
      fetchIndexer<{ data: PrivateAccessRow[] }>(
        `/api/assets/${tokenId.toString()}/private-access?caller=${ownerAddress}`,
      ).then((r) => r.data),
    staleTime: 15_000,
  })

  const rows = data ?? []

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', background: 'var(--bg-elev-2)' }}>
        <div className="allcaps mono" style={{ color: 'var(--ink-3)' }}>
          {t.assetDetail.access.title}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
          {t.assetDetail.access.subtitle}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div
            className="animate-spin w-5 h-5 rounded-full border-2 border-current border-t-transparent mx-auto"
            style={{ color: 'var(--gold-text)' }}
          />
        </div>
      ) : error ? (
        <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>
          {error instanceof Error ? error.message : t.assetDetail.access.error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {t.assetDetail.access.empty}
        </div>
      ) : (
        rows.map((row, i) => {
          const ts = row.isActive ? row.grantedAt : row.revokedAt
          const tx = row.isActive ? row.grantTx : row.revokeTx
          const block = row.isActive ? row.grantBlock : row.revokeBlock
          return (
            <div
              key={row.grantee + i}
              style={{
                padding: '12px 18px',
                borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--line-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                  {row.grantee}
                </div>
                <div className="flex items-center gap-2 mono mt-0.5" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                  {block !== null && <span className="tnum">#{block}</span>}
                  {ts && (
                    <>
                      <span>·</span>
                      <span>{new Date(ts * 1000).toLocaleString()}</span>
                    </>
                  )}
                  {tx && (
                    <>
                      <span>·</span>
                      <a
                        href={explorerUrlForEvent(tx, block ?? 0)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--gold-text)' }}
                      >
                        {t.common.viewOnExplorer}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: row.isActive
                    ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
                    : 'color-mix(in srgb, var(--ink-3) 12%, transparent)',
                  color: row.isActive ? 'var(--ok)' : 'var(--ink-3)',
                }}
              >
                {row.isActive ? t.assetDetail.access.statusActive : t.assetDetail.access.statusRevoked}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

function ProvenanceSchedule({ tokenId, asset }: { tokenId: bigint; asset: UserIPAsset }) {
  const { t } = useTranslations()
  const { events, isLoading } = useIndexedExplorerEvents('all', 200)

  const assetEvents = useMemo(() => {
    return events
      .filter((e) => {
        const args = e.args
        const tokenIdArg = args.tokenId
        const ipAssetIdArg = args.ipAssetId
        const idArg = args.id
        try {
          if (tokenIdArg !== undefined && BigInt(String(tokenIdArg)) === tokenId) return true
          if (ipAssetIdArg !== undefined && BigInt(String(ipAssetIdArg)) === tokenId) return true
          if (idArg !== undefined && BigInt(String(idArg)) === tokenId) return true
        } catch {
          return false
        }
        return false
      })
      .sort((a, b) => Number(b.blockNumber - a.blockNumber))
  }, [events, tokenId])

  // OnChainProof anchor: prefer indexer-supplied asset.blockNumber / txHash,
  // fall back to the IPMinted event from the provenance stream.
  const mintEvent = useMemo(
    () => assetEvents.find((e) => e.eventName === 'IPMinted'),
    [assetEvents],
  )
  const proofBlock = asset.blockNumber ?? mintEvent?.blockNumber
  const proofTx = asset.txHash ?? mintEvent?.transactionHash
  const proofTimestamp = mintEvent?.blockTimestamp

  const humanizeEvent = (e: { eventName: string; args: Record<string, unknown> }) =>
    describeEvent(e, t.assetDetail.provenance.events)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-elev-2)',
        }}
      >
        <div className="allcaps mono" style={{ color: 'var(--ink-3)' }}>
          {t.assetDetail.provenance.title}
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
          {t.assetDetail.provenance.subtitle}
        </div>
      </div>
      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div
            className="animate-spin w-5 h-5 rounded-full border-2 border-current border-t-transparent mx-auto"
            style={{ color: 'var(--gold-text)' }}
          />
        </div>
      ) : assetEvents.length === 0 ? (
        <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {t.assetDetail.provenance.noEvents}
        </div>
      ) : (
        assetEvents.map((e, i) => {
          const ts = e.blockTimestamp
            ? new Date(e.blockTimestamp * 1000).toLocaleDateString('en-CA')
            : '—'
          return (
            <div
              key={e.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 16px',
                borderBottom: i < assetEvents.length - 1 ? '1px solid var(--line-2)' : 'none',
                alignItems: 'flex-start',
              }}
            >
              <div
                className="mono"
                style={{ width: 96, color: 'var(--ink-3)', fontSize: 12, flexShrink: 0 }}
              >
                {ts}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{humanizeEvent(e)}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                  witnessed ·{' '}
                  {e.transactionHash
                    ? `${e.transactionHash.slice(0, 10)}…${e.transactionHash.slice(-8)}`
                    : '—'}
                  {' · '}
                  <a
                    href={getTxUrl(e.transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--gold-text)' }}
                  >
                    ↗
                  </a>
                </div>
              </div>
              <div
                className="mono tnum"
                style={{ fontSize: 13, color: 'var(--ink-3)', flexShrink: 0 }}
              >
                {t.explorer.block} {e.blockNumber.toString()}
              </div>
            </div>
          )
        })
      )}
      {proofBlock !== undefined && proofTx && (
        <OnChainProof
          blockNumber={proofBlock}
          txHash={proofTx}
          chainId={ACTIVE_CHAIN_ID}
          timestamp={proofTimestamp}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
  const { tokenId: tokenIdParam } = useParams<{ tokenId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { colors } = useTheme()
  const { t } = useTranslations()
  const nowMs = useNow()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const {
    assets,
    licenses,
    heldLicenses,
    address,
    allListings,
    refetchAssets,
    refreshListings,
  } = usePreloadedData()

  const tokenId = tokenIdParam && /^\d+$/.test(tokenIdParam) ? BigInt(tokenIdParam) : undefined
  const returnContext = searchParams.get('from')
  const backTarget = returnContext === 'licenses'
    ? '/licenses'
    : returnContext === 'explorer'
      ? '/explorer'
      : returnContext === 'judicial'
        ? '/judicial'
        : '/studio'

  useEffect(() => {
    if (tokenId === undefined) return
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canonical = existing ?? document.createElement('link')
    const previousHref = existing?.href
    canonical.rel = 'canonical'
    canonical.href = `${window.location.origin}/assets/${tokenId.toString()}`
    if (!existing) document.head.appendChild(canonical)
    return () => {
      if (!existing) canonical.remove()
      else if (previousHref) existing.href = previousHref
    }
  }, [tokenId])

  const preloadedAsset = useMemo(
    () => (tokenId !== undefined ? assets.find((a) => a.tokenId === tokenId) : undefined),
    [assets, tokenId],
  )

  const preloadedLicenses = useMemo(
    () => (tokenId !== undefined ? licenses.filter((l) => l.ipAssetId === tokenId) : []),
    [licenses, tokenId],
  )

  const {
    data: fetchedData,
    isLoading: isFetching,
    isError: isFetchError,
    refetch: refetchAsset,
  } = useQuery({
    queryKey: ['asset-detail', tokenIdParam],
    queryFn: async () => {
      const res = await fetchIndexer<{ data: IndexerAssetRow }>(`/api/assets/${tokenIdParam}`)
      return res.data
    },
    enabled: !preloadedAsset && tokenId !== undefined,
    staleTime: 30_000,
  })

  const indexedAsset: UserIPAsset | undefined =
    preloadedAsset ?? (fetchedData ? mapAssetRow(fetchedData) : undefined)

  const { indexerHealth } = useResilience()
  const needsDirectRead = isFetchError || indexerHealth !== 'healthy'
  const { asset: directAsset, isLoading: directLoading } = useDirectAsset(tokenId, needsDirectRead)

  const isDirectRead = needsDirectRead && !!directAsset

  const asset: UserIPAsset | undefined = useMemo(
    () => isDirectRead && directAsset ? {
      ...indexedAsset,
      tokenId: directAsset.tokenId,
      owner: directAsset.owner,
      metadataURI: directAsset.metadataURI,
      title: indexedAsset?.title ?? directAsset.title,
      category: indexedAsset?.category ?? 'IP Asset',
      activeLicenseCount: directAsset.activeLicenseCount,
      hasActiveDispute: directAsset.hasActiveDispute,
    } : indexedAsset,
    [isDirectRead, directAsset, indexedAsset],
  )
  const assetLicenses: UserLicense[] = preloadedAsset
    ? preloadedLicenses
    : fetchedData?.licenses?.map(mapLicenseRow) ?? []
  const hasActiveLicenseForAsset = !!asset && heldLicenses.some(
    (license) => license.ipAssetId === asset.tokenId && license.balance > 0n && license.isActive,
  )
  const { data: assetPrivateAccess } = useQuery({
    queryKey: ['asset-private-content-access', tokenId?.toString(), address?.toLowerCase()],
    queryFn: () => fetchIndexer<{ data: Array<{ account: string }> }>(
      `/api/private-access?targetType=ip_asset&targetId=${tokenId!.toString()}&account=${address}`,
    ),
    enabled: tokenId !== undefined && !!address,
    staleTime: 15_000,
  })

  const assetListings: ListingItem[] = useMemo(() => {
    if (!asset) return []
    return allListings.filter((l) => {
      // ERC-1155 license listings tied to this IP
      if (l.ipAssetId !== undefined && l.ipAssetId === asset.tokenId) return true
      // ERC-721 listings where the asset itself is being transferred
      if (
        l.isERC721 &&
        l.nftContract.toLowerCase() === CONTRACT_ADDRESSES.IPAsset.toLowerCase() &&
        l.tokenId === asset.tokenId
      ) {
        return true
      }
      return false
    })
  }, [allListings, asset])

  const [showRevenueSplit, setShowRevenueSplit] = useState(false)
  const [showUpdateMetadata, setShowUpdateMetadata] = useState(false)
  const [showCertificate, setShowCertificate] = useState(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [licenseForAsset, setLicenseForAsset] = useState<string | undefined>()
  const [showListingModal, setShowListingModal] = useState(false)
  const [listingForAsset, setListingForAsset] = useState<string | undefined>()
  const [scheduleTab, setScheduleTab] = useState<
    'certificate' | 'schedule-a' | 'schedule-b' | 'schedule-c' | 'schedule-d' | 'schedule-e'
  >('certificate')

  const {
    withdrawRevenue,
    hash: withdrawHash,
    isPending: withdrawPending,
    isSuccess: withdrawSuccess,
    error: withdrawError,
  } = useWithdrawRevenue()
  const { data: revenueBalance } = useGetRevenueBalance(address)
  const txToast = useTxToast()

  const handleWithdraw = async () => {
    txToast.start(t.tx.withdrawingRevenue)
    try {
      await withdrawRevenue()
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  useEffect(() => {
    if (withdrawHash) txToast.onHash(withdrawHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawHash])

  useEffect(() => {
    if (withdrawError) txToast.onError(withdrawError instanceof Error ? withdrawError : new Error(String(withdrawError)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawError])

  useEffect(() => {
    if (withdrawSuccess) txToast.onConfirmed(t.profile.revenue.withdrawSuccess)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawSuccess])

  if (!tokenIdParam) {
    navigate('/studio', { replace: true })
    return null
  }

  if (isFetching || directLoading) {
    return <DetailLoadingState label={t.assetDetail.loading} />
  }

  if (isFetchError && !asset) {
    return <DetailErrorState
      title={t.assetDetail.unavailable}
      message={t.assetDetail.unavailableHint}
      retry={<button type="button" className="btn btn-primary btn-sm" onClick={() => { void refetchAsset() }}>{t.assetDetail.retry}</button>}
      back={<Link to={backTarget} className="btn btn-ghost btn-sm"><DetailBackLabel>{t.assetDetail.back}</DetailBackLabel></Link>}
    />
  }

  if (!asset) {
    return <DetailEmptyState
      title={t.assetDetail.assetNotFound.replace('{id}', tokenIdParam)}
      message={t.assetDetail.notFoundHint}
      action={<Link to={backTarget} className="btn btn-ghost btn-sm"><DetailBackLabel>{t.assetDetail.back}</DetailBackLabel></Link>}
    />
  }

  const categoryIcon = WORK_TYPE_ICON_MAP[asset.category.toLowerCase()] ?? Briefcase
  const categoryLabel =
    (t.registry.categories as Record<string, string>)[asset.category] ?? asset.category
  const isOwner = !!address && address.toLowerCase() === asset.owner?.toLowerCase()
  const canDecryptAssetContent = canDecryptPrivateContent({
    isOwner,
    hasActiveLicense: hasActiveLicenseForAsset,
    hasExplicitGrant: (assetPrivateAccess?.data.length ?? 0) > 0,
  })

  const year = new Date().getFullYear()
  const folioStr = `SL-${year}-${asset.tokenId.toString().padStart(4, '0')}`

  const ipfsHttp = asset.metadataURI
    ? asset.metadataURI.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${asset.metadataURI.slice(7)}`
      : asset.metadataURI
    : undefined

  const renderMedia = () => {
    const cat = (asset.category || '').toLowerCase()
    const isAudiovisual =
      (cat.includes('audio') && cat.includes('visual')) ||
      cat.includes('video') ||
      cat.includes('film')
    const isMusical = cat === 'musical' || cat.includes('music')
    if (isAudiovisual && asset.animationUrl) {
      return (
        <video
          src={asset.animationUrl}
          poster={asset.imageUrl || undefined}
          controls
          preload="metadata"
          playsInline
          className="w-full h-full object-cover"
        />
      )
    }
    if (isMusical && asset.animationUrl) {
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-3 px-4"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--gold) 6%, transparent), var(--bg-elev-2))',
          }}
        >
          <Music className="w-14 h-14" style={{ color: 'var(--gold-text)' }} />
          <audio src={asset.animationUrl} controls className="w-full" />
        </div>
      )
    }
    if (asset.imageUrl) {
      return <img src={asset.imageUrl} alt={asset.title} className="w-full h-full object-cover" />
    }
    const CatIcon = categoryIcon
    return <CatIcon className="w-14 h-14" style={{ color: 'var(--ink-4)' }} />
  }

  const detailTabs = [
    { id: 'certificate', label: t.assetDetail.tabs.certificate },
    { id: 'schedule-a', label: t.assetDetail.tabs.scheduleA, count: assetLicenses.length },
    { id: 'schedule-b', label: t.assetDetail.tabs.scheduleB, count: assetListings.length },
    { id: 'schedule-c', label: t.assetDetail.tabs.scheduleC },
    { id: 'schedule-d', label: t.assetDetail.tabs.scheduleD },
    ...(isOwner ? [{ id: 'schedule-e', label: t.assetDetail.tabs.scheduleE }] : []),
  ]

  return (
    <EntityDetailShell
      className="animate-fade-in-up"
      breadcrumbs={<Link to={backTarget}><DetailBackLabel>{t.assetDetail.back}</DetailBackLabel></Link>}
      header={<>
      {/* The certificate remains the authoritative legal-document header. */}
      <div
        className="card"
        data-type={asset.category.toLowerCase()}
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      >
        <div className="type-rail" />

        {/* Folio utility bar */}
        <div
          style={{
            borderBottom: '1px solid var(--line)',
            padding: '10px 18px',
            background: 'var(--bg-elev-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="mono allcaps"
            style={{ fontSize: 10, color: 'var(--gold-text)', letterSpacing: '0.14em' }}
          >
            {t.assetDetail.folioNo} {folioStr}
          </span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
            {t.assetDetail.onChainToken}{' '}
            <span style={{ color: 'var(--ink-2)' }}>
              0x{asset.tokenId.toString(16).padStart(4, '0')} · #{asset.tokenId.toString()}
            </span>
          </span>
          <div style={{ flex: 1 }} />
          <StatusSeal
            status={
              asset.isInvalidated ? 'invalidated'
              : asset.hasActiveDispute ? 'disputed'
              : asset.wrappedNftStuck ? 'stuck'
              : 'active'
            }
            context="asset"
          />
          {isDirectRead && <ChainDirectBadge />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              <Printer className="w-3 h-3 mr-1" /> {t.assetDetail.printCertificate}
            </button>
            {asset.txHash && (
              <a
                className="btn btn-ghost btn-sm"
                href={getTxUrl(asset.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                {t.assetDetail.verify}
              </a>
            )}
          </div>
        </div>

        {/* Centered certificate body */}
        <div style={{ padding: '32px 40px 28px', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--gold-text)',
                }}
              >
                SOFT
              </span>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  background: 'var(--gold)',
                  transform: 'rotate(45deg)',
                  margin: '0 4px',
                }}
              />
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: 'var(--gold-text)',
                }}
              >
                LAW
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  border: '1.5px solid var(--gold)',
                  transform: 'rotate(45deg)',
                }}
              />
              <div style={{ textAlign: 'right' }}>
                <div
                  className="mono allcaps"
                  style={{
                    fontSize: 9.5,
                    color: 'var(--gold-text)',
                    letterSpacing: '0.14em',
                    fontWeight: 700,
                  }}
                >
                  Polkadot Asset Hub
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 1 }}
                >
                  PVM · Chain ID {ACTIVE_CHAIN_ID}
                </div>
              </div>
            </div>
          </div>

          <div
            className="allcaps mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              color: 'var(--ink-3)',
              marginBottom: 6,
            }}
          >
            {t.assetDetail.officialDocument}
          </div>
          <div
            className="display"
            style={{
              fontSize: 'calc(36px * var(--type-scale, 1))',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              color: 'var(--ink)',
              marginBottom: 4,
            }}
          >
            {t.assetDetail.intellectualProperty}
          </div>
          <div
            className="allcaps mono"
            style={{ color: 'var(--ink-3)', letterSpacing: '0.32em', marginBottom: 18 }}
          >
            {t.assetDetail.protectionCertificate}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div
              className="mono"
              style={{
                display: 'inline-flex',
                gap: 12,
                padding: '5px 14px',
                border: '1px solid var(--gold)',
                background: 'color-mix(in srgb, var(--gold) 6%, transparent)',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--gold-text)',
              }}
            >
              <span>ID: {folioStr}</span>
              <span style={{ color: 'var(--ink-3)' }}>·</span>
              <span style={{ color: 'var(--ink-3)' }}>
                {t.assetDetail.derivedFrom} #{asset.tokenId.toString()}
              </span>
            </div>
          </div>

          <p
            style={{
              maxWidth: 640,
              margin: '0 auto 20px',
              fontStyle: 'italic',
              color: 'var(--ink-2)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {t.assetDetail.certifyText}
          </p>

          <div
            style={{
              width: 260,
              margin: '0 auto 20px',
              aspectRatio: '1',
              overflow: 'hidden',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-elev-2)',
            }}
          >
            {renderMedia()}
          </div>

          <div
            className="display"
            style={{
              fontSize: 'calc(28px * var(--type-scale, 1))',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: '0 0 10px',
              textWrap: 'balance',
            }}
          >
            {asset.title}
          </div>
          {asset.creator && (
            <div
              className="mono"
              style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}
            >
              {t.common.by} {asset.creator}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <span
              className="mono allcaps"
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                border: '1px solid var(--gold)',
                color: 'var(--gold-text)',
                fontSize: 11,
                letterSpacing: '0.18em',
                background: 'color-mix(in srgb, var(--gold) 8%, transparent)',
              }}
            >
              {categoryLabel}
            </span>
          </div>

          <div
            style={{
              margin: '16px auto 0',
              width: 60,
              height: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
            <div style={{ width: 4, height: 4, background: 'var(--gold)', margin: '0 8px' }} />
            <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
          </div>
        </div>

        {/* 2-col registration details + on-chain proof grid */}
        <div style={{ padding: '0 40px 18px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: '1px solid var(--line)',
            }}
          >
            <CertCell k={t.assetDetail.registrationDetails} header leftCol />
            <CertCell k={t.assetDetail.onChainProof} header />
            <CertCell k={t.common.tokenId} v={`#${asset.tokenId.toString()}`} leftCol />
            <CertCell
              k={t.explorer.block}
              v={asset.blockNumber ? asset.blockNumber.toString() : '—'}
            />
            <CertCell k={t.assetDetail.ipType} v={categoryLabel} leftCol />
            <CertCell
              k={t.assetDetail.txHash}
              v={asset.txHash ? `${asset.txHash.slice(0, 10)}…${asset.txHash.slice(-8)}` : '—'}
            />
            <CertCell
              k={t.assetDetail.owner}
              v={asset.owner ? `${asset.owner.slice(0, 6)}…${asset.owner.slice(-4)}` : '—'}
              leftCol
            />
            <CertCell
              k="IPFS"
              v={asset.metadataURI ? `${asset.metadataURI.slice(0, 12)}…` : '—'}
            />
            <CertCell
              k={t.assetDetail.registered}
              v={asset.blockNumber ? t.assetDetail.confirmedOnChain : '—'}
              leftCol
              last
            />
            <CertCell k="Chain" v="Polkadot Asset Hub (PVM)" last />
          </div>
        </div>

        {/* Work description */}
        {asset.description && (
          <div style={{ padding: '0 40px 16px' }}>
            <div
              style={{
                border: '1px solid var(--line)',
                borderLeft: '3px solid var(--gold)',
                padding: '10px 14px',
                background: 'var(--bg-elev-2)',
              }}
            >
              <div
                className="mono allcaps"
                style={{
                  fontSize: 10,
                  color: 'var(--gold-text)',
                  letterSpacing: '0.14em',
                  marginBottom: 4,
                }}
              >
                {t.assetDetail.workDescription}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  lineHeight: 1.55,
                  fontStyle: 'italic',
                }}
              >
                {asset.description}
              </div>
            </div>
          </div>
        )}

        {/* Legal basis block */}
        <div style={{ padding: '0 40px 24px' }}>
          <div
            style={{
              border: '1px solid var(--line)',
              borderLeft: '3px solid var(--gold)',
              padding: '12px 14px',
              background: 'var(--bg-elev-2)',
            }}
          >
            <div
              className="mono allcaps"
              style={{
                fontSize: 10,
                color: 'var(--gold-text)',
                letterSpacing: '0.14em',
                marginBottom: 8,
              }}
            >
              {t.assetDetail.legalBasis}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {t.assetDetail.legalBasisIntro}
            </div>
            <ul
              style={{
                margin: '8px 0 0',
                padding: '0 0 0 18px',
                color: 'var(--ink-2)',
                fontSize: 12.5,
                lineHeight: 1.7,
              }}
            >
              <li>{t.assetDetail.berneText}</li>
              <li>{t.assetDetail.wctText}</li>
              <li>{t.assetDetail.tripsText}</li>
            </ul>
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 11,
                fontStyle: 'italic',
                color: 'var(--ink-3)',
                borderTop: '1px dashed var(--line)',
                paddingTop: 8,
              }}
            >
              {t.assetDetail.legalDisclaimer}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 40px',
            borderTop: '1px solid var(--line)',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              className="mono allcaps"
              style={{
                fontSize: 9.5,
                color: 'var(--gold-text)',
                letterSpacing: '0.14em',
                marginBottom: 4,
              }}
            >
              {t.assetDetail.verifyOnChain}
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--gold-text)' }}>
              https://soft.law/verify/{asset.tokenId.toString()}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 6,
                fontSize: 10.5,
                color: 'var(--ink-3)',
              }}
            >
              {asset.txHash && (
                <a
                  href={getTxUrl(asset.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{
                    borderBottom: '1px dotted var(--line)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  {t.assetDetail.blockExplorer}
                </a>
              )}
              {ipfsHttp && (
                <a
                  href={ipfsHttp}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{
                    borderBottom: '1px dotted var(--line)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}
                >
                  {t.assetDetail.ipfsMetadata}
                </a>
              )}
            </div>
          </div>

          <WaxSeal size={72} label="SOFT·LAW" glyph="§" year={year} />

          <div style={{ textAlign: 'right' }}>
            <div
              className="mono allcaps"
              style={{
                fontSize: 9.5,
                color: 'var(--gold-text)',
                letterSpacing: '0.14em',
                marginBottom: 4,
              }}
            >
              {t.assetDetail.issuedBy}
            </div>
            <div className="display" style={{ fontSize: 18, letterSpacing: '-0.01em' }}>
              Soft.Law
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
              Softlaw SA de CV
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
              {t.assetDetail.registryLabel}
            </div>
          </div>
        </div>

        {/* Bottom witness strip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 10,
            padding: '8px 14px',
            background: 'color-mix(in srgb, var(--gold) 6%, var(--bg-elev-2))',
            borderTop: '1px solid var(--gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--gold-text)' }}>+</span>
          <span>{t.assetDetail.witnessRegistered}</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <span>PVM / pallet_revive</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <span>{t.assetDetail.witnessImmutable}</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <span>Softlaw SA de CV</span>
          <span style={{ color: 'var(--gold-text)' }}>+</span>
        </div>

      </div>
      </>}
      tabs={detailTabs}
      activeTab={scheduleTab}
      onTabChange={(tab) => setScheduleTab(tab as typeof scheduleTab)}
      aside={<DetailActionRail title={t.assetDetail.availableActions} primary={isOwner ? (
        <button
          className="btn btn-primary"
          onClick={() => {
            setLicenseForAsset(asset.tokenId.toString())
            setShowLicenseModal(true)
          }}
        ><Key className="w-3.5 h-3.5" />{t.assetDetail.actions.issueLicense}</button>
      ) : undefined}>
        {isOwner && <>
          <button className="btn btn-ghost" onClick={() => { setListingForAsset(asset.tokenId.toString()); setShowListingModal(true) }}>
            <Tag className="w-3.5 h-3.5" />{t.assetDetail.actions.issueOffering}
          </button>
          <button className="btn btn-ghost" onClick={() => setShowUpdateMetadata(true)}>
            <Edit3 className="w-3.5 h-3.5" />{t.assetDetail.actions.updateMetadata}
          </button>
          <button className="btn btn-ghost" onClick={() => setShowRevenueSplit(true)}>
            <DollarSign className="w-3.5 h-3.5" />{t.assetDetail.actions.revenueSplit}
          </button>
        </>}
        {isOwner && revenueBalance !== undefined && revenueBalance > 0n && (
          <button className="btn btn-ghost" onClick={() => handleWithdraw()} disabled={withdrawPending}>
            <DollarSign className="w-3.5 h-3.5" />{withdrawPending ? '…' : t.ipSection.withdraw}
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => setShowCertificate(true)}>
          <Award className="w-3.5 h-3.5" />{t.assetDetail.actions.certificate}
        </button>
        <div id="offers" className="entity-offers-panel">
          <p className="allcaps mono entity-offers-panel__title">{t.incomingOffers.title}</p>
          <IncomingOffersPanel
            nftContract={CONTRACT_ADDRESSES.IPAsset}
            tokenId={asset.tokenId}
            canAccept={isOwner}
          />
        </div>
      </DetailActionRail>}
    >

      {/* Tab content */}
      {scheduleTab === 'certificate' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="allcaps mono" style={{ color: 'var(--ink-3)', marginBottom: 12 }}>
              {t.assetDetail.rights.title}
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              {[
                { label: t.assetDetail.rights.reproduction, note: t.assetDetail.rights.reproductionNote },
                { label: t.assetDetail.rights.publicDisplay, note: t.assetDetail.rights.publicDisplayNote },
                { label: t.assetDetail.rights.derivativeWorks, note: t.assetDetail.rights.derivativeWorksNote },
                { label: t.assetDetail.rights.subLicensing, note: t.assetDetail.rights.subLicensingNote },
                { label: t.assetDetail.rights.moralRights, note: t.assetDetail.rights.moralRightsNote },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    borderBottom: '1px dashed var(--line-2)',
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      background: 'color-mix(in srgb, var(--ok) 15%, transparent)',
                      color: 'var(--ok)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--ok)',
                    }}
                  >
                    <Check className="w-3 h-3" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div className="allcaps mono" style={{ color: 'var(--ink-3)', marginBottom: 12 }}>
              {t.assetDetail.rights.fullLegalBasis}
            </div>
            <LegalCite workType={asset.category} />
          </div>
          {isOwner && !asset.privateContentCid && (
            <div className="card" style={{ padding: 18 }}>
              <PrivateContentUpload
                subject={{ kind: 'asset', id: Number(asset.tokenId) }}
                onDone={() => { invalidateIndexed(); refetchAssets() }}
              />
            </div>
          )}
          {canDecryptAssetContent && asset.privateContentCid && (
            <div className="card" style={{ padding: 18 }}>
              <div
                className="allcaps mono"
                style={{
                  color: 'var(--ink-3)',
                  marginBottom: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <Lock className="w-3 h-3" /> {t.privateContent.downloadTitle}
              </div>
              <PrivateContentDownload
                subject={{ kind: 'asset', id: Number(asset.tokenId) }}
                cid={asset.privateContentCid}
              />
            </div>
          )}
        </div>
      )}

      {scheduleTab === 'schedule-a' && (
        <div>
          {assetLicenses.length === 0 ? (
            <div
              style={{
                padding: '40px 0',
                textAlign: 'center',
                border: '1px dashed var(--line)',
                borderRadius: 4,
              }}
            >
              <Key className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-4)' }} />
              <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t.assetDetail.scheduleA.empty}</p>
              <p style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 4 }}>
                {t.assetDetail.scheduleA.emptyHint}
              </p>
              {isOwner && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setLicenseForAsset(asset.tokenId.toString())
                    setShowLicenseModal(true)
                  }}
                >
                  <Key className="w-3.5 h-3.5 mr-1.5" /> {t.assetDetail.actions.issueLicense}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {assetLicenses.map((lic) => {
                const now = BigInt(Math.floor(nowMs / 1000))
                const daysLeft =
                  lic.expiryTime === 0n ? null : Number(lic.expiryTime - now) / 86400
                const payDays =
                  lic.paymentInterval > 0n ? Number(lic.paymentInterval) / 86400 : null
                return (
                  <div
                    key={lic.licenseId.toString()}
                    className="card"
                    style={{ padding: 0, overflow: 'hidden' }}
                  >
                    <div className="type-rail" />
                    <div
                      style={{
                        padding: '12px 18px',
                        borderBottom: '1px solid var(--line)',
                        background: 'var(--bg-elev-2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: 'var(--gold-text)',
                            letterSpacing: '0.12em',
                          }}
                        >
                          LIC-{year}-{lic.licenseId.toString().padStart(4, '0')}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                          {lic.title || `License #${lic.licenseId.toString()}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {lic.isExclusive && (
                          <span
                            className="chip"
                            style={{
                              background: 'color-mix(in srgb, #8b5cf6 15%, transparent)',
                              color: '#8b5cf6',
                              border: '1px solid color-mix(in srgb, #8b5cf6 40%, transparent)',
                            }}
                          >
                            {t.common.exclusive}
                          </span>
                        )}
                        <span
                          className="chip"
                          style={{
                            background: lic.isActive
                              ? 'color-mix(in srgb, var(--ok) 15%, transparent)'
                              : lic.isRevoked
                              ? 'color-mix(in srgb, var(--danger) 15%, transparent)'
                              : 'var(--bg-elev-2)',
                            color: lic.isActive
                              ? 'var(--ok)'
                              : lic.isRevoked
                              ? 'var(--danger)'
                              : 'var(--ink-4)',
                            border: `1px solid ${
                              lic.isActive
                                ? 'color-mix(in srgb, var(--ok) 40%, transparent)'
                                : lic.isRevoked
                                ? 'color-mix(in srgb, var(--danger) 40%, transparent)'
                                : 'var(--line)'
                            }`,
                          }}
                        >
                          {lic.isActive ? t.assetDetail.scheduleA.inForce : lic.isRevoked ? t.common.revoked : t.assetDetail.scheduleA.concluded}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '14px 18px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          className="allcaps mono"
                          style={{ fontSize: 9.5, color: 'var(--ink-4)', marginBottom: 2 }}
                        >
                          {t.common.supply}
                        </div>
                        <div style={{ fontSize: 13 }}>{lic.supply.toString()} {t.common.tokens}</div>
                      </div>
                      <div>
                        <div
                          className="allcaps mono"
                          style={{ fontSize: 9.5, color: 'var(--ink-4)', marginBottom: 2 }}
                        >
                          {t.common.balance}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {lic.balance.toString()} / {lic.supply.toString()}
                        </div>
                      </div>
                      <div>
                        <div
                          className="allcaps mono"
                          style={{ fontSize: 9.5, color: 'var(--ink-4)', marginBottom: 2 }}
                        >
                          {t.assetDetail.scheduleA.duration}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {lic.expiryTime === 0n
                            ? t.common.perpetual
                            : daysLeft !== null && daysLeft > 0
                            ? t.assetDetail.scheduleA.daysRemaining.replace('{n}', String(Math.floor(daysLeft)))
                            : t.common.expired}
                        </div>
                      </div>
                      <div>
                        <div
                          className="allcaps mono"
                          style={{ fontSize: 9.5, color: 'var(--ink-4)', marginBottom: 2 }}
                        >
                          {t.common.payment}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {lic.paymentInterval === 0n
                            ? t.common.oneTime
                            : payDays !== null
                            ? t.common.everyDays.replace('{n}', String(Math.floor(payDays)))
                            : '—'}
                        </div>
                      </div>
                    </div>
                    {lic.terms && (
                      <div style={{ padding: '0 18px 14px' }}>
                        <div
                          className="allcaps mono"
                          style={{ fontSize: 9.5, color: 'var(--ink-4)', marginBottom: 4 }}
                        >
                          {t.common.terms}
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--ink-2)',
                            lineHeight: 1.55,
                            fontStyle: 'italic',
                            padding: '8px 12px',
                            background: 'var(--bg-elev)',
                            border: '1px solid var(--line-2)',
                          }}
                        >
                          {lic.terms}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {scheduleTab === 'schedule-b' && (
        <div>
          {assetListings.length === 0 ? (
            <div
              style={{
                padding: '40px 0',
                textAlign: 'center',
                border: '1px dashed var(--line)',
                borderRadius: 4,
              }}
            >
              <Tag className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-4)' }} />
              <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t.assetDetail.scheduleB.empty}</p>
              <p style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 4 }}>
                {t.assetDetail.scheduleB.emptyHint}
              </p>
              {isOwner && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setListingForAsset(asset.tokenId.toString())
                    setShowListingModal(true)
                  }}
                >
                  <Tag className="w-3.5 h-3.5 mr-1.5" /> {t.assetDetail.actions.issueOffering}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {assetListings.map((listing) => {
                const kindLabel = listing.isERC721 ? t.assetDetail.scheduleB.ipTransfer : t.assetDetail.scheduleB.licenseSale
                const refNum = listing.tokenId.toString().padStart(4, '0')
                return (
                  <div
                    key={listing.id}
                    className="card"
                    style={{
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: 'var(--gold-text)',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        NTC-{refNum}
                      </div>
                      <div className="display" style={{ fontSize: 18, marginTop: 2 }}>
                        {kindLabel}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="allcaps mono" style={{ fontSize: 9.5, color: 'var(--ink-4)' }}>
                        {t.assetDetail.scheduleB.reserve}
                      </div>
                      <div
                        className="display tnum"
                        style={{ fontSize: 22, color: 'var(--gold-text)' }}
                      >
                        {formatPrice(listing.price)} PAS
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {scheduleTab === 'schedule-c' && (
        <RevenueSchedule
          tokenId={asset.tokenId}
          ownerAddress={asset.owner}
          address={address}
          withdrawRevenue={handleWithdraw}
          withdrawPending={withdrawPending}
          revenueBalance={revenueBalance as bigint | undefined}
        />
      )}

      {scheduleTab === 'schedule-d' && <ProvenanceSchedule tokenId={asset.tokenId} asset={asset} />}

      {scheduleTab === 'schedule-e' && isOwner && asset.owner && (
        <AccessSchedule tokenId={asset.tokenId} ownerAddress={asset.owner} />
      )}

      {/* Modals */}
      {showRevenueSplit && asset && isOwner && (
        <ConfigureRevenueSplitModal
          colors={colors}
          asset={asset}
          onClose={() => setShowRevenueSplit(false)}
          onSuccess={() => {
            refetchAssets()
            invalidateIndexed()
            setShowRevenueSplit(false)
          }}
        />
      )}
      {showUpdateMetadata && asset && address && isOwner && (
        <UpdateMetadataModal
          colors={colors}
          asset={asset}
          address={address}
          onClose={() => setShowUpdateMetadata(false)}
          onSuccess={() => {
            refetchAssets()
            invalidateIndexed()
            setShowUpdateMetadata(false)
          }}
        />
      )}
      {showCertificate && asset && (
        <CertificateModal
          colors={colors}
          asset={asset}
          ownerAddress={asset.owner ?? asset.creator}
          licenses={assetLicenses}
          onClose={() => setShowCertificate(false)}
        />
      )}
      {showLicenseModal && address && isOwner && (
        <CreateLicenseModal
          colors={colors}
          address={address}
          initialIpAssetId={licenseForAsset}
          onClose={() => setShowLicenseModal(false)}
          onSuccess={() => {
            invalidateIndexed()
            setShowLicenseModal(false)
          }}
        />
      )}
      {showListingModal && address && isOwner && (
        <CreateListingModal
          colors={colors}
          address={address}
          initialAssetId={listingForAsset}
          onClose={() => setShowListingModal(false)}
          onSuccess={() => {
            refreshListings()
            invalidateIndexed()
            setShowListingModal(false)
          }}
        />
      )}
    </EntityDetailShell>
  )
}
