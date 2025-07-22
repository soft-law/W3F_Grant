// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {CopyrightsRegister} from "../registry/Register.sol";

contract Licensing is CopyrightsRegister {
    constructor() CopyrightsRegister(msg.sender) {}

    /// @dev Create license for IP asset
    function createLicense(
        uint256 tokenId,
        address licensee,
        EconomicCopyrights memory grantedRights,
        uint256 duration
    ) external payable nonReentrant returns (uint256) {}

    // function to create a license for an NFT
    function offerPublicLicense(
        uint256 _tokenId,
        uint256 _price,
        uint256 _duration
    ) public onlyEconomicRightsOwner(_tokenId) {
        // TODO: Implement the logic to offer a public license for an NFT
    }

    // function to accept a license for an NFT
    function acceptPublicLicense(uint256 _tokenId) public returns (bool) {
        // TODO: Implement the logic to accept a license for an NFT
    }

    function offerPrivateLicense(
        uint256 _tokenId,
        uint256 _price,
        uint256 _duration
    ) public onlyEconomicRightsOwner(_tokenId) {
        // TODO: Implement the logic to offer a private license for an NFT
    }

    // function to accept a license for an NFT
    function acceptPrivateLicense(uint256 _tokenId) public returns (bool) {
        // TODO: Implement the logic to accept a license for an NFT
    }

    // function to reject a license for an NFT
    function rejectPrivateLicense(
        uint256 _tokenId
    ) public onlyEconomicRightsOwner(_tokenId) {
        // TODO: Implement the logic to reject a license for an NFT
    }

    /// @notice Transfer only economic rights of a copyright asset to a new owner (the nft owbnership remains with the original owner)
    function transferEconomicRights(
        uint256 _tokenId,
        address _newOwner
    ) public onlyEconomicRightsOwner(_tokenId) {
        require(_newOwner != address(0), "Invalid new owner");

        address previousOwner = ownerOf(_tokenId);
        copyrightAssets[_tokenId].economicRightsOwner = _newOwner;

        emit EconomicRightsTransferred(_tokenId, previousOwner, _newOwner);
    }
}
