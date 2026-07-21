import { useQuery, type QueryObserverResult } from '@tanstack/react-query'
import {
  decodeErrorResult,
  decodeFunctionResult,
  encodeFunctionData,
  type Abi,
  type AbiFunction,
  type Hex,
} from 'viem'
import {
  Binary,
  type SizedHex,
  type SS58String,
} from 'polkadot-api'
import { usePapi, type PaseoAssetHubApi } from '@/contexts/papi-context'

/**
 * Raised when a Revive view returns `0x` for an ABI shape that requires an
 * encoded value. This prevents empty payloads from decoding as zero values.
 */
export class EmptyReviveResultError extends Error {
  readonly functionName: string
  readonly contractAddress: `0x${string}`
  readonly declaredOutputs: readonly string[]
  constructor(functionName: string, contractAddress: `0x${string}`, declaredOutputs: readonly string[]) {
    super(
      `ReviveApi.call ${functionName} returned empty data (0x) but ABI declares ` +
      `outputs: [${declaredOutputs.join(', ')}]. Refusing to silently decode to ` +
      `zero values. Check the contract address (${contractAddress}) and that the ` +
      `function is actually deployed.`,
    )
    this.name = 'EmptyReviveResultError'
    this.functionName = functionName
    this.contractAddress = contractAddress
    this.declaredOutputs = declaredOutputs
  }
}

// Reads use the typed Revive runtime API; viem provides Solidity ABI encoding.

const ZERO_H160: Hex = '0x0000000000000000000000000000000000000000'

// pallet_revive ReturnFlags::REVERT bit; data contains the encoded revert reason.
const REVERT_FLAG = 1

// This zero-address origin is valid only for views that do not depend on msg.sender.
// Cache per API instance so origins cannot cross reconnects or chains.
const originCache = new WeakMap<PaseoAssetHubApi, SS58String>()
const originPromises = new WeakMap<PaseoAssetHubApi, Promise<SS58String>>()

async function getOrigin(api: PaseoAssetHubApi): Promise<SS58String> {
  const cached = originCache.get(api)
  if (cached) return cached
  const inFlight = originPromises.get(api)
  if (inFlight) return inFlight
  const p = api.apis.ReviveApi.account_id(ZERO_H160 as SizedHex<20>).then((origin) => {
    originCache.set(api, origin)
    return origin
  })
  originPromises.set(api, p)
  return p
}

interface CallArgs<TAbi extends Abi> {
  contractAddress: `0x${string}`
  abi: TAbi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
}

export async function reviveApiCall<TAbi extends Abi>(
  api: PaseoAssetHubApi,
  { contractAddress, abi, functionName, args = [], value = 0n }: CallArgs<TAbi>,
): Promise<unknown> {
  const inputHex = encodeFunctionData({
    abi,
    functionName,
    args,
  // viem can't infer the narrow ContractFunctionArgs against the un-narrowed
  // Abi shape we pass through here, so cast on the way in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as Hex
  const origin = await getOrigin(api)
  const dest = contractAddress as SizedHex<20>
  const inputBin: Uint8Array = Binary.fromHex(inputHex)

  const callResult = await api.apis.ReviveApi.call(
    origin,
    dest,
    value,
    undefined,
    undefined,
    inputBin,
  )

  const dispatchResult = callResult.result
  // Dispatch errors and EVM reverts use different result fields.
  if (!dispatchResult.success) {
    // Dispatch errors can contain bigints — use a custom replacer to keep
    // JSON.stringify from throwing on `Do not know how to serialize a BigInt`.
    const errStr = JSON.stringify(dispatchResult.value, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    )
    throw new Error(`ReviveApi.call ${functionName} dispatch error: ${errStr}`)
  }
  // `dispatchResult.value.data` is Uint8Array in v2, not Binary
  const dataHex = Binary.toHex(dispatchResult.value.data) as Hex

  // Static and tuple outputs require non-empty ABI data.
  if (dataHex === '0x' && (dispatchResult.value.flags & REVERT_FLAG) !== REVERT_FLAG) {
    const fnItem = abi.find(
      (item): item is AbiFunction => item.type === 'function' && item.name === functionName,
    )
    const outputs = fnItem?.outputs ?? []
    const isLegitEmpty = outputs.length === 0
      || outputs.every((o) => o.type === 'bytes' || o.type === 'string')
    if (!isLegitEmpty) {
      throw new EmptyReviveResultError(functionName, contractAddress, outputs.map((o) => o.type))
    }
  }

  if ((dispatchResult.value.flags & REVERT_FLAG) === REVERT_FLAG) {
    // Contract reverted. viem's decodeErrorResult auto-includes solidityError
    // (Error(string)) and solidityPanic (Panic(uint256)); custom errors decode
    // when present in the abi we passed in.
    let reason = dataHex
    try {
      const decoded = decodeErrorResult({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: abi as any,
        data: dataHex,
      })
      const argStr = decoded.args ? Array.from(decoded.args).map(String).join(', ') : ''
      reason = argStr ? `${decoded.errorName}(${argStr})` : decoded.errorName
    } catch {
      // Empty data = bare revert(); short data = unknown selector. Fall back to
      // the raw hex (already assigned above).
    }
    throw new Error(`ReviveApi.call ${functionName} reverted: ${reason}`)
  }
  return decodeFunctionResult({
    abi,
    functionName,
    data: dataHex,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

export interface UseReviveApiCallArgs<TAbi extends Abi> {
  contractAddress: `0x${string}`
  abi: TAbi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
  enabled?: boolean
  refetchInterval?: number | false
  staleTime?: number
}

export interface UseReviveApiCallResult<T = unknown> {
  data: T | undefined
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => Promise<QueryObserverResult<T, Error>>
}

/** React Query wrapper around `api.apis.ReviveApi.call`. */
export function useReviveApiCall<TAbi extends Abi, T = unknown>(
  params: UseReviveApiCallArgs<TAbi>,
): UseReviveApiCallResult<T> {
  const { api, isReady } = usePapi()
  const {
    contractAddress,
    abi,
    functionName,
    args = [],
    value,
    enabled = true,
    refetchInterval,
    staleTime,
  } = params

  // Query key intentionally ignores `abi` (large object) and `value` (rare).
  // Stringify args to give bigint-safe stable identity.
  const argsKey = useMemo_argsKey(args)

  const query = useQuery<T, Error>({
    queryKey: ['reviveApiCall', contractAddress, functionName, argsKey],
    queryFn: async () => {
      if (!api) throw new Error('PAPI client not ready')
      return (await reviveApiCall(api, {
        contractAddress,
        abi,
        functionName,
        args,
        value,
      })) as T
    },
    enabled: enabled && isReady && !!api,
    refetchInterval: refetchInterval ?? false,
    staleTime: staleTime ?? 30_000,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

// Local helper — JSON.stringify with bigint coercion, returns a string the
// react-query key can stably hash on. Hoisted out of the hook so the closure
// allocation doesn't recreate the helper on every render.
function useMemo_argsKey(args: readonly unknown[]): string {
  try {
    return JSON.stringify(args, (_k, v) => {
      if (typeof v === 'bigint') return `${v}n`
      // Lowercase H160 addresses so `0xABCD…` and `0xabcd…` share a cache entry.
      if (typeof v === 'string' && v.length === 42 && v.startsWith('0x')) return v.toLowerCase()
      return v
    })
  } catch {
    return String(args)
  }
}
