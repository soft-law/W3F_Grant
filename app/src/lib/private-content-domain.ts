export type RegistryVisibility = 'public' | 'confidential'
export type LicenseVisibility = 'public' | 'confidential'

export type PrivateContentSubject =
  | { kind: 'license'; id: number }
  | { kind: 'asset'; id: number }

// Source-file limit leaves headroom for non-streaming encryption on mobile browsers.
export const MAX_PRIVATE_CONTENT_BYTES = 20 * 1024 * 1024

export function privateContentFileIsValid(file: File): boolean {
  return file.size <= MAX_PRIVATE_CONTENT_BYTES
}

export function registrationFileLimit(publicLimit: number, visibility: RegistryVisibility): number {
  return visibility === 'confidential'
    ? Math.min(publicLimit, MAX_PRIVATE_CONTENT_BYTES)
    : publicLimit
}

/** Confidential IPs default new licenses to confidential; public IPs do not. */
export function defaultLicenseVisibility(assetVisibility: RegistryVisibility): LicenseVisibility {
  return assetVisibility === 'confidential' ? 'confidential' : 'public'
}

/** On-chain identity is always public; this controls off-chain metadata/content only. */
export function usesEncryptedContent(visibility: RegistryVisibility | LicenseVisibility): boolean {
  return visibility === 'confidential'
}

/** Confidential bytes must never be attached to the public NFT metadata. */
export function publicRegistryMedia(
  visibility: RegistryVisibility,
  selectedFile: File | null,
): File | null {
  return visibility === 'public' ? selectedFile : null
}

export type PrivateContentViewerFacts = {
  isOwner: boolean
  hasActiveLicense: boolean
  hasExplicitGrant: boolean
}

/** UI eligibility only; the backend always repeats the live on-chain check. */
export function canDecryptPrivateContent(facts: PrivateContentViewerFacts): boolean {
  return facts.isOwner || facts.hasActiveLicense || facts.hasExplicitGrant
}
