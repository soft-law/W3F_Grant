// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CopyrightsRegister} from "./Register.sol";
import {IERC721} from "../interfaces/IERC721.sol";

/// @title RCopyrights - Complete Copyrights Registry with NFT functionality
contract CopyrightsWrapper is CopyrightsRegister {
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
                            Events
    //////////////////////////////////////////////////////////////*/

    struct CopyrightWrapped {
        uint256 registryDate;
        address originalNftContract;
        uint256 originalNftId;
    }

    event CopyrightUnwrapped(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed author,
        address originalContract,
        uint256 originalTokenId
    );

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @dev Constructor
    constructor(address _feeRecipient) CopyrightsRegister(msg.sender) {
        feeRecipient = _feeRecipient;

        // Initialize the counters from CopyrightsRegistryTypes

        _nextCopyrightId = 1;
    }

    /*//////////////////////////////////////////////////////////////
                        COPYRIGHT WRAPPER LOGIC
    //////////////////////////////////////////////////////////////*/

    function wrapCopyright(
        address _nftContract,
        uint256 _tokenId,
        EconomicCopyrights memory rights,
        string memory _name,
        string memory _description,
        string memory _image
    ) public returns (uint256) {
        // require(msg.value >= REGISTRY_FEE, "Insufficient fee");
        // require(collections[_collectionId].exists, "Collection does not exist");

        // require(
        //     nftContract.ownerOf(_tokenId) == msg.sender,
        //     "Not the owner of the NFT"
        // );

        IERC721 nftContract = IERC721(_nftContract);

        //Transfer the NFT to the registry
        nftContract.transferFrom(msg.sender, address(this), _tokenId);

        //Get the token URI from the original NFT
        // string memory tokenUri = "";
        // try nftContract.tokenURI(_tokenId) returns (string memory uri) {
        //     tokenUri = uri;
        // } catch {
        //     tokenUri = "";
        // }

        uint256 newId = _nextCopyrightId++;

        // // NFTWrapped memory nftWrapped = NFTWrapped({
        //     registryDate: block.timestamp,
        //     originalNftContract: _nftContract,
        //     originalNftId: _tokenId
        // });

        address _author = msg.sender;

        CopyrightAsset memory copyrightAsset = CopyrightAsset({
            author: _author,
            economicRightsOwner: msg.sender,
            copyrights: rights,
            name: _name,
            description: _description,
            image: _image,
            tokenUri: "", // metadata
            isValidated: false,
            originalNftContract: _nftContract,
            originalNftId: _tokenId
        });

        copyrightAssets[newId] = copyrightAsset;
        // creatorAssets[_author].push(newId);
        // collections[_collectionId].currentSupply++;

        // _safeMint(msg.sender, newId);
        // _setTokenURI(newId, tokenUri);
        // _addTokenToEnumeration(newId);
        // _addTokenToOwnerEnumeration(msg.sender, newId);

        // Transfer the fee to the fee recipient
        // payable(feeRecipient).transfer(msg.value);

        // emit CopyrightProtected(
        //     newId,
        //     msg.sender,
        //     _author,
        //     _nftContract,
        //     _tokenId
        // );
        return newId;
    }

    // function unwrap(uint256 _tokenId) public onlyEconomicRightsOwner(_tokenId) {
    //     CopyrightAsset memory copyrightAsset = copyrightAssets[_tokenId];

    //     require(
    //         copyrightAsset.originalNftContract != address(0),
    //         "NFT is not wrapped"
    //     );

    //     IERC721 nftContract = IERC721(copyrightAsset.originalNftContract);

    //     nftContract.transferFrom(
    //         address(this),
    //         msg.sender,
    //         copyrightAsset.originalNftId
    //     );

    //     _removeTokenFromEnumeration(_tokenId);
    //     _removeTokenFromOwnerEnumeration(msg.sender, _tokenId);

    //     _burn(_tokenId);

    //     delete copyrightAssets[_tokenId];

    //     emit CopyrightUnwrapped(
    //         _tokenId,
    //         msg.sender,
    //         copyrightAsset.author,
    //         copyrightAsset.originalNftContract,
    //         copyrightAsset.originalNftId
    //     );
    // }

    // /*//////////////////////////////////////////////////////////////
    //                     VALIDATION LOGIC
    // //////////////////////////////////////////////////////////////*/

    // /// @dev Function to validate the copyright NFT
    // function validateLegally(uint256 _tokenId) public onlyOwner {
    //     require(
    //         copyrightAssets[_tokenId].author != address(0),
    //         "Copyright is not registered"
    //     );
    //     copyrightAssets[_tokenId].isValidated = true;

    //     emit CopyrightsValidated(_tokenId, copyrightAssets[_tokenId].author);
    // }

    // /*//////////////////////////////////////////////////////////////
    //                    RIGHTS TRANSFER
    // //////////////////////////////////////////////////////////////*/

    // function transferEconomicRights(
    //     uint256 _tokenId,
    //     address _newOwner
    // ) external onlyEconomicRightsOwner(_tokenId) {
    //     require(_newOwner != address(0), "Invalid new owner");

    //     address previousOwner = copyrightAssets[_tokenId].economicRightsOwner;
    //     copyrightAssets[_tokenId].economicRightsOwner = _newOwner;

    //     emit EconomicRightsTransferred(_tokenId, previousOwner, _newOwner);
    // }

    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    // function getCreatorCollections(
    //     address _creator
    // ) public view returns (uint256[] memory) {
    //     return creatorCollections[_creator];
    // }

    // function getCreatorAssets(
    //     address _creator
    // ) public view returns (uint256[] memory) {
    //     return creatorAssets[_creator];
    // }

    // /*//////////////////////////////////////////////////////////////
    //                       ENUMERATION LOGIC
    // //////////////////////////////////////////////////////////////*/

    // function totalSupply() public view returns (uint256) {
    //     return _allTokens.length;
    // }

    // function tokenByIndex(uint256 index) public view returns (uint256) {
    //     require(index < totalSupply(), "INDEX_OUT_OF_BOUNDS");
    //     return _allTokens[index];
    // }

    // function tokenOfOwnerByIndex(
    //     address _owner,
    //     uint256 index
    // ) public view returns (uint256) {
    //     require(index < balanceOf(_owner), "INDEX_OUT_OF_BOUNDS");
    //     return _ownedTokens[_owner][index];
    // }

    // function tokensOfOwner(
    //     address _owner
    // ) external view returns (uint256[] memory) {
    //     return _ownedTokens[_owner];
    // }

    /*//////////////////////////////////////////////////////////////
                        TOKEN URI LOGIC
    //////////////////////////////////////////////////////////////*/

    // function tokenURI(
    //     uint256 tokenId
    // ) public view override returns (string memory) {
    //     require(
    //         _ownerOf[tokenId] != address(0),
    //         "URI query for nonexistent token"
    //     );
    //     return _tokenURIs[tokenId];
    // }

    // function _setTokenURI(
    //     uint256 tokenId,
    //     string memory _uri
    // ) internal override {
    //     _tokenURIs[tokenId] = _uri;
    // }

    /*//////////////////////////////////////////////////////////////
                    OVERRIDE TRANSFER LOGIC
    //////////////////////////////////////////////////////////////*/

    function transferFrom(
        address from,
        address to,
        uint256 id
    ) public virtual override {
        super.transferFrom(from, to, id);
        // _removeTokenFromOwnerEnumeration(from, id);
        // _addTokenToOwnerEnumeration(to, id);
    }

    // /*//////////////////////////////////////////////////////////////
    //               INTERNAL ENUMERATION HELPERS
    // //////////////////////////////////////////////////////////////*/

    // function _addTokenToEnumeration(uint256 tokenId) private {
    //     _allTokensIndex[tokenId] = _allTokens.length;
    //     _allTokens.push(tokenId);
    // }

    // function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
    //     _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
    //     _ownedTokens[to].push(tokenId);
    // }

    // function _removeTokenFromEnumeration(uint256 tokenId) private {
    //     uint256 lastTokenIndex = _allTokens.length - 1;
    //     uint256 tokenIndex = _allTokensIndex[tokenId];

    //     if (tokenIndex != lastTokenIndex) {
    //         uint256 lastTokenId = _allTokens[lastTokenIndex];
    //         _allTokens[tokenIndex] = lastTokenId;
    //         _allTokensIndex[lastTokenId] = tokenIndex;
    //     }

    //     _allTokens.pop();
    //     delete _allTokensIndex[tokenId];
    // }

    // function _removeTokenFromOwnerEnumeration(
    //     address from,
    //     uint256 tokenId
    // ) private {
    //     uint256 lastTokenIndex = _ownedTokens[from].length - 1;
    //     uint256 tokenIndex = _ownedTokensIndex[tokenId];

    //     if (tokenIndex != lastTokenIndex) {
    //         uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];
    //         _ownedTokens[from][tokenIndex] = lastTokenId;
    //         _ownedTokensIndex[lastTokenId] = tokenIndex;
    //     }

    //     _ownedTokens[from].pop();
    //     delete _ownedTokensIndex[tokenId];
    // }

    // /*//////////////////////////////////////////////////////////////
    //                        ERC165 SUPPORT
    // //////////////////////////////////////////////////////////////*/

    // function supportsInterface(
    //     bytes4 interfaceId
    // ) public view virtual override returns (bool) {
    //     return
    //         interfaceId == 0x780e9d63 || // ERC165 Interface ID for ERC721Enumerable
    //         super.supportsInterface(interfaceId);
    // }
    // /*//////////////////////////////////////////////////////////////
    //                         UTILITY FUNCTIONS
    // //////////////////////////////////////////////////////////////*/

    // function _toString(uint256 value) internal pure returns (string memory) {
    //     if (value == 0) {
    //         return "0";
    //     }
    //     uint256 temp = value;
    //     uint256 digits;
    //     while (temp != 0) {
    //         digits++;
    //         temp /= 10;
    //     }
    //     bytes memory buffer = new bytes(digits);
    //     while (value != 0) {
    //         digits -= 1;
    //         buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
    //         value /= 10;
    //     }
    //     return string(buffer);
    // }
}
