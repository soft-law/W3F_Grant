const chai = require("chai");
const { expect } = chai;
const { getWallets } = require("./shared/utilities");
const { ethers } = require("hardhat");

describe("SimpleNFT Contract", () => {
  let owner;
  let user = "0xFD0Bb0b9F3B236F211033BCa5De04Cc0531B0250";
  let simpleNFT;

  before(async () => {
    [owner] = await ethers.getSigners();
    console.log("Owner:", owner.address);

    const SimpleNFT = await ethers.getContractFactory("SimpleNFT");
    simpleNFT = await SimpleNFT.deploy(
      "SimpleNFT",
      "SNFT",
      "https://simplenft.com",
      100
    );
    await simpleNFT.waitForDeployment();
    console.log("SimpleNFT deployed to:", await simpleNFT.getAddress());
  });

  it("should deploy the contracts", async () => {
    expect(await simpleNFT.owner()).to.equal(owner.address);
  });

  it("should mint a simple NFT", async () => {
    await simpleNFT.mint(owner.address);
    expect(await simpleNFT.ownerOf(1)).to.equal(owner.address);
  });

  it("should mint batch of simple NFT", async () => {
    await simpleNFT.batchMint(owner.address, 10);
    expect(await simpleNFT.totalSupply()).to.equal(11);
  });

  it("should burn a simple NFT", async () => {
    await simpleNFT.burn(1);
  });

  it("should transfer  a simple NFT", async () => {
    await simpleNFT.transferFrom(owner.address, user, 2);
    expect(await simpleNFT.ownerOf(2)).to.equal(user);
  });
});
