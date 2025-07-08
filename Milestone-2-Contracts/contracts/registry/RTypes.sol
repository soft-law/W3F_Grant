// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CopyrightsRegistry Types
 * @dev Contract for storing the types for the Copyrights Registry
 * Compliant with Berne Convention and international copyright law
 * Supports Collections, Items, Roles, NFT Wrapping and Copyright Assets
 *
 */

// This contract is used to store the types for the Copyrights Registry
contract CopyrightsRegistryTypes {
    // Beneficiary   configuration
    address public feeRecipient;

    // Registry configuration
    uint256 public constant REGISTRY_FEE = 0.01 ether;
    // License configuration
    uint256 public constant MAX_ROYALTY_RATE = 1000; // 10% in basis points

    // Collection and asset counters
    uint256 public _nextCollectionId;
    uint256 public _nextCopyrightId;
    uint256 public _nextLicenseId;

    /// @dev Collection configuration (inspired by Polkadot NFTs pallet)
    struct CollectionConfig {
        bool transferable; // Items can be transferred
        bool metadataLocked; // Metadata is locked
        bool attributesLocked; // Attributes are locked
        bool supplyLocked; // Max supply is locked
        uint256 maxSupply; // Maximum supply of items
    }

    /// @dev Collection metadata and management
    struct Collection {
        address owner;
        string name;
        string description;
        string image;
        uint256 currentSupply;
        CollectionConfig config;
        uint256 createdAt;
        bool exists;
    }

    // Copyright rights structure
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

    struct CopyrightAsset {
        uint256 collectionId;
        address author; // moral rights holder (inalienable)
        address economicRightsOwner; // economic rights holder (transferable)
        //EconomicCopyrights copyrights; //
        string name;
        string description;
        string image;
        string tokenUri;
        bool isValidated;
        address originalNftContract;
        uint256 originalNftId;
    }

    struct NFTWrapped {
        uint256 registryDate;
        address originalNftContract;
        uint256 originalNftId;
    }

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

    // Wrapping events
    event CopyrightProtected(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed author,
        address originalContract,
        uint256 originalTokenId
    );

    event CopyrightUnwrapped(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed author,
        address originalContract,
        uint256 originalTokenId
    );

    // Events
    event CollectionCreated(
        uint256 indexed collectionId,
        address indexed creator,
        string name
    );

    event CopyrightRegistered(
        uint256 indexed tokenId,
        uint256 indexed collectionId,
        address indexed author
    );

    event CopyrightsValidated(
        uint256 indexed tokenId,
        address indexed validator
    );

    event CopyrightLicensed(
        uint256 indexed tokenId,
        address indexed licensee,
        uint256 licenseId
    );

    event EconomicRightsTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to
    );

    event CollectionFrozen(uint256 indexed collectionId, bool frozen);
    event IPAssetFrozen(uint256 indexed tokenId, bool frozen);

    // Storage mappings
    mapping(uint256 => CopyrightAsset) public copyrightAssets;
    mapping(uint256 => Collection) public collections;
    mapping(uint256 => License[]) public licenses;
    mapping(address => uint256[]) public creatorCollections;
    mapping(address => uint256[]) public creatorAssets;
}
