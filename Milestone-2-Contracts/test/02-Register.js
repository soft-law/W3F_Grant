const chai = require("chai");
const { expect } = chai;
const { getWallets } = require("./shared/utilities");

describe("Copyrights Registry Contract", () => {
  let copyrightsRegister;
  let owner;
  let user = "0xFD0Bb0b9F3B236F211033BCa5De04Cc0531B0250";
  let copyrightsRegisterAddress;
  let simpleNFT;
  let simpleNFTAddress;

  before(async () => {
    [owner] = await ethers.getSigners();
    console.log("Owner address:", owner.address);

    const CopyrightsRegister = await ethers.getContractFactory(
      "CopyrightsRegister"
    );
    copyrightsRegister = await CopyrightsRegister.deploy(owner.address);
    await copyrightsRegister.waitForDeployment();
    copyrightsRegisterAddress = await copyrightsRegister.getAddress();
    console.log("Copyrights Register deployed to:", copyrightsRegisterAddress);
    console.log("Copyrights Register owner:", await copyrightsRegister.owner());

    const SimpleNFT = await ethers.getContractFactory("SimpleNFT");
    simpleNFT = await SimpleNFT.deploy(
      "SimpleNFT",
      "SNFT",
      "https://test.com",
      100
    );
    await simpleNFT.waitForDeployment();
    simpleNFTAddress = await simpleNFT.getAddress();
    console.log("SimpleNFT deployed to:", simpleNFTAddress);
  });

  ///////////////////
  //////TEST 1 //////
  ///////////////////
  it("should verify the deployment of the contracts and the ownership", async () => {
    console.log(
      "The owner of copyrightsRegister is:",
      await copyrightsRegister.owner()
    );
    expect(await copyrightsRegister.owner()).to.equal(owner.address);
  });

  ///////////////////
  //////TEST 2 //////
  ///////////////////
  it("should create a copyright asset with register", async () => {
    console.log("Creating a copyright asset...");

    const economicRights = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];

    try {
      const createCopyrightTx = await copyrightsRegister.registerCopyrightAsset(
        1,
        owner.address,
        economicRights,
        "Test name",
        "Test description",
        "https://test.com/image.jpg",
        "https://test.com/tokenUri"
      );
      console.log("✅ copyright transaction:", createCopyrightTx.hash);
      const copyrightAsset = await copyrightsRegister.getCopyrightAsset(1);
      console.log("copyrightAsset:", copyrightAsset);
      expect(copyrightAsset.author).to.equal(owner.address);

      // expect(copyrightAsset.copyrights).to.equal(economicRights);
      expect(copyrightAsset.name).to.equal("Test name");
      expect(copyrightAsset.description).to.equal("Test description");
      expect(copyrightAsset.image).to.equal("https://test.com/image.jpg");
      expect(copyrightAsset.tokenUri).to.equal("https://test.com/tokenUri");
      // console.log("✅ copyrightAsset created successfully");
    } catch (error) {
      console.log("❌ CopyrightsRegister creation failed:");
      console.log("Error message:", error.message);
      console.log("Error code:", error.code);
      console.log("Full error:", error);
      throw error;
    }
  });

  ///////////////////
  //////TEST 4 //////
  ///////////////////
  it("should verify the author of the copyright asset (moral rights holder) is the original owner", async () => {
    try {
      const author = await copyrightsRegister.getAuthor(1);
      expect(author).to.equal(owner.address);
      console.log("✅ Author verified successfully!");
      console.log("Author:", author);
    } catch (error) {
      console.log("Error:", error.message);
      throw error;
    }
  });

  ///////////////////
  //////TEST 5 //////
  ///////////////////
  it("should wrap a copyright asset in a copyright NFT", async () => {
    try {
      // mint the NFT
      await simpleNFT.mint(owner.address);
      expect(await simpleNFT.ownerOf(1)).to.equal(owner.address);

      // approve the registry to transfer the NFT
      await simpleNFT
        .connect(owner)
        .approve(await copyrightsRegisterAddress, 1);

      const economicRights = {
        reproduction: true,
        distribution: true,
        rental: true,
        publicDisplay: true,
        publicPerformance: true,
        derivativeWorks: true,
        commercialUse: true,
        broadcasting: true,
        adaptation: true,
        translation: true,
      };
      // wrap the NFT

      const wrappedTx = await copyrightsRegister.wrapCopyright(
        simpleNFTAddress,
        1,
        economicRights,
        "Test name",
        "Test description",
        "https://test.com/image.jpg"
      );
      await wrappedTx.wait();
      console.log("✅ wrapped transaction:", wrappedTx.hash);

      const wrappedAsset = await copyrightsRegister.getCopyrightAsset(2);
      // console.log("wrappedAsset:", wrappedAsset);
      expect(wrappedAsset.originalNftContract).to.equal(simpleNFTAddress);
      expect(wrappedAsset.originalNftId).to.equal(1);

      expect();

      console.log("✅ wrapped asset verified successfully!");
    } catch (error) {
      console.log("Error:", error.message);
      throw error;
    }
  });

  it("should unwrap a copyright asset", async () => {
    try {
      const unwrappedTx = await copyrightsRegister.unwrapCopyright(2);
      await unwrappedTx.wait();
      console.log("✅ unwrapped transaction:", unwrappedTx.hash);
    } catch (error) {
      console.log("Error:", error.message);
      throw error;
    }
  });
});
