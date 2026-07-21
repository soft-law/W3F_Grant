import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tag, User, Calendar, Activity, ShoppingCart, Send, ShieldCheck, ShieldOff, Briefcase, Package, Clock, CreditCard, XCircle, Music, Film, FileText, Code, Drama, ExternalLink, X, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatEther } from 'viem'
import { usePreloadedData } from '@/contexts/data-preloader-context'
import { useBuyListing, useCancelListing, useCreateOffer, useAssetRoyalty, usePlatformFee } from '@/hooks/useContracts'
import { useInvalidateIndexedQueries, useIPRevenue, useIndexedPaymentStatus, type IndexerListingRow, type ListingItem, mapListing } from '@/hooks/useIndexed'
import { useTxToast } from '@/hooks/useTxToast'
import { toastError } from '@/hooks/useToast'
import { useRefreshAfterWrite } from '@/hooks/useRefreshAfterWrite'
import { reviveApiCall } from '@/hooks/useReviveApiCall'
import { usePapi } from '@/contexts/papi-context'
import { fetchIndexer } from '@/lib/indexer'
import { useDirectListing } from '@/hooks/useDirectReads'
import { ChainDirectBadge } from '@/components/ChainDirectBadge'
import { DynamicIcon } from '@/components/DynamicIcon'
import { useResilience } from '@/contexts/resilience-context'
import { useNow } from '@/hooks/useNow'
import { sellerHasListedToken } from '@/lib/marketplace-state'
import { formatPrice, formatTimestamp, shortenAddress, parsePrice, CONTRACT_ADDRESSES, ABIS, BLOCK_EXPLORER_URL } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/Button'
import { IncomingOffersPanel } from '@/pages/dashboard/components/IncomingOffersPanel'
import { PrivateContentDownload } from '@/pages/dashboard/components/PrivateContentDownload'
import {
  DetailActionRail,
  DetailBackLabel,
  DetailEmptyState,
  DetailErrorState,
  DetailLoadingState,
  EntityDetailShell,
  EntityHeader,
} from '@/components/detail'

function mediaKindFor(category?: string): 'image' | 'audio' | 'video' | 'document' {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return 'audio'
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return 'video'
  if (c.includes('literary') || c.includes('dramatic') || c.includes('software') || c.includes('code') || c.includes('script')) return 'document'
  return 'image'
}

function documentIconFor(category?: string): LucideIcon {
  const c = (category || '').toLowerCase()
  if (c.includes('music')) return Music
  if (c.includes('audio') || c.includes('video') || c.includes('film')) return Film
  if (c.includes('software') || c.includes('code')) return Code
  if (c.includes('dramatic') || c.includes('script') || c.includes('drama')) return Drama
  if (c.includes('literary') || c.includes('book') || c.includes('text')) return FileText
  return Tag
}

function MetaRow({ icon, label, value, valueColor }: { icon: LucideIcon; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <DynamicIcon icon={icon} className="w-3.5 h-3.5" style={{ color: 'var(--ink-4)' }} />
        <span className="text-xs" style={{ color: 'var(--ink-4)' }}>{label}</span>
      </div>
      <span className="text-xs font-medium flex-1" style={{ color: valueColor ?? 'var(--ink)' }}>{value}</span>
    </div>
  )
}

export default function ListingDetailPage() {
  const { listingId: listingIdParam } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslations()
  const nowMs = useNow()
  const invalidateIndexed = useInvalidateIndexedQueries()
  const { address, allListings, heldLicenses, refreshListings } = usePreloadedData()

  const listingId = listingIdParam && /^0x[0-9a-fA-F]{64}$/.test(listingIdParam)
    ? listingIdParam.toLowerCase() as `0x${string}`
    : undefined

  useEffect(() => {
    if (!listingId) return
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const canonical = existing ?? document.createElement('link')
    const previousHref = existing?.href
    canonical.rel = 'canonical'
    canonical.href = `${window.location.origin}/explorer/listing/${listingId}`
    if (!existing) document.head.appendChild(canonical)
    return () => {
      if (!existing) canonical.remove()
      else if (previousHref) existing.href = previousHref
    }
  }, [listingId])

  const preloadedListing = useMemo(
    () => listingId ? allListings.find(l => l.listingId.toLowerCase() === listingId) : undefined,
    [allListings, listingId],
  )

  const { data: fetchedRow, isLoading: isFetching, isError: isFetchError, refetch: refetchListing } = useQuery({
    queryKey: ['listing-detail', listingId],
    queryFn: async () => {
      const res = await fetchIndexer<{ data: IndexerListingRow }>(`/api/listings/${listingId}`)
      return res.data
    },
    enabled: !preloadedListing && !!listingId,
    staleTime: 30_000,
  })

  const { indexerHealth } = useResilience()
  const needsDirectRead = isFetchError || indexerHealth !== 'healthy'
  const { listing: directListing, isLoading: directLoading } = useDirectListing(listingId, needsDirectRead)

  const isDirectRead = needsDirectRead && !!directListing
  const indexedListing = preloadedListing ?? (fetchedRow ? mapListing(fetchedRow) : undefined)
  const listing: ListingItem | undefined = useMemo(
    () => isDirectRead && directListing ? {
        ...indexedListing,
        id: indexedListing?.id ?? `listing-${directListing.listingId}`,
        listingId: directListing.listingId as `0x${string}`,
        seller: directListing.seller as `0x${string}`,
        nftContract: directListing.nftContract as `0x${string}`,
        tokenId: directListing.tokenId,
        price: directListing.price,
        title: indexedListing?.title ?? directListing.title,
        category: indexedListing?.category ?? (directListing.isERC721 ? 'IP Asset' : 'License'),
        isERC721: directListing.isERC721,
        createdAt: indexedListing?.createdAt ?? 0,
        isActive: directListing.isActive,
      } : indexedListing,
    [isDirectRead, directListing, indexedListing],
  )
  const isOwn = !!address && !!listing && listing.seller.toLowerCase() === address.toLowerCase()
  const isIP = listing?.isERC721 ?? false
  const holdsListedLicense = !!listing && !isIP && heldLicenses.some(
    (license) => license.licenseId === listing.tokenId && license.balance > 0n && license.isActive,
  )

  // Live royalty for the listed IP or the parent IP of a listed license.
  const { data: resaleRoyaltyBps } = useAssetRoyalty(listing ? (isIP ? listing.tokenId : listing.ipAssetId) : undefined)

  // Revenue belongs to the IP: directly for IP listings and through the parent
  // asset for license listings.
  const revenueIpAssetId = listing
    ? (isIP ? Number(listing.tokenId) : listing.ipAssetId !== undefined ? Number(listing.ipAssetId) : undefined)
    : undefined
  const { totalRevenue, royaltyBps: _revenueRoyaltyBps, payments: revenuePayments, isLoading: isRevenueLoading } = useIPRevenue(revenueIpAssetId)

  // One-time licenses have no recurring payment status.
  const licenseIdForPayment = !isIP && listing ? Number(listing.tokenId) : undefined
  const isRecurringLicense = !isIP && listing && listing.paymentInterval !== undefined && listing.paymentInterval > 0n
  const { data: paymentStatusData } = useIndexedPaymentStatus(isRecurringLicense ? licenseIdForPayment : undefined)

  const { data: platformFeeBps } = usePlatformFee()
  const { buyListing, hash: buyHash, isPending: isBuyPending, isSuccess: isBuySuccess, isError: isBuyError } = useBuyListing()
  const { cancelListing, hash: cancelHash, isPending: isCancelPending, isSuccess: isCancelSuccess, isError: isCancelError } = useCancelListing()
  const { createOffer, hash: offerHash, isPending: isOfferPending, isSuccess: isOfferSuccess, isError: isOfferError } = useCreateOffer()
  const txToast = useTxToast()
  const { api: papiApi } = usePapi()

  type LiveListingState = { isActive: boolean; sellerHasToken: boolean }

  // Check listing activity and token ownership directly before purchase.
  // The indexer supplies discovery data, not purchase authorization.
  async function fetchLiveListingState(target: ListingItem): Promise<LiveListingState | null> {
    if (!papiApi) return null
    const fetchOnce = async () => {
      const l = await reviveApiCall(papiApi, {
        contractAddress: CONTRACT_ADDRESSES.Marketplace,
        abi: ABIS.Marketplace,
        functionName: 'listings',
        args: [target.listingId],
      }) as {
        seller?: string
        nftContract?: string
        tokenId?: bigint
        isActive?: boolean
        isERC721?: boolean
      } | readonly unknown[]
      // listings() is a public mapping-of-struct getter → 6 positional outputs:
      // [0]seller [1]nftContract [2]tokenId [3]price [4]isActive [5]isERC721
      const tuple = Array.isArray(l) ? l : null
      const object = (tuple ? {} : l) as {
        seller?: string
        nftContract?: string
        tokenId?: bigint
        isActive?: boolean
        isERC721?: boolean
      }
      const seller = String(tuple?.[0] ?? object.seller ?? target.seller)
      const nftContract = String(tuple?.[1] ?? object.nftContract ?? target.nftContract) as `0x${string}`
      const tokenId = BigInt((tuple?.[2] as bigint | undefined) ?? object.tokenId ?? target.tokenId)
      const isActive = Boolean(tuple?.[4] ?? object.isActive)
      const isERC721 = Boolean(tuple?.[5] ?? object.isERC721)

      if (!isActive) return { isActive: false, sellerHasToken: false }
      const ownerOrBalance = isERC721
        ? await reviveApiCall(papiApi, {
            contractAddress: nftContract,
            abi: ABIS.IPAsset,
            functionName: 'ownerOf',
            args: [tokenId],
          }) as string
        : await reviveApiCall(papiApi, {
            contractAddress: nftContract,
            abi: ABIS.LicenseToken,
            functionName: 'balanceOf',
            args: [seller, tokenId],
          }) as bigint
      return { isActive, sellerHasToken: sellerHasListedToken(isERC721, seller, ownerOrBalance) }
    }
    try { return await fetchOnce() }
    catch {
      await new Promise(r => setTimeout(r, 2_000))
      try { return await fetchOnce() } catch { return null }
    }
  }

  async function fetchListingIsActive(listingId: `0x${string}`): Promise<boolean | null> {
    if (!papiApi) return null
    const fetchOnce = async () => {
      const value = await reviveApiCall(papiApi, {
        contractAddress: CONTRACT_ADDRESSES.Marketplace,
        abi: ABIS.Marketplace,
        functionName: 'listings',
        args: [listingId],
      }) as { isActive?: boolean } | readonly unknown[]
      return Array.isArray(value)
        ? Boolean(value[4])
        : Boolean((value as { isActive?: boolean }).isActive)
    }
    try { return await fetchOnce() }
    catch {
      await new Promise(resolve => setTimeout(resolve, 2_000))
      try { return await fetchOnce() } catch { return null }
    }
  }

  const {
    data: liveListingState,
    isFetching: isCheckingOwnership,
    isError: isOwnershipCheckError,
  } = useQuery({
    queryKey: ['listing-purchase-state', listing?.listingId],
    queryFn: () => fetchLiveListingState(listing!),
    enabled: !!listing && !!papiApi,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
  })

  const listingInactive = liveListingState?.isActive === false
  const sellerMissingToken = liveListingState
    ? liveListingState.isActive && !liveListingState.sellerHasToken
    : listing?.sellerHasToken === false
  const purchaseValidated = liveListingState?.isActive === true && liveListingState.sellerHasToken
  const purchaseUnavailable = !isOwn && !isCheckingOwnership && (!papiApi || isOwnershipCheckError || liveListingState === null)

  const [showOfferForm, setShowOfferForm] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerDays, setOfferDays] = useState(7)

  useEffect(() => { if (buyHash) txToast.onHash(buyHash) }, [buyHash, txToast])
  useEffect(() => { if (cancelHash) txToast.onHash(cancelHash) }, [cancelHash, txToast])
  useEffect(() => { if (offerHash) txToast.onHash(offerHash) }, [offerHash, txToast])
  useEffect(() => {
    if (isBuySuccess) txToast.onConfirmed('Purchase confirmed')
  }, [isBuySuccess, txToast])
  useEffect(() => {
    if (isBuyError) txToast.onError(new Error('Purchase reverted on-chain'))
  }, [isBuyError, txToast])
  useRefreshAfterWrite(isBuySuccess, {
    refetches: [refreshListings],
    invalidateIndexed,
  })

  useEffect(() => {
    if (isCancelSuccess) {
      txToast.onConfirmed(t.listingDetail.cancelSuccess)
      navigate('/explorer', { replace: true })
    }
  }, [isCancelSuccess, navigate, t.listingDetail.cancelSuccess, txToast])
  useEffect(() => {
    if (isCancelError) txToast.onError(new Error('Cancel reverted on-chain'))
  }, [isCancelError, txToast])
  useRefreshAfterWrite(isCancelSuccess, {
    refetches: [refreshListings],
    invalidateIndexed,
  })
  useEffect(() => {
    if (isOfferSuccess) {
      const timer = window.setTimeout(() => {
        txToast.onConfirmed('Offer submitted')
        setShowOfferForm(false)
        setOfferPrice('')
        invalidateIndexed()
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [isOfferSuccess, invalidateIndexed, txToast])
  useEffect(() => {
    if (isOfferError) txToast.onError(new Error('Offer reverted on-chain'))
  }, [isOfferError, txToast])

  const handleBuy = async () => {
    if (!listing) return
    const liveState = await fetchLiveListingState(listing)
    if (liveState === null) { toastError(t.disputes.connectionTemporarilyDown); return }
    if (!liveState.isActive) { toastError(t.listingDetail.listingNoLongerAvailable); return }
    if (!liveState.sellerHasToken) { toastError(t.listingDetail.staleSellerBody); return }
    txToast.start(t.tx.buyingListing)
    try {
      await buyListing(listing.listingId, listing.price)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const handleCancel = async () => {
    if (!listing) return
    const isActive = await fetchListingIsActive(listing.listingId)
    if (isActive === null) { toastError(t.disputes.connectionTemporarilyDown); return }
    if (!isActive) { toastError(t.listingDetail.listingAlreadyInactive); return }
    txToast.start(t.tx.cancellingListing)
    try {
      await cancelListing(listing.listingId)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const handleMakeOffer = async () => {
    if (!listing || !offerPrice || isOfferPending) return
    const price = parsePrice(offerPrice)
    if (price === 0n) return
    const expiryTime = BigInt(Math.floor(Date.now() / 1000) + offerDays * 86400)
    txToast.start('Submitting offer...')
    try {
      await createOffer(listing.nftContract, listing.tokenId, expiryTime, price)
    } catch (err) {
      txToast.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  // Private content CID resolution (same as modal)
  const { resolvedCid, resolvedFileName } = useMemo(() => {
    if (!listing) return { resolvedCid: undefined, resolvedFileName: undefined }
    if (listing.privateCid) return { resolvedCid: listing.privateCid, resolvedFileName: undefined as string | undefined }
    if (isIP) return { resolvedCid: undefined, resolvedFileName: undefined }
    try {
      const raw = window.localStorage.getItem(`softlaw-private-cid-${listing.tokenId.toString()}`)
      if (!raw) return { resolvedCid: undefined, resolvedFileName: undefined }
      const parsed = JSON.parse(raw) as { cid?: string; fileName?: string }
      return { resolvedCid: parsed.cid, resolvedFileName: parsed.fileName }
    } catch {
      return { resolvedCid: undefined, resolvedFileName: undefined }
    }
  }, [listing, isIP])

  if (isFetching || directLoading) {
    return <DetailLoadingState label={t.listingDetail.loading} />
  }

  if (!listing) {
    const back = <Link to="/explorer" className="btn btn-ghost btn-sm"><DetailBackLabel>{t.listingDetail.back}</DetailBackLabel></Link>
    return isFetchError && !directListing ? (
      <DetailErrorState
        title={t.listingDetail.unavailable}
        message={t.listingDetail.unavailableHint}
        retry={<button type="button" className="btn btn-primary btn-sm" onClick={() => { void refetchListing() }}>{t.listingDetail.retry}</button>}
        back={back}
      />
    ) : (
      <DetailEmptyState
        title={t.listingDetail.notFound.replace('{id}', listingIdParam ?? '')}
        message={t.listingDetail.notFoundHint}
        action={back}
      />
    )
  }

  const mediaKind = mediaKindFor(listing.category)
  const docIcon = documentIconFor(listing.category)

  // IP listings use the asset's revenue; license listings use the parent IP's revenue.
  const lifetimeEth = (() => {
    try { return Number(formatEther(BigInt(totalRevenue || '0'))) } catch { return 0 }
  })()
  const nowSec = Math.floor(nowMs / 1000)
  const yearAgo = nowSec - 365 * 86400
  const last12MoEth = revenuePayments.reduce((sum, p) => {
    if (!p.blockTimestamp) return sum
    // The API returns Unix seconds.
    const ts = Math.floor(new Date(Number(p.blockTimestamp) * 1000).getTime() / 1000)
    if (!ts || ts < yearAgo) return sum
    try { return sum + Number(formatEther(BigInt(p.amount ?? '0'))) } catch { return sum }
    return sum
  }, 0)

  // Localized relative time for recent payment rows.
  const formatRelative = (ts: number): string => {
    const diff = nowSec - ts
    if (diff < 60) return t.listingDetail.revenue.justNow
    const hours = Math.floor(diff / 3600)
    if (hours < 24) return t.listingDetail.revenue.hoursAgo.replace('{n}', String(hours))
    const days = Math.floor(hours / 24)
    if (days < 30) return t.listingDetail.revenue.daysAgo.replace('{n}', String(days))
    const months = Math.floor(days / 30)
    return t.listingDetail.revenue.monthsAgo.replace('{n}', String(months))
  }

  const media = (
    <div className="w-full aspect-square overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--bg-elev-2)' }}>
            {mediaKind === 'video' && listing.animationUrl ? (
              <video src={listing.animationUrl} controls preload="metadata" poster={listing.imageUrl || undefined} className="w-full h-full object-cover">
                <track kind="captions" />
              </video>
            ) : mediaKind === 'audio' && listing.animationUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-3">
                <Music className="w-12 h-12" style={{ color: 'var(--gold-text)' }} />
                <audio src={listing.animationUrl} controls className="w-full" />
              </div>
            ) : mediaKind === 'document' && listing.animationUrl ? (
              <a href={listing.animationUrl} target="_blank" rel="noopener noreferrer" className="w-full h-full flex flex-col items-center justify-center gap-2 hover:opacity-80 transition-opacity">
                <DynamicIcon icon={docIcon} className="w-14 h-14" style={{ color: 'var(--ink-4)' }} />
                <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: 'var(--gold-text)' }}>
                  {t.licenseContract.viewOnIPFS} <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </a>
            ) : listing.imageUrl ? (
              <img src={listing.imageUrl} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <DynamicIcon icon={docIcon} className="w-12 h-12" style={{ color: 'var(--ink-4)' }} />
            )}
    </div>
  )

  const commerceRail = (
    <DetailActionRail title={t.listingDetail.availableActions}>
          <div className="rounded-sm p-3 text-center" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold) 10%, transparent), var(--bg-elev))', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--ink-4)' }}>{t.marketplace.listing.price}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--gold-text)' }}>{formatPrice(listing.price)}</p>
            <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>PAS</p>
            {resaleRoyaltyBps !== undefined && Number(resaleRoyaltyBps) > 0 && (
              <p className="text-[10px] mono mt-1" style={{ color: 'var(--ink-4)' }}>
                {t.marketplace.listing.royaltyOnResale} {Number(resaleRoyaltyBps) / 100}%
              </p>
            )}
          </div>

          {!isOwn && (listingInactive || sellerMissingToken || purchaseUnavailable || (isCheckingOwnership && !liveListingState)) && (
            <div
              role="status"
              className="mt-3 p-3 rounded-sm text-xs"
              style={{
                color: listingInactive || sellerMissingToken ? 'var(--danger)' : 'var(--ink-2)',
                backgroundColor: listingInactive || sellerMissingToken
                  ? 'color-mix(in srgb, var(--danger) 8%, var(--bg-elev))'
                  : 'var(--bg-elev-2)',
                border: `1px solid ${listingInactive || sellerMissingToken ? 'color-mix(in srgb, var(--danger) 35%, var(--line))' : 'var(--line)'}`,
              }}
            >
              <p className="font-semibold mb-1">
                {listingInactive || sellerMissingToken
                  ? t.listingDetail.staleSellerTitle
                  : isCheckingOwnership
                    ? t.listingDetail.verifyingOwnership
                    : t.listingDetail.ownershipUnavailable}
              </p>
              {(listingInactive || sellerMissingToken) && (
                <p style={{ color: 'var(--ink-3)' }}>
                  {listingInactive ? t.listingDetail.listingNoLongerAvailable : t.listingDetail.staleSellerBody}
                </p>
              )}
            </div>
          )}

          {address ? <div className="flex gap-2 mt-3">
            {isOwn ? (
              <Button variant="outline" className="flex-1" onClick={handleCancel} isLoading={isCancelPending}>
                <X className="w-4 h-4 mr-2" /> {t.listingDetail.cancelListing}
              </Button>
            ) : (
              <>
                <Button className="flex-1" onClick={handleBuy} isLoading={isBuyPending || isCheckingOwnership} disabled={!purchaseValidated}>
                  <ShoppingCart className="w-4 h-4 mr-2" /> {t.listingDetail.buyNow}
                </Button>
                <Button variant="outline" onClick={() => setShowOfferForm(s => !s)} isLoading={isOfferPending} disabled={!purchaseValidated}>
                  <Send className="w-4 h-4 mr-2" /> {t.listingDetail.makeOffer}
                </Button>
              </>
            )}
          </div> : <p className="text-xs mt-3" style={{ color: 'var(--ink-3)' }}>{t.listingDetail.connectToAct}</p>}

          {showOfferForm && (
            <div className="mt-2 p-3 rounded-sm" style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.makeOffer}</p>

              {/* Item 4: label + PAS suffix */}
              <label htmlFor="offer-price-input" className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ink-3)' }}>
                {t.listingDetail.offerAmount}
              </label>
              <div className="flex gap-2 mb-2">
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="offer-price-input"
                    type="number"
                    placeholder="0.00"
                    value={offerPrice}
                    onChange={e => setOfferPrice(e.target.value)}
                    className="input w-full text-xs"
                    style={{ paddingRight: 48 }}
                    min="0"
                    step="0.0001"
                  />
                  <span className="mono" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold-text)', fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}>PAS</span>
                </div>

                {/* Item 3: duration chips */}
                <div role="group" aria-label="Offer expiry" className="flex gap-1">
                  {([3, 7, 14, 30] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setOfferDays(d)}
                      className="mono text-[10px] px-1.5 py-1 rounded-sm"
                      style={{
                        background: offerDays === d ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'transparent',
                        border: `1px solid ${offerDays === d ? 'var(--gold)' : 'var(--line)'}`,
                        color: offerDays === d ? 'var(--gold-text)' : 'var(--ink-3)',
                      }}
                    >{d}d</button>
                  ))}
                </div>
              </div>

              {/* Item 5: seller-receives hint */}
              {platformFeeBps !== undefined && parsePrice(offerPrice) > 0n && (() => {
                const p = parseFloat(offerPrice)
                const feeBps = Number(platformFeeBps)
                const net = p * (10000 - feeBps) / 10000
                const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 })
                return (
                  <div className="mono mb-2" style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', padding: '5px 8px', border: '1px solid var(--line)', background: 'var(--bg-elev-2)', color: 'var(--ink-3)' }}>
                    <span>{t.listingDetail.sellerReceives}</span>
                    <span style={{ color: 'var(--gold-text)' }}>~{fmt(net)} PAS {t.listingDetail.afterFee.replace('{fee}', String(feeBps / 100))}</span>
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <Button className="flex-1 btn-sm" onClick={handleMakeOffer} isLoading={isOfferPending} disabled={!offerPrice || parsePrice(offerPrice) === 0n}>
                  {t.modals.submitOffer}
                </Button>
                <Button variant="ghost" className="btn-sm" onClick={() => setShowOfferForm(false)}>
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          )}
    </DetailActionRail>
  )

  return (
    <EntityDetailShell
      className="animate-fade-in-up"
      breadcrumbs={<Link to="/explorer" className="transition-opacity hover:opacity-70"><DetailBackLabel>{t.listingDetail.back}</DetailBackLabel></Link>}
      header={(
        <EntityHeader
          media={media}
          eyebrow={isIP ? t.modals.ipAsset : t.modals.license}
          title={listing.title}
          description={listing.description || t.listingDetail.noDescription}
          status={<>{isOwn ? <span className="chip">{t.listingDetail.yourListing}</span> : null}{isDirectRead && <ChainDirectBadge />}</>}
          metadata={(
            <>
              <span>{(t.registry.categories as Record<string, string>)[listing.category] ?? listing.category}</span>
              <span>{listing.isActive ? t.common.active : t.common.inactive}</span>
              <span>{t.listingDetail.tokenId} #{listing.tokenId.toString()}</span>
            </>
          )}
        />
      )}
      aside={commerceRail}
    >
      <div className="flex-1 min-w-0">

          {/* Indexed revenue summary. */}
          <div className="mt-3 p-3 rounded-sm" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink-4)' }}>
              <TrendingUp className="w-3 h-3" /> {t.listingDetail.revenue.title}
            </p>
            {isRevenueLoading && lifetimeEth === 0 && last12MoEth === 0 ? (
              <p className="text-[11px] mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.revenue.loading}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.revenue.lifetime}</p>
                    <p className="mono tnum text-base font-bold" style={{ color: lifetimeEth > 0 ? 'var(--gold-text)' : 'var(--ink-4)' }}>
                      {lifetimeEth > 0 ? lifetimeEth.toFixed(2) : '—'} <span style={{ fontSize: 9, color: 'var(--gold-text)' }}>PAS</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.revenue.last12Mo}</p>
                    <p className="mono tnum text-base font-bold" style={{ color: last12MoEth > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                      {last12MoEth > 0 ? last12MoEth.toFixed(2) : '—'} <span style={{ fontSize: 9, color: 'var(--gold-text)' }}>PAS</span>
                    </p>
                  </div>
                </div>
                {revenuePayments.length > 0 && (
                  <>
                    <p className="text-[9px] uppercase tracking-wider mono mb-1" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.revenue.recent}</p>
                    <div className="space-y-1">
                      {revenuePayments.slice(0, 5).map((p, i) => {
                        // The API returns Unix seconds.
                        const ts = p.blockTimestamp ? Math.floor(new Date(Number(p.blockTimestamp) * 1000).getTime() / 1000) : 0
                        const txHref = p.txHash ? `${BLOCK_EXPLORER_URL}/tx/${p.txHash}` : null
                        return (
                          <div key={i} className="flex items-center justify-between text-[10px] gap-2" style={{ color: 'var(--ink-3)' }}>
                            <div className="flex items-center gap-1.5 min-w-0">
                              {txHref ? (
                                <a href={txHref} target="_blank" rel="noopener noreferrer" className="mono truncate hover:underline" style={{ color: 'var(--ink-2)' }} title={p.txHash ?? ''}>
                                  {formatPrice(BigInt(p.amount || '0'))} PAS
                                </a>
                              ) : (
                                <span className="mono truncate">{formatPrice(BigInt(p.amount || '0'))} PAS</span>
                              )}
                              <span
                                className="chip mono"
                                style={{
                                  fontSize: 8,
                                  padding: '0 4px',
                                  color: p.isPrimarySale ? 'var(--gold-text)' : 'var(--ink-4)',
                                  backgroundColor: p.isPrimarySale
                                    ? 'color-mix(in srgb, var(--gold) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--ink-4) 10%, transparent)',
                                }}
                                title={p.isPrimarySale ? t.listingDetail.revenue.saleTypePrimary : t.listingDetail.revenue.saleTypeSecondary}
                              >
                                {p.isPrimarySale ? t.listingDetail.revenue.primary : t.listingDetail.revenue.secondary}
                              </span>
                            </div>
                            <span className="mono shrink-0" style={{ color: 'var(--ink-4)' }}>
                              {ts ? formatRelative(ts) : `#${p.blockNumber}`}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
                {revenuePayments.length === 0 && (
                  <p className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.revenue.noPayments}</p>
                )}
              </>
            )}
          </div>

          {/* Payment status for recurring license listings. */}
          {isRecurringLicense && (
            <div className="mt-3 p-3 rounded-sm" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5" style={{ color: 'var(--ink-4)' }}>
                <CreditCard className="w-3 h-3" /> {t.listingDetail.paymentStatus.title}
              </p>
              {!paymentStatusData ? (
                <p className="text-[11px] mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.revenue.loading}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.paymentStatus.nextDue}</p>
                      <p className="mono tnum text-[11px] font-semibold" style={{ color: paymentStatusData.nextPaymentDue && paymentStatusData.nextPaymentDue * 1000 < nowMs ? 'var(--danger)' : 'var(--ink)' }}>
                        {paymentStatusData.nextPaymentDue
                          ? new Date(paymentStatusData.nextPaymentDue * 1000).toLocaleDateString()
                          : t.listingDetail.paymentStatus.onTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.paymentStatus.lastPaid}</p>
                      <p className="mono tnum text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                        {paymentStatusData.lastPaymentTime
                          ? new Date(paymentStatusData.lastPaymentTime * 1000).toLocaleDateString()
                          : t.listingDetail.paymentStatus.neverPaid}
                      </p>
                    </div>
                  </div>
                  {paymentStatusData.paymentHistory.length > 0 ? (
                    <div className="space-y-1">
                      {paymentStatusData.paymentHistory.slice(0, 4).map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px] gap-2" style={{ color: 'var(--ink-3)' }}>
                          <span className="mono">
                            {formatPrice(BigInt(p.base_amount))} PAS
                            {BigInt(p.penalty) > 0n && (
                              <span style={{ color: 'var(--danger)' }}> + {formatPrice(BigInt(p.penalty))}</span>
                            )}
                          </span>
                          <span className="mono shrink-0" style={{ color: 'var(--ink-4)' }}>
                            {p.payment_timestamp
                              ? new Date(p.payment_timestamp * 1000).toLocaleDateString()
                              : `#${p.block_number}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] mono" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.paymentStatus.noHistory}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Incoming offers (owner only) */}
          {isOwn && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.incomingOffers}</p>
              <IncomingOffersPanel nftContract={listing.nftContract} tokenId={listing.tokenId} canAccept />
            </div>
          )}

          {/* Core details */}
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.tokenInfo}</p>
            <MetaRow icon={Tag} label={t.listingDetail.tokenId} value={`#${listing.tokenId.toString()}`} />
            <MetaRow icon={User} label={t.listingDetail.seller} value={shortenAddress(listing.seller)} />
            {listing.createdAt > 0 && (
              <MetaRow icon={Calendar} label={t.listingDetail.listed} value={new Date(listing.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} />
            )}
            <MetaRow icon={Activity} label={t.listingDetail.status} value={listing.isActive ? t.common.active : t.common.inactive} valueColor={listing.isActive ? 'var(--ok)' : 'var(--ink-4)'} />
          </div>

          {/* License-specific section */}
          {!isIP && (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.licenseDetails}</p>
              {listing.isExclusive !== undefined && (
                <MetaRow
                  icon={listing.isExclusive ? ShieldCheck : ShieldOff}
                  label={t.listingDetail.exclusivity}
                  value={listing.isExclusive ? t.listingDetail.exclusive : t.listingDetail.nonExclusive}
                  valueColor={listing.isExclusive ? 'var(--gold)' : 'var(--ink)'}
                />
              )}
              {listing.ipAssetId !== undefined && (
                <MetaRow icon={Briefcase} label={t.listingDetail.parentIP} value={listing.ipAssetTitle ? `${listing.ipAssetTitle} (#${listing.ipAssetId.toString()})` : `#${listing.ipAssetId.toString()}`} valueColor="var(--gold)" />
              )}
              {listing.supply !== undefined && (
                <MetaRow icon={Package} label={t.listingDetail.supply} value={listing.supply.toString()} />
              )}
              {listing.expiryTime !== undefined && (
                <MetaRow
                  icon={Clock}
                  label={t.listingDetail.expiry}
                  value={listing.expiryTime === 0n ? t.common.perpetual : (() => {
                    const now = BigInt(Math.floor(nowMs / 1000))
                    const diff = listing.expiryTime! - now
                    if (diff <= 0n) return `${t.common.expired} (${formatTimestamp(listing.expiryTime!)})`
                    const days = Number(diff) / 86400
                    return days >= 1
                      ? `${Math.floor(days)}${t.common.daysLeft} (${formatTimestamp(listing.expiryTime!)})`
                      : `${Math.floor(Number(diff) / 3600)}${t.common.hoursLeft}`
                  })()}
                  valueColor={listing.expiryTime !== 0n && listing.expiryTime! < BigInt(Math.floor(nowMs / 1000)) ? 'var(--danger)' : undefined}
                />
              )}
              {listing.paymentInterval !== undefined && listing.paymentInterval > 0n && (
                <MetaRow
                  icon={CreditCard}
                  label={t.listingDetail.payment}
                  value={Number(listing.paymentInterval) >= 86400
                    ? t.common.everyDays.replace('{n}', String(Math.floor(Number(listing.paymentInterval) / 86400)))
                    : t.common.everyHours.replace('{n}', String(Math.floor(Number(listing.paymentInterval) / 3600)))}
                />
              )}
              {listing.isRevoked !== undefined && (
                <MetaRow icon={XCircle} label={t.listingDetail.revoked} value={listing.isRevoked ? t.listingDetail.yes : t.listingDetail.no} valueColor={listing.isRevoked ? 'var(--danger)' : 'var(--ok)'} />
              )}
              {listing.isExpired !== undefined && (
                <MetaRow icon={Clock} label={t.listingDetail.expired} value={listing.isExpired ? t.listingDetail.yes : t.listingDetail.no} valueColor={listing.isExpired ? 'var(--danger)' : 'var(--ok)'} />
              )}
              {listing.terms && (
                <div className="mt-2 p-3 rounded-sm" style={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: 'var(--ink-4)' }}>{t.listingDetail.terms}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>{listing.terms}</p>
                </div>
              )}

              {resolvedCid && holdsListedLicense && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--ink-4)' }}>{t.privateContent.downloadTitle}</p>
                  <PrivateContentDownload
                    licenseId={Number(listing.tokenId)}
                    cid={resolvedCid}
                    fileName={resolvedFileName}
                  />
                </div>
              )}
            </div>
          )}
      </div>
    </EntityDetailShell>
  )
}
