// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IERC721 Interface
 * @dev Interface for the ERC721 standard
 */

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
