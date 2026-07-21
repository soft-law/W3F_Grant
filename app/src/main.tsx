import { Buffer } from 'buffer'
import processShim from 'vite-plugin-node-polyfills/shims/process'
if (!globalThis.Buffer) globalThis.Buffer = Buffer
if (!globalThis.global) globalThis.global = globalThis
if (!globalThis.process) globalThis.process = processShim

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from '@privy-io/wagmi'
import { PrivyProvider } from '@privy-io/react-auth'
import { Analytics } from '@vercel/analytics/react'
import { wagmiConfig } from '@/lib/wagmi-config'
import { privyConfig } from '@/lib/privy-config'
import { clearDynamicImportRecovery, handleVitePreloadError } from '@/lib/lazy-with-reload'
import App from './App'

window.addEventListener('vite:preloadError', handleVitePreloadError)
// Keep the Vite-level loop guard across the recovery reload. Clear it only
// after the new document has had time to load its initial chunks successfully.
window.setTimeout(() => clearDynamicImportRecovery('vite-preload'), 10_000)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID as string} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <BrowserRouter>
            <App />
            <Analytics />
          </BrowserRouter>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
)
