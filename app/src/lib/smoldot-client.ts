import type { Client, Chain } from '@polkadot-api/smoldot'
import { importWithReload } from '@/lib/lazy-with-reload'

let clientPromise: Promise<Client> | null = null
let workerRef: Worker | null = null

export async function getSmoldotClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { startFromWorker } = await importWithReload(
        'smoldot-worker-runtime',
        () => import('polkadot-api/smoldot/from-worker'),
      )
      const worker = new Worker(
        new URL('./smoldot-worker.ts', import.meta.url),
        { type: 'module' },
      )
      workerRef = worker
      return startFromWorker(worker)
    })()
  }
  return clientPromise
}

// Browser-compatible Paseo Asset Hub bootnodes. Replacing bootNodes preserves
// the bundled chain specification's genesis identity.
const PASEO_AH_WSS_BOOTNODES = [
  '/dns/asset-hub-paseo-boot-ng.dwellir.com/tcp/443/wss/p2p/12D3KooWGoC9CdpY8T5bgf6PqKgry2DjCxaqQS7R9WdQ8rVMeEMg',
  '/dns/boot.gatotech.network/tcp/35410/wss/p2p/12D3KooWS94imuEGq76dNBJb11hDKhx4UrJ8gG7hrgaeDRzDEcGG',
  '/dns/ibp-boot-paseo-assethub.luckyfriday.io/tcp/443/wss/p2p/12D3KooWGysSK1vEWnqLyFHib2ddnbTdcngNcCjZTHCoGiNcM2vs',
  '/dns/assethub-paseo-bootnode.radiumblock.com/tcp/30336/wss/p2p/12D3KooWP8aNgAjkYzH1QuwLjYyNqfpWkJkFRgdtUuey9KzEJciq',
  '/dns/asset-hub-paseo.boot.rotko.net/tcp/30435/wss/p2p/12D3KooWLzC336hvwY7Vyjdwc8VMMMyqnwph1UXMoi1LEbw8RiHj',
  '/dns/asset-hub-paseo-bootnode.turboflakes.io/tcp/30430/wss/p2p/12D3KooWJzfVkdDnKfn2hQ1c3ysrbmReTjVKrEBHkdwgZThbB1BM',
] as const

// sm-provider requires fresh Chain objects; smoldot deduplicates the relay internally.
export async function createAssetHubChain(): Promise<Chain> {
  const client = await getSmoldotClient()
  const [{ chainSpec: relaySpec }, { chainSpec: paraSpecRaw }] = await Promise.all([
    importWithReload('paseo-chain-spec', () => import('polkadot-api/chains/paseo')),
    importWithReload('paseo-asset-hub-chain-spec', () => import('polkadot-api/chains/paseo_asset_hub')),
  ])

  // Replace only the transport bootnodes; the genesis state remains unchanged.
  const paraSpecObj = JSON.parse(paraSpecRaw) as { bootNodes: string[]; [k: string]: unknown }
  paraSpecObj.bootNodes = [...PASEO_AH_WSS_BOOTNODES]
  const paraSpec = JSON.stringify(paraSpecObj)

  const relay = await client.addChain({ chainSpec: relaySpec, disableJsonRpc: true })
  return client.addChain({
    chainSpec: paraSpec,
    potentialRelayChains: [relay],
  })
}

export function destroySmoldotClient() {
  clientPromise = null
  if (workerRef) {
    workerRef.terminate()
    workerRef = null
  }
}
