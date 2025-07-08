// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ERC721TokenReceiver
 * @dev Interface for a contract that wants to support receiving ERC721 tokens
 */

abstract contract ERC721TokenReceiver {
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external virtual returns (bytes4) {
        return ERC721TokenReceiver.onERC721Received.selector;
    }
}
