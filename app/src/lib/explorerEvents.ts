import {
  Plus, ArrowRight, Key, XCircle, Clock, Tag, X, DollarSign,
  MessageCircle, Check, AlertTriangle, CheckCircle, Activity,
  RefreshCw, ShieldOff, ShieldCheck, Banknote, Lock, Unlock,
  TrendingDown, Settings, Zap,
} from 'lucide-react'

export interface ContractEvent {
  id: string
  contract: 'IPAsset' | 'LicenseToken' | 'Marketplace' | 'Arbitrator'
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: string
  blockTimestamp?: number // unix seconds, indexer-supplied
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatEventArg(_key: string, value: unknown): string {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') {
    if (value.startsWith('0x') && value.length === 66) return `${value.slice(0, 10)}...${value.slice(-8)}`
    if (value.startsWith('0x') && value.length === 42) return `${value.slice(0, 6)}...${value.slice(-4)}`
    if (value.length > 50) return `${value.slice(0, 47)}...`
  }
  return String(value)
}

export function getEventColor(eventName: string): string {
  const colors: Record<string, string> = {
    IPMinted: '#22c55e',
    Transfer: '#3b82f6',
    TransferSingle: '#3b82f6',
    TransferBatch: '#3b82f6',
    LicenseCreated: '#8b5cf6',
    LicenseRegistered: '#8b5cf6',
    LicenseMinted: '#8b5cf6',
    LicenseRevoked: '#ef4444',
    LicenseExpired: '#f59e0b',
    LicenseConcluded: '#f59e0b',
    AutoRevoked: '#ef4444',
    ListingCreated: '#06b6d4',
    ListingCancelled: '#6b7280',
    Sale: '#10b981',
    OfferCreated: '#f97316',
    OfferAccepted: '#10b981',
    OfferCancelled: '#6b7280',
    DisputeSubmitted: '#f59e0b',
    DisputeResolved: '#22c55e',
    DisputeStatusChanged: '#f59e0b',
    DisputeExpired: '#6b7280',
    DisputeBondUpdated: '#a78bfa',
    PaymentDistributed: '#10b981',
    RecurringPaymentMade: '#10b981',
    MetadataUpdated: '#64748b',
    NFTWrapped: '#06b6d4',
    NFTUnwrapped: '#64748b',
    BondDeposited: '#a78bfa',
    BondReleased: '#22c55e',
    BondWithdrawn: '#a78bfa',
    AssetRoyaltyUpdated: '#a78bfa',
    RoyaltyUpdated: '#a78bfa',
    RoyaltyRateSet: '#a78bfa',
    PrivateAccessGranted: '#06b6d4',
    PrivateAccessRevoked: '#ef4444',
    IPInvalidated: '#ef4444',
    ArbitratorTransferred: '#f97316',
    IPOwnershipTransferred: '#f97316',   // harmless alias
    Withdrawal: '#10b981',
    Withdrawn: '#10b981',
    SplitConfigured: '#06b6d4',
    RevenueSplitConfigured: '#06b6d4',
    PenaltyRateUpdated: '#64748b',
    ArbitratorBurned: '#ef4444',
    Upgraded: '#64748b',
  }
  return colors[eventName] ?? '#6b7280'
}

export function getEventIcon(eventName: string) {
  switch (eventName) {
    case 'IPMinted':                             return Plus
    case 'Transfer':
    case 'TransferSingle':
    case 'TransferBatch':                        return ArrowRight
    case 'LicenseCreated':
    case 'LicenseRegistered':
    case 'LicenseMinted':                        return Key
    case 'LicenseRevoked':
    case 'AutoRevoked':                          return XCircle
    case 'LicenseExpired':
    case 'LicenseConcluded':
    case 'DisputeExpired':                       return Clock
    case 'ListingCreated':                       return Tag
    case 'ListingCancelled':
    case 'OfferCancelled':                       return X
    case 'Sale':
    case 'PaymentDistributed':
    case 'RecurringPaymentMade':                 return DollarSign
    case 'OfferCreated':                         return MessageCircle
    case 'OfferAccepted':                        return Check
    case 'DisputeSubmitted':
    case 'DisputeStatusChanged':                 return AlertTriangle
    case 'DisputeResolved':                      return CheckCircle
    case 'NFTWrapped':                           return RefreshCw
    case 'NFTUnwrapped':                         return RefreshCw
    case 'BondDeposited':
    case 'BondWithdrawn':
    case 'BondReleased':
    case 'DisputeBondUpdated':                   return Banknote
    case 'PrivateAccessGranted':                 return Lock
    case 'PrivateAccessRevoked':                 return Unlock
    case 'Withdrawal':
    case 'Withdrawn':                            return TrendingDown
    case 'SplitConfigured':
    case 'RevenueSplitConfigured':               return Settings
    case 'MetadataUpdated':
    case 'AssetRoyaltyUpdated':
    case 'RoyaltyUpdated':
    case 'RoyaltyRateSet':
    case 'PenaltyRateUpdated':                   return Settings
    case 'IPInvalidated':                        return ShieldOff
    case 'ArbitratorTransferred':
    case 'IPOwnershipTransferred':               return ShieldCheck  // harmless alias
    case 'ArbitratorBurned':                     return XCircle
    case 'Upgraded':                             return Zap
    default:                                     return Activity
  }
}
