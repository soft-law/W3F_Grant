// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CopyrightsRegistryTypes} from "../registry/RegistryTypes.sol";

/**
 * @title LicenseTypes
 * @dev Contract for storing the types for the License
 */

contract LicenseTypes is CopyrightsRegistryTypes {
    uint256 internal _nextLicenseId;

    struct License {
        address licenseOwner; // owner of the license
        address licensee; // who is licensed to use the NFT
        uint256 royaltyRate; // Royalty percentage (basis points)
        uint256 licensePrice; // Price for licensing
        bool digitalRights; // Digital/online rights
        uint256 territorialRights; // Bitmask for territorial rights
        uint256 exclusivityPeriod; // Exclusivity period in seconds
        uint256 ipAssetId;
        EconomicCopyrights grantedRights;
        uint256 price;
        uint256 duration; // License duration in seconds (0 = permanent)
        uint256 issuedAt;
        bool isActive;
    }

    /*//////////////////////////////////////////////////////////////
                        STORAGE MAPPINGS
    //////////////////////////////////////////////////////////////*/

    mapping(uint256 => License[]) public licenses;
}
