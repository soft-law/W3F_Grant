import { useMemo, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useGetRevenueBalance,
  type UserIPAsset,
  type UserLicense,
} from '@/hooks/useContracts'
import {
  useIndexedAssets,
  useIndexedTransactions,
  useIndexedLicenses,
  useIndexedAllLicenses,
  useIndexedListings,
  useIndexedHeldLicenses,
  useIndexedUserListings,
  useIndexedUserOffers,
  useIndexedDisputes,
  useInvalidateIndexedQueries,
  type ListingItem,
} from '@/hooks/useIndexed'
import { useIndexerStream } from '@/hooks/useIndexerStream'
import { consumeSyncSignal } from '@/hooks/useTxToast'
import { toast } from '@/hooks/useToast'
import { useTranslations } from '@/lib/i18n'
import { useResilience } from '@/contexts/resilience-context'
import { DataPreloaderContext, type PreloadedData } from '@/contexts/data-preloader-context'
import { mergeOptimistic } from '@/lib/optimistic-state'

export function DataPreloaderProvider({ children }: { children: React.ReactNode }) {
  const { address, isLoggedIn: isConnected } = useAuth()
  const { t } = useTranslations()

  const {
    listings: allListings,
    isLoading: isLoadingAllListings,
    refresh: refreshListings,
    error: listingsError,
    dataState: allListingsDataState,
  } = useIndexedListings()

  const {
    licenses: allLicenses,
    isLoading: isLoadingAllLicenses,
    refetch: refetchAllLicenses,
  } = useIndexedAllLicenses()

  const { assets, isLoading: isLoadingAssets, error: assetsError, refetch: refetchAssets, dataState: assetsDataState } = useIndexedAssets(address)
  const { licenses, isLoading: isLoadingLicenses, error: licensesError, refetch: refetchLicenses } = useIndexedLicenses(address)
  const { licenses: heldLicenses, isLoading: isLoadingHeldLicenses, refetch: refetchHeldLicenses } = useIndexedHeldLicenses(address)
  const { disputes, isLoading: isLoadingDisputes, error: disputesError } = useIndexedDisputes(address)
  const { listings, isLoading: isLoadingListings, refetch: refetchListings } = useIndexedUserListings(address)
  const { offers, isLoading: isLoadingOffers, refetch: refetchOffers } = useIndexedUserOffers(address)
  const { transactions, isLoading: isLoadingTx } = useIndexedTransactions(address)

  const { data: revenueBalance } = useGetRevenueBalance(address)

  const invalidateAll = useInvalidateIndexedQueries()
  const { onConfirmedBlock, sseState } = useIndexerStream()
  useEffect(() => {
    return onConfirmedBlock((blockNumber) => {
      invalidateAll()
      if (consumeSyncSignal()) {
        toast(t.common.synced.replace('{block}', String(blockNumber)))
      }
    })
  }, [onConfirmedBlock, invalidateAll, t])

  useEffect(() => {
    if (sseState === 'connected') invalidateAll()
  }, [sseState, invalidateAll])

  const { optimistic } = useResilience()
  const reconcileOptimistic = optimistic.reconcile

  // Remove optimistic placeholders after indexed entities arrive.
  useEffect(() => {
    if (!assetsError && assets.length > 0) {
      const indexedIds = assets.map((a) => a.tokenId)
      reconcileOptimistic({ assetIds: indexedIds })
    }
  }, [assets, assetsError, reconcileOptimistic])

  useEffect(() => {
    if (licenses.length > 0) {
      reconcileOptimistic({ licenseIds: licenses.map((l) => l.licenseId) })
    }
  }, [licenses, reconcileOptimistic])

  useEffect(() => {
    if (listings.length > 0) {
      reconcileOptimistic({ listingIds: listings.map((l) => l.listingId) })
    }
  }, [listings, reconcileOptimistic])

  useEffect(() => {
    if (disputes.length > 0) {
      reconcileOptimistic({ disputeIds: disputes.map((d) => d.disputeId) })
    }
  }, [disputes, reconcileOptimistic])

  // ── Merge optimistic entities into the actual collections ──
  const mergedAssets = useMemo(
    () => mergeOptimistic<UserIPAsset>(
      assets,
      optimistic.assets.map((a) => ({
        tokenId: a.tokenId,
        owner: a.owner,
        metadataURI: a.metadataURI,
        title: `IP Asset #${a.tokenId.toString()}`,
        description: undefined,
        category: 'IP Asset',
        creator: undefined,
        imageUrl: undefined,
        animationUrl: undefined,
        privateContentCid: undefined,
        activeLicenseCount: 0n,
        hasActiveDispute: false,
        royaltyBps: undefined,
        isInvalidated: false,
        wrappedNftStuck: false,
        blockNumber: 0n,
        txHash: '',
        isOptimistic: true,
      })) as UserIPAsset[],
      (a) => a.tokenId.toString(),
    ),
    [assets, optimistic.assets],
  )

  const optimisticLicenses = useMemo<UserLicense[]>(
    () => optimistic.licenses.map((license) => ({
      licenseId: license.licenseId,
      ipAssetId: license.ipAssetId,
      supply: license.supply ?? 0n,
      expiryTime: 0n,
      terms: '',
      paymentInterval: license.paymentInterval ?? 0n,
      isExclusive: license.isExclusive ?? false,
      isRevoked: false,
      isExpired: false,
      isConcluded: false,
      isActive: true,
      publicMetadataURI: '',
      title: `License #${license.licenseId.toString()}`,
      balance: license.supply ?? 0n,
      isOptimistic: true,
    })),
    [optimistic.licenses],
  )

  const mergedLicenses = useMemo(
    () => mergeOptimistic(licenses, optimisticLicenses, (license) => license.licenseId.toString()),
    [licenses, optimisticLicenses],
  )

  const mergedHeldLicenses = useMemo(
    () => mergeOptimistic(
      heldLicenses,
      optimisticLicenses.filter((_, index) =>
        !!address
        && optimistic.licenses[index]?.licensee.toLowerCase() === address.toLowerCase()),
      (license) => license.licenseId.toString(),
    ),
    [heldLicenses, optimisticLicenses, optimistic.licenses, address],
  )

  const optimisticUserListings = useMemo(
    () => optimistic.listings
      .filter((listing) => !!address && listing.seller.toLowerCase() === address.toLowerCase())
      .map((listing) => ({
        listingId: listing.listingId as `0x${string}`,
        nftContract: listing.nftContract as `0x${string}`,
        tokenId: listing.tokenId,
        price: listing.price,
        isActive: true,
        isERC721: listing.isERC721,
        title: `Token #${listing.tokenId.toString()}`,
      })),
    [optimistic.listings, address],
  )

  const mergedListings = useMemo(
    () => mergeOptimistic(listings, optimisticUserListings, (listing) => listing.listingId),
    [listings, optimisticUserListings],
  )

  const mergedAllListings = useMemo(
    () => mergeOptimistic<ListingItem>(
      allListings,
      optimistic.listings.map((listing) => ({
        id: `listing-${listing.listingId}`,
        listingId: listing.listingId as `0x${string}`,
        seller: listing.seller as `0x${string}`,
        nftContract: listing.nftContract as `0x${string}`,
        tokenId: listing.tokenId,
        price: listing.price,
        title: `Token #${listing.tokenId.toString()}`,
        category: listing.isERC721 ? 'IP Asset' : 'License',
        isERC721: listing.isERC721,
        createdAt: 0,
        isActive: true,
        isOptimistic: true,
      })),
      (listing) => listing.listingId,
    ),
    [allListings, optimistic.listings],
  )

  const mergedAllLicenses = useMemo(
    () => mergeOptimistic(
      allLicenses,
      optimistic.licenses.map((license) => ({
        licenseId: license.licenseId,
        ipAssetId: license.ipAssetId,
        isExclusive: license.isExclusive ?? false,
        paymentInterval: license.paymentInterval ?? 0n,
        expiryTime: 0n,
        terms: '',
        isActive: true,
        title: `License #${license.licenseId.toString()}`,
      })),
      (license) => license.licenseId.toString(),
    ),
    [allLicenses, optimistic.licenses],
  )

  const mergedDisputes = useMemo(
    () => mergeOptimistic(
      disputes,
      optimistic.disputes.map((d) => ({
        disputeId: d.disputeId,
        disputeType: d.disputeType,
        // DisputeType enum: 0 = License, 1 = IP.
        ipAssetId: d.disputeType === 1 ? Number(d.targetId) : null,
        licenseId: d.disputeType === 0 ? d.targetId : 0n,
        reason: d.reason,
        status: d.status,
        submittedAt: 0n,
        isExpired: false,
        bondReleased: false,
        bondAmount: 0n,
        proofURI: '',
        submitter: d.submitter,
        ipOwner: '',
        resolvedAt: 0n,
        resolver: '',
        resolutionReason: '',
      })) as typeof disputes,
      (d) => d.disputeId.toString(),
    ),
    [disputes, optimistic.disputes],
  )

  const value = useMemo<PreloadedData>(() => ({
    assets: mergedAssets,
    isLoadingAssets,
    refetchAssets,
    assetsDataState,
    licenses: mergedLicenses,
    isLoadingLicenses,
    refetchLicenses,
    heldLicenses: mergedHeldLicenses,
    isLoadingHeldLicenses,
    refetchHeldLicenses,
    disputes: mergedDisputes,
    isLoadingDisputes,
    revenueBalance: revenueBalance as bigint | undefined,
    transactions,
    isLoadingTx,
    listings: mergedListings,
    isLoadingListings,
    refetchListings,
    offers,
    isLoadingOffers,
    refetchOffers,
    isConnected,
    address,
    allListings: mergedAllListings,
    isLoadingAllListings,
    refreshListings,
    allListingsDataState,
    allLicenses: mergedAllLicenses,
    isLoadingAllLicenses,
    refetchAllLicenses,
    listingsError,
    assetsError,
    licensesError,
    disputesError,
    sseState,
  }), [
    mergedAssets, isLoadingAssets, refetchAssets, assetsDataState,
    mergedLicenses, isLoadingLicenses, refetchLicenses,
    mergedHeldLicenses, isLoadingHeldLicenses, refetchHeldLicenses,
    mergedDisputes, isLoadingDisputes,
    revenueBalance,
    transactions, isLoadingTx,
    mergedListings, isLoadingListings, refetchListings,
    offers, isLoadingOffers, refetchOffers,
    isConnected, address,
    mergedAllListings, isLoadingAllListings, refreshListings, allListingsDataState, listingsError,
    mergedAllLicenses, isLoadingAllLicenses, refetchAllLicenses,
    assetsError, licensesError, disputesError,
    sseState,
  ])

  return (
    <DataPreloaderContext.Provider value={value}>
      {children}
    </DataPreloaderContext.Provider>
  )
}
