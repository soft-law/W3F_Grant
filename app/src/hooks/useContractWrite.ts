import { useState, useCallback } from 'react'
import { useSwitchChain, usePublicClient, useAccount } from 'wagmi'
import { BaseError, ContractFunctionRevertedError, encodeFunctionData, toHex, type Abi } from 'viem'
import { ACTIVE_CHAIN_ID, ACTIVE_FALLBACK_GAS_PRICE_HEX } from '@/lib/wagmi-config'
import { usePapi } from '@/contexts/papi-context'
import { INDEXER_URL } from '@/lib/indexer'
import { useI18nStore, translations } from '@/lib/i18n'

/**
 * Sends explicit EIP-1559 transactions through the active EIP-1193 provider.
 * Gas price comes from ReviveApi, gas is estimated with the connected account,
 * and all transaction fields are encoded as RPC hex values.
 */

// EIP-1559 fee buffer: matches the indexer's funder path (payments.ts).
// Between sign and inclusion the dynamic fee multiplier can tick up — without
// the buffer the tx fails with "max fee per gas less than block base fee".
const GAS_PRICE_BUFFER_BPS = 12_000n // 120% (10000 = 100%)
const GAS_PRICE_TIMEOUT_MS = 3000

// Chained writes can opt into the gas floor when the second estimate observes
// state from before the first transaction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractParams = { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint; estimateRevertFallsBack?: boolean; [k: string]: any }

// A decoded contract revert aborts submission; transport failures use the gas
// floor because the transaction may still be valid.
export function estimateRevertReason(e: unknown): string | null {
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      if (revert.data?.errorName) {
        const args = (revert.data.args ?? []).map(String).join(', ')
        return `${revert.data.errorName}(${args})`
      }
      return revert.reason ?? revert.shortMessage
    }
    if (/execution reverted/i.test(e.shortMessage)) return e.shortMessage
  }
  return null
}

export function useContractWrite() {
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient()
  const { address, connector } = useAccount()
  const { api } = usePapi()

  const [data, setData] = useState<`0x${string}` | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const send = useCallback(async (params: ContractParams): Promise<`0x${string}`> => {
    if (!address) throw new Error('No wallet connected')

    // Always use the raw EIP-1193 provider from the connector.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider: any = connector ? await (connector as any).getProvider() : null
    if (!provider) throw new Error('No wallet provider. Please reconnect your wallet.')

    // Only prompt wallet_addEthereumChain when actually on the wrong chain
    try {
      const chainIdHex = await provider.request({ method: 'eth_chainId' })
      if (parseInt(chainIdHex, 16) !== ACTIVE_CHAIN_ID) {
        await switchChainAsync({ chainId: ACTIVE_CHAIN_ID })
      }
    } catch {
      await switchChainAsync({ chainId: ACTIVE_CHAIN_ID })
    }

    const calldata = encodeFunctionData({
      abi: params.abi,
      functionName: params.functionName,
      args: params.args ?? [],
    })

    // Fetch gas price and estimate gas in parallel with 8s timeout.
    // Both are fallback-safe: if either fails, we use conservative defaults.
    let maxFeePerGas: string = ACTIVE_FALLBACK_GAS_PRICE_HEX
    const GAS_FLOOR = 2_000_000n
    let gas: string = toHex(GAS_FLOOR)

    const ESTIMATE_TIMEOUT_MS = 8_000

    const gasPricePromise = api
      ? Promise.race([
          api.apis.ReviveApi.gas_price(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('gas_price timeout')), GAS_PRICE_TIMEOUT_MS)
          ),
        ]).catch((e) => {
          console.warn('[useContractWrite] gas_price failed, using fallback:', e)
          return null
        })
      : Promise.resolve(null)

    const estimatePromise = publicClient
      ? Promise.race([
          publicClient.estimateContractGas({
            address: params.address,
            abi: params.abi,
            functionName: params.functionName,
            args: params.args ?? [],
            account: address,
            value: params.value,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('estimateGas timeout')), ESTIMATE_TIMEOUT_MS)
          ),
        ]).catch((e) => {
          // Three-way branch: success → estimate; REVERT → abort (the tx is
          // doomed — never hand it to the wallet); network failure → floor.
          // Chained writes (see estimateRevertFallsBack) opt back into floor.
          const revertReason = estimateRevertReason(e)
          if (revertReason !== null && !params.estimateRevertFallsBack) {
            const t = translations[useI18nStore.getState().language]
            throw new Error(`${t.tx.wouldFail} ${revertReason}`)
          }
          console.warn('[useContractWrite] gas estimate failed (network or chained-revert), using floor:', GAS_FLOOR.toString(), e)
          return null
        })
      : Promise.resolve(null)

    const [gasPrice, estimated] = await Promise.all([gasPricePromise, estimatePromise])

    if (gasPrice !== null) {
      const gasPriceBigint = typeof gasPrice === 'bigint'
        ? gasPrice
        : (gasPrice as bigint[]).reduce(
            (acc: bigint, limb: bigint, i: number) => acc | (limb << (64n * BigInt(i))), 0n
          )
      if (gasPriceBigint > 0n) {
        maxFeePerGas = toHex((gasPriceBigint * GAS_PRICE_BUFFER_BPS) / 10_000n)
      }
    }

    if (estimated) gas = toHex((estimated * 12n) / 10n)

    const txParams: Record<string, unknown> = {
      from: address,
      to: params.address,
      data: calldata,
      type: '0x2',
      maxFeePerGas,
      maxPriorityFeePerGas: '0x0',
      gas,
    }
    if (params.value) txParams.value = toHex(params.value)

    console.log('[useContractWrite] submitting tx', {
      to: params.address,
      fn: params.functionName,
      gas,
      maxFeePerGas,
    })

    try {
      return await (provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as Promise<`0x${string}`>)
    } catch (e: unknown) {
      console.error('[useContractWrite] eth_sendTransaction failed:', e)
      throw e
    }
    // Depend on both the connector object and its uid. Some connectors replace
    // the object, while Privy can preserve the object and rotate only the uid.
  }, [connector, switchChainAsync, publicClient, address, api])

  const writeContract = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (...args: any[]): Promise<`0x${string}`> => {
      setIsPending(true)
      setError(null)
      setData(undefined)
      try {
        const hash = await send(args[0] as ContractParams)
        setData(hash)
        // Hint the indexer without making it part of transaction success.
        try {
          void fetch(`${INDEXER_URL}/api/index-hint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash: hash }),
          }).catch(() => {})
        } catch {
          // swallow — auto-hint is an accelerator, never a blocker
        }
        return hash
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsPending(false)
      }
    },
    [send],
  )

  return {
    writeContract,
    writeContractAsync: writeContract,
    data,
    isPending,
    error,
    reset: useCallback(() => { setData(undefined); setError(null); setIsPending(false) }, []),
  }
}
