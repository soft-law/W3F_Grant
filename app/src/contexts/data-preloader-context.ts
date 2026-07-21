import { createContext, useContext } from 'react'
import type { UserIPAsset, UserLicense } from '@/hooks/useContracts'
import type { ListingItem } from '@/hooks/useIndexed'
import type { SseState } from '@/hooks/useIndexerStream'
import type { Transaction } from '@/lib/timeAgo'
import type { DataState } from '@/lib/data-state'

export interface PreloadedData {
  assets: UserIPAsset[]
  isLoadingAssets: boolean
  refetchAssets: () => void
  assetsDataState: DataState

  licenses: UserLicense[]
  isLoadingLicenses: boolean
  refetchLicenses: () => void

  heldLicenses: UserLicense[]
  isLoadingHeldLicenses: boolean
  refetchHeldLicenses: () => void

  disputes: Array<{
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
  }>
  isLoadingDisputes: boolean

  revenueBalance: bigint | undefined

  transactions: Transaction[]
  isLoadingTx: boolean

  listings: Array<{
    listingId: `0x${string}`
    nftContract: `0x${string}`
    tokenId: bigint
    price: bigint
    isActive: boolean
    isERC721: boolean
    title: string
  }>
  isLoadingListings: boolean
  refetchListings: () => void

  offers: Array<{
    offerId: `0x${string}`
    buyer: `0x${string}`
    nftContract: `0x${string}`
    tokenId: bigint
    price: bigint
    isActive: boolean
    expiryTime: bigint
  }>
  isLoadingOffers: boolean
  refetchOffers: () => void

  isConnected: boolean
  address: `0x${string}` | undefined

  allListings: ListingItem[]
  isLoadingAllListings: boolean
  refreshListings: () => void
  allListingsDataState: DataState

  allLicenses: Array<{
    licenseId: bigint
    ipAssetId: bigint
    isExclusive: boolean
    paymentInterval: bigint
    expiryTime: bigint
    terms: string
    isActive: boolean
    title: string
  }>
  isLoadingAllLicenses: boolean
  refetchAllLicenses: () => void

  listingsError: Error | null
  assetsError: Error | null
  licensesError: Error | null
  disputesError: Error | null

  sseState: SseState
}

export const DataPreloaderContext = createContext<PreloadedData | null>(null)

export function usePreloadedData(): PreloadedData {
  const context = useContext(DataPreloaderContext)
  if (!context) {
    throw new Error('usePreloadedData must be used within DataPreloaderProvider')
  }
  return context
}
