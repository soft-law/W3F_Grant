// ── Type alias ────────────────────────────────────────────────────────────────
// Structural shape accepted from both locales (EN and ES).
// Keyed by property name, values are strings — avoids coupling to literal types.

interface ProvenanceEvents {
  ipMinted: string
  licenseCreated: string
  licenseRevoked: string
  licenseExpired: string
  listingCreated: string
  listingCancelled: string
  sale: string
  disputeSubmitted: string
  disputeResolved: string
  paymentDistributed: string
  metadataUpdated: string
  nftWrapped: string
  nftUnwrapped: string
  licenseConcluded: string
  autoRevoked: string
  offerCancelled: string
  recurringPayment: string
  bondWithdrawn: string
  disputeExpired: string
  ipInvalidated: string
  ipTransferred: string
  withdrawal: string
  splitConfigured: string
  royaltyRateSet: string
  penaltyUpdated: string
  offerCreated: string
  offerAccepted: string
  bondDeposited: string
  bondReleased: string
  disputeBondUpdated: string
  assetRoyaltyUpdated: string
  defaultRoyaltyUpdated: string
  privateAccessGranted: string
  privateAccessRevoked: string
  // Events with localized provenance sentences.
  wrappedNftStuck: string
  privateMetadataUpdated: string
  disputeStatusChanged: string
  arbitratorBurned: string
  transferred: string
}

// ── Fallback: space-split PascalCase (acronym-aware) ────────────────────────
// Preserve acronyms such as NFT, IP, and ID.

function splitPascalCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .toLowerCase()
}

// ── humanizeEvent ─────────────────────────────────────────────────────────────
// Return a concise English verb for activity feeds.

export function humanizeEvent(eventName: string): string {
  switch (eventName) {
    case 'IPMinted':               return 'minted'
    case 'Sale':                   return 'purchased'
    case 'ListingCreated':         return 'listed'
    case 'ListingCancelled':       return 'unlisted'
    case 'OfferCreated':           return 'offered'
    case 'OfferAccepted':          return 'accepted offer on'
    case 'OfferCancelled':         return 'cancelled offer'
    case 'LicenseCreated':
    case 'LicenseRegistered':
    case 'LicenseMinted':          return 'issued license'
    case 'LicenseRevoked':         return 'revoked license'
    case 'LicenseExpired':         return 'license expired'
    case 'LicenseConcluded':       return 'concluded license'
    case 'AutoRevoked':            return 'auto-revoked'
    case 'DisputeSubmitted':       return 'filed dispute on'
    case 'DisputeResolved':        return 'resolved dispute'
    case 'DisputeStatusChanged':   return 'updated dispute'
    case 'DisputeExpired':         return 'dispute expired'
    case 'DisputeBondUpdated':     return 'bond requirement updated'
    case 'PaymentDistributed':     return 'royalty paid'
    case 'RecurringPaymentMade':   return 'recurring payment'
    case 'TransferSingle':
    case 'TransferBatch':
    case 'Transfer':               return 'transferred'
    case 'MetadataUpdated':        return 'updated metadata'
    case 'NFTWrapped':             return 'wrapped NFT'
    case 'NFTUnwrapped':           return 'unwrapped NFT'
    case 'BondWithdrawn':          return 'bond withdrawn'
    case 'BondDeposited':          return 'bond deposited'
    case 'BondReleased':           return 'bond released'
    case 'AssetRoyaltyUpdated':    return 'asset royalty rate updated'
    case 'RoyaltyUpdated':         return 'default royalty rate updated'
    case 'RoyaltyRateSet':         return 'royalty rate updated'
    case 'PrivateAccessGranted':   return 'private access granted'
    case 'PrivateAccessRevoked':   return 'private access revoked'
    case 'IPInvalidated':          return 'IP invalidated'
    case 'ArbitratorTransferred':
    case 'IPOwnershipTransferred': return 'IP transferred by arbitrator'  // Compatibility alias
    case 'Withdrawal':             return 'revenue withdrawn'
    case 'Withdrawn':              return 'withdrew'  // Compatibility alias
    case 'SplitConfigured':
    case 'RevenueSplitConfigured': return 'revenue split configured'
    case 'PenaltyRateUpdated':     return 'penalty rate updated'
    case 'ArbitratorBurned':       return 'arbitrator burned IP'
    case 'Upgraded':               return 'contract upgraded'
    case 'Initialized':            return 'contract initialized'
    case 'Paused':                 return 'contract paused'
    case 'Unpaused':               return 'contract unpaused'
    case 'RoleAdminChanged':       return 'role administrator changed'
    case 'RoleGranted':            return 'role granted'
    case 'RoleRevoked':            return 'role revoked'
    case 'Approval':               return 'token approval updated'
    case 'ApprovalForAll':         return 'operator approval updated'
    case 'URI':                    return 'token URI updated'
    case 'ArbitratorContractSet':
    case 'ArbitratorContractUpdated': return 'arbitrator contract updated'
    case 'LicenseTokenContractSet': return 'license contract updated'
    case 'IPAssetContractUpdated': return 'IP asset contract updated'
    case 'MarketplaceContractUpdated': return 'marketplace contract updated'
    case 'RevenueDistributorSet':  return 'revenue distributor updated'
    // Keep acronym-heavy event names readable.
    case 'WrappedNFTStuck':        return 'wrapped NFT stuck'
    case 'PrivateMetadataUpdated': return 'private metadata updated'
    default:                       return splitPascalCase(eventName)
  }
}

// ── describeEvent ─────────────────────────────────────────────────────────────
// Build a localized provenance sentence without coupling this module to React.

// Shorten 32-byte listing IDs for display while preserving other values.
function shortenListingId(raw: unknown): string {
  if (raw === undefined || raw === null) return ''
  let hex: string
  if (typeof raw === 'string') {
    hex = raw
  } else if (typeof raw === 'bigint') {
    hex = '0x' + raw.toString(16).padStart(64, '0')
  } else if (raw instanceof Uint8Array) {
    hex = '0x' + Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('')
  } else {
    return String(raw)
  }
  // 0x + 64 hex = 66 chars. Anything else is already short.
  if (hex.length !== 66 || !hex.startsWith('0x')) return hex
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`
}

export function describeEvent(
  e: { eventName: string; args: Record<string, unknown> },
  events: ProvenanceEvents,
): string {
  switch (e.eventName) {
    case 'IPMinted':
      return events.ipMinted
    case 'LicenseCreated':
    case 'LicenseMinted':
      return `${events.licenseCreated}${e.args.licenseId ?? ''}`
    case 'LicenseRevoked':
      return `${events.licenseRevoked}${e.args.licenseId ?? ''}`
    case 'LicenseExpired':
      return `${events.licenseExpired}${e.args.licenseId ?? ''}`
    case 'ListingCreated':
      return `${events.listingCreated}${shortenListingId(e.args.listingId)}`
    case 'ListingCancelled':
      return `${events.listingCancelled}${shortenListingId(e.args.listingId)}`
    case 'Sale':
      return events.sale
    case 'DisputeSubmitted':
      return `${events.disputeSubmitted}${e.args.disputeId ?? ''}`
    case 'DisputeResolved':
      return events.disputeResolved
    case 'PaymentDistributed':
      return events.paymentDistributed
    case 'MetadataUpdated':
      return events.metadataUpdated
    case 'NFTWrapped':
      return events.nftWrapped
    case 'NFTUnwrapped':
      return events.nftUnwrapped
    case 'LicenseConcluded':
      return `${events.licenseConcluded}${e.args.licenseId ?? ''}`
    case 'AutoRevoked':
      return `${events.autoRevoked}${e.args.licenseId ?? ''}`
    case 'OfferCreated':
      return `${events.offerCreated}${e.args.offerId ?? ''}`
    case 'OfferAccepted':
      return events.offerAccepted
    case 'OfferCancelled':
      return events.offerCancelled
    case 'RecurringPaymentMade':
      return events.recurringPayment
    case 'BondWithdrawn':
      return events.bondWithdrawn
    case 'BondDeposited':
      return `${events.bondDeposited}${e.args.disputeId ?? ''}`
    case 'BondReleased':
      return `${events.bondReleased}${e.args.disputeId ?? ''}`
    case 'DisputeBondUpdated':
      return events.disputeBondUpdated
    case 'AssetRoyaltyUpdated':
      return events.assetRoyaltyUpdated
    case 'RoyaltyUpdated':
      return events.defaultRoyaltyUpdated
    case 'PrivateAccessGranted':
      return events.privateAccessGranted
    case 'PrivateAccessRevoked':
      return events.privateAccessRevoked
    case 'DisputeExpired':
      return `${events.disputeExpired}${e.args.disputeId ?? ''}`
    case 'IPInvalidated':
      return events.ipInvalidated
    case 'ArbitratorTransferred':
    case 'IPOwnershipTransferred': // kept as harmless alias
      return events.ipTransferred
    case 'Withdrawal':
      return events.withdrawal
    case 'SplitConfigured':
    case 'RevenueSplitConfigured':
      return events.splitConfigured
    case 'RoyaltyRateSet':
      return events.royaltyRateSet
    case 'PenaltyRateUpdated':
      return events.penaltyUpdated
    case 'LicenseRegistered':
      return `${events.licenseCreated}${e.args.licenseId ?? ''}`
    // Map these events to localized provenance sentences.
    case 'WrappedNFTStuck':
      return events.wrappedNftStuck
    case 'PrivateMetadataUpdated':
      return events.privateMetadataUpdated
    case 'DisputeStatusChanged':
      return events.disputeStatusChanged
    case 'ArbitratorBurned':
      return events.arbitratorBurned
    // Shared case for the OZ ERC-721 + ERC-1155 transfer events. They share
    // a single i18n sentence because the legal meaning is identical.
    case 'Transfer':
    case 'TransferSingle':
    case 'TransferBatch':
      return events.transferred
    default:
      // Fall back to the verb-fragment humanizer (space-splits PascalCase) rather than leaking raw event name.
      return humanizeEvent(e.eventName)
  }
}
