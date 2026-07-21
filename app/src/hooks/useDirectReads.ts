/**
 * Direct-chain reads for known identifiers when the indexer is unavailable.
 * Contract state is authoritative, while enriched metadata, history, revenue
 * rollups, and private content remain indexer or backend dependent. Results are
 * tagged `chain-direct-partial` so detail pages can indicate that distinction.
 */

import { useQuery } from '@tanstack/react-query'
import { usePapi } from '@/contexts/papi-context'
import { reviveApiCall } from '@/hooks/useReviveApiCall'
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts'
import type { DataState } from '@/lib/data-state'

// ── Asset ──

export interface DirectAsset {
  tokenId: bigint
  owner: string
  metadataURI: string
  activeLicenseCount: bigint
  hasActiveDispute: boolean
  // Enriched display fields require an IPFS fetch and may remain undefined.
  title: string
  imageUrl?: string
  dataState: DataState
}

/**
 * Read an IP asset's current state directly from the chain by tokenId.
 * Works without the indexer. Title/image are absent (IPFS fetch not included).
 */
export function useDirectAsset(tokenId?: bigint, enabled = true) {
  const { api, isReady } = usePapi()

  const { data, isLoading, error } = useQuery<DirectAsset | null, Error>({
    queryKey: ['direct-asset', tokenId?.toString()],
    queryFn: async () => {
      if (!api) throw new Error('PAPI client not ready')
      if (tokenId === undefined) return null

      // Read the 4 authoritative fields in parallel. Fail the fallback if any
      // read fails: substituting false/zero would turn "unknown" into a false
      // claim about dispute or license state.
      const [owner, metadataURI, activeLicenseCount, hasActiveDispute] = await Promise.all([
        reviveApiCall(api, {
          contractAddress: CONTRACT_ADDRESSES.IPAsset,
          abi: ABIS.IPAsset,
          functionName: 'ownerOf',
          args: [tokenId],
        }),
        reviveApiCall(api, {
          contractAddress: CONTRACT_ADDRESSES.IPAsset,
          abi: ABIS.IPAsset,
          functionName: 'tokenURI',
          args: [tokenId],
        }),
        reviveApiCall(api, {
          contractAddress: CONTRACT_ADDRESSES.IPAsset,
          abi: ABIS.IPAsset,
          functionName: 'activeLicenseCount',
          args: [tokenId],
        }),
        reviveApiCall(api, {
          contractAddress: CONTRACT_ADDRESSES.IPAsset,
          abi: ABIS.IPAsset,
          functionName: 'hasActiveDispute',
          args: [tokenId],
        }),
      ])

      return {
        tokenId,
        owner: owner as string,
        metadataURI: metadataURI as string,
        activeLicenseCount: activeLicenseCount as bigint,
        hasActiveDispute: hasActiveDispute as boolean,
        title: `IP Asset #${tokenId.toString()}`,
        dataState: 'chain-direct-partial' as DataState,
      }
    },
    enabled: enabled && isReady && !!api && tokenId !== undefined,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: 1,
  })

  return { asset: data ?? null, isLoading, error }
}

// ── License ──

export interface DirectLicense {
  licenseId: bigint
  ipAssetId: bigint
  supply: bigint
  expiryTime: bigint
  terms: string
  paymentInterval: bigint
  isExclusive: boolean
  isRevoked: boolean
  isExpired: boolean
  title: string
  dataState: DataState
}

export function useDirectLicense(licenseId?: bigint, enabled = true) {
  const { api, isReady } = usePapi()

  const { data, isLoading, error } = useQuery<DirectLicense | null, Error>({
    queryKey: ['direct-license', licenseId?.toString()],
    queryFn: async () => {
      if (!api) throw new Error('PAPI client not ready')
      if (licenseId === undefined) return null

      const info = await reviveApiCall(api, {
        contractAddress: CONTRACT_ADDRESSES.LicenseToken,
        abi: ABIS.LicenseToken,
        functionName: 'getLicenseInfo',
        args: [licenseId],
      }) as [bigint, bigint, bigint, string, bigint, boolean, boolean, boolean]

      const [ipAssetId, supply, expiryTime, terms, paymentInterval, isExclusive, isRevoked, isExpiredStatus] = info

      if (supply === 0n) return null

      return {
        licenseId,
        ipAssetId,
        supply,
        expiryTime,
        terms,
        paymentInterval,
        isExclusive,
        isRevoked,
        isExpired: isExpiredStatus,
        title: `License #${licenseId.toString()}`,
        dataState: 'chain-direct-partial' as DataState,
      }
    },
    enabled: enabled && isReady && !!api && licenseId !== undefined,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: 1,
  })

  return { license: data ?? null, isLoading, error }
}

// ── Listing ──

export interface DirectListing {
  listingId: string
  seller: string
  nftContract: string
  tokenId: bigint
  price: bigint
  isActive: boolean
  isERC721: boolean
  title: string
  dataState: DataState
}

export function useDirectListing(listingId?: string, enabled = true) {
  const { api, isReady } = usePapi()

  const { data, isLoading, error } = useQuery<DirectListing | null, Error>({
    queryKey: ['direct-listing', listingId],
    queryFn: async () => {
      if (!api) throw new Error('PAPI client not ready')
      if (!listingId) return null

      const info = await reviveApiCall(api, {
        contractAddress: CONTRACT_ADDRESSES.Marketplace,
        abi: ABIS.Marketplace,
        functionName: 'listings',
        args: [listingId as `0x${string}`],
      }) as [string, string, bigint, bigint, boolean, boolean]

      const [seller, nftContract, tokenId, price, isActive, isERC721] = info

      // A listing with a zero seller address doesn't exist.
      if (seller === '0x0000000000000000000000000000000000000000') return null

      return {
        listingId,
        seller,
        nftContract,
        tokenId,
        price,
        isActive,
        isERC721,
        title: `Token #${tokenId.toString()}`,
        dataState: 'chain-direct-partial' as DataState,
      }
    },
    enabled: enabled && isReady && !!api && !!listingId,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: 1,
  })

  return { listing: data ?? null, isLoading, error }
}

// ── Dispute ──

export interface DirectDispute {
  disputeId: bigint
  disputeType: number
  ipAssetId: bigint
  licenseId: bigint
  submitter: string
  ipOwner: string
  awardRecipient: string
  status: number
  submittedAt: bigint
  resolvedAt: bigint
  bondAmount: bigint
  resolver: string
  reason: string
  proofURI: string
  resolutionReason: string
  dataState: DataState
}

export function useDirectDispute(disputeId?: bigint, enabled = true) {
  const { api, isReady } = usePapi()

  const { data, isLoading, error } = useQuery<DirectDispute | null, Error>({
    queryKey: ['direct-dispute', disputeId?.toString()],
    queryFn: async () => {
      if (!api) throw new Error('PAPI client not ready')
      if (disputeId === undefined) return null

      const result = await reviveApiCall(api, {
        contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
        abi: ABIS.GovernanceArbitrator,
        functionName: 'getDispute',
        args: [disputeId],
      }) as { disputeType: number; ipAssetId: bigint; licenseId: bigint; submitter: string;
              ipOwner: string; awardRecipient: string; status: number; submittedAt: bigint;
              resolvedAt: bigint; bondAmount: bigint; resolver: string; reason: string;
              proofURI: string; resolutionReason: string }

      const d = result

      return {
        disputeId,
        disputeType: d.disputeType,
        ipAssetId: d.ipAssetId,
        licenseId: d.licenseId,
        submitter: d.submitter,
        ipOwner: d.ipOwner,
        awardRecipient: d.awardRecipient,
        status: d.status,
        submittedAt: d.submittedAt,
        resolvedAt: d.resolvedAt,
        bondAmount: d.bondAmount,
        resolver: d.resolver,
        reason: d.reason,
        proofURI: d.proofURI,
        resolutionReason: d.resolutionReason,
        dataState: 'chain-direct-partial' as DataState,
      }
    },
    enabled: enabled && isReady && !!api && disputeId !== undefined,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: 1,
  })

  return { dispute: data ?? null, isLoading, error }
}
