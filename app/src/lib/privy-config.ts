import type { PrivyClientConfig } from '@privy-io/react-auth'
import { polkadotHubTestnet, polkadotHub } from './wagmi-config'

export const privyConfig: PrivyClientConfig = {
  loginMethods: ['google', 'wallet'],
  defaultChain: polkadotHubTestnet,
  supportedChains: [polkadotHubTestnet, polkadotHub],
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  appearance: {
    showWalletLoginFirst: false,
    // 'detected_ethereum_wallets' is the correct v3 identifier (not 'detected_wallets')
    walletList: ['metamask', 'detected_ethereum_wallets'],
    walletChainType: 'ethereum-only',
    // Base theme — CSS variables (set in useTheme.ts) override these dynamically
    // so the modal always matches the current app theme (dark/light)
    theme: 'dark',
    landingHeader: 'Soft.Law',
    loginMessage: 'Manage your IP assets on Polkadot Hub',
  },
}
