> - Network name: Passet Hub
> - Chain ID: 420420422
> - RPC URL: https://testnet-passet-hub-eth-rpc.polkadot.io
> - Block Explorer URL: https://blockscout-passet-hub.parity-testnet.parity.io/

<!-- npx hardhat run scripts/debug-paseo.
js --network passetHub -->

testing:

1. Download Polkadot sdk:
   git clone https://github.com/paritytech/polkadot-sdk.git
   cd polkadot-sdk

2. Compile nodes:
   cargo build --bin substrate-node --release
   cargo build -p pallet-revive-eth-rpc --bin eth-rpc --release

3. verify the binaries are available in the target/release directory:

Substrate node path - polkadot-sdk/target/release/substrate-node
ETH-RPC adapter path - polkadot-sdk/target/release/eth-rpc

4. real testnet
   a. set private keys in hardhat
   npx hardhat vars set PRIVATE_KEY "INSERT_PRIVATE_KEY"
   npx hardhat vars set PRIVATE_KEY_2 "INSERT_PRIVATE_KEY"

   b. Check that your private key has been set up successfully by running:
   npx hardhat vars get PRIVATE_KEY
