require("@nomicfoundation/hardhat-toolbox");

require("@parity/hardhat-polkadot");
require("@nomicfoundation/hardhat-ignition-ethers");
const { vars } = require("hardhat/config");

require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
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
      // accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
    },
    passetHub: {
      polkavm: true,
      url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
      // accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      accounts: [vars.get("PRIVATE_KEY")],
      // chainId: 420420422,
      // timeout: 120000,
      // gas: "auto",
      // gasPrice: "auto",
    },

    kusamaPVM: {
      polkavm: true,
      url: "https://kusama-asset-hub-eth-rpc.polkadot.io",
      // accounts: [process.env.PRIVATE_KEY1, process.env.PRIVATE_KEY2],
      accounts: [vars.get("PRIVATE_KEY")],
      chainId: 420420418,
    },
  },
};
