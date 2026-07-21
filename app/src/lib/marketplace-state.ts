export type OfferState = {
  isActive: boolean
  expiryTime: bigint
}

/**
 * Conservative UI projection of Marketplace.acceptOffer. The contract rejects
 * after expiry; equality is treated as unavailable because the submitted tx
 * can only land at the same or a later block timestamp. Zero is never perpetual.
 */
export function isOfferAcceptable(offer: OfferState, nowSeconds: bigint): boolean {
  return offer.isActive && offer.expiryTime > nowSeconds
}

/** Active-but-expired offers remain cancellable by their buyer for a refund. */
export function isOfferAwaitingRefund(offer: OfferState, nowSeconds: bigint): boolean {
  return offer.isActive && offer.expiryTime <= nowSeconds
}

export function addressesEqual(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

export function sellerHasListedToken(
  isERC721: boolean,
  seller: string,
  ownerOrBalance: string | bigint | number | null | undefined,
): boolean {
  if (isERC721) {
    return typeof ownerOrBalance === 'string' && addressesEqual(ownerOrBalance, seller)
  }
  try {
    return BigInt(ownerOrBalance ?? 0) > 0n
  } catch {
    return false
  }
}
