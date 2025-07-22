require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("@nomicfoundation/hardhat-ignition-ethers");
const { vars } = require("hardhat/config");

require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false, // ✅ Disabled for PolkaVM compatibility
    },
  },
  resolc: {
    version: "1.5.2",
    compilerSource: "npm",
    settings: {
      optimizer: {
        enabled: true,
        parameters: "z",
        fallbackOz: true,
        runs: 200,
      },
      standardJson: true,
    },
  },
  networks: {
    hardhat: {
      polkavm: true,
      nodeConfig: {
        nodeBinaryPath:
          "/Users/wario/Documents/Polkadot_Dev/polkadot-sdk/target/release/substrate-node",
        rpcPort: 8000,
        dev: true,
      },
      adapterConfig: {
        adapterBinaryPath:
          "/Users/wario/Documents/Polkadot_Dev/polkadot-sdk/target/release/eth-rpc",
        dev: true,
      },
    },
    localNode: {
      polkavm: true,
      url: `http://127.0.0.1:8545`,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      timeout: 300000,
      // accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
    },
    passetHub: {
      polkavm: true,
      url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
      // accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      accounts: [vars.get("PRIVATE_KEY")],
      // chainId: 420420422,
      gas: 12000000,
      gasPrice: 20000000000,
      timeout: 300000,
    },

    kusamaPVM: {
      polkavm: true,
      url: "https://kusama-asset-hub-eth-rpc.polkadot.io",
      // accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      accounts: [vars.get("PRIVATE_KEY")],
      chainId: 420420418,
      gas: 12000000,
      timeout: 300000,
    },
  },

  // ✅ Extended timeouts for PolkaVM
  mocha: {
    timeout: 300000, // 5 minutes
  },
};
