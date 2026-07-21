import { CONTRACT_ADDRESSES } from '@/lib/contracts'

export type MarketEntityKind = 'asset' | 'license'

export interface MarketEntityTarget {
  nftContract?: string | null
  tokenId?: string | number | bigint | null
}

/**
 * Canonical product route for a marketplace token. Keeping this mapping in
 * one domain module prevents Explorer, offers, listings and activity cards
 * from inventing competing detail URLs.
 */
export function canonicalEntityRoute(target: MarketEntityTarget): string | null {
  if (target.tokenId === undefined || target.tokenId === null) return null
  const contract = target.nftContract?.toLowerCase()
  const tokenId = String(target.tokenId)

  if (contract === CONTRACT_ADDRESSES.IPAsset.toLowerCase()) return `/assets/${tokenId}`
  if (contract === CONTRACT_ADDRESSES.LicenseToken.toLowerCase()) return `/licenses/${tokenId}`
  return null
}

export function canonicalEventEntityRoute(event: {
  contract: string
  eventName: string
  args: Record<string, unknown>
}): string | null {
  const { args, eventName } = event

  if (eventName === 'OfferCreated') {
    return canonicalEntityRoute({
      nftContract: typeof args.nftContract === 'string' ? args.nftContract : null,
      tokenId: args.tokenId as string | number | bigint | null | undefined,
    })
  }

  if (eventName === 'IPMinted') {
    const tokenId = args.tokenId
    return tokenId === undefined || tokenId === null ? null : `/assets/${String(tokenId)}`
  }

  if (eventName === 'LicenseRegistered' || eventName === 'LicenseMinted' || eventName === 'LicenseCreated') {
    const licenseId = args.licenseId ?? args.tokenId
    return licenseId === undefined || licenseId === null ? null : `/licenses/${String(licenseId)}`
  }

  return null
}

export function withEntityFocus(route: string, focus: 'offers'): string {
  return `${route}?focus=${focus}#${focus}`
}
