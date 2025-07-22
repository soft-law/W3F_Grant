// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC721} from "./ERC721.sol";
import {Ownable} from "../Ownable.sol";

/// @title SimpleNFT - NFT Collection with URI and Enumeration
/// @notice Simple ERC721 implementation with metadata and enumeration capabilities
contract SimpleNFT is ERC721, Ownable {
    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Current token ID counter
    uint256 public currentTokenId;

    /// @notice Maximum supply of tokens
    uint256 public maxSupply;

    /*//////////////////////////////////////////////////////////////
                            ENUMERATION STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Array of all token IDs
    uint256[] private _allTokens;

    /// @notice Mapping from token ID to index in _allTokens array
    mapping(uint256 => uint256) private _allTokensIndex;

    /// @notice Mapping from owner to list of owned token IDs
    mapping(address => uint256[]) private _ownedTokens;

    /// @notice Mapping from token ID to index in owner's token list
    mapping(uint256 => uint256) private _ownedTokensIndex;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event BaseURIUpdated(string newBaseURI);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _initialBaseURI,
        uint256 _maxSupply
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        // owner = msg.sender;
        _baseTokenURI = _initialBaseURI;
        maxSupply = _maxSupply;
        currentTokenId = 1; // Start from token ID 1
    }

    /*//////////////////////////////////////////////////////////////
                           METADATA LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the token URI for a given token ID
    function tokenURI(
        uint256 id
    ) public view virtual override returns (string memory) {
        require(_ownerOf[id] != address(0), "NOT_MINTED");

        string memory baseUri = _baseTokenURI;
        return
            bytes(baseUri).length > 0
                ? string(abi.encodePacked(baseUri, _toString(id), ".json"))
                : "";
    }

    /// @notice Updates the base URI (only owner)
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Returns the base URI
    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    /*//////////////////////////////////////////////////////////////
                            MINTING LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint a token to the specified address
    function mint(address to) external onlyOwner returns (uint256) {
        require(currentTokenId <= maxSupply, "MAX_SUPPLY_REACHED");

        uint256 tokenId = currentTokenId;
        currentTokenId++;

        _mint(to, tokenId);
        _addTokenToEnumeration(tokenId);
        _addTokenToOwnerEnumeration(to, tokenId);

        return tokenId;
    }

    /// @notice Mint multiple tokens to the specified address
    function batchMint(address to, uint256 quantity) external onlyOwner {
        require(
            currentTokenId + quantity - 1 <= maxSupply,
            "MAX_SUPPLY_REACHED"
        );

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = currentTokenId;
            currentTokenId++;

            _mint(to, tokenId);
            _addTokenToEnumeration(tokenId);
            _addTokenToOwnerEnumeration(to, tokenId);
        }
    }

    /// @notice Burn a token
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
    }

    /*//////////////////////////////////////////////////////////////
                         ENUMERATION LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the total number of tokens in existence
    function totalSupply() public view returns (uint256) {
        return _allTokens.length;
    }

    /// @notice Returns the token ID at the given index in the global token list
    function tokenByIndex(uint256 index) public view returns (uint256) {
        require(index < totalSupply(), "INDEX_OUT_OF_BOUNDS");
        return _allTokens[index];
    }

    /// @notice Returns the token ID at the given index of the owner's token list
    function tokenOfOwnerByIndex(
        address tokenOwner,
        uint256 index
    ) public view returns (uint256) {
        require(index < balanceOf(tokenOwner), "INDEX_OUT_OF_BOUNDS");
        return _ownedTokens[tokenOwner][index];
    }

    /// @notice Returns an array of all token IDs owned by the given address
    function tokensOfOwner(
        address tokenOwner
    ) external view returns (uint256[] memory) {
        return _ownedTokens[tokenOwner];
    }

    /*//////////////////////////////////////////////////////////////
                       OVERRIDE TRANSFER LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Override transferFrom to update enumeration
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
                         OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    // /// @notice Withdraw contract balance (if any)
    // function withdraw() external onlyOwner {
    //     (bool success, ) = payable(owner).call{value: address(this).balance}(
    //         ""
    //     );
    //     require(success, "WITHDRAWAL_FAILED");
    // }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL ENUMERATION HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add token to global enumeration
    function _addTokenToEnumeration(uint256 tokenId) private {
        _allTokensIndex[tokenId] = _allTokens.length;
        _allTokens.push(tokenId);
    }

    /// @notice Add token to owner's enumeration
    function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
    }

    /// @notice Remove token from owner's enumeration
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
                            UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Convert uint256 to string
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

    /*//////////////////////////////////////////////////////////////
                           ERC165 SUPPORT
    //////////////////////////////////////////////////////////////*/

    /// @notice Override supportsInterface to include enumeration
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == 0x780e9d63 || // ERC165 Interface ID for ERC721Enumerable
            super.supportsInterface(interfaceId);
    }
}
