// const chai = require("chai");
// const { expect } = chai;
// const { getWallets } = require("./shared/utilities");
// const { ethers } = require("hardhat");

// describe("Licensing Contract", () => {
//   let copyrights;
//   let licenses;
//   let owner;
//   let user = "0xFD0Bb0b9F3B236F211033BCa5De04Cc0531B0250";
//   let doomieNFT;

//   beforeEach(async () => {
//     [owner] = await ethers.getSigners();
//     console.log("Owner:", owner.address);

//     let user = await ethers.getSigner(user);
//     console.log("User:", user.address);

//     // Deploy contracts
//     copyrightsContract = await ethers.getContractFactory("Register");
//     licensesContract = await ethers.getContractFactory("Licensing");

//     copyrights = await copyrightsContract.deploy(owner.address);
//     await copyrights.waitForDeployment();
//     console.log(
//       "Copyrights contract deployed to:",
//       await copyrights.getAddress()
//     );

//     licenses = await licensesContract.deploy(owner.address);
//     await licenses.waitForDeployment();
//     console.log("Licenses contract deployed to:", await licenses.getAddress());
//   });

//   ///////////////////
//   //////TEST 1 //////
//   ///////////////////
//   it("should offer a public license for a copyright NFT", async () => {
//     // 1. First mint the doomie  NFT
//     await doomieNFT.safeMint(owner.address, 1, "https://doomie.com/1");
//     expect(await doomieNFT.ownerOf(1)).to.equal(owner.address);

//     // 2. Approve the copyright contract to transfer the NFT
//     await doomieNFT.connect(owner).approve(await copyrights.getAddress(), 1);

//     // 3. Mint a copyright NFT
//     await copyrights.connect(owner).mint(1, "https://doomie.com/1");
//     expect(await copyrights.ownerOf(1)).to.equal(owner.address);

//     // 4. Offer a public license for the copyright NFT
//     await licenses.connect(owner).offerPublicLicense(1, 100, 100);
//   });

//   ///////////////////
//   //////TEST 1 //////
//   ///////////////////

//   ///////////////////
//   //////TEST 2 //////
//   ///////////////////
//   it("should mint a new copyright asset and transfer only the economic rights to the user", async () => {
//     try {
//       const createCopyrightTx = await copyrightsRegister.registerCopyrightAsset(
//         2,
//         owner.address,
//         economicRights,
//         "Test name",
//         "Test description",
//         "https://test.com/image.jpg",
//         "https://test.com/tokenUri"
//       );
//       await createCopyrightTx.wait();
//       console.log("✅ copyright transaction:", createCopyrightTx.hash);
//       console.log("✅ copyrightAsset created successfully");
//       const copyrightAsset = await copyrightsRegister.getCopyrightAsset(2);
//       console.log("copyrightAsset:", copyrightAsset);
//       expect(copyrightAsset.author).to.equal(owner.address);
//       console.log("author:", copyrightAsset.author);
//       expect(copyrightAsset.economicRightsOwner).to.equal(owner.address);
//       console.log("economicRightsOwner:", copyrightAsset.economicRightsOwner);

//       const transferEconomicRightsTx =
//         await copyrightsRegister.transferEconomicRights(2, user);
//       await transferEconomicRightsTx.wait();
//       console.log(
//         "✅ transferEconomicRights transaction:",
//         transferEconomicRightsTx.hash
//       );
//       console.log(
//         "✅ Economic rights transferred successfully! to user:",
//         user
//       );

//       const economicRightsOwner =
//         await copyrightsRegister.getEconomicRightsOwner(2);
//       expect(economicRightsOwner).to.equal(user);
//       console.log("✅ Economic rights owner verified successfully!");
//       console.log("Economic rights owner:", economicRightsOwner);
//     } catch (error) {
//       console.log("Error:", error.message);
//       throw error;
//     }
//   });

///////////////////
//////TEST 3 //////
///////////////////
// it("should transfer the economic rights to the other party", async () => {
//   try {
//     const transfertx = await copyrightsRegister.transferEconomicRights(
//       // owner.address,
//       1,
//       user
//     );
//     await transfertx.wait();
//     console.log(
//       "Transfer economic rights transaction successful:",
//       transfertx.hash
//     );

//     console.log("ownerOf:", await copyrightsRegister.ownerOf(1), "user:", user);

//     // Check that owner now has the copyright NFT (token ID is 1)
//     expect(await copyrightsRegister.ownerOf(1)).to.equal(user);

//     // Verify the copyright asset data
//     const copyrightAsset = await copyrightsRegister.getCopyrightAsset(1);
//     expect(copyrightAsset.economicRightsOwner).to.equal(user);
//     console.log("✅ Economic rights transferred successfully!");
//     console.log("Copyright Token ID:", 1);
//   } catch (error) {
//     console.log("Error:", error.message);
//     throw error;
//   }
// });
// });
