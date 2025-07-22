// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "../Ownable.sol";
import {ERC721} from "../nft/ERC721.sol";
import {IERC721} from "../interfaces/IERC721.sol";
import {ReentrancyGuard} from "../ReentrancyGuard.sol";
import {CopyrightsRegistry} from "./Registry.sol";

/// @title RCopyrights - Complete Copyrights Registry with NFT functionality
contract CopyrightsRegister is
    Ownable,
    ERC721,
    ReentrancyGuard,
    CopyrightsRegistry
{
    /*//////////////////////////////////////////////////////////////
                            TOKEN URI STORAGE
    //////////////////////////////////////////////////////////////*/

    mapping(uint256 => string) private _tokenURIs;

    /*//////////////////////////////////////////////////////////////
                            ENUMERATION STORAGE
    //////////////////////////////////////////////////////////////*/
    uint256[] private _allTokens;
    mapping(uint256 => uint256) private _allTokensIndex;
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @dev Constructor
    constructor(
        address _feeRecipient
    ) Ownable(msg.sender) ERC721("Registry", "RCP") {
        feeRecipient = _feeRecipient;

        // Initialize the counters from CopyrightsRegistryTypes

        _nextCopyrightId = 1;
    }

    /*//////////////////////////////////////////////////////////////
                        COPYRIGHT REGISTRATION LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev Register new Copyright asset in a collection
    function registerCopyrightAsset(
        uint256 collectionId,
        address author,
        EconomicCopyrights memory rights,
        string memory _name,
        string memory _description,
        string memory _image,
        string memory _tokenUri
    ) external payable nonReentrant returns (uint256) {
        uint256 assetId = _nextCopyrightId++;

        CopyrightAsset memory copyrightAsset = CopyrightAsset({
            author: author,
            economicRightsOwner: msg.sender,
            copyrights: rights,
            name: _name,
            description: _description,
            image: _image,
            tokenUri: _tokenUri, // metadata
            isValidated: false,
            originalNftContract: address(0),
            originalNftId: 0
        });

        copyrightAssets[assetId] = copyrightAsset;
        creatorAssets[msg.sender].push(assetId);

        // Mint the copyright NFT
        _mint(msg.sender, assetId);
        _setTokenURI(assetId, _tokenUri);
        // _addTokenToEnumeration(assetId);
        // _addTokenToOwnerEnumeration(msg.sender, assetId);

        // Transfer the fee to the fee recipient
        payable(feeRecipient).transfer(msg.value);

        emit CopyrightRegistered(assetId, collectionId, author);

        return assetId;
    }

    // /*//////////////////////////////////////////////////////////////
    //                    RIGHTS TRANSFER
    // //////////////////////////////////////////////////////////////*/

    /// @notice Transfer the NFT of a copyright asset to a new owner (with economic rights)
    function transferCopyrightAsset(address to, uint256 id) public {
        address previousOwner = ownerOf(id);

        safeTransferFrom(previousOwner, to, id);
        // Update economic rights owner when NFT is transferred
        copyrightAssets[id].economicRightsOwner = to;
        emit EconomicRightsTransferred(id, previousOwner, to);
    }

    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getCopyrightAsset(
        uint256 _tokenId
    ) public view returns (CopyrightAsset memory) {
        return copyrightAssets[_tokenId];
    }

    /// @notice Get the author (moral rights holder) of a copyright asset
    function getAuthor(uint256 _tokenId) external view returns (address) {
        require(
            copyrightAssets[_tokenId].author != address(0),
            "Asset does not exist"
        );
        return copyrightAssets[_tokenId].author;
    }

    /// @notice Get the economic rights owner of a copyright asset
    function getEconomicRightsOwner(
        uint256 _tokenId
    ) external view returns (address) {
        require(
            copyrightAssets[_tokenId].author != address(0),
            "Asset does not exist"
        );
        return copyrightAssets[_tokenId].economicRightsOwner;
    }

    /// @notice Get both owners of a copyright asset
    function getAssetOwners(
        uint256 _tokenId
    ) external view returns (address author, address economicRightsOwner) {
        require(
            copyrightAssets[_tokenId].author != address(0),
            "Asset does not exist"
        );
        CopyrightAsset memory asset = copyrightAssets[_tokenId];
        return (asset.author, asset.economicRightsOwner);
    }

    /*//////////////////////////////////////////////////////////////
                        TOKEN URI LOGIC
    //////////////////////////////////////////////////////////////*/

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(
            _ownerOf[tokenId] != address(0),
            "URI query for nonexistent token"
        );
        return _tokenURIs[tokenId];
    }

    function _setTokenURI(uint256 tokenId, string memory _uri) internal {
        _tokenURIs[tokenId] = _uri;
    }

    /*//////////////////////////////////////////////////////////////
                    OVERRIDE TRANSFER LOGIC
    //////////////////////////////////////////////////////////////*/

    function safeTransferFrom(
        address from,
        address to,
        uint256 id
    ) public virtual override {
        super.safeTransferFrom(from, to, id);
        // Update economic rights owner
        copyrightAssets[id].economicRightsOwner = to;
        emit EconomicRightsTransferred(id, from, to);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        bytes calldata data
    ) public virtual override {
        super.safeTransferFrom(from, to, id, data);
        // Update economic rights owner
        copyrightAssets[id].economicRightsOwner = to;
        emit EconomicRightsTransferred(id, from, to);
    }
}
