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
//     copyrightsContract = await ethers.getContractFactory("RCopyrights");
//     licensesContract = await ethers.getContractFactory("LCopyrights");

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
// });
