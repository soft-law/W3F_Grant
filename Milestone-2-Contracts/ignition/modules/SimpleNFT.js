const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("SimpleNFT", (m) => {
  const simpleNFT = m.contract("SimpleNFT", [
    "SimpleNFT",
    "SNFT",
    "https://simplenft.com",
    100,
  ]);

  //   m.call(simpleNFT, "batchMint", [m.address, 10]);

  return { simpleNFT };
});
