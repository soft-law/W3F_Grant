import { createContext, useContext } from 'react'
import type { PolkadotClient, TypedApi } from 'polkadot-api'
import { paseoAssetHub } from '@polkadot-api/descriptors'
import { DEFAULT_WS_URL, type PapiTransportPolicy } from '@/lib/papi-utils'

export type PaseoAssetHubApi = TypedApi<typeof paseoAssetHub>
export type PapiState = 'connecting' | 'ready' | 'reconnecting' | 'error'
export type PapiTransport = PapiTransportPolicy
export type EffectiveTransport = 'ws' | 'smoldot'

export interface PapiContextValue {
  client: PolkadotClient | null
  api: PaseoAssetHubApi | null
  isReady: boolean
  papiState: PapiState
  transport: PapiTransport
  effectiveTransport: EffectiveTransport
  setTransport: (transport: PapiTransport) => void
  customRpcUrl: string
  setCustomRpcUrl: (url: string) => void
  activeWsUrl: string
  genesisHash: string | null
  genesisError: string | null
}

export const PapiContext = createContext<PapiContextValue>({
  client: null,
  api: null,
  isReady: false,
  papiState: 'connecting',
  transport: 'auto',
  effectiveTransport: 'ws',
  setTransport: () => {},
  customRpcUrl: '',
  setCustomRpcUrl: () => {},
  activeWsUrl: DEFAULT_WS_URL,
  genesisHash: null,
  genesisError: null,
})

export function usePapi(): PapiContextValue {
  return useContext(PapiContext)
}
