/**
 * Receipt-derived records shown until the indexer returns the corresponding
 * entity. Only event fields are populated, records are marked `isOptimistic`,
 * and they remain session-scoped.
 */

import { decodeEventLog, type Abi } from 'viem'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'

/** Minimal log shape — only the fields decodeEventLog needs. */
export interface MinimalLog {
  address: string
  topics: unknown
  data: string
}

export interface OptimisticAsset {
  tokenId: bigint
  owner: string
  metadataURI: string
  isOptimistic: true
  optimisticAt: number
}

export interface OptimisticLicense {
  licenseId: bigint
  ipAssetId: bigint
  licensee: string
  supply?: bigint
  isExclusive?: boolean
  paymentInterval?: bigint
  isOptimistic: true
  optimisticAt: number
}

export interface OptimisticListing {
  listingId: string
  seller: string
  nftContract: string
  tokenId: bigint
  price: bigint
  isERC721: boolean
  isOptimistic: true
  optimisticAt: number
}

export interface OptimisticDispute {
  disputeId: bigint
  submitter: string
  /** targetId from the event — maps to ipAssetId or licenseId depending on disputeType. */
  targetId: bigint
  disputeType: number
  reason: string
  status: number
  isOptimistic: true
  optimisticAt: number
}

export type OptimisticEntity =
  | OptimisticAsset
  | OptimisticLicense
  | OptimisticListing
  | OptimisticDispute

export type OptimisticKind = 'asset' | 'license' | 'listing' | 'dispute'

/** Prepend optimistic records that are not already present in indexed data. */
export function mergeOptimistic<T>(
  indexed: readonly T[],
  optimistic: readonly T[],
  keyFn: (item: T) => string | number,
): T[] {
  const indexedKeys = new Set(indexed.map(keyFn))
  const newOptimistic = optimistic.filter((o) => !indexedKeys.has(keyFn(o)))
  return [...newOptimistic, ...indexed]
}

/**
 * Decode a transaction receipt's logs into optimistic entities.
 * Returns only the entities whose events were found; absent event types
 * contribute nothing (e.g. a license-mint receipt has no ListingCreated log).
 */
export function decodeOptimisticEntities(
  logs: readonly MinimalLog[],
  abis: {
    IPAsset: Abi
    LicenseToken: Abi
    Marketplace: Abi
    GovernanceArbitrator: Abi
  },
): {
  assets: OptimisticAsset[]
  licenses: OptimisticLicense[]
  listings: OptimisticListing[]
  disputes: OptimisticDispute[]
} {
  const now = Date.now()
  const assets: OptimisticAsset[] = []
  const licenses: OptimisticLicense[] = []
  const listings: OptimisticListing[] = []
  const disputes: OptimisticDispute[] = []

  const upsertLicense = (next: OptimisticLicense) => {
    const existing = licenses.find((item) => item.licenseId === next.licenseId)
    if (!existing) {
      licenses.push(next)
      return
    }
    existing.ipAssetId = next.ipAssetId
    if (next.licensee) existing.licensee = next.licensee
    if (next.supply !== undefined) existing.supply = next.supply
    if (next.isExclusive !== undefined) existing.isExclusive = next.isExclusive
    if (next.paymentInterval !== undefined) existing.paymentInterval = next.paymentInterval
  }

  for (const log of logs) {
    // IPAsset.IPMinted / LicenseRegistered events
    if (log.address.toLowerCase() === CONTRACT_ADDRESSES.IPAsset.toLowerCase()) {
      try {
        const decoded = decodeEventLog({
          abi: abis.IPAsset,
          data: log.data as `0x${string}`,
          topics: log.topics as `0x${string}`[] as never,
        })
        if (decoded.eventName === 'IPMinted') {
          const args = decoded.args as { tokenId?: bigint; to?: string; owner?: string; metadataURI?: string }
          const tokenId = args.tokenId
          if (tokenId !== undefined) {
            assets.push({
              tokenId,
              owner: args.to ?? args.owner ?? '',
              metadataURI: args.metadataURI ?? '',
              isOptimistic: true,
              optimisticAt: now,
            })
          }
        }
        if (decoded.eventName === 'LicenseMinted' || decoded.eventName === 'LicenseRegistered') {
          const args = decoded.args as {
            licenseId?: bigint
            ipTokenId?: bigint
            licensee?: string
            supply?: bigint
            isExclusive?: boolean
          }
          const licenseId = args.licenseId
          const ipAssetId = args.ipTokenId
          if (licenseId !== undefined && ipAssetId !== undefined) {
            upsertLicense({
              licenseId,
              ipAssetId,
              licensee: args.licensee ?? '',
              supply: args.supply,
              isExclusive: args.isExclusive,
              isOptimistic: true,
              optimisticAt: now,
            })
          }
        }
      } catch {
        /* not a known event — skip */
      }
    }

    // LicenseToken.LicenseCreated
    if (log.address.toLowerCase() === CONTRACT_ADDRESSES.LicenseToken.toLowerCase()) {
      try {
        const decoded = decodeEventLog({
          abi: abis.LicenseToken,
          data: log.data as `0x${string}`,
          topics: log.topics as `0x${string}`[] as never,
        })
        if (decoded.eventName === 'LicenseCreated') {
          const args = decoded.args as {
            licenseId?: bigint
            ipAssetId?: bigint
            licensee?: string
            isExclusive?: boolean
            paymentInterval?: bigint
          }
          const licenseId = args.licenseId
          const ipAssetId = args.ipAssetId
          if (licenseId !== undefined && ipAssetId !== undefined) {
            upsertLicense({
              licenseId,
              ipAssetId,
              licensee: args.licensee ?? '',
              isExclusive: args.isExclusive,
              paymentInterval: args.paymentInterval,
              isOptimistic: true,
              optimisticAt: now,
            })
          }
        }
      } catch {
        /* skip */
      }
    }

    // Marketplace.ListingCreated
    if (log.address.toLowerCase() === CONTRACT_ADDRESSES.Marketplace.toLowerCase()) {
      try {
        const decoded = decodeEventLog({
          abi: abis.Marketplace,
          data: log.data as `0x${string}`,
          topics: log.topics as `0x${string}`[] as never,
        })
        if (decoded.eventName === 'ListingCreated') {
          const args = decoded.args as { listingId?: string; seller?: string; nftContract?: string; tokenId?: bigint; price?: bigint; isERC721?: boolean }
          if (args.listingId !== undefined && args.seller !== undefined) {
            listings.push({
              listingId: args.listingId,
              seller: args.seller,
              nftContract: args.nftContract ?? '',
              tokenId: args.tokenId ?? 0n,
              price: args.price ?? 0n,
              isERC721:
                (args.nftContract ?? '').toLowerCase()
                === CONTRACT_ADDRESSES.IPAsset.toLowerCase(),
              isOptimistic: true,
              optimisticAt: now,
            })
          }
        }
      } catch {
        /* skip */
      }
    }

    // GovernanceArbitrator.DisputeSubmitted
    if (log.address.toLowerCase() === CONTRACT_ADDRESSES.GovernanceArbitrator.toLowerCase()) {
      try {
        const decoded = decodeEventLog({
          abi: abis.GovernanceArbitrator,
          data: log.data as `0x${string}`,
          topics: log.topics as `0x${string}`[] as never,
        })
        if (decoded.eventName === 'DisputeSubmitted') {
          const args = decoded.args as { disputeId?: bigint; targetId?: bigint; disputeType?: number; submitter?: string; reason?: string }
          if (args.disputeId !== undefined) {
            disputes.push({
              disputeId: args.disputeId,
              submitter: args.submitter ?? '',
              targetId: args.targetId ?? 0n,
              disputeType: args.disputeType ?? 0,
              reason: args.reason ?? '',
              status: 0,
              isOptimistic: true,
              optimisticAt: now,
            })
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  return { assets, licenses, listings, disputes }
}
