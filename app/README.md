# Soft.Law — Decentralized IP Licensing Platform

A blockchain-based intellectual property registration, licensing, and dispute resolution platform built on [Polkadot Hub](https://polkadot.com).

## What It Does

- **Register IP** — Mint an ERC-721 NFT representing your intellectual property asset
- **License It** — Create ERC-1155 license tokens with configurable terms (exclusivity, duration, payments)
- **Trade IP** — Marketplace for listing, buying, and making offers on IP assets and licenses
- **Resolve Disputes** — On-chain arbitration via the GovernanceArbitrator contract (30-day resolution window)
- **Earn Revenue** — Automatic revenue distribution and royalty splitting via smart contract

## Tech Stack

- **Frontend**: React 19 + TypeScript 6 + Vite 8 (Rolldown+Oxc) + Tailwind CSS 4
- **Blockchain**: [Polkadot Hub](https://docs.polkadot.com/smart-contracts/overview/) (Solidity compiled with `resolc` to PVM bytecode and executed through `pallet_revive`)
- **Wallet**: [Privy](https://privy.io) (Google social login + injected EVM wallets — MetaMask, Talisman)
- **Contract Interaction**: wagmi v3 + viem v2 + PAPI (EIP-1559 type-2 transactions, dynamic gas via ReviveApi)
- **Storage**: IPFS via [Pinata](https://pinata.cloud)
- **i18n**: English + Spanish

## Quick Start

```bash
bun install --frozen-lockfile
cp .env.example .env
# Fill in VITE_PRIVY_APP_ID, VITE_INDEXER_URL, VITE_PINATA_GATEWAY,
# PINATA_JWT (server-side), and STRIPE_SECRET_KEY
bun dev
```

Open [http://localhost:5173](http://localhost:5173)

## Smart Contracts

Deployed on **Polkadot Hub Testnet** (Chain ID: 420420417):

| Contract | Address |
|----------|---------|
| IPAsset (ERC-721) | `0xdf141b3e2c063b60a36d17cbedf0585052eb0447` |
| LicenseToken (ERC-1155) | `0xb394cbd030936f3e60199facf34477d8c1a819e2` |
| Marketplace | `0xc6e62682d0e8a4eb6079f612f94b6c8277daee88` |
| GovernanceArbitrator | `0x23ff1e43b4b4e05dc2b49b2f648dc189e1b7ffe2` |
| RevenueDistributor | `0x5b5e657092b9090d34ac262f47106bec7c5a2a2c` |

> Source of truth: [`src/lib/contracts.ts`](src/lib/contracts.ts) — `CONTRACT_ADDRESSES`.

Contract source code:
[soft-law/softlaw-contracts](https://github.com/soft-law/softlaw-contracts)

## Authentication

Privy is the single authentication provider (`src/lib/privy-config.ts`). Supported login methods:

- **Google** — social OAuth, creates an embedded EVM wallet
- **Injected EVM wallets** — MetaMask, Talisman, and any EIP-6963 wallet

Telegram login was removed from the production configuration.

## Data layer

Production uses `https://api.soft.law` for discovery and history. An SSE stream
invalidates query caches as blocks are confirmed.

For known asset, licence, listing, or dispute identifiers, the application can
fall back to direct PAPI reads of current contract state when an indexed detail
request is unavailable. Direct reads do not replace the indexer for complete
collection discovery or historical event and transaction queries because the
deployed contracts do not expose bounded historical enumeration.

## Architecture

```
src/
├── abis/              # Contract ABIs (auto-generated from forge build)
├── components/        # Reusable UI components (NavBar, Button, Toast, etc.)
├── contexts/          # React contexts (DataPreloader, PapiProvider)
├── hooks/             # Custom hooks (useContracts, useContractWrite, useAuth)
├── lib/               # Utilities (contracts, IPFS, i18n, wagmi config, theme)
└── pages/
    └── dashboard/
        ├── sections/  # IP, Marketplace, Disputes, Explorer
        ├── modals/    # RegisterIP, CreateLicense, CreateListing, etc.
        └── components/# Reusable dashboard components
```

## Backend Services

| Service | Location | Purpose |
|---------|----------|---------|
| **Indexer API** | `https://api.soft.law` | Blockchain event indexing, fast queries |
| **Stripe Checkout** | Vercel `/api/create-checkout` | Creates Stripe payment sessions |
| **IPFS Sign** | Vercel `/api/pinata-sign` | Issues scoped Pinata signed URLs (JWT server-side, files upload direct from browser) |
| **IPFS Metadata** | Vercel `/api/upload-ipfs` | Pins JSON metadata to Pinata |
| **Stripe Webhook + Token Funding** | Indexer `/api/payments/webhook` | Receives Stripe events, sends PAS tokens |

Indexer source: [soft-law/indexer](https://github.com/soft-law/indexer)

## Key Features

- **Polkadot Hub PVM Execution**: Uses `useContractWrite` with Ethereum-compatible JSON-RPC, EIP-1559 type-2 transactions, and dynamic gas pricing via PAPI `ReviveApi.gas_price()`; deployed contracts are native PVM artifacts, not EVM bytecode
- **Social Login**: Google via Privy creates an embedded EVM wallet; injected wallets (MetaMask, Talisman) connect directly
- **Bilingual**: Full English and Spanish translation support
- **Dark/Light Theme**: System-aware with manual toggle
- **IPFS Direct Upload**: Files upload directly from the browser to Pinata via short-lived signed URLs — no Vercel body-size cap. Limits: images 10 MB, audio 100 MB, video 500 MB, documents 50 MB, archives 100 MB. JSON metadata is pinned server-side. `PINATA_JWT` never reaches the browser
- **Real-Time Block Feed**: Server-sent events from the indexer push pending and confirmed blocks; the app refreshes caches the instant a tx confirms instead of waiting for the next poll
- **Indexer Integration**: Feature-flagged, replaces Blockscout/Routescan with single API

## Build

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run build
```

For a live product evaluation, follow
[`EVALUATOR_WALKTHROUGH.md`](./EVALUATOR_WALKTHROUGH.md).

## License

[Apache License 2.0](LICENSE)

Copyright 2026 Softlaw S.A. de C.V.
