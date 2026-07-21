export interface ListingEntryContext {
  initialAssetId?: string
  initialItem?: { kind: 'ip' | 'license'; tokenId: string }
}

/** Entity actions keep their subject fixed; global actions require a picker. */
export function hasContextualListingSubject({ initialAssetId, initialItem }: ListingEntryContext): boolean {
  return Boolean(initialItem || initialAssetId)
}

export function hasContextualLicenseSubject(initialIpAssetId?: string): boolean {
  return Boolean(initialIpAssetId)
}
