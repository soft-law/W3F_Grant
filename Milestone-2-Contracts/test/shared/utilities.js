const { getBigInt } = require("ethers");
const { ethers } = require("hardhat");

function expandTo18Decimals(n) {
  return getBigInt(n) * getBigInt("1000000000000000000");
}

function getWallets(n) {
  const provider = new ethers.JsonRpcProvider(hre.network.config.url);
  const allWallets = hre.network.config.accounts.map(
    (account) => new ethers.Wallet(account, provider)
  );
  return allWallets.slice(0, n);
}

module.exports = { expandTo18Decimals, getWallets };
