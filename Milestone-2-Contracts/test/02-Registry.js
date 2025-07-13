// const chai = require("chai");
// const { expect } = chai;
// const { getWallets } = require("./shared/utilities");

// describe("Copyrights Registry Contract", () => {
//   let simpleNFT;
//   let copyrightsRegistry;
//   let owner;
//   let user = "0xFD0Bb0b9F3B236F211033BCa5De04Cc0531B0250";
//   let collectionId;

//   before(async () => {
//     [owner] = await ethers.getSigners();
//     console.log("Owner address:", owner.address);

//     const SimpleNFT = await ethers.getContractFactory("SimpleNFT");
//     simpleNFT = await SimpleNFT.deploy(
//       "SimpleNFT",
//       "SNFT",
//       "https://simplenft.com",
//       100
//     );
//     await simpleNFT.waitForDeployment();
//     console.log("SimpleNFT deployed to:", await simpleNFT.getAddress());

//     const CopyrightsRegistry = await ethers.getContractFactory(
//       "CopyrightsRegistry"
//     );
//     copyrightsRegistry = await CopyrightsRegistry.deploy();
//     await copyrightsRegistry.waitForDeployment();
//     console.log(
//       "Copyrights Registry deployed to:",
//       await copyrightsRegistry.getAddress()
//     );
//     console.log("Copyrights Registry owner:", await copyrightsRegistry.owner());

//     const registryOwner = await copyrightsRegistry.owner();
//     console.log("Registry owner() returns:", registryOwner);
//     console.log("Expected owner:", owner.address);

//     // // Create a collection for testing
//     // const collectionConfig = {
//     //   maxSupply: 1000,
//     //   mintPrice: ethers.parseEther("0.01"),
//     //   royaltyPercentage: 500, // 5%
//     //   isPublic: true,
//     // };

//     // const createCollectionTx = await copyrightsRegistry.createCollection(
//     //   "Test Collection",
//     //   "A test collection for wrapped NFTs",
//     //   "https://test.com/collection.jpg",
//     //   collectionConfig
//     // );
//     // await createCollectionTx.wait();

//     // collectionId = 0; // First collection will have ID 0
//     // console.log("Collection created with ID:", collectionId);
//     // 🔍 DEBUG: Check what owner() actually returns
//   });

//   ///////////////////
//   //////TEST 1 //////
//   ///////////////////
//   it("should deploy the contracts", async () => {
//     expect(await simpleNFT.owner()).to.equal(owner.address);
//     expect(await copyrightsRegistry.owner()).to.equal(owner.address);
//   });

//   ///////////////////
//   //////TEST 2 //////
//   ///////////////////
//   it("should mint a Simple NFT, wrap it, then mint a copyright NFT and validate it", async () => {
//     // verify that the copyrights contract is owned by the owner
//     expect(await copyrightsRegistry.owner()).to.equal(owner.address);

//     // mint the Simple NFT before wrapping
//     await simpleNFT.safeMint(owner.address, 1, "https://doomie.com/1");
//     expect(await simpleNFT.ownerOf(1)).to.equal(owner.address);

//     // Approve the copyright contract to transfer the NFT
//     await simpleNFT
//       .connect(owner)
//       .approve(await copyrightsRegistry.getAddress(), 1);

//     // 3. Wrap the NFT
//     let simpleNFTAddress = await simpleNFT.getAddress();
//     console.log("SimpleNFT Address:", simpleNFTAddress);

//     // Create economic rights structure (you'll need to adjust this based on your actual struct)
//     const economicRights = {
//       // Add the actual fields from your EconomicCopyrights struct
//       // This is a placeholder - adjust according to your struct definition
//       reproduction: true,
//       distribution: true,
//       publicDisplay: true,
//       adaptation: true,
//     };

//     let wrappedTx;
//     try {
//       wrappedTx = await copyrightsRegistry.wrap(
//         collectionId, // collection ID
//         simpleNFTAddress, // NFT contract address
//         1, // original token ID
//         owner.address, // author
//         economicRights, // economic rights struct
//         "Doomie NFT", // name
//         "Doomie NFT Description", // description
//         "https://doomie.com/1" // image
//       );

//       await wrappedTx.wait(); // Wait for transaction to be mined
//       console.log("Wrap transaction successful:", wrappedTx.hash);

//       // 4. Check that the original NFT is now owned by the copyright contract
//       expect(await simpleNFT.ownerOf(1)).to.equal(
//         await copyrightsRegistry.getAddress()
//       );

//       // 5. Check that owner now has the copyright NFT (token ID will be 0, the first copyright NFT)
//       expect(await copyrightsRegistry.ownerOf(0)).to.equal(owner.address);

//       // 6. Verify the copyright asset data
//       const copyrightAsset = await copyrightsRegistry.getCopyrightAsset(0);
//       expect(copyrightAsset.author).to.equal(owner.address);
//       expect(copyrightAsset.originalNftContract).to.equal(simpleNFTAddress);
//       expect(copyrightAsset.originalNftId).to.equal(1);
//       expect(copyrightAsset.name).to.equal("Doomie NFT");

//       console.log("✅ NFT successfully wrapped!");
//       console.log("Copyright Token ID:", 0);
//       console.log(
//         "Original NFT locked in contract:",
//         await copyrightsRegistry.getAddress()
//       );
//     } catch (error) {
//       console.log("Error:", error.message);
//       throw error;
//     }
//   });

//   ///////////////////
//   //////TEST 3 //////
//   ///////////////////
//   it("should mint a second NFT, wrap it, and then unwrap it", async () => {
//     // 1. First mint the NFT
//     await simpleNFT.safeMint(owner.address, 2, "https://doomie.com/2");
//     expect(await simpleNFT.ownerOf(2)).to.equal(owner.address);

//     // 2. Approve the copyright contract to transfer the NFT
//     await simpleNFT
//       .connect(owner)
//       .approve(await copyrightsRegistry.getAddress(), 2);

//     // 3. Wrap the NFT
//     let simpleNFTAddress = await simpleNFT.getAddress();
//     console.log("SimpleNFT Address:", simpleNFTAddress);

//     const economicRights = {
//       reproduction: true,
//       distribution: true,
//       publicDisplay: true,
//       adaptation: true,
//     };

//     let wrappedTx;
//     try {
//       wrappedTx = await copyrightsRegistry.wrap(
//         collectionId, // collection ID
//         simpleNFTAddress, // NFT contract address
//         2, // original token ID
//         owner.address, // author
//         economicRights, // economic rights struct
//         "Doomie NFT 2", // name
//         "Doomie NFT 2 Description", // description
//         "https://doomie.com/2" // image
//       );

//       await wrappedTx.wait();
//       console.log("Wrap transaction successful");

//       // 4. Check that the original NFT is now owned by the copyright contract
//       expect(await simpleNFT.ownerOf(2)).to.equal(
//         await copyrightsRegistry.getAddress()
//       );

//       // 5. Check that owner now has the copyright NFT (token ID will be 1, the second copyright NFT)
//       expect(await copyrightsRegistry.ownerOf(1)).to.equal(owner.address);

//       // 6. Verify the copyright asset data
//       const copyrightAsset = await copyrightsRegistry.getCopyrightAsset(1);
//       expect(copyrightAsset.author).to.equal(owner.address);
//       expect(copyrightAsset.originalNftContract).to.equal(simpleNFTAddress);
//       expect(copyrightAsset.originalNftId).to.equal(2);
//       expect(copyrightAsset.name).to.equal("Doomie NFT 2");

//       console.log("✅ NFT successfully wrapped!");
//       console.log("Copyright Token ID:", 1);
//       console.log(
//         "Original NFT locked in contract:",
//         await copyrightsRegistry.getAddress()
//       );
//     } catch (error) {
//       console.log("Error:", error.message);
//       throw error;
//     }

//     // 7. Unwrap the NFT
//     let unwrappedTx;
//     try {
//       unwrappedTx = await copyrightsRegistry.connect(owner).unwrap(1);
//       await unwrappedTx.wait();

//       // Check that the original NFT is back with the owner
//       expect(await simpleNFT.ownerOf(2)).to.equal(owner.address);
//       console.log("✅ NFT successfully unwrapped to owner:", owner.address);
//     } catch (error) {
//       console.log("Error:", error.message);
//       throw error;
//     }
//   });
// });

// Test minimal para debuggear el ContractTrapped error
const chai = require("chai");
const { expect } = chai;

describe("Minimal Debug Test", () => {
  let owner;

  before(async () => {
    [owner] = await ethers.getSigners();
    console.log("🔍 Owner address:", owner.address);
  });

  it("should deploy SimpleNFT first", async () => {
    console.log("📦 Deploying SimpleNFT...");
    try {
      const SimpleNFT = await ethers.getContractFactory("SimpleNFT");
      const simpleNFT = await SimpleNFT.connect(owner).deploy(
        "SimpleNFT",
        "SNFT",
        "https://simplenft.com/",
        100
      );
      await simpleNFT.waitForDeployment();

      console.log("✅ SimpleNFT deployed to:", await simpleNFT.getAddress());
      console.log("✅ SimpleNFT owner:", await simpleNFT.owner());

      expect(await simpleNFT.owner()).to.equal(owner.address);
    } catch (error) {
      console.log("❌ SimpleNFT deployment failed:", error.message);
      throw error;
    }
  });

  it("should deploy CopyrightsRegistry step by step", async () => {
    console.log("📦 Getting CopyrightsRegistry factory...");

    try {
      const CopyrightsRegistry = await ethers.getContractFactory(
        "CopyrightsRegistry"
      );
      console.log("✅ Factory created successfully");

      console.log("📦 Deploying CopyrightsRegistry...");
      const copyrightsRegistry = await CopyrightsRegistry.connect(owner).deploy(
        owner.address
      );
      console.log("✅ Deployment transaction sent");

      await copyrightsRegistry.waitForDeployment();
      console.log("✅ Deployment confirmed");

      const deployedAddress = await copyrightsRegistry.getAddress();
      console.log("✅ Contract deployed to:", deployedAddress);

      const contractOwner = await copyrightsRegistry.owner();
      console.log("✅ Contract owner:", contractOwner);
      console.log("✅ Expected owner:", owner.address);

      expect(contractOwner).to.equal(owner.address);
    } catch (error) {
      console.log("❌ CopyrightsRegistry deployment failed:");
      console.log("Error message:", error.message);
      console.log("Error code:", error.code);
      console.log("Full error:", error);
      throw error;
    }
  });

  it("should create a collection", async () => {
    console.log("📦 Creating collection...");

    try {
      const CopyrightsRegistry = await ethers.getContractFactory(
        "CopyrightsRegistry"
      );
      const copyrightsRegistry = await CopyrightsRegistry.connect(owner).deploy(
        owner.address
      );
      await copyrightsRegistry.waitForDeployment();

      const collectionConfig = {
        transferable: true,
        metadataLocked: false,
        attributesLocked: false,
        supplyLocked: false,
        maxSupply: 1000,
      };

      const createTx = await copyrightsRegistry
        .connect(owner)
        .createCollection(
          "Test Collection",
          "A test collection",
          "https://test.com/image.jpg",
          collectionConfig
        );
      await createTx.wait();

      console.log("✅ Collection created successfully");

      const collection = await copyrightsRegistry.getCollection(1);
      expect(collection.exists).to.be.true;
      console.log("✅ Collection verified");
    } catch (error) {
      console.log("❌ Collection creation failed:", error.message);
      throw error;
    }
  });
});
