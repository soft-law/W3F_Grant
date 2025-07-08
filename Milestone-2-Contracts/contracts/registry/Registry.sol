// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "./Ownable.sol";
import {ERC721} from "./ERC721.sol";
import {IERC721} from "../interfaces/IERC721.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import {CopyrightsRegistryTypes} from "./RTypes.sol";

/// @title RCopyrights - Complete Copyrights Registry with NFT functionality
contract CopyrightsRegistry is
    Ownable,
    ERC721,
    ReentrancyGuard,
    CopyrightsRegistryTypes
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
        _nextCollectionId = 1;
        _nextCopyrightId = 1;
        _nextLicenseId = 1;
    }

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

    /// @dev Modifier to check if the caller is the collection owner
    modifier onlyCollectionOwner(uint256 _collectionId) {
        require(
            msg.sender == collections[_collectionId].owner,
            "Only collection owner can call this function"
        );
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            COLLECTION LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev Creates a new collection
    function createCollection(
        string memory _name,
        string memory _description,
        string memory _image,
        CollectionConfig memory _config
    ) public onlyOwner returns (uint256) {
        uint256 collectionId = _nextCollectionId++;

        collections[collectionId] = Collection({
            owner: msg.sender,
            name: _name,
            description: _description,
            image: _image,
            currentSupply: 0,
            config: _config,
            createdAt: block.timestamp,
            exists: true
        });

        creatorCollections[msg.sender].push(collectionId);

        emit CollectionCreated(collectionId, msg.sender, _name);

        return collectionId;
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
            collectionId: collectionId,
            author: author,
            economicRightsOwner: msg.sender,
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

        //update the collection supply
        collections[collectionId].currentSupply++;

        // Mint the copyright NFT
        _mint(msg.sender, assetId);
        _setTokenURI(assetId, _tokenUri);
        _addTokenToEnumeration(assetId);
        _addTokenToOwnerEnumeration(msg.sender, assetId);

        // Transfer the fee to the fee recipient
        payable(feeRecipient).transfer(msg.value);

        emit CopyrightRegistered(assetId, collectionId, author);

        return assetId;
    }

    /*//////////////////////////////////////////////////////////////
                        NFT WRAPPER LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev Function to wrap an NFT in the copyright wrapper
    function wrap(
        uint256 _collectionId,
        address _nftContract,
        uint256 _tokenId,
        address _author,
        EconomicCopyrights memory _rights,
        string memory _name,
        string memory _description,
        string memory _image
    ) public payable nonReentrant returns (uint256) {
        require(msg.value >= REGISTRY_FEE, "Insufficient fee");
        require(collections[_collectionId].exists, "Collection does not exist");

        IERC721 nftContract = IERC721(_nftContract);
        require(
            nftContract.ownerOf(_tokenId) == msg.sender,
            "Not the owner of the NFT"
        );

        //Transfer the NFT to the registry
        nftContract.transferFrom(msg.sender, address(this), _tokenId);

        //Get the token URI from the original NFT
        string memory tokenUri;
        try ERC721(_nftContract).tokenURI(_tokenId) returns (
            string memory uri
        ) {
            tokenUri = uri;
        } catch {
            tokenUri = "";
        }

        uint256 newId = _nextCopyrightId++;

        // NFTWrapped memory nftWrapped = NFTWrapped({
        //     registryDate: block.timestamp,
        //     originalNftContract: _nftContract,
        //     originalNftId: _tokenId
        // });

        CopyrightAsset memory copyrightAsset = CopyrightAsset({
            collectionId: _collectionId,
            author: _author,
            economicRightsOwner: msg.sender,
            name: _name,
            description: _description,
            image: _image,
            tokenUri: tokenUri,
            isValidated: false,
            originalNftContract: _nftContract,
            originalNftId: _tokenId
        });

        copyrightAssets[newId] = copyrightAsset;
        creatorAssets[_author].push(newId);
        collections[_collectionId].currentSupply++;

        _safeMint(msg.sender, newId);
        _setTokenURI(newId, tokenUri);
        _addTokenToEnumeration(newId);
        _addTokenToOwnerEnumeration(msg.sender, newId);

        // Transfer the fee to the fee recipient
        payable(feeRecipient).transfer(msg.value);

        emit CopyrightProtected(
            newId,
            msg.sender,
            _author,
            _nftContract,
            _tokenId
        );
        return newId;
    }

    function unwrap(uint256 _tokenId) public onlyEconomicRightsOwner(_tokenId) {
        CopyrightAsset memory copyrightAsset = copyrightAssets[_tokenId];

        require(
            copyrightAsset.originalNftContract != address(0),
            "NFT is not wrapped"
        );

        IERC721 nftContract = IERC721(copyrightAsset.originalNftContract);

        nftContract.transferFrom(
            address(this),
            msg.sender,
            copyrightAsset.originalNftId
        );

        _removeTokenFromEnumeration(_tokenId);
        _removeTokenFromOwnerEnumeration(msg.sender, _tokenId);

        _burn(_tokenId);

        delete copyrightAssets[_tokenId];

        emit CopyrightUnwrapped(
            _tokenId,
            msg.sender,
            copyrightAsset.author,
            copyrightAsset.originalNftContract,
            copyrightAsset.originalNftId
        );
    }

    /*//////////////////////////////////////////////////////////////
                        VALIDATION LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @dev Function to validate the copyright NFT
    function validateLegally(uint256 _tokenId) public onlyOwner {
        require(
            copyrightAssets[_tokenId].author != address(0),
            "Copyright is not registered"
        );
        copyrightAssets[_tokenId].isValidated = true;

        emit CopyrightsValidated(_tokenId, copyrightAssets[_tokenId].author);
    }

    /*//////////////////////////////////////////////////////////////
                       RIGHTS TRANSFER
    //////////////////////////////////////////////////////////////*/

    function transferEconomicRights(
        uint256 _tokenId,
        address _newOwner
    ) external onlyEconomicRightsOwner(_tokenId) {
        require(_newOwner != address(0), "Invalid new owner");

        address previousOwner = copyrightAssets[_tokenId].economicRightsOwner;
        copyrightAssets[_tokenId].economicRightsOwner = _newOwner;

        emit EconomicRightsTransferred(_tokenId, previousOwner, _newOwner);
    }

    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getCollection(
        uint256 _collectionId
    ) public view returns (Collection memory) {
        return collections[_collectionId];
    }

    function getCopyrightAsset(
        uint256 _tokenId
    ) public view returns (CopyrightAsset memory) {
        return copyrightAssets[_tokenId];
    }

    function getCreatorCollections(
        address _creator
    ) public view returns (uint256[] memory) {
        return creatorCollections[_creator];
    }

    function getCreatorAssets(
        address _creator
    ) public view returns (uint256[] memory) {
        return creatorAssets[_creator];
    }

    /*//////////////////////////////////////////////////////////////
                          ENUMERATION LOGIC
    //////////////////////////////////////////////////////////////*/

    function totalSupply() public view returns (uint256) {
        return _allTokens.length;
    }

    function tokenByIndex(uint256 index) public view returns (uint256) {
        require(index < totalSupply(), "INDEX_OUT_OF_BOUNDS");
        return _allTokens[index];
    }

    function tokenOfOwnerByIndex(
        address owner,
        uint256 index
    ) public view returns (uint256) {
        require(index < balanceOf(owner), "INDEX_OUT_OF_BOUNDS");
        return _ownedTokens[owner][index];
    }

    function tokensOfOwner(
        address owner
    ) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
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

    function transferFrom(
        address from,
        address to,
        uint256 id
    ) public virtual override {
        super.transferFrom(from, to, id);
        _removeTokenFromOwnerEnumeration(from, id);
        _addTokenToOwnerEnumeration(to, id);
    }

    /*//////////////////////////////////////////////////////////////
                  INTERNAL ENUMERATION HELPERS
    //////////////////////////////////////////////////////////////*/

    function _addTokenToEnumeration(uint256 tokenId) private {
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }

    function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
    }

    function _removeTokenFromEnumeration(uint256 tokenId) private {
        uint256 lastTokenIndex = _allTokens.length - 1;
        uint256 tokenIndex = _allTokensIndex[tokenId];

        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _allTokens[lastTokenIndex];
            _allTokens[tokenIndex] = lastTokenId;
            _allTokensIndex[lastTokenId] = tokenIndex;
        }

        _allTokens.pop();
        delete _allTokensIndex[tokenId];
    }

    function _removeTokenFromOwnerEnumeration(
        address from,
        uint256 tokenId
    ) private {
        uint256 lastTokenIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];

        if (tokenIndex != lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }

        _ownedTokens[from].pop();
        delete _ownedTokensIndex[tokenId];
    }

    /*//////////////////////////////////////////////////////////////
                           ERC165 SUPPORT
    //////////////////////////////////////////////////////////////*/

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == 0x780e9d63 || // ERC165 Interface ID for ERC721Enumerable
            super.supportsInterface(interfaceId);
    }
    /*//////////////////////////////////////////////////////////////
                            UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
