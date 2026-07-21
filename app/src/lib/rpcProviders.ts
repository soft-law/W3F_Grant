/**
 * Paseo Asset Hub WSS pool, ordered by preferred default and failover priority.
 */
export type RpcProvider = { label: string; url: string }

export const RPC_PROVIDERS: RpcProvider[] = [
  { label: 'via TurboFlakes', url: 'wss://sys.turboflakes.io/asset-hub-paseo' },
  { label: 'via Dwellir',     url: 'wss://asset-hub-paseo-rpc.n.dwellir.com' },
]
