import type { Abi } from 'viem'
import IPAssetABI from '@/abis/IPAsset.json'
import LicenseTokenABI from '@/abis/LicenseToken.json'
import MarketplaceABI from '@/abis/Marketplace.json'
import GovernanceArbitratorABI from '@/abis/GovernanceArbitrator.json'
import RevenueDistributorABI from '@/abis/RevenueDistributor.json'
import { ACTIVE_BLOCK_EXPLORER_URL } from '@/lib/wagmi-config'

// Block explorer base URL for transaction and block links.
export const BLOCK_EXPLORER_URL = ACTIVE_BLOCK_EXPLORER_URL.replace(/\/$/, '')

// Faucet URL for testnet tokens
export const FAUCET_URL = 'https://faucet.polkadot.io/?parachain=1000'

// Landing site base URL (legal pages live there)
export const LANDING_URL = import.meta.env.DEV ? 'http://localhost:5173' : 'https://soft.law'

// Contracts deployed on Polkadot Hub Testnet.
export const CONTRACT_ADDRESSES = {
  IPAsset: '0xdf141b3e2c063b60a36d17cbedf0585052eb0447' as `0x${string}`,
  LicenseToken: '0xb394cbd030936f3e60199facf34477d8c1a819e2' as `0x${string}`,
  Marketplace: '0xc6e62682d0e8a4eb6079f612f94b6c8277daee88' as `0x${string}`,
  GovernanceArbitrator: '0x23ff1e43b4b4e05dc2b49b2f648dc189e1b7ffe2' as `0x${string}`,
  RevenueDistributor: '0x5b5e657092b9090d34ac262f47106bec7c5a2a2c' as `0x${string}`,
} as const

// Narrow JSON ABI imports for viem's compile-time function inference.
export const ABIS = {
  IPAsset: IPAssetABI as Abi,
  LicenseToken: LicenseTokenABI as Abi,
  Marketplace: MarketplaceABI as Abi,
  GovernanceArbitrator: GovernanceArbitratorABI as Abi,
  RevenueDistributor: RevenueDistributorABI as Abi,
} as const

// Synthetic indexer hashes link to their block instead of a transaction page.

export function isSyntheticTxHash(txHash: string): boolean {
  return txHash.startsWith('papi:')
}

export function getTxUrl(txHash: string): string {
  // Never produce a transaction URL for a synthetic hash.
  if (isSyntheticTxHash(txHash)) {
    // Recover the block hash when the synthetic format includes it.
    const parts = txHash.split(':')
    if (parts.length >= 2 && parts[1].startsWith('0x')) {
      return `${BLOCK_EXPLORER_URL}/block/${parts[1]}`
    }
    return BLOCK_EXPLORER_URL
  }
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`
}

/**
 * Build an explorer URL for an event. When the indexer can resolve a real
 * Ethereum tx hash, links to the tx page; otherwise links to the block page
 * so the user can still inspect the underlying state change.
 */
export function explorerUrlForEvent(
  txHash: string,
  blockNumber: number | bigint,
): string {
  if (isSyntheticTxHash(txHash)) {
    return `${BLOCK_EXPLORER_URL}/block/${blockNumber.toString()}`
  }
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`
}

/**
 * UI label hint for explorer links so the user understands when a block link
 * is shown instead of a tx link.
 */
export function explorerLabelForEvent(txHash: string): 'transaction' | 'block' {
  return isSyntheticTxHash(txHash) ? 'block' : 'transaction'
}

// TypeScript interfaces
export interface IPAssetMetadata {
  tokenId: bigint
  owner: `0x${string}`
  metadataURI: string
  activeLicenseCount: bigint
  hasActiveDispute: boolean
}

export interface License {
  licenseId: bigint
  ipAssetId: bigint
  supply: bigint
  expiryTime: bigint
  terms: string
  isExclusive: boolean
  isRevoked: boolean
  publicMetadataURI: string
  privateMetadataURI: string
  paymentInterval: bigint
}

export interface Listing {
  listingId: `0x${string}`
  seller: `0x${string}`
  nftContract: `0x${string}`
  tokenId: bigint
  price: bigint
  isActive: boolean
  isERC721: boolean
}

export interface Offer {
  offerId: `0x${string}`
  buyer: `0x${string}`
  nftContract: `0x${string}`
  tokenId: bigint
  price: bigint
  isActive: boolean
  expiryTime: bigint
}

export enum DisputeStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Executed = 3,
  Expired = 4,
}

export interface Dispute {
  disputeId: bigint
  disputeType: number
  ipAssetId: bigint
  licenseId: bigint
  submitter: `0x${string}`
  ipOwner: `0x${string}`
  awardRecipient: `0x${string}`
  reason: string
  proofURI: string
  status: DisputeStatus
  submittedAt: bigint
  resolvedAt: bigint
  bondAmount: bigint
  resolver: `0x${string}`
  resolutionReason: string
  isExpired: boolean
  bondReleased: boolean
}

export interface RevenueSplit {
  recipients: `0x${string}`[]
  shares: bigint[]
}

// Utility functions
export function formatPrice(value: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals)
  const integerPart = value / divisor
  const fractionalPart = value % divisor
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 4)
  return `${integerPart}.${fractionalStr}`
}

export function parsePrice(value: string, decimals: number = 18): bigint {
  const cleaned = value.trim()
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return 0n
  const [integer = '0', fraction = ''] = cleaned.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(integer + paddedFraction)
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-4)}`
}

export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

export function formatTimestamp(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString()
}
