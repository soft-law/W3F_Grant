// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/**
 * @title IERC721 Interface
 * @dev Interface extracted from Solmate ERC721 implementation
 */
interface IERC721 {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed id
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 indexed id
    );

    event ApprovalForAll(
        address indexed owner,
        address indexed operator,
        bool approved
    );

    /*//////////////////////////////////////////////////////////////
                         METADATA FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 id) external view returns (string memory);

    /*//////////////////////////////////////////////////////////////
                      ERC721 BALANCE/OWNER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function ownerOf(uint256 id) external view returns (address owner);
    function balanceOf(address owner) external view returns (uint256);

    /*//////////////////////////////////////////////////////////////
                         ERC721 APPROVAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getApproved(uint256 id) external view returns (address);
    function isApprovedForAll(
        address owner,
        address operator
    ) external view returns (bool);
    function approve(address spender, uint256 id) external;
    function setApprovalForAll(address operator, bool approved) external;

    /*//////////////////////////////////////////////////////////////
                              ERC721 LOGIC
    //////////////////////////////////////////////////////////////*/

    function transferFrom(address from, address to, uint256 id) external;
    function safeTransferFrom(address from, address to, uint256 id) external;
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        bytes calldata data
    ) external;

    /*//////////////////////////////////////////////////////////////
                              ERC165 LOGIC
    //////////////////////////////////////////////////////////////*/

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    /*//////////////////////////////////////////////////////////////
                              ERC721TokenReceiver LOGIC
    //////////////////////////////////////////////////////////////*/

    function onERC721Received(
        address operator,
        address from,
        uint256 id,
        bytes calldata data
    ) external returns (bytes4);
}
