export type RegistrationPreparationStatus = 'idle' | 'preparing' | 'ready' | 'error' | 'fallback'

export interface RegistrationDraftFingerprintInput {
  title: string
  description: string
  workType: string
  file: File | null
  creationDate: string
  jurisdiction: string
  derivativeTokenId: string
  additionalNotes: string
  coAuthors: Array<{ address: string; sharePct: number }>
  copyrightDeclaration: boolean
  contentHash: string
}

export function registrationDraftFingerprint(input: RegistrationDraftFingerprintInput): string {
  return JSON.stringify({
    ...input,
    file: input.file
      ? [input.file.name, input.file.size, input.file.type, input.file.lastModified]
      : null,
  })
}

export function canSubmitPreparedRegistration(
  formValid: boolean,
  ipfsConfigured: boolean,
  status: RegistrationPreparationStatus,
): boolean {
  return formValid && (!ipfsConfigured || status === 'ready')
}

export function isWalletRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /user (rejected|denied)|request rejected|rejected the request/i.test(message)
}
