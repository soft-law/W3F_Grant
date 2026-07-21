/**
 * Enforces the expected genesis hash before typed PAPI reads are enabled.
 * Production fails closed; development and test builds remain advisory.
 */

/** Paseo Asset Hub genesis hash — verified via chain_getBlockHash(0) on both
 *  configured WSS endpoints (TurboFlakes + Dwellir). */
export const EXPECTED_PASEO_ASSET_HUB_GENESIS =
  '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2'

/** Fatal chain-identity failure. Providers must not retry this error. */
export class GenesisMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenesisMismatchError'
  }
}

export interface GenesisCheckResult {
  ok: boolean
  reason?: string
  expected?: string
  observed?: string
}

/** Enforce the expected genesis in production and report it in development. */
export function enforceGenesisMatch(
  observed: string | undefined,
  expected: string | undefined,
  isProduction: boolean,
): GenesisCheckResult {
  if (!isProduction) {
    return { ok: true }
  }

  if (!expected) {
    return {
      ok: false,
      reason:
        'VITE_EXPECTED_GENESIS_HASH is not set. Production builds must pin the ' +
        'expected Paseo Asset Hub genesis hash to prevent cross-chain type confusion.',
    }
  }

  if (!observed) {
    return {
      ok: false,
      reason: 'Could not read genesis hash from the connected node.',
    }
  }

  const obs = observed.toLowerCase()
  const exp = expected.toLowerCase()
  if (obs !== exp) {
    return {
      ok: false,
      reason:
        `Genesis hash mismatch: connected node reports ${obs}, expected ${exp}. ` +
        'Refusing to enable typed reads — the chain does not match the bundled deployment.',
      expected: exp,
      observed: obs,
    }
  }

  return { ok: true }
}
