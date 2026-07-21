import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { keccak256, toHex } from 'viem'
import { useContractWrite } from '@/hooks/useContractWrite'
import { useReviveApiCall } from '@/hooks/useReviveApiCall'
import { useOptimisticOnReceipt } from '@/hooks/useOptimisticOnReceipt'
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts'
import { ipfsToHttp } from '@/lib/ipfs-storage'

// ============ Role Constants ============

export type ContractName = 'IPAsset' | 'LicenseToken' | 'Marketplace' | 'GovernanceArbitrator' | 'RevenueDistributor'

export const ARBITRATOR_ROLE = keccak256(toHex('ARBITRATOR_ROLE'))

export function useHasRole(contract: ContractName, role: `0x${string}`, account?: `0x${string}`) {
  return useReviveApiCall<typeof ABIS[ContractName], boolean>({
    contractAddress: CONTRACT_ADDRESSES[contract],
    abi: ABIS[contract],
    functionName: 'hasRole',
    args: account ? [role, account] : [],
    enabled: !!account,
  })
}

// ============ localStorage helpers for Marketplace IDs ============
// Polkadot Hub RPC doesn't index historical events (eth_getLogs returns empty),
// so we track listing/offer IDs in localStorage when transactions are created.

const LISTING_IDS_KEY = 'softlaw_listing_ids'
const OFFER_IDS_KEY = 'softlaw_offer_ids'

function getStoredIds(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch { return [] }
}

function storeId(key: string, id: string) {
  const ids = getStoredIds(key)
  if (!ids.includes(id)) {
    ids.push(id)
    localStorage.setItem(key, JSON.stringify(ids))
  }
}

// ============ IPAsset Hooks ============

export function useMintIP() {
  const { writeContractAsync, data: hash, isPending, error: writeError, reset } = useContractWrite()
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const [submitError, setSubmitError] = useState<Error | null>(null)

  useOptimisticOnReceipt(isSuccess, receipt)

  const mintIP = async (to: `0x${string}`, metadataURI: string) => {
    setSubmitError(null)
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.IPAsset,
        abi: ABIS.IPAsset,
        functionName: 'mintIP',
        args: [to, metadataURI],
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err : new Error('Failed to mint IP'))
      throw err
    }
  }

  const error = submitError || writeError

  return { mintIP, hash, receipt, isPending, isConfirming, isSuccess, error, reset }
}

export function useWrapNFT() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const wrapNFT = async (nftContract: `0x${string}`, nftTokenId: bigint, metadataURI: string) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'wrapNFT',
      args: [nftContract, nftTokenId, metadataURI],
    })
  }

  return { wrapNFT, hash, isPending, isConfirming, isSuccess, error }
}

export function useUnwrapNFT() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const unwrapNFT = async (tokenId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'unwrapNFT',
      args: [tokenId],
    })
  }

  return { unwrapNFT, hash, isPending, isConfirming, isSuccess, error }
}

export function useUpdateMetadata() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const updateMetadata = async (tokenId: bigint, newURI: string) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'updateMetadata',
      args: [tokenId, newURI],
    })
  }

  return { updateMetadata, hash, isPending, isConfirming, isSuccess, error }
}

export function useConfigureRevenueSplit() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const configureRevenueSplit = async (tokenId: bigint, recipients: `0x${string}`[], shares: bigint[]) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'configureRevenueSplit',
      args: [tokenId, recipients, shares],
    })
  }

  return { configureRevenueSplit, hash, isPending, isConfirming, isSuccess, error }
}

export function useSetRoyaltyRate() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const setRoyaltyRate = async (tokenId: bigint, basisPoints: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'setRoyaltyRate',
      args: [tokenId, basisPoints],
    })
  }

  return { setRoyaltyRate, hash, isPending, isConfirming, isSuccess, error }
}

export function useSetPrivateMetadata() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const setPrivateMetadata = async (tokenId: bigint, metadata: string) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'setPrivateMetadata',
      args: [tokenId, metadata],
    })
  }

  return { setPrivateMetadata, hash, isPending, isConfirming, isSuccess, error }
}

export function useGrantPrivateAccessIP() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const grantPrivateAccessIP = async (ipAssetId: bigint, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'grantPrivateAccess',
      args: [ipAssetId, account],
    })
  }

  return { grantPrivateAccessIP, hash, isPending, isConfirming, isSuccess, error }
}

export function useRevokePrivateAccessIP() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const revokePrivateAccessIP = async (ipAssetId: bigint, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'revokePrivateAccess',
      args: [ipAssetId, account],
    })
  }

  return { revokePrivateAccessIP, hash, isPending, isConfirming, isSuccess, error }
}

export function useBurnIP() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const burnIP = async (tokenId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'burn',
      args: [tokenId],
    })
  }

  return { burnIP, hash, isPending, isConfirming, isSuccess, error }
}

// Get the balance of IP assets for an address (ERC-721 balanceOf)
// ============ LicenseToken Hooks ============

/**
 * Defaults applied by LicenseToken when IPAsset mints with zero-valued penalty
 * and missed-payment parameters.
 */
export const DEFAULT_PENALTY_RATE_BPS = 500 // 5% per 30 overdue days — LicenseToken default
export const DEFAULT_MAX_MISSED_PAYMENTS = 3  // LicenseToken default

export function useMintLicense() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useOptimisticOnReceipt(isSuccess, receipt)

  // The IPAsset wrapper supplies LicenseToken's default penalty parameters.
  const mintLicense = async (
    ipTokenId: bigint,
    licensee: `0x${string}`,
    supply: bigint,
    publicMetadataURI: string,
    privateMetadataURI: string,
    expiryTime: bigint,
    terms: string,
    isExclusive: boolean,
    paymentInterval: bigint,
  ) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'mintLicense',
      args: [ipTokenId, licensee, supply, publicMetadataURI, privateMetadataURI, expiryTime, terms, isExclusive, paymentInterval],
    })
  }

  return { mintLicense, hash, isPending, isConfirming, isSuccess, error }
}

export function useRevokeForMissedPayments() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const revokeForMissedPayments = async (licenseId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'revokeForMissedPayments',
      args: [licenseId],
    })
  }

  return { revokeForMissedPayments, hash, isPending, isConfirming, isSuccess, error }
}

export function useMarkExpired() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const markExpired = async (licenseId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'markExpired',
      args: [licenseId],
    })
  }

  return { markExpired, hash, isPending, isConfirming, isSuccess, error }
}

export function useGrantPrivateAccess() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const grantPrivateAccess = async (licenseId: bigint, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'grantPrivateAccess',
      args: [licenseId, account],
    })
  }

  return { grantPrivateAccess, hash, isPending, isConfirming, isSuccess, error }
}

export function useRevokePrivateAccess() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const revokePrivateAccess = async (licenseId: bigint, account: `0x${string}`) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'revokePrivateAccess',
      args: [licenseId, account],
    })
  }

  return { revokePrivateAccess, hash, isPending, isConfirming, isSuccess, error }
}

export function useSetLicensePenaltyRate() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const setPenaltyRate = async (licenseId: bigint, penaltyRateBPS: number) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'setPenaltyRate',
      args: [licenseId, penaltyRateBPS],
    })
  }

  return { setPenaltyRate, hash, isPending, isConfirming, isSuccess, error }
}

// ============ Marketplace Hooks ============

export function useCreateListing() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useOptimisticOnReceipt(isSuccess, receipt)

  // Save listing ID to localStorage when tx confirms
  useEffect(() => {
    if (receipt) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === CONTRACT_ADDRESSES.Marketplace.toLowerCase() && log.topics[1]) {
          storeId(LISTING_IDS_KEY, log.topics[1])
          break
        }
      }
    }
  }, [receipt])

  const createListing = async (nftContract: `0x${string}`, tokenId: bigint, price: bigint, isERC721: boolean, opts?: { chainedAfterApproval?: boolean }) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'createListing',
      args: [nftContract, tokenId, price, isERC721],
      // When fired right after setApprovalForAll's hash (receipt not yet
      // mined), the estimate reverts against pre-approval state — keep the
      // floor-gas fallback so inclusion order resolves it.
      estimateRevertFallsBack: opts?.chainedAfterApproval,
    })
  }

  return { createListing, hash, isPending, isConfirming, isSuccess, error }
}

export function useBuyListing() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const buyListing = async (listingId: `0x${string}`, price: bigint) => {

    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'buyListing',
      args: [listingId],
      value: price,
    })
  }

  return { buyListing, hash, isPending, isConfirming, isSuccess, isError, error }
}

export function useCancelListing() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const cancelListing = async (listingId: `0x${string}`) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'cancelListing',
      args: [listingId],
    })
  }

  return { cancelListing, hash, isPending, isConfirming, isSuccess, isError, error }
}

export function useCreateOffer() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { data: receipt, isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  // Save offer ID to localStorage when tx confirms
  useEffect(() => {
    if (receipt) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === CONTRACT_ADDRESSES.Marketplace.toLowerCase() && log.topics[1]) {
          storeId(OFFER_IDS_KEY, log.topics[1])
          break
        }
      }
    }
  }, [receipt])

  const createOffer = async (nftContract: `0x${string}`, tokenId: bigint, expiryTime: bigint, price: bigint) => {

    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'createOffer',
      args: [nftContract, tokenId, expiryTime],
      value: price,
    })
  }

  return { createOffer, hash, isPending, isConfirming, isSuccess, isError, error }
}

export function useAcceptOffer() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const acceptOffer = async (offerId: `0x${string}`) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'acceptOffer',
      args: [offerId],
    })
  }

  return { acceptOffer, hash, isPending, isConfirming, isSuccess, isError, error }
}

export function useCancelOffer() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const cancelOffer = async (offerId: `0x${string}`) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'cancelOffer',
      args: [offerId],
    })
  }

  return { cancelOffer, hash, isPending, isConfirming, isSuccess, isError, error }
}

export function useMakeRecurringPayment() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransactionReceipt({ hash })

  const makeRecurringPayment = async (licenseContract: `0x${string}`, licenseId: bigint, amount: bigint) => {

    return writeContractAsync({
      address: CONTRACT_ADDRESSES.Marketplace,
      abi: ABIS.Marketplace,
      functionName: 'makeRecurringPayment',
      args: [licenseContract, licenseId],
      value: amount,
    })
  }

  return { makeRecurringPayment, hash, isPending, isConfirming, isSuccess, isError, error }
}

export function useGetTotalPaymentDue(
  licenseContract: `0x${string}`,
  licenseId: bigint,
  opts?: { enabled?: boolean },
) {
  // Returns (baseAmount, penalty, total). Multi-output ABI calls decode as a
  // tuple — consumers must destructure rather than treating the value as bigint.
  return useReviveApiCall<typeof ABIS.Marketplace, readonly [bigint, bigint, bigint]>({
    contractAddress: CONTRACT_ADDRESSES.Marketplace,
    abi: ABIS.Marketplace,
    functionName: 'getTotalPaymentDue',
    args: [licenseContract, licenseId],
    enabled: opts?.enabled,
  })
}

export function useGetMissedPayments(
  licenseContract: `0x${string}`,
  licenseId: bigint,
  opts?: { enabled?: boolean },
) {
  return useReviveApiCall<typeof ABIS.Marketplace, bigint>({
    contractAddress: CONTRACT_ADDRESSES.Marketplace,
    abi: ABIS.Marketplace,
    functionName: 'getMissedPayments',
    args: [licenseContract, licenseId],
    enabled: opts?.enabled,
  })
}

// ============ RevenueDistributor Hooks ============

/**
 * Live platform fee in basis points (e.g. 250 = 2.5%). Admin-settable via
 * RevenueDistributor.setPlatformFee (capped at 10%). That setter emits NO
 * event, so the indexer cannot materialize fee changes. The listing modal
 * reads it live for fee and net-proceeds estimates.
 */
export function usePlatformFee() {
  return useReviveApiCall<typeof ABIS.RevenueDistributor, bigint>({
    contractAddress: CONTRACT_ADDRESSES.RevenueDistributor,
    abi: ABIS.RevenueDistributor,
    functionName: 'platformFeeBasisPoints',
    args: [],
  })
}

// ── Paused state ─────────────────────────────────────────────────────────────

/**
 * Contracts included in the application-wide paused-state read.
 */
const PAUSED_CONTRACTS = [
  'IPAsset',
  'LicenseToken',
  'Marketplace',
  'GovernanceArbitrator',
  'RevenueDistributor',
] as const satisfies readonly ContractName[]

export function useIsPaused(): {
  paused: Record<ContractName, boolean | undefined>
  anyPaused: boolean
  isLoading: boolean
} {
  const publicClient = usePublicClient()

  // Five parallel reads; each is its own React Query entry so the result
  // survives per-component remounts and is independently cacheable.
  const queries = useQueries({
    queries: PAUSED_CONTRACTS.map((contract) => ({
      queryKey: ['paused', contract] as const,
      queryFn: () => {
        // Reuse the publicClient path so the read goes through eth_call
        // (PAPI's ReviveApi.call would also work but would be an extra hop
        // for a single bool). Wagmi is already initialized app-wide.
        const address = CONTRACT_ADDRESSES[contract]
        return publicClient
          ? publicClient.readContract({
              address,
              abi: ABIS[contract],
              functionName: 'paused',
              args: [],
            }) as Promise<boolean>
          : Promise.resolve(false)
      },
      // Cache paused-state reads for one minute.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
      retry: 1,
    })),
  })

  const paused = {} as Record<ContractName, boolean | undefined>
  let anyPaused = false
  PAUSED_CONTRACTS.forEach((c, i) => {
    const v = queries[i]?.data as boolean | undefined
    paused[c] = v
    if (v === true) anyPaused = true
  })

  return {
    paused,
    anyPaused,
    isLoading: queries.some((q) => q.isLoading),
  }
}

/**
 * Live contract-wide default royalty in basis points (e.g. 1000 = 10%).
 * Admin-settable via RevenueDistributor.setDefaultRoyalty. Emits RoyaltyUpdated
 * for later changes, while the initial value has no event and must be read live.
 */
export function useDefaultRoyalty() {
  return useReviveApiCall<typeof ABIS.RevenueDistributor, bigint>({
    contractAddress: CONTRACT_ADDRESSES.RevenueDistributor,
    abi: ABIS.RevenueDistributor,
    functionName: 'defaultRoyaltyBasisPoints',
    args: [],
  })
}

/**
 * Marketplace-wide penalty setting for administrative diagnostics.
 * LicenseToken.getPenaltyRate(licenseId) is the effective payment value.
 */
export function useMarketplacePenaltyRate() {
  return useReviveApiCall<typeof ABIS.Marketplace, bigint>({
    contractAddress: CONTRACT_ADDRESSES.Marketplace,
    abi: ABIS.Marketplace,
    functionName: 'penaltyBasisPointsPerMonth',
    args: [],
  })
}

/**
 * Live effective royalty (basis points) for an IP asset — the exact value
 * RevenueDistributor.distributePayment applies on a secondary sale (asset
 * override, falling back to the default rate). Read live for display; the
 * indexed `ip_assets.royalty_bps` is supplementary provenance that can drift.
 */
export function useAssetRoyalty(ipAssetId: bigint | undefined) {
  return useReviveApiCall<typeof ABIS.RevenueDistributor, bigint>({
    contractAddress: CONTRACT_ADDRESSES.RevenueDistributor,
    abi: ABIS.RevenueDistributor,
    functionName: 'getAssetRoyalty',
    args: ipAssetId !== undefined ? [ipAssetId] : [],
    enabled: ipAssetId !== undefined,
  })
}

// ============ GovernanceArbitrator Hooks ============

export function useDisputeBond() {
  return useReviveApiCall<typeof ABIS.GovernanceArbitrator, bigint>({
    contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
    abi: ABIS.GovernanceArbitrator,
    functionName: 'disputeBond',
    args: [],
  })
}

export function useSubmitDispute() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useOptimisticOnReceipt(isSuccess, receipt)

  // disputeType: 0 = License dispute, 1 = IP dispute
  const submitDispute = async (
    targetId: bigint,
    disputeType: bigint,
    reason: string,
    proofURI: string,
    bondValue: bigint,
  ) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.GovernanceArbitrator,
      abi: ABIS.GovernanceArbitrator,
      functionName: 'submitDispute',
      args: [targetId, disputeType, reason, proofURI],
      value: bondValue,
    })
  }

  return { submitDispute, hash, isPending, isConfirming, isSuccess, error }
}

export function useExecuteAward() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const executeAward = async (disputeId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GovernanceArbitrator,
      abi: ABIS.GovernanceArbitrator,
      functionName: 'executeAward',
      args: [disputeId],
    })
  }

  return { executeAward, hash, isPending, isConfirming, isSuccess, error }
}

export function useResolveDispute() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const resolveDispute = async (
    disputeId: bigint,
    approve: boolean,
    awardRecipient: `0x${string}`,
    resolutionReason: string,
  ) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GovernanceArbitrator,
      abi: ABIS.GovernanceArbitrator,
      functionName: 'resolveDispute',
      args: [disputeId, approve, awardRecipient, resolutionReason],
    })
  }

  return { resolveDispute, hash, isPending, isConfirming, isSuccess, error }
}

export function useGetDispute(
  disputeId: bigint,
  opts?: { staleTime?: number; refetchInterval?: number | false; enabled?: boolean },
) {
  // getDispute returns a single Dispute tuple; viem decodes named tuples as objects
  return useReviveApiCall<typeof ABIS.GovernanceArbitrator, {
    licenseId: bigint
    submitter: `0x${string}`
    ipOwner: `0x${string}`
    reason: string
    proofURI: string
    status: number
    submittedAt: bigint
    resolvedAt: bigint
    resolver: `0x${string}`
    resolutionReason: string
  }>({
    contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
    abi: ABIS.GovernanceArbitrator,
    functionName: 'getDispute',
    args: [disputeId],
    staleTime: opts?.staleTime,
    refetchInterval: opts?.refetchInterval,
    enabled: opts?.enabled,
  })
}

export function useIsDisputeOverdue(disputeId: bigint, opts?: { enabled?: boolean }) {
  return useReviveApiCall<typeof ABIS.GovernanceArbitrator, boolean>({
    contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
    abi: ABIS.GovernanceArbitrator,
    functionName: 'isDisputeOverdue',
    args: [disputeId],
    enabled: opts?.enabled,
  })
}

export function useGetTimeRemaining(disputeId: bigint, opts?: { enabled?: boolean }) {
  return useReviveApiCall<typeof ABIS.GovernanceArbitrator, bigint>({
    contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
    abi: ABIS.GovernanceArbitrator,
    functionName: 'getTimeRemaining',
    args: [disputeId],
    enabled: opts?.enabled,
  })
}

// ============ RevenueDistributor Hooks ============

export function useWithdrawRevenue() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const withdrawRevenue = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.RevenueDistributor,
      abi: ABIS.RevenueDistributor,
      functionName: 'withdraw',
    })
  }

  return { withdrawRevenue, hash, isPending, isConfirming, isSuccess, error }
}

export function useGetRevenueBalance(recipient?: `0x${string}`) {
  return useReviveApiCall<typeof ABIS.RevenueDistributor, bigint>({
    contractAddress: CONTRACT_ADDRESSES.RevenueDistributor,
    abi: ABIS.RevenueDistributor,
    functionName: 'getBalance',
    args: recipient ? [recipient] : [],
    enabled: !!recipient,
  })
}

export function useGetIPSplits(ipAssetId: bigint) {
  // ipSplits returns [recipients, shares]; consumer at ConfigureRevenueSplitModal
  // casts to a destructured shape so we leave the generic loose here.
  return useReviveApiCall<typeof ABIS.RevenueDistributor, readonly [readonly `0x${string}`[], readonly bigint[]]>({
    contractAddress: CONTRACT_ADDRESSES.RevenueDistributor,
    abi: ABIS.RevenueDistributor,
    functionName: 'ipSplits',
    args: [ipAssetId],
  })
}

// ============ Approval Hooks ============

export function useApproveIPAsset() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = async (to: `0x${string}`, tokenId: bigint) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'approve',
      args: [to, tokenId],
    })
  }

  const setApprovalForAll = async (operator: `0x${string}`, approved: boolean) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'setApprovalForAll',
      args: [operator, approved],
    })
  }

  return { approve, setApprovalForAll, hash, isPending, isConfirming, isSuccess, error }
}

export function useApproveLicenseToken() {
  const { writeContractAsync, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const setApprovalForAll = async (operator: `0x${string}`, approved: boolean) => {
    return writeContractAsync({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'setApprovalForAll',
      args: [operator, approved],
    })
  }

  return { setApprovalForAll, hash, isPending, isConfirming, isSuccess, error }
}

export function useIsApprovedForAll(contract: 'IPAsset' | 'LicenseToken', owner?: `0x${string}`, operator?: `0x${string}`) {
  return useReviveApiCall<typeof ABIS[typeof contract], boolean>({
    contractAddress: CONTRACT_ADDRESSES[contract],
    abi: ABIS[contract],
    functionName: 'isApprovedForAll',
    args: owner && operator ? [owner, operator] : [],
    enabled: !!owner && !!operator,
  })
}

// ============ User Asset Fetching Hooks ============

export interface UserIPAsset {
  tokenId: bigint
  metadataURI: string
  title: string
  description?: string
  category: string
  creator?: string
  imageUrl?: string
  /** animation_url (musical/audiovisual) or IPFS-resolved external_url
   *  (literary/dramatic/software) — non-image works don't populate imageUrl. */
  animationUrl?: string
  /** IPFS CID of encrypted private content attached by the IP owner. Decrypted
   *  via /api/content/asset/decrypt after a live owner/grant/license check. */
  privateContentCid?: string
  owner?: string
  activeLicenseCount: bigint
  hasActiveDispute: boolean
  royaltyBps?: number
  isInvalidated?: boolean
  wrappedNftStuck?: boolean
  /** Block number where the IP was minted (from indexer ip_assets row). */
  blockNumber?: bigint
  /** Tx hash of the mint (from indexer ip_assets row). */
  txHash?: string
  /** Receipt-derived placeholder shown until the indexer supplies the full row. */
  isOptimistic?: boolean
}

// IPFS gateway fallback list — Pinata first (user's own content is fastest from origin)
const IPFS_GATEWAYS = [
  `https://${import.meta.env.VITE_PINATA_GATEWAY}/ipfs/`,
  'https://w3s.link/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
].filter(Boolean)

// Session-scoped IPFS metadata cache — content is immutable, safe to cache indefinitely
const ipfsCache = new Map<string, Record<string, unknown>>()

function extractCID(uri: string): string | null {
  if (uri.startsWith('ipfs://')) return uri.replace('ipfs://', '').replace('ipfs/', '')
  for (const gw of ['gateway.pinata.cloud/ipfs/', 'w3s.link/ipfs/', 'dweb.link/ipfs/', 'ipfs.io/ipfs/']) {
    const idx = uri.indexOf(gw)
    if (idx !== -1) return uri.slice(idx + gw.length)
  }
  return null
}

// Helper: fetch JSON from IPFS — cache hit returns instantly, miss races all gateways
async function fetchIPFSJson(cid: string): Promise<Record<string, unknown> | null> {
  if (ipfsCache.has(cid)) return ipfsCache.get(cid)!
  try {
    const res = await Promise.any(
      IPFS_GATEWAYS.map(gw =>
        fetch(`${gw}${cid}`, { signal: AbortSignal.timeout(8000) })
          .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      )
    )
    ipfsCache.set(cid, res)
    return res
  } catch {
    return null
  }
}

function parseMetadataJson(json: Record<string, unknown>): { title: string; description?: string; category: string; creator?: string; imageUrl?: string } {
  const attrs = json.attributes as Array<{ trait_type: string; value: string }> | undefined
  return {
    title: (json.name as string) || '',
    description: (json.description as string) || undefined,
    category: attrs?.find((a) => a.trait_type === 'Work Type' || a.trait_type === 'Category')?.value || 'IP Asset',
    creator: attrs?.find((a) => a.trait_type === 'Creator')?.value || (json.creator as string) || undefined,
    imageUrl: json.image ? ipfsToHttp(json.image as string) : undefined,
  }
}

// Helper: resolve token metadata from URI
async function resolveTokenMetadata(
  uri: string
): Promise<{ title: string; description?: string; category: string; creator?: string; imageUrl?: string }> {
  const defaults = { title: '', category: 'IP Asset', imageUrl: undefined }
  if (!uri) return defaults

  try {
    // Handle base64-encoded JSON (no network needed)
    if (uri.startsWith('data:application/json;base64,')) {
      const json = JSON.parse(atob(uri.replace('data:application/json;base64,', '')))
      return parseMetadataJson(json)
    }

    // Handle IPFS URIs — use gateway fallback
    const cid = extractCID(uri)
    if (cid) {
      const json = await fetchIPFSJson(cid)
      if (json) return parseMetadataJson(json)
      return defaults
    }

    // Handle plain HTTP URLs (non-IPFS)
    if (uri.startsWith('http')) {
      const res = await fetch(uri, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const json = await res.json()
        return parseMetadataJson(json)
      }
    }
  } catch { /* */ }
  return defaults
}

// Helper: enrich a single token with metadata, license count, dispute status — all in parallel
async function enrichIPAsset(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  tokenId: bigint
): Promise<UserIPAsset> {
  const [uriResult, licenseResult, disputeResult] = await Promise.allSettled([
    publicClient.readContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'tokenURI',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'activeLicenseCount',
      args: [tokenId],
    }),
    publicClient.readContract({
      address: CONTRACT_ADDRESSES.IPAsset,
      abi: ABIS.IPAsset,
      functionName: 'hasActiveDispute',
      args: [tokenId],
    }),
  ])

  let title = `IP Asset #${tokenId.toString()}`
  let description: string | undefined
  let category = 'IP Asset'
  let creator: string | undefined
  let imageUrl: string | undefined
  let metadataURI = ''

  if (uriResult.status === 'fulfilled' && uriResult.value) {
    metadataURI = uriResult.value as string
    const meta = await resolveTokenMetadata(metadataURI)
    if (meta.title) title = meta.title
    if (meta.category) category = meta.category
    description = meta.description
    creator = meta.creator
    imageUrl = meta.imageUrl
  }

  return {
    tokenId,
    metadataURI,
    title,
    description,
    category,
    creator,
    imageUrl,
    activeLicenseCount: licenseResult.status === 'fulfilled' ? licenseResult.value as bigint : 0n,
    hasActiveDispute: disputeResult.status === 'fulfilled' ? disputeResult.value as boolean : false,
  }
}

// Helper: scan sequential token IDs to find all existing IP assets
async function scanIPAssets(
  publicClient: ReturnType<typeof usePublicClient>,
  owner?: `0x${string}`
): Promise<UserIPAsset[]> {
  if (!publicClient) return []

  const assets: UserIPAsset[] = []
  let consecutiveFailures = 0
  const MAX_CONSECUTIVE_FAILURES = 5

  for (let tokenId = 1n; consecutiveFailures < MAX_CONSECUTIVE_FAILURES; tokenId++) {
    try {
      const currentOwner = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.IPAsset,
        abi: ABIS.IPAsset,
        functionName: 'ownerOf',
        args: [tokenId],
      }) as `0x${string}`

      consecutiveFailures = 0

      if (owner && currentOwner.toLowerCase() !== owner.toLowerCase()) continue

      const asset = await enrichIPAsset(publicClient, tokenId)
      assets.push(asset)
    } catch {
      consecutiveFailures++
    }
  }

  return assets
}

export function useUserIPAssets(owner?: `0x${string}`) {
  const publicClient = usePublicClient()

  const { data: assets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['userIPAssets', owner],
    queryFn: () => scanIPAssets(publicClient, owner),
    enabled: !!publicClient && !!owner,
    staleTime: 60_000,       // serve cached data for 1 min before background refresh
    gcTime: 5 * 60_000,      // keep in cache 5 min after unmount
    refetchOnWindowFocus: false,
  })

  return { assets, isLoading, error, refetch }
}

// Helper: scan sequential license IDs to find all existing licenses
async function scanLicenses(
  publicClient: ReturnType<typeof usePublicClient>,
  owner?: `0x${string}`
): Promise<UserLicense[]> {
  if (!publicClient) return []

  const result: UserLicense[] = []
  let consecutiveEmpty = 0
  const MAX_EMPTY = 3 // License IDs are sequential with no gaps, so 3 empties means we're past the end

  for (let licenseId = 1n; consecutiveEmpty < MAX_EMPTY; licenseId++) {
    try {
      const info = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.LicenseToken,
        abi: ABIS.LicenseToken,
        functionName: 'getLicenseInfo',
        args: [licenseId],
      }) as [bigint, bigint, bigint, string, bigint, boolean, boolean, boolean]

      const [ipAssetId, supply, expiryTime, terms, paymentInterval, isExclusive, isRevoked, isExpiredStatus] = info

      if (supply === 0n) {
        consecutiveEmpty++
        continue
      }

      consecutiveEmpty = 0

      // Fetch balance, active status, and metadata in parallel
      const [balanceResult, activeResult, metadataResult] = await Promise.allSettled([
        owner
          ? publicClient.readContract({
              address: CONTRACT_ADDRESSES.LicenseToken,
              abi: ABIS.LicenseToken,
              functionName: 'balanceOf',
              args: [owner, licenseId],
            })
          : Promise.resolve(supply),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.LicenseToken,
          abi: ABIS.LicenseToken,
          functionName: 'isActiveLicense',
          args: [licenseId],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESSES.LicenseToken,
          abi: ABIS.LicenseToken,
          functionName: 'getPublicMetadata',
          args: [licenseId],
        }),
      ])

      const balance = balanceResult.status === 'fulfilled' ? balanceResult.value as bigint : supply
      if (owner && balance === 0n) continue

      const isActive = activeResult.status === 'fulfilled' ? activeResult.value as boolean : false

      let publicMetadataURI = ''
      let title = `License #${licenseId.toString()}`
      if (metadataResult.status === 'fulfilled' && metadataResult.value) {
        publicMetadataURI = metadataResult.value as string
        if (publicMetadataURI) {
          const meta = await resolveTokenMetadata(publicMetadataURI)
          if (meta.title) title = meta.title
        }
      }

      result.push({
        licenseId,
        ipAssetId,
        supply,
        expiryTime,
        terms,
        paymentInterval,
        isExclusive,
        isRevoked,
        isExpired: isExpiredStatus,
        isConcluded: false,
        isActive,
        publicMetadataURI,
        title,
        balance,
      })
    } catch {
      consecutiveEmpty++
    }
  }

  return result
}

// ============ User Listings Hook ============

export function useUserListings(owner?: `0x${string}`) {
  const publicClient = usePublicClient()
  const [listings, setListings] = useState<Array<{
    listingId: `0x${string}`
    nftContract: `0x${string}`
    tokenId: bigint
    price: bigint
    isActive: boolean
    isERC721: boolean
    title: string
  }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchListings = useCallback(async () => {
    if (!publicClient || !owner) return

    setIsLoading(true)
    try {
      // Read listing IDs from localStorage (eth_getLogs doesn't work on Polkadot Hub)
      const storedIds = getStoredIds(LISTING_IDS_KEY)
      const results: typeof listings = []

      for (const id of storedIds) {
        try {
          const listing = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.Marketplace,
            abi: ABIS.Marketplace,
            functionName: 'listings',
            args: [id as `0x${string}`],
          }) as [string, string, bigint, bigint, boolean, boolean]

          const [seller, nftContract, tokenId, price, isActive, isERC721] = listing

          // Filter by owner
          if (seller.toLowerCase() !== owner.toLowerCase()) continue

          // Fetch metadata — use correct ABI/function for ERC-721 vs ERC-1155
          let title = `Token #${tokenId.toString()}`
          try {
            const uri = isERC721
              ? await publicClient.readContract({
                  address: nftContract as `0x${string}`,
                  abi: ABIS.IPAsset,
                  functionName: 'tokenURI',
                  args: [tokenId],
                }) as string
              : await publicClient.readContract({
                  address: nftContract as `0x${string}`,
                  abi: ABIS.LicenseToken,
                  functionName: 'getPublicMetadata',
                  args: [tokenId],
                }) as string
            const meta = await resolveTokenMetadata(uri)
            if (meta.title) title = meta.title
          } catch { /* */ }

          results.push({
            listingId: id as `0x${string}`,
            nftContract: nftContract as `0x${string}`,
            tokenId,
            price,
            isActive,
            isERC721,
            title,
          })
        } catch { /* skip invalid listing IDs */ }
      }

      setListings(results)
    } catch {
      // Silently handle listing fetch errors
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, owner])

  useEffect(() => {
    const timer = window.setTimeout(fetchListings, 0)
    return () => window.clearTimeout(timer)
  }, [fetchListings])

  return { listings, isLoading, refetch: fetchListings }
}

// ============ User Offers Hook ============

export function useUserOffers(owner?: `0x${string}`) {
  const publicClient = usePublicClient()
  const [offers, setOffers] = useState<Array<{
    offerId: `0x${string}`
    buyer: `0x${string}`
    nftContract: `0x${string}`
    tokenId: bigint
    price: bigint
    isActive: boolean
    expiryTime: bigint
  }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchOffers = useCallback(async () => {
    if (!publicClient || !owner) return

    setIsLoading(true)
    try {
      // Read offer IDs from localStorage (eth_getLogs doesn't work on Polkadot Hub)
      const storedIds = getStoredIds(OFFER_IDS_KEY)
      const results: typeof offers = []

      for (const id of storedIds) {
        try {
          const offer = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.Marketplace,
            abi: ABIS.Marketplace,
            functionName: 'offers',
            args: [id as `0x${string}`],
          }) as [string, string, bigint, bigint, boolean, bigint]

          const [buyer, nftContract, tokenId, price, isActive, expiryTime] = offer

          // Filter by owner
          if (buyer.toLowerCase() !== owner.toLowerCase()) continue

          results.push({
            offerId: id as `0x${string}`,
            buyer: buyer as `0x${string}`,
            nftContract: nftContract as `0x${string}`,
            tokenId,
            price,
            isActive,
            expiryTime,
          })
        } catch { /* skip invalid offer IDs */ }
      }

      setOffers(results)
    } catch {
      // Silently handle offer fetch errors
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, owner])

  useEffect(() => {
    const timer = window.setTimeout(fetchOffers, 0)
    return () => window.clearTimeout(timer)
  }, [fetchOffers])

  return { offers, isLoading, refetch: fetchOffers }
}

// ============ User Disputes Hook ============

export function useUserDisputes(owner?: `0x${string}`) {
  const publicClient = usePublicClient()
  const [disputes, setDisputes] = useState<Array<{
    disputeId: bigint
    licenseId: bigint
    reason: string
    status: number
    submittedAt: bigint
  }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchDisputes = useCallback(async () => {
    if (!publicClient || !owner) return

    setIsLoading(true)
    try {
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.GovernanceArbitrator,
        abi: ABIS.GovernanceArbitrator,
        functionName: 'getDisputeCount',
      }) as bigint

      if (count === 0n) { setDisputes([]); return }

      // Fetch all disputes in parallel (Multicall3 not deployed on Polkadot Hub)
      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))
      const results = await Promise.allSettled(
        ids.map(i =>
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.GovernanceArbitrator,
            abi: ABIS.GovernanceArbitrator,
            functionName: 'getDispute',
            args: [i],
          })
        )
      )

      const disputeList = results
        .map((r, idx) => ({ result: r, id: ids[idx] }))
        .filter(({ result }) => result.status === 'fulfilled')
        .map(({ result, id }) => {
          const d = (result as PromiseFulfilledResult<unknown>).value as {
            licenseId: bigint; submitter: string; ipOwner: string; reason: string;
            status: number; submittedAt: bigint;
          }
          return { disputeId: id, ...d }
        })
        .filter(d =>
          d.submitter.toLowerCase() === owner.toLowerCase() ||
          d.ipOwner.toLowerCase() === owner.toLowerCase()
        )
        .map(d => ({
          disputeId: d.disputeId,
          licenseId: d.licenseId,
          reason: d.reason,
          status: d.status,
          submittedAt: d.submittedAt,
        }))

      setDisputes(disputeList)
    } catch {
      // Silently handle dispute fetch errors
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, owner])

  useEffect(() => {
    const timer = window.setTimeout(fetchDisputes, 0)
    return () => window.clearTimeout(timer)
  }, [fetchDisputes])

  return { disputes, isLoading, refetch: fetchDisputes }
}

// ============ User Licenses Hook ============

export interface UserLicense {
  licenseId: bigint
  ipAssetId: bigint
  supply: bigint
  expiryTime: bigint
  terms: string
  paymentInterval: bigint
  isExclusive: boolean
  isRevoked: boolean
  isExpired: boolean
  isConcluded: boolean
  isActive: boolean
  penaltyRateBps?: number
  publicMetadataURI: string
  privateContentCid?: string
  title: string
  balance: bigint
  /** Receipt-derived placeholder shown until the indexer supplies the full row. */
  isOptimistic?: boolean
}

export function useUserLicenses(owner?: `0x${string}`) {
  const publicClient = usePublicClient()

  const { data: licenses = [], isLoading, error, refetch } = useQuery({
    queryKey: ['userLicenses', owner],
    queryFn: () => scanLicenses(publicClient, owner),
    enabled: !!publicClient && !!owner,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  return { licenses, isLoading, error, refetch }
}

// ============ All Licenses Hook (Available) ============

export function useAllLicenses() {
  const publicClient = usePublicClient()
  const [licenses, setLicenses] = useState<Array<{
    licenseId: bigint
    ipAssetId: bigint
    isExclusive: boolean
    paymentInterval: bigint
    expiryTime: bigint
    terms: string
    isActive: boolean
    title: string
  }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchLicenses = useCallback(async () => {
    if (!publicClient) return

    setIsLoading(true)
    setError(null)

    try {
      // Scan all licenses (no owner filter)
      const allLicenses = await scanLicenses(publicClient)

      // Map to the expected shape and sort
      const mapped = allLicenses.map(l => ({
        licenseId: l.licenseId,
        ipAssetId: l.ipAssetId,
        isExclusive: l.isExclusive,
        paymentInterval: l.paymentInterval,
        expiryTime: l.expiryTime,
        terms: l.terms,
        isActive: l.isActive,
        title: l.title,
      }))

      // Sort: active first, then by licenseId descending
      mapped.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1
        return Number(b.licenseId - a.licenseId)
      })

      setLicenses(mapped)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch licenses'))
    } finally {
      setIsLoading(false)
    }
  }, [publicClient])

  useEffect(() => {
    const timer = window.setTimeout(fetchLicenses, 0)
    return () => window.clearTimeout(timer)
  }, [fetchLicenses])

  return { licenses, isLoading, error, refetch: fetchLicenses }
}

// ============ Arbitrator Hooks (used by Dashboard ArbitratorSection) ============

export interface FullDispute {
  disputeId: bigint
  disputeType: number
  ipAssetId: bigint
  licenseId: bigint
  submitter: string
  ipOwner: string
  awardRecipient: string
  reason: string
  proofURI: string
  status: number
  submittedAt: bigint
  resolvedAt: bigint
  bondAmount: bigint
  resolver: string
  resolutionReason: string
  isExpired: boolean
  bondReleased: boolean
}

export function useAllDisputes(enabled = true) {
  const publicClient = usePublicClient()
  const [disputes, setDisputes] = useState<FullDispute[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchDisputes = useCallback(async () => {
    if (!publicClient || !enabled) return

    setIsLoading(true)
    try {
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.GovernanceArbitrator,
        abi: ABIS.GovernanceArbitrator,
        functionName: 'getDisputeCount',
      }) as bigint

      const disputeList: FullDispute[] = []

      for (let i = 1n; i <= count; i++) {
        try {
          const dispute = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.GovernanceArbitrator,
            abi: ABIS.GovernanceArbitrator,
            functionName: 'getDispute',
            args: [i],
          }) as {
            disputeType: number; ipAssetId: bigint; licenseId: bigint; submitter: string;
            ipOwner: string; awardRecipient: string; status: number; submittedAt: bigint;
            resolvedAt: bigint; bondAmount: bigint; resolver: string; reason: string;
            proofURI: string; resolutionReason: string;
          }

          disputeList.push({
            disputeId: i,
            disputeType: dispute.disputeType,
            ipAssetId: dispute.ipAssetId,
            licenseId: dispute.licenseId,
            submitter: dispute.submitter,
            ipOwner: dispute.ipOwner,
            awardRecipient: dispute.awardRecipient,
            reason: dispute.reason,
            proofURI: dispute.proofURI,
            status: dispute.status,
            submittedAt: dispute.submittedAt,
            resolvedAt: dispute.resolvedAt,
            bondAmount: dispute.bondAmount,
            resolver: dispute.resolver,
            resolutionReason: dispute.resolutionReason,
            isExpired: false,
            bondReleased: false,
          })
        } catch { /* skip invalid */ }
      }

      setDisputes(disputeList)
    } catch { /* silently handle */ } finally {
      setIsLoading(false)
    }
  }, [publicClient, enabled])

  useEffect(() => {
    const timer = window.setTimeout(fetchDisputes, 0)
    return () => window.clearTimeout(timer)
  }, [fetchDisputes])

  return { disputes, isLoading, refetch: fetchDisputes }
}

// License revocation is available only through the dispute lifecycle.

export function useConcludeLicense() {
  const { writeContract, data: hash, isPending, error: submitError } = useContractWrite()
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({ hash })
  const error = submitError ?? receiptError

  const concludeLicense = async (licenseId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.LicenseToken,
      abi: ABIS.LicenseToken,
      functionName: 'concludeLicense',
      args: [licenseId],
    })
  }

  return { concludeLicense, hash, isPending, isConfirming, isSuccess, error }
}

export function useClaimExpiredBond() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const claimExpiredBond = async (disputeId: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GovernanceArbitrator,
      abi: ABIS.GovernanceArbitrator,
      functionName: 'claimExpiredBond',
      args: [disputeId],
    })
  }

  return { claimExpiredBond, hash, isPending, isConfirming, isSuccess, error }
}

export function useWithdrawBond() {
  const { writeContract, data: hash, isPending, error } = useContractWrite()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const withdrawBond = async () => {
    return writeContract({
      address: CONTRACT_ADDRESSES.GovernanceArbitrator,
      abi: ABIS.GovernanceArbitrator,
      functionName: 'withdrawBond',
    })
  }

  return { withdrawBond, hash, isPending, isConfirming, isSuccess, error }
}

export function useWithdrawableBond(
  account?: `0x${string}`,
  opts?: { staleTime?: number; refetchInterval?: number | false },
) {
  return useReviveApiCall<typeof ABIS.GovernanceArbitrator, bigint>({
    contractAddress: CONTRACT_ADDRESSES.GovernanceArbitrator,
    abi: ABIS.GovernanceArbitrator,
    functionName: 'withdrawableBond',
    args: account ? [account] : [],
    enabled: !!account,
    staleTime: opts?.staleTime,
    refetchInterval: opts?.refetchInterval,
  })
}
