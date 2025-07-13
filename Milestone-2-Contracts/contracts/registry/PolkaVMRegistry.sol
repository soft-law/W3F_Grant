// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "./Ownable.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import {CopyrightsRegistryTypes} from "./RegistryTypes.sol";

/// @title PolkaVMRegistry - Simplified for PolkaVM compatibility
/// @dev Removes ERC721 inheritance to avoid PolkaVM complexity issues
/// @dev Provides same functionality as CopyrightsRegistry but PolkaVM-compatible
contract PolkaVMRegistry is Ownable, ReentrancyGuard, CopyrightsRegistryTypes {
    uint256 public constant REGISTRY_FEE = 0.001 ether;
    address public feeRecipient;
    
    // Simple NFT-like functionality without ERC721 inheritance
    mapping(uint256 => address) public copyrightOwners;
    mapping(address => uint256[]) public ownedCopyrights;
    mapping(address => uint256) public balances;
    mapping(uint256 => string) private _tokenURIs;
    
    uint256 public totalSupply;
    
    event CopyrightMinted(uint256 indexed tokenId, address indexed to);
    event CopyrightTransfer(uint256 indexed tokenId, address indexed from, address indexed to);
    
    constructor(address _feeRecipient) Ownable(msg.sender) ReentrancyGuard() {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
        _nextCollectionId = 1;
        _nextCopyrightId = 1;
    }
    
    function createCollection(
        string memory _name,
        string memory _description,
        string memory _image,
        CollectionConfig memory _config
    ) public onlyOwner returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_config.maxSupply > 0, "Max supply must be greater than 0");
        
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
    
    function registerCopyrightAsset(
        uint256 collectionId,
        address author,
        EconomicCopyrights memory rights,
        string memory _name,
        string memory _description,
        string memory _image,
        string memory _tokenUri
    ) external payable nonReentrant returns (uint256) {
        require(msg.value >= REGISTRY_FEE, "Insufficient fee");
        require(collections[collectionId].exists, "Collection does not exist");
        require(author != address(0), "Invalid author");
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        uint256 assetId = _nextCopyrightId++;
        
        // Create copyright asset
        copyrightAssets[assetId] = CopyrightAsset({
            collectionId: collectionId,
            author: author,
            economicRightsOwner: msg.sender,
            name: _name,
            description: _description,
            image: _image,
            tokenUri: _tokenUri,
            isValidated: false,
            originalNftContract: address(0),
            originalNftId: 0
        });
        
        // Mint copyright token (without ERC721)
        _mintCopyright(msg.sender, assetId);
        _setTokenURI(assetId, _tokenUri);
        
        creatorAssets[msg.sender].push(assetId);
        collections[collectionId].currentSupply++;
        
        // Transfer fee
        if (msg.value > 0) {
            payable(feeRecipient).transfer(msg.value);
        }
        
        emit CopyrightRegistered(assetId, collectionId, author);
        
        return assetId;
    }
    
    function transferCopyright(uint256 _tokenId, address _to) external {
        require(copyrightOwners[_tokenId] == msg.sender, "Not owner");
        require(_to != address(0), "Invalid recipient");
        
        address from = msg.sender;
        
        // Update ownership
        copyrightOwners[_tokenId] = _to;
        
        // Update balances
        balances[from]--;
        balances[_to]++;
        
        // Update owned arrays (simplified)
        ownedCopyrights[_to].push(_tokenId);
        
        emit CopyrightTransfer(_tokenId, from, _to);
    }
    
    function ownerOf(uint256 _tokenId) external view returns (address) {
        address owner = copyrightOwners[_tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }
    
    function balanceOf(address _owner) external view returns (uint256) {
        return balances[_owner];
    }
    
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(copyrightOwners[tokenId] != address(0), "Token does not exist");
        return _tokenURIs[tokenId];
    }
    
    function getCollection(uint256 _collectionId) public view returns (Collection memory) {
        return collections[_collectionId];
    }
    
    function getCopyrightAsset(uint256 _tokenId) public view returns (CopyrightAsset memory) {
        return copyrightAssets[_tokenId];
    }
    
    function getCreatorCollections(address _creator) public view returns (uint256[] memory) {
        return creatorCollections[_creator];
    }
    
    function getCreatorAssets(address _creator) public view returns (uint256[] memory) {
        return creatorAssets[_creator];
    }
    
    function tokensOfOwner(address _owner) external view returns (uint256[] memory) {
        return ownedCopyrights[_owner];
    }
    
    function getFeeRecipient() external view returns (address) {
        return feeRecipient;
    }
    
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        feeRecipient = _newRecipient;
    }
    
    // Internal functions
    function _mintCopyright(address to, uint256 tokenId) internal {
        require(to != address(0), "Invalid recipient");
        require(copyrightOwners[tokenId] == address(0), "Token already exists");
        
        copyrightOwners[tokenId] = to;
        ownedCopyrights[to].push(tokenId);
        balances[to]++;
        totalSupply++;
        
        emit CopyrightMinted(tokenId, to);
    }
    
    function _setTokenURI(uint256 tokenId, string memory _uri) internal {
        _tokenURIs[tokenId] = _uri;
    }
}
