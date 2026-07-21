import { decodeEventLog, isAddress, type Abi, type Hex } from 'viem'
import type { LicenseType, WizardType } from '@/lib/copyright-license'
import { getSmartDefaults, resolveWizardProfile } from '@/lib/copyright-license'
import { ABIS, CONTRACT_ADDRESSES } from '@/lib/contracts'

export const MAX_LICENSE_SUPPLY = 1_000_000
export const MAX_LICENSES_PER_IP = 100

export const LICENSE_PROFILE_CASES: ReadonlyArray<{
  wizardType: WizardType
  attribution: boolean
  allowDerivatives: boolean
  expectedType: LicenseType
}> = [
  { wizardType: 'free-use', attribution: false, allowDerivatives: true, expectedType: 'cc0' },
  { wizardType: 'free-use', attribution: true, allowDerivatives: true, expectedType: 'cc-by' },
  { wizardType: 'free-use', attribution: true, allowDerivatives: false, expectedType: 'cc-by-nd' },
  { wizardType: 'personal-use', attribution: true, allowDerivatives: true, expectedType: 'cc-by-nc' },
  { wizardType: 'share-alike', attribution: true, allowDerivatives: true, expectedType: 'cc-by-sa' },
  { wizardType: 'commercial', attribution: false, allowDerivatives: false, expectedType: 'non-exclusive' },
  { wizardType: 'commercial', attribution: false, allowDerivatives: true, expectedType: 'remix' },
  { wizardType: 'sole', attribution: false, allowDerivatives: true, expectedType: 'sole' },
  { wizardType: 'exclusive', attribution: false, allowDerivatives: true, expectedType: 'exclusive' },
]

export type LicenseAvailabilityReason = 'active-dispute' | 'exclusive-conflict' | 'max-licenses'

export function getLicenseAvailabilityReason(input: {
  wizardType: WizardType
  hasActiveDispute: boolean
  activeExclusiveLicense: boolean
  existingLicenseCount: number
}): LicenseAvailabilityReason | null {
  if (input.hasActiveDispute) return 'active-dispute'
  if (input.existingLicenseCount >= MAX_LICENSES_PER_IP) return 'max-licenses'
  if (getSmartDefaults(input.wizardType).isExclusive && input.activeExclusiveLicense) {
    return 'exclusive-conflict'
  }
  return null
}

export interface PrepareLicenseMintInput {
  wizardType: WizardType
  licensor: string
  attribution: boolean
  allowDerivatives: boolean
  ipAssetId: string
  licensee: string
  supply: number
  publicMetadataURI: string
  privateMetadataURI?: string
  expiryTime: number
  paymentInterval: number
}

/**
 * Validates wizard state and returns arguments for IPAsset.mintLicense.
 */
export function prepareLicenseMint(input: PrepareLicenseMintInput) {
  if (!/^\d+$/.test(input.ipAssetId)) throw new Error('INVALID_IP_ASSET_ID')
  const ipAssetId = BigInt(input.ipAssetId)
  if (!isAddress(input.licensee) || /^0x0{40}$/i.test(input.licensee)) {
    throw new Error('INVALID_LICENSEE')
  }
  if (!isAddress(input.licensor) || /^0x0{40}$/i.test(input.licensor)) {
    throw new Error('INVALID_LICENSOR')
  }
  if (!Number.isSafeInteger(input.supply) || input.supply < 1 || input.supply > MAX_LICENSE_SUPPLY) {
    throw new Error('INVALID_SUPPLY')
  }
  if (!Number.isSafeInteger(input.expiryTime) || input.expiryTime < 0) {
    throw new Error('INVALID_EXPIRY')
  }
  if (!Number.isSafeInteger(input.paymentInterval) || input.paymentInterval < 0) {
    throw new Error('INVALID_PAYMENT_INTERVAL')
  }
  if (!input.publicMetadataURI.trim()) throw new Error('MISSING_PUBLIC_METADATA')

  const defaults = getSmartDefaults(input.wizardType)
  if (defaults.isExclusive && input.supply !== 1) {
    throw new Error('EXCLUSIVE_SUPPLY_MUST_BE_ONE')
  }
  // Recurring V1 licenses are single-copy because payment state is per license.
  if (input.paymentInterval > 0 && input.supply !== 1) {
    throw new Error('RECURRING_SUPPLY_MUST_BE_ONE')
  }
  // A direct mint to a third party never initializes Marketplace.recurring.
  // Recurring inventory must first belong to the seller so that buyListing or
  // acceptOffer can atomically set the price and transfer the single copy.
  if (input.paymentInterval > 0 && input.licensee.toLowerCase() !== input.licensor.toLowerCase()) {
    throw new Error('RECURRING_MUST_BE_ISSUED_TO_SELLER')
  }

  const profile = resolveWizardProfile(input.wizardType, {
    attribution: input.attribution,
    allowDerivatives: input.allowDerivatives,
  })

  return {
    licenseType: profile.licenseType,
    isExclusive: defaults.isExclusive,
    args: [
      ipAssetId,
      input.licensee as `0x${string}`,
      BigInt(input.supply),
      input.publicMetadataURI,
      input.privateMetadataURI ?? '',
      BigInt(input.expiryTime),
      profile.licenseType,
      defaults.isExclusive,
      BigInt(input.paymentInterval),
    ] as const,
  }
}

export interface LicenseReceiptLog {
  address: string
  data: Hex
  topics: readonly Hex[]
}

/** Extract the new ID from the deployed LicenseRegistered receipt event. */
export function extractRegisteredLicenseId(
  logs: readonly LicenseReceiptLog[],
  ipAssetAddress: string = CONTRACT_ADDRESSES.IPAsset,
  abi: Abi = ABIS.IPAsset,
): number | undefined {
  for (const log of logs) {
    if (log.address.toLowerCase() !== ipAssetAddress.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics as [] | [Hex, ...Hex[]],
      })
      if (decoded.eventName !== 'LicenseRegistered' && decoded.eventName !== 'LicenseMinted') continue
      const licenseId = (decoded.args as { licenseId?: unknown }).licenseId
      if (typeof licenseId !== 'bigint' || licenseId > BigInt(Number.MAX_SAFE_INTEGER)) continue
      return Number(licenseId)
    } catch {
      // Receipts contain logs from multiple contracts; unrelated entries are
      // expected and must not mask a later matching event.
    }
  }
  return undefined
}
