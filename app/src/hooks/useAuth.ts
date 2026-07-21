import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'

/**
 * Combines Privy authentication readiness with wagmi wallet state.
 */
export function useAuth() {
  const { address, isConnected, status } = useAccount()
  const { authenticated, ready } = usePrivy()

  return {
    address,
    isLoggedIn: isConnected && authenticated,
    // 'reconnecting'  = wagmi restoring a saved wallet session (page refresh)
    // 'connecting'    = wagmi creating/connecting embedded wallet for Google users
    // Both mean "not settled yet" — hold the intro until they resolve
    isReady: ready && status !== 'reconnecting' && status !== 'connecting',
    isPrivyAuthenticated: authenticated,
    isWagmiConnected: isConnected,
  }
}
