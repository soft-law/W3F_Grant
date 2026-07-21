/**
 * Indexed entity and activity queries. User-scoped data uses shorter stale
 * times than global discovery data.
 */

import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { fetchIndexer, getIndexerResponseSource } from '@/lib/indexer'
import { ipfsToHttp } from '@/lib/ipfs-storage'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import type { UserIPAsset, UserLicense, FullDispute } from '@/hooks/useContracts'
import type { Transaction } from '@/lib/timeAgo'
import type { ContractEvent } from '@/lib/explorerEvents'
import { deriveQueryState, type DataState } from '@/lib/data-state'

function queryDataState(path: string, isLoading: boolean, isError: boolean, hasData: boolean): DataState {
  return deriveQueryState({
    isLoading,
    isError,
    hasData,
    hasCachedFallback: getIndexerResponseSource(path) === 'cache',
  })
}

// ── ListingItem (shared across marketplace UI) ──
// Shared marketplace listing shape.
export interface ListingItem {
  id: string
  listingId: `0x${string}`
  seller: `0x${string}`
  nftContract: `0x${string}`
  tokenId: bigint
  price: bigint
  title: string
  description?: string
  category: string
  isERC721: boolean
  imageUrl?: string
  // For musical/audiovisual works the upload lives in `animation_url`; for
  // literary/dramatic/software it lives in `external_url`. Indexer normalises
  // both into this single field.
  animationUrl?: string
  createdAt: number
  isActive: boolean
  /** Indexer-derived hint. Purchase still performs a fresh chain preflight. */
  sellerHasToken?: boolean
  // License-specific fields
  ipAssetId?: bigint
  ipAssetTitle?: string
  ipAssetImageUrl?: string
  isExclusive?: boolean
  expiryTime?: bigint
  terms?: string
  supply?: bigint
  paymentInterval?: bigint
  isRevoked?: boolean
  isExpired?: boolean
  privateCid?: string
  /** Receipt-derived placeholder shown until the indexer supplies enrichment. */
  isOptimistic?: boolean
}

// ── Indexer row types (snake_case, matching SQLite columns) ──

export interface IndexerAssetRow {
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
  has_active_dispute: number // 0 or 1
  royalty_bps: number | null
  is_invalidated: number | null // 0 or 1
  wrapped_nft_stuck: number | null // 0 or 1
  block_number: number
  tx_hash: string
}

export interface IndexerLicenseRow {
  license_id: number
  ip_asset_id: number
  licensee: string | null
  supply: number | null
  expiry_time: number | null
  terms: string | null
  payment_interval: number | null
  is_exclusive: number // 0 or 1
  is_revoked: number // 0 or 1
  is_expired: number // 0 or 1
  is_concluded: number | null // 0 or 1
  penalty_rate_bps: number | null
  public_metadata_uri: string | null
  private_content_cid?: string | null
  title: string | null
  balance?: number
  holder?: string
}

export interface IndexerListingRow {
  listing_id: string
  seller: string
  nft_contract: string
  token_id: number
  price: string // stored as text in DB
  is_active: number // 0 or 1
  is_erc721: number // 0 or 1
  title: string | null
  image_url: string | null
  animation_url: string | null
  block_number: number
  created_at: string
  // Joined fields from active listings query (ERC-721 IPAsset)
  asset_title?: string | null
  asset_description?: string | null
  asset_image_url?: string | null
  asset_animation_url?: string | null
  asset_category?: string | null
  asset_owner?: string | null
  seller_has_token?: number | null
  // Joined fields for ERC-1155 license listings
  lic_id?: number | null
  lic_ip_asset_id?: number | null
  lic_is_exclusive?: number | null
  lic_expiry_time?: number | null
  lic_terms?: string | null
  lic_supply?: number | null
  lic_payment_interval?: number | null
  lic_is_revoked?: number | null
  lic_is_expired?: number | null
  lic_private_content_cid?: string | null
  lic_ip_title?: string | null
  lic_ip_image_url?: string | null
  lic_ip_animation_url?: string | null
}

interface IndexerOfferRow {
  offer_id: string
  buyer: string
  nft_contract: string
  token_id: number
  price: string
  is_active: number
  expiry_time: number | null
  block_number: number
}

export interface IndexerDisputeRow {
  dispute_id: number
  dispute_type: number | null
  ip_asset_id: number | null
  license_id: number | null
  submitter: string
  ip_owner: string | null
  reason: string | null
  proof_uri: string | null
  status: number
  submitted_at: number | null
  resolved_at: number | null
  resolver: string | null
  resolution_reason: string | null
  bond_amount: string | null
  award_recipient: string | null
  is_expired: number | null // 0 or 1
  bond_released: number | null // 0 or 1
  block_number: number
  created_at: string | null
}

interface IndexerEventRow {
  id: number
  contract_address: string
  event_name: string
  block_number: number
  tx_hash: string
  log_index: number
  args_json: string | null
  block_timestamp: number | null
}

interface PaginatedResponse<T> {
  data: T[]
  total?: number
  limit: number
  offset: number
}

// ── Mappers: indexer rows -> frontend types ──

export function mapAsset(row: IndexerAssetRow): UserIPAsset {
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

export function mapUserLicense(row: IndexerLicenseRow): UserLicense {
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
    privateContentCid: row.private_content_cid ?? undefined,
    title: row.title || `License #${row.license_id}`,
    balance: BigInt(row.balance ?? row.supply ?? 0),
  }
}

function mapAllLicense(row: IndexerLicenseRow): {
  licenseId: bigint
  ipAssetId: bigint
  isExclusive: boolean
  paymentInterval: bigint
  expiryTime: bigint
  terms: string
  isActive: boolean
  title: string
} {
  const isRevoked = row.is_revoked === 1
  const isExpired = row.is_expired === 1
  return {
    licenseId: BigInt(row.license_id),
    ipAssetId: BigInt(row.ip_asset_id),
    isExclusive: row.is_exclusive === 1,
    paymentInterval: BigInt(row.payment_interval ?? 0),
    expiryTime: BigInt(row.expiry_time ?? 0),
    terms: row.terms ?? '',
    isActive: !isRevoked && !isExpired,
    title: row.title || `License #${row.license_id}`,
  }
}

export function mapListing(row: IndexerListingRow): ListingItem {
  const isERC721 = row.is_erc721 === 1
  const rawAnimation = row.asset_animation_url || row.lic_ip_animation_url || row.animation_url || ''
  return {
    id: `listing-${row.listing_id}`,
    listingId: row.listing_id as `0x${string}`,
    seller: row.seller as `0x${string}`,
    nftContract: row.nft_contract as `0x${string}`,
    tokenId: BigInt(row.token_id),
    price: BigInt(row.price),
    title: row.asset_title || row.lic_ip_title || row.title || `Token #${row.token_id}`,
    description: row.asset_description ?? undefined,
    category: row.asset_category || 'IP Asset',
    isERC721,
    imageUrl: ipfsToHttp(row.asset_image_url || row.lic_ip_image_url || row.image_url || ''),
    animationUrl: rawAnimation ? ipfsToHttp(rawAnimation) : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
    isActive: row.is_active === 1,
    sellerHasToken: row.seller_has_token === undefined || row.seller_has_token === null
      ? undefined
      : row.seller_has_token === 1,
    // License-specific fields (ERC-1155 listings)
    ipAssetId: row.lic_ip_asset_id ? BigInt(row.lic_ip_asset_id) : undefined,
    ipAssetTitle: row.lic_ip_title ?? undefined,
    ipAssetImageUrl: row.lic_ip_image_url ? ipfsToHttp(row.lic_ip_image_url) : undefined,
    isExclusive: row.lic_is_exclusive === 1 ? true : undefined,
    expiryTime: row.lic_expiry_time ? BigInt(row.lic_expiry_time) : undefined,
    terms: row.lic_terms ?? undefined,
    supply: row.lic_supply ? BigInt(row.lic_supply) : undefined,
    paymentInterval: row.lic_payment_interval ? BigInt(row.lic_payment_interval) : undefined,
    isRevoked: row.lic_is_revoked === 1 ? true : undefined,
    isExpired: row.lic_is_expired === 1 ? true : undefined,
    privateCid: row.lic_private_content_cid ?? undefined,
  }
}

type UserListingItem = {
  listingId: `0x${string}`
  nftContract: `0x${string}`
  tokenId: bigint
  price: bigint
  isActive: boolean
  isERC721: boolean
  title: string
}

function mapUserListing(row: IndexerListingRow): UserListingItem {
  return {
    listingId: row.listing_id as `0x${string}`,
    nftContract: row.nft_contract as `0x${string}`,
    tokenId: BigInt(row.token_id),
    price: BigInt(row.price),
    isActive: row.is_active === 1,
    isERC721: row.is_erc721 === 1,
    title: row.title || `Token #${row.token_id}`,
  }
}

export type UserOfferItem = {
  offerId: `0x${string}`
  buyer: `0x${string}`
  nftContract: `0x${string}`
  tokenId: bigint
  price: bigint
  isActive: boolean
  expiryTime: bigint
  blockNumber: bigint
}

function mapOffer(row: IndexerOfferRow): UserOfferItem {
  return {
    offerId: row.offer_id as `0x${string}`,
    buyer: row.buyer as `0x${string}`,
    nftContract: row.nft_contract as `0x${string}`,
    tokenId: BigInt(row.token_id),
    price: BigInt(row.price),
    isActive: row.is_active === 1,
    expiryTime: BigInt(row.expiry_time ?? 0),
    blockNumber: BigInt(row.block_number),
  }
}

/** Authoritative active-offer projection for the public Explorer. */
export function useIndexedActiveOffers(limit = 24) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['indexed-active-offers', limit],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerOfferRow>>(
        `/api/offers?active=true&limit=${limit}`
      ),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const offers: UserOfferItem[] = data?.data?.map(mapOffer) ?? []
  return { offers, isLoading, refetch }
}

type UserDisputeItem = {
  disputeId: bigint
  disputeType: number
  ipAssetId: number | null
  licenseId: bigint
  reason: string
  status: number
  submittedAt: bigint
  isExpired: boolean
  bondReleased: boolean
  bondAmount: bigint
  proofURI: string
  submitter: string
  ipOwner: string
  resolvedAt: bigint
  resolver: string
  resolutionReason: string
}

function mapUserDispute(row: IndexerDisputeRow): UserDisputeItem {
  return {
    disputeId: BigInt(row.dispute_id),
    disputeType: row.dispute_type ?? 0,
    ipAssetId: row.ip_asset_id ?? null,
    licenseId: BigInt(row.license_id ?? 0),
    reason: row.reason ?? '',
    status: row.status,
    submittedAt: BigInt(row.submitted_at ?? (row.created_at ? Math.floor(new Date(row.created_at + 'Z').getTime() / 1000) : 0)),
    isExpired: row.is_expired === 1,
    bondReleased: row.bond_released === 1,
    bondAmount: BigInt(row.bond_amount ?? 0),
    proofURI: row.proof_uri ?? '',
    submitter: row.submitter,
    ipOwner: row.ip_owner ?? '',
    resolvedAt: BigInt(row.resolved_at ?? 0),
    resolver: row.resolver ?? '',
    resolutionReason: row.resolution_reason ?? '',
  }
}

export function mapFullDispute(row: IndexerDisputeRow): FullDispute {
  return {
    disputeId: BigInt(row.dispute_id),
    disputeType: row.dispute_type ?? 0,
    ipAssetId: BigInt(row.ip_asset_id ?? 0),
    licenseId: BigInt(row.license_id ?? 0),
    submitter: row.submitter,
    ipOwner: row.ip_owner ?? '',
    awardRecipient: row.award_recipient ?? '',
    reason: row.reason ?? '',
    proofURI: row.proof_uri ?? '',
    status: row.status,
    submittedAt: BigInt(row.submitted_at ?? (row.created_at ? Math.floor(new Date(row.created_at + 'Z').getTime() / 1000) : 0)),
    resolvedAt: BigInt(row.resolved_at ?? 0),
    bondAmount: BigInt(row.bond_amount ?? 0),
    resolver: row.resolver ?? '',
    resolutionReason: row.resolution_reason ?? '',
    isExpired: row.is_expired === 1,
    bondReleased: row.bond_released === 1,
  }
}

// ── Hooks ──

/** Assets owned by an address. */
export function useIndexedAssets(address?: string) {
  const path = `/api/assets?owner=${address}&limit=200`
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-assets', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerAssetRow>>(
        path
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    // Reconcile after focus and periodically in case the SSE stream was interrupted.
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })

  const rows = data?.data
  const assets: UserIPAsset[] = rows?.map(mapAsset) ?? []
  const dataState = queryDataState(path, isLoading, !!error, rows !== undefined)
  return { assets, isLoading, error, refetch, dataState }
}

export function useIndexedAllAssets() {
  const { data, isLoading } = useQuery({
    queryKey: ['indexed-all-assets'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerAssetRow>>(
        `/api/assets?limit=200`
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const assets: UserIPAsset[] = data?.data?.map(mapAsset) ?? []
  return { assets, isLoading }
}

/**
 * Licenses minted on IPs the address owns (creator/studio view).
 * This is distinct from licenses currently held by the address.
 */
export function useIndexedLicenses(address?: string) {
  const path = `/api/licenses?ipOwner=${address}&limit=200`
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-licenses', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerLicenseRow>>(
        path,
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const rows = data?.data
  const seen = new Set<number>()
  const licenses: UserLicense[] = []
  for (const row of rows ?? []) {
    if (seen.has(row.license_id)) continue
    seen.add(row.license_id)
    licenses.push(mapUserLicense(row))
  }
  const dataState = queryDataState(path, isLoading, !!error, rows !== undefined)
  return { licenses, isLoading, error, refetch, dataState }
}

/** Exact single-IP license set used for mint preflight constraints. */
export function useIndexedLicensesForAsset(ipAssetId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-licenses-for-asset', ipAssetId ?? 'none'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerLicenseRow>>(
        `/api/licenses?ipAssetId=${ipAssetId}&limit=100`,
      ),
    enabled: /^\d+$/.test(ipAssetId ?? ''),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  return {
    licenses: data?.data?.map(mapUserLicense) ?? [],
    isLoading,
    error,
    refetch,
  }
}

/** Licenses currently held by an address. */
export function useIndexedHeldLicenses(address?: string) {
  const path = `/api/licenses?holder=${address}&limit=200`
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-held-licenses', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerLicenseRow>>(
        path,
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const rows = data?.data
  const licenses: UserLicense[] = rows?.map(mapUserLicense) ?? []
  const dataState = queryDataState(path, isLoading, !!error, rows !== undefined)
  return { licenses, isLoading, error, refetch, dataState }
}

export interface PaymentStatusData {
  licenseId: number
  paymentInterval: number | null
  lastPaymentTime: number | null
  nextPaymentDue: number | null
  paymentHistory: Array<{
    id: number
    license_id: number
    payer: string
    base_amount: string
    penalty: string
    payment_timestamp: number | null
    block_number: number
    tx_hash: string | null
  }>
}

export function useIndexedPaymentStatus(licenseId?: number) {
  return useQuery({
    queryKey: ['indexed-payment-status', licenseId],
    queryFn: () => fetchIndexer<PaymentStatusData>(`/api/licenses/${licenseId}/payment-status`),
    enabled: licenseId !== undefined && licenseId > 0,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

/** Global license collection. */
export function useIndexedAllLicenses() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-all-licenses'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerLicenseRow>>(
        '/api/licenses?limit=200'
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const licenses = (data?.data?.map(mapAllLicense) ?? []).sort((a, b) => {
    if (a.isActive && !b.isActive) return -1
    if (!a.isActive && b.isActive) return 1
    return Number(b.licenseId - a.licenseId)
  })

  return { licenses, isLoading, error, refetch }
}

/** Active marketplace listings. */
export function useIndexedListings() {
  const path = '/api/listings?active=true&limit=200'
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-listings'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerListingRow>>(
        path
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const rows = data?.data
  // Exclude records whose seller no longer controls the listed token.
  const listings: ListingItem[] = (rows?.map(mapListing) ?? []).filter(
    listing => listing.sellerHasToken !== false,
  )
  const dataState = queryDataState(path, isLoading, !!error, rows !== undefined)
  return {
    listings,
    isLoading,
    error,
    refresh: refetch,
    dataState,
  }
}

/** Marketplace listings created by an address. */
export function useIndexedUserListings(address?: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['indexed-user-listings', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerListingRow>>(
        `/api/listings?seller=${address}&limit=200`
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const listings: UserListingItem[] = data?.data?.map(mapUserListing) ?? []
  return { listings, isLoading, refetch }
}

/** Marketplace offers created by an address. */
export function useIndexedUserOffers(address?: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['indexed-user-offers', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerOfferRow>>(
        `/api/offers?buyer=${address}&limit=200`
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const offers: UserOfferItem[] = data?.data?.map(mapOffer) ?? []
  return { offers, isLoading, refetch }
}

/**
 * Active offers received on IP assets currently owned by `address`,
 * aggregated across all their works. Backed by /api/offers?seller=.
 */
export function useIndexedReceivedOffers(address?: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['indexed-received-offers', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerOfferRow>>(
        `/api/offers?seller=${address}&active=true&limit=200`
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const offers: UserOfferItem[] = data?.data?.map(mapOffer) ?? []
  return { offers, isLoading, refetch }
}

export interface WithdrawalItem {
  source: 'revenue' | 'bond'
  recipient: string
  amount: string
  blockNumber: number
  txHash: string | null
  blockTimestamp: number | null
}

interface IndexerWithdrawalRow {
  source: 'revenue' | 'bond'
  recipient: string
  amount: string
  block_number: number
  tx_hash: string | null
  block_timestamp: number | null
}

/**
 * Past withdrawals (revenue draws and bond sweeps) for an account. Backed by
 * /api/withdrawals?recipient=&source= — recipient-scoped, not asset-scoped:
 * Withdrawal/BondWithdrawn events carry no asset or dispute reference.
 */
export function useIndexedWithdrawals(recipient?: string, source?: 'revenue' | 'bond') {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['indexed-withdrawals', recipient, source ?? 'all'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerWithdrawalRow>>(
        `/api/withdrawals?recipient=${recipient}${source ? `&source=${source}` : ''}&limit=100`
      ),
    enabled: !!recipient,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const withdrawals: WithdrawalItem[] = data?.data?.map((row) => ({
    source: row.source,
    recipient: row.recipient,
    amount: row.amount,
    blockNumber: row.block_number,
    txHash: row.tx_hash,
    blockTimestamp: row.block_timestamp,
  })) ?? []
  return { withdrawals, isLoading, isError, refetch }
}

/**
 * Block timestamp for a given block number, sourced from any event in that
 * block. Returns `undefined` if no event was indexed at that height (for
 * blocks where nothing of interest happened — but a mint or transfer always
 * lands in the events table, so any asset.blockNumber will resolve).
 */
export function useIndexedBlockTime(blockNumber?: bigint) {
  const { data, isLoading } = useQuery({
    queryKey: ['indexed-block-time', blockNumber?.toString()],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerEventRow>>(
        `/api/events?fromBlock=${blockNumber}&toBlock=${blockNumber}&limit=1`
      ),
    enabled: blockNumber !== undefined && blockNumber > 0n,
    staleTime: Infinity, // block timestamps never change
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })

  const ts = data?.data?.[0]?.block_timestamp ?? undefined
  const date = typeof ts === 'number' ? new Date(ts * 1000) : undefined
  return { date, isLoading }
}

/** Active offers for one contract token. */
export function useIndexedOffersForToken(
  nftContract?: `0x${string}`,
  tokenId?: bigint,
) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['indexed-offers-for-token', nftContract, tokenId?.toString()],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerOfferRow>>(
        `/api/offers?nftContract=${nftContract}&tokenId=${tokenId}&active=true&limit=200`
      ),
    enabled: !!nftContract && tokenId !== undefined,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const offers: UserOfferItem[] = data?.data?.map(mapOffer) ?? []
  return { offers, isLoading, refetch }
}

/** Disputes involving an address. */
export function useIndexedDisputes(address?: string) {
  const path = `/api/disputes?participant=${address}&limit=200`
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-user-disputes', address],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerDisputeRow>>(
        path
      ),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const rows = data?.data
  const disputes: UserDisputeItem[] = rows?.map(mapUserDispute) ?? []
  const dataState = queryDataState(path, isLoading, !!error, rows !== undefined)
  return { disputes, isLoading, error, refetch, dataState }
}

/** Global dispute collection. */
export function useIndexedAllDisputes(enabled = true) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['indexed-all-disputes'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerDisputeRow>>(
        '/api/disputes?limit=200'
      ),
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const disputes: FullDispute[] = data?.data?.map(mapFullDispute) ?? []
  return { disputes, isLoading, refetch }
}

/**
 * License-scoped disputes, including error state so an unavailable docket is
 * distinguishable from an empty one.
 */
export function useIndexedDisputesByLicense(licenseId: bigint | undefined, enabled = true) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['indexed-disputes-by-license', licenseId?.toString() ?? 'none'],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerDisputeRow>>(
        `/api/disputes?licenseId=${licenseId!.toString()}&limit=50`
      ),
    enabled: enabled && licenseId !== undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const disputes: FullDispute[] = data?.data?.map(mapFullDispute) ?? []
  return { disputes, isLoading, isError, refetch }
}

// ── Transactions ──

export interface IndexerTxRow {
  block_number: number
  extrinsic_index: number
  tx_hash: string
  block_timestamp: number
  from_address: string
  to_address: string
  value: string
  method_id: string
  method_name: string
  gas_limit: string
  gas_used: string
  gas_price: string
  tx_type: number
  status: 0 | 1
}

function mapTx(row: IndexerTxRow): Transaction {
  return {
    hash: row.tx_hash,
    method: row.method_name ?? 'unknown',
    methodRaw: row.method_id,
    timestamp: new Date((row.block_timestamp ?? 0) * 1000).toISOString(),
    blockNumber: row.block_number,
    from: row.from_address ?? '',
    to: row.to_address ?? '',
    value: row.value ?? '0',
    status: row.status === 1,
  }
}

export function useIndexedTransactions(address?: string, limit = 30) {
  const path = `/api/txs?participant=${address}&limit=${limit}`
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-txs', address, limit],
    queryFn: () =>
      fetchIndexer<PaginatedResponse<IndexerTxRow>>(path),
    enabled: !!address,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = data?.data
  const transactions: Transaction[] = rows?.map(mapTx) ?? []
  const dataState = queryDataState(path, isLoading, !!error, rows !== undefined)
  return { transactions, isLoading, error, refetch, dataState }
}

// ── Chain constants (Revive runtime config; backed by indexer /api/chain) ──

export interface ChainConstants {
  nativeToEthRatio: string
  // bigint on this runtime, not the {ref_time, proof_size} Weight struct.
  maxEthExtrinsicWeight: string
  depositPerByte: string
  depositPerItem: string
  depositPerChildTrieItem: string
  codeHashLockupDepositPercent: number
  allowEvmBytecode: boolean
  debugEnabled: boolean
  gasScale: number | null
}

const CHAIN_CONSTANTS_FALLBACK: Readonly<ChainConstants> = Object.freeze({
  nativeToEthRatio: '1000000',
  maxEthExtrinsicWeight: '0',
  depositPerByte: '0',
  depositPerItem: '0',
  depositPerChildTrieItem: '0',
  codeHashLockupDepositPercent: 0,
  allowEvmBytecode: true,
  debugEnabled: false,
  gasScale: null,
})

export function useChainConstants() {
  return useQuery({
    queryKey: ['indexed-chain'],
    queryFn: () => fetchIndexer<{ data: ChainConstants }>(`/api/chain`).then(r => r.data),
    staleTime: 60_000 * 60,
    gcTime: 60_000 * 60 * 2,
    refetchOnWindowFocus: false,
    placeholderData: CHAIN_CONSTANTS_FALLBACK,
  })
}

// ── Explorer events ──

const CONTRACT_LABEL_MAP: Record<string, ContractEvent['contract']> = {
  [CONTRACT_ADDRESSES.IPAsset.toLowerCase()]: 'IPAsset',
  [CONTRACT_ADDRESSES.LicenseToken.toLowerCase()]: 'LicenseToken',
  [CONTRACT_ADDRESSES.Marketplace.toLowerCase()]: 'Marketplace',
  [CONTRACT_ADDRESSES.GovernanceArbitrator.toLowerCase()]: 'Arbitrator',
}

function mapExplorerEvent(row: IndexerEventRow): ContractEvent {
  let args: Record<string, unknown> = {}
  if (row.args_json) {
    try {
      args = JSON.parse(row.args_json)
    } catch { /* use empty args if parse fails */ }
  }

  return {
    id: `${row.tx_hash}-${row.log_index}`,
    contract: CONTRACT_LABEL_MAP[row.contract_address.toLowerCase()] ?? 'IPAsset',
    eventName: row.event_name,
    args,
    blockNumber: BigInt(row.block_number),
    transactionHash: row.tx_hash,
    blockTimestamp: row.block_timestamp ?? undefined,
  }
}

/** Explorer events with an optional contract filter. */
export function useIndexedExplorerEvents(
  contractFilter: 'all' | 'IPAsset' | 'LicenseToken' | 'Marketplace' | 'Arbitrator' = 'all',
  limit = 100,
  enabled = true,
) {
  const contractAddress = contractFilter === 'all'
    ? undefined
    : contractFilter === 'Arbitrator'
      ? CONTRACT_ADDRESSES.GovernanceArbitrator
      : CONTRACT_ADDRESSES[contractFilter]

  const queryPath = contractAddress
    ? `/api/events?contract=${contractAddress}&limit=${limit}`
    : `/api/events?limit=${limit}`

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['indexed-explorer-events', contractFilter, limit],
    queryFn: () => fetchIndexer<PaginatedResponse<IndexerEventRow>>(queryPath),
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

  const events: ContractEvent[] = data?.data?.map(mapExplorerEvent) ?? []
  return { events, isLoading, error: error as Error | null, refetch }
}

// ── Per-IP revenue (PaymentDistributed aggregation from RevenueDistributor) ──

export interface IPRevenueData {
  ipAssetId: number
  totalRevenue: string
  royaltyBps: number
  paymentCount: number
  payments: Array<{
    amount: string
    seller: string
    isPrimarySale: boolean
    blockNumber: number
    txHash: string
    blockTimestamp: string | null
  }>
  splits: { recipients: string[]; shares: string[] } | null
}

export function useIPRevenue(ipAssetId?: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['indexed-revenue', ipAssetId],
    queryFn: () =>
      fetchIndexer<IPRevenueData>(`/api/revenue/${ipAssetId}`),
    enabled: ipAssetId !== undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  return {
    totalRevenue: data?.totalRevenue ?? '0',
    royaltyBps: data?.royaltyBps ?? 0,
    paymentCount: data?.paymentCount ?? 0,
    payments: data?.payments ?? [],
    splits: data?.splits ?? null,
    isLoading,
  }
}

/**
 * Returns total revenue by IP asset using the same query keys as useIPRevenue.
 */
export function useIPRevenueMap(ipAssetIds: number[]): Record<number, string> {
  const results = useQueries({
    queries: ipAssetIds.map((id) => ({
      queryKey: ['indexed-revenue', id],
      queryFn: () => fetchIndexer<IPRevenueData>(`/api/revenue/${id}`),
      enabled: Number.isFinite(id),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    })),
  })
  const map: Record<number, string> = {}
  ipAssetIds.forEach((id, i) => {
    map[id] = results[i]?.data?.totalRevenue ?? '0'
  })
  return map
}

// ── Invalidation helper for optimistic updates ──

/**
 * Returns a function that invalidates all indexed query caches.
 * Call after a successful write transaction to trigger re-fetches.
 */
export function useInvalidateIndexedQueries() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['indexed-assets'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-licenses'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-held-licenses'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-all-licenses'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-listings'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-user-listings'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-user-offers'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-received-offers'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-user-disputes'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-all-disputes'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-disputes-by-license'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-events'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-explorer-events'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-txs'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-revenue'] })
    queryClient.invalidateQueries({ queryKey: ['indexed-withdrawals'] })
  }, [queryClient])
}
