# Milestone 3 Evaluator Walkthrough

## Network

- Application: [https://app.soft.law/](https://app.soft.law/)
- Network: Polkadot Hub Testnet
- Chain ID: `420420417`
- Native token: `PAS`
- Faucet: [Paseo faucet](https://faucet.polkadot.io/?parachain=1000)

Use a test-only wallet. Never use a wallet holding production funds.

## 1. Connect and inspect

1. Open the application.
2. Connect with Google or an injected EVM-compatible wallet.
3. Confirm the network indicator shows Polkadot Hub Testnet.
4. Open Explorer and inspect the public assets, licences, listings, offers,
   disputes, and activity feed.

## 2. Register an IP asset

1. Open Studio and choose **Register IP**.
2. Add title, category, description, authorship information, and a media file.
3. Choose public or confidential visibility.
4. Review the prepared metadata and confirm the wallet transaction.
5. Wait for finalisation. The newly registered item should appear immediately
   as receipt-derived optimistic state and then reconcile with the indexer.

## 3. Create each licence profile

From an IP asset you own, open **Create Licence** and inspect the available
profiles:

- Non-Exclusive
- Exclusive
- Sole
- CC BY
- CC BY-NC
- CC BY-ND
- CC BY-SA
- CC0
- Remix

For one test profile, configure its rights, term, supply, payment cadence, and
optional confidential deliverable. Review the generated agreement, sign, and
submit the mint transaction. The commercial sale price is set separately when
the resulting licence is listed.

## 4. Marketplace

1. From an owned asset or licence, create a listing.
2. Open the listing detail route and verify the item, seller, price, and status.
3. With a second test wallet, create an offer or buy the listing.
4. With the seller wallet, accept or reject the offer.
5. Verify the resulting ownership and activity in the detail page and Explorer.

## 5. Revenue

1. Open the revenue views for the relevant IP/licence owner.
2. Inspect configured royalty splits, accrued balances, distributions, and
   withdrawal history where data exists.
3. Compare the current balance read with the indexed historical entries.

## 6. Disputes

1. Open an eligible asset or licence and submit a dispute with a reason and
   evidence URI.
2. Inspect the dispute detail route and status timeline.
3. Resolution and award execution are visible only to authorised arbitrators.

Submission writes to testnet and locks the configured dispute bond. Do not test
privileged resolution with an unapproved wallet.

## 7. Accessibility and resilience checks

1. Switch between English and Spanish.
2. Switch between light and dark themes.
3. Temporarily block the indexer endpoint in browser developer tools.
4. Confirm the UI reports degraded discovery instead of falsely showing empty
   ownership, and that known current-state detail routes can use direct reads.
5. Restore connectivity and confirm cached/optimistic state reconciles.

## Expected limitations

- Full collection discovery, event history, and transaction history depend on
  the indexer because the deployed contracts do not expose bounded historical
  enumeration.
- Confidential key storage/decryption and fiat checkout require backend
  services and do not pretend to operate through the light client.
- Google login depends on Privy. Wallet login remains available through
  compatible injected providers.
