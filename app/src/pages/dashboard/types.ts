export type Section = 'explorer' | 'ip' | 'licenses' | 'judicial'
export type WorkType = 'literary' | 'artistic' | 'musical' | 'audiovisual' | 'software' | 'dramatic'
export type IPSubCategory = 'all' | WorkType
export type UserDispute = { disputeId: bigint; disputeType: number; ipAssetId: number | null; licenseId: bigint; reason: string; status: number; submittedAt: bigint; isExpired: boolean; bondReleased: boolean; bondAmount: bigint; proofURI: string; submitter: string; ipOwner: string; resolvedAt: bigint; resolver: string; resolutionReason: string }
