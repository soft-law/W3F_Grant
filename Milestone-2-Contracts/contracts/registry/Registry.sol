// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CopyrightsRegistry Types
 * @dev Contract for storing the types for the Copyrights Registry
 * Compliant with Berne Convention and international copyright law
 * Supports Collections, Items, Roles, NFT Wrapping and Copyright Assets
 *
 */

// This contract is used as the main registry for the Copyrights Registry
contract CopyrightsRegistry {
    // Asset counters
    uint256 internal _nextCopyrightId;
    // Registry configuration (fee for the registry)
    uint256 public constant REGISTRY_FEE = 0.01 ether;
    // Beneficiary configuration (address that receives the fees)
    address internal feeRecipient;

    // Copyright rights structure (economic rights)
    struct EconomicCopyrights {
        bool reproduction; // Right to prevent copying
        bool distribution; // Right to sell copies
        bool rental; // Right to rent
        bool publicDisplay; // Right to publicly display
        bool publicPerformance; // Right to publicly perform
        bool derivativeWorks; // Right to create derivatives
        bool commercialUse; // Commercial usage rights
        bool broadcasting;
        bool translation;
        bool adaptation; // adapt/modify
    }

    // Copyright asset structure (copyright NFT)
    struct CopyrightAsset {
        address author; // moral rights holder (inalienable)
        address economicRightsOwner; // economic rights holder (transferable)
        EconomicCopyrights copyrights; //
        string name;
        string description;
        string image;
        string tokenUri;
        bool isValidated;
        address originalNftContract;
        uint256 originalNftId;
    }

    event CopyrightRegistered(
        uint256 indexed tokenId,
        uint256 indexed collectionId,
        address indexed author
    );

    event EconomicRightsTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to
    );
    // Storage mappings
    mapping(uint256 => CopyrightAsset) public copyrightAssets;
    mapping(address => uint256[]) public creatorAssets;

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Modifier to check if the caller is the economic rights owner of the copyright NFT
    modifier onlyEconomicRightsOwner(uint256 _tokenId) {
        require(
            msg.sender == copyrightAssets[_tokenId].economicRightsOwner,
            "Only economic rights owner can call this function"
        );
        _;
    }

    /// @dev Modifier to check if the caller is the author / moral rights holder of the copyright NFT
    modifier onlyAuthor(uint256 _tokenId) {
        require(
            msg.sender == copyrightAssets[_tokenId].author,
            "Only author - moral rights holder can call this function"
        );
        _;
    }
}
