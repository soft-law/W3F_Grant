// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "../Ownable.sol";
import {CopyrightsRegistry} from "../registry/Registry.sol";

contract RightsValidation is Ownable, CopyrightsRegistry {
    // /*//////////////////////////////////////////////////////////////
    //                     CONSTRUCTOR
    // //////////////////////////////////////////////////////////////*/
    constructor() Ownable(msg.sender) {}

    // /*//////////////////////////////////////////////////////////////
    //                     VALIDATION LOGIC
    // //////////////////////////////////////////////////////////////*/

    /// @dev Function to validate the copyright NFT
    function validateLegally(uint256 _tokenId) public onlyOwner {
        require(
            copyrightAssets[_tokenId].author != address(0),
            "Copyright is not registered"
        );
        copyrightAssets[_tokenId].isValidated = true;

        emit CopyrightsValidated(_tokenId, copyrightAssets[_tokenId].author);
    }

    function validateRights(uint256 _tokenId) public view returns (bool) {
        return true;
    }

    event CopyrightsValidated(
        uint256 indexed tokenId,
        address indexed validator
    );
}
