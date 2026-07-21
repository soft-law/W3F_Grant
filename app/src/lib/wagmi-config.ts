import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { createConfig } from '@privy-io/wagmi'
import { defineChain } from 'viem'
import { getGasPrice } from 'viem/actions'

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export const TESTNET_CHAIN_ID = 420420417 as const
export const MAINNET_CHAIN_ID = 420420419 as const

/** Resolve the human-readable network name for any supported chain ID. */
export function getNetworkName(chainId: number): string {
  if (chainId === MAINNET_CHAIN_ID) return 'Polkadot Hub'
  if (chainId === TESTNET_CHAIN_ID) return 'Polkadot Hub Testnet'
  return `Unknown chain (${chainId})`
}

// Per-chain defaults. Override any of these with a VITE_* env var below.
const CHAIN_DEFAULTS = {
  [TESTNET_CHAIN_ID]: {
    name: 'Polkadot Hub Testnet',
    nativeSymbol: 'PAS',
    // This endpoint supports Revive reads and confirmed transaction receipts.
    rpcHttp: 'https://paseo-assethub-rpc.laissez-faire.trade',
    explorer: 'https://assethub-paseo.subscan.io',
    explorerFallback: 'https://blockscout-testnet.polkadot.io',
    // 1000 Gwei — Polkadot Hub Testnet baseFee. Safe fallback when ReviveApi.gas_price() fails.
    fallbackGasPriceHex: '0xe8d4a51000',
  },
  [MAINNET_CHAIN_ID]: {
    name: 'Polkadot Hub',
    nativeSymbol: 'DOT',
    rpcHttp: 'https://services.polkadothub-rpc.com/mainnet',
    explorer: 'https://assethub-polkadot.subscan.io',
    explorerFallback: 'https://blockscout.polkadot.io',
    // Mainnet baseFee unverified — operators MUST set VITE_FALLBACK_GAS_PRICE_HEX
    // when flipping to mainnet rather than relying on a hardcoded testnet value.
    fallbackGasPriceHex: '0xe8d4a51000',
  },
} as const

const envChainId = Number(import.meta.env.VITE_CHAIN_ID)

// Bundled contract addresses are testnet-only.
export function resolveActiveChainId(
  chainId: number,
): typeof TESTNET_CHAIN_ID | typeof MAINNET_CHAIN_ID {
  if (chainId === MAINNET_CHAIN_ID) {
    throw new Error(
      'Polkadot Hub mainnet is not configured: the bundled contract addresses are testnet-only.',
    )
  }
  if (Number.isFinite(chainId) && chainId !== 0 && chainId !== TESTNET_CHAIN_ID) {
    throw new Error(`Unsupported VITE_CHAIN_ID: ${chainId}`)
  }
  return TESTNET_CHAIN_ID
}
export const ACTIVE_CHAIN_ID: typeof TESTNET_CHAIN_ID | typeof MAINNET_CHAIN_ID =
  resolveActiveChainId(envChainId)

const defaults = CHAIN_DEFAULTS[ACTIVE_CHAIN_ID]

export const ACTIVE_NETWORK_NAME =
  (import.meta.env.VITE_NETWORK_NAME as string | undefined) || defaults.name
export const ACTIVE_NATIVE_SYMBOL =
  (import.meta.env.VITE_NATIVE_SYMBOL as string | undefined) || defaults.nativeSymbol
export const ACTIVE_RPC_HTTP_URL =
  (import.meta.env.VITE_RPC_HTTP_URL as string | undefined) || defaults.rpcHttp
export const ACTIVE_BLOCK_EXPLORER_URL =
  (import.meta.env.VITE_BLOCK_EXPLORER_URL as string | undefined) || defaults.explorer
export const ACTIVE_FALLBACK_GAS_PRICE_HEX =
  (import.meta.env.VITE_FALLBACK_GAS_PRICE_HEX as string | undefined) || defaults.fallbackGasPriceHex

// Polkadot Hub Testnet
export const polkadotHubTestnet = defineChain({
  id: TESTNET_CHAIN_ID,
  name: CHAIN_DEFAULTS[TESTNET_CHAIN_ID].name,
  nativeCurrency: {
    decimals: 18,
    name: 'PAS',
    symbol: CHAIN_DEFAULTS[TESTNET_CHAIN_ID].nativeSymbol,
  },
  rpcUrls: {
    default: {
      http: [
        ACTIVE_CHAIN_ID === TESTNET_CHAIN_ID
          ? ACTIVE_RPC_HTTP_URL
          : CHAIN_DEFAULTS[TESTNET_CHAIN_ID].rpcHttp,
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Subscan',
      url:
        ACTIVE_CHAIN_ID === TESTNET_CHAIN_ID
          ? ACTIVE_BLOCK_EXPLORER_URL
          : CHAIN_DEFAULTS[TESTNET_CHAIN_ID].explorer,
    },
    blockscout: {
      name: 'Blockscout',
      url: CHAIN_DEFAULTS[TESTNET_CHAIN_ID].explorerFallback,
    },
  },
  testnet: true,
  fees: {
    async estimateFeesPerGas({ client }) {
      const gasPrice = await getGasPrice(client)
      return { type: 'eip1559' as const, maxFeePerGas: gasPrice, maxPriorityFeePerGas: 0n }
    },
  },
})

// Polkadot Hub Mainnet (Asset Hub)
export const polkadotHub = defineChain({
  id: MAINNET_CHAIN_ID,
  name: CHAIN_DEFAULTS[MAINNET_CHAIN_ID].name,
  nativeCurrency: {
    decimals: 18,
    name: 'DOT',
    symbol: CHAIN_DEFAULTS[MAINNET_CHAIN_ID].nativeSymbol,
  },
  rpcUrls: {
    default: {
      http: [
        ACTIVE_CHAIN_ID === MAINNET_CHAIN_ID
          ? ACTIVE_RPC_HTTP_URL
          : CHAIN_DEFAULTS[MAINNET_CHAIN_ID].rpcHttp,
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Subscan',
      url:
        ACTIVE_CHAIN_ID === MAINNET_CHAIN_ID
          ? ACTIVE_BLOCK_EXPLORER_URL
          : CHAIN_DEFAULTS[MAINNET_CHAIN_ID].explorer,
    },
    blockscout: {
      name: 'Blockscout',
      url: CHAIN_DEFAULTS[MAINNET_CHAIN_ID].explorerFallback,
    },
  },
  fees: {
    async estimateFeesPerGas({ client }) {
      const gasPrice = await getGasPrice(client)
      return { type: 'eip1559' as const, maxFeePerGas: gasPrice, maxPriorityFeePerGas: 0n }
    },
  },
})

export const ACTIVE_CHAIN = ACTIVE_CHAIN_ID === MAINNET_CHAIN_ID ? polkadotHub : polkadotHubTestnet
export const IS_TESTNET = ACTIVE_CHAIN_ID === TESTNET_CHAIN_ID

export const wagmiConfig = createConfig({
  chains: [polkadotHubTestnet, polkadotHub],
  // Support MetaMask, Talisman, and other EIP-6963 wallets.
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  transports: {
    [polkadotHubTestnet.id]: http(),
    [polkadotHub.id]: http(),
  },
})

// Backwards-compat aliases — prefer ACTIVE_CHAIN_ID for new code.
export const POLKADOT_HUB_CHAIN_ID = ACTIVE_CHAIN_ID
export const POLKADOT_HUB_MAINNET_CHAIN_ID = MAINNET_CHAIN_ID
