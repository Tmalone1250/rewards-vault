// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICommunityToken {
    function MINTER_ROLE() external view returns (bytes32);
    function grantRole(bytes32 role, address account) external;
    function mint(address to, uint256 amount) external;
}

contract RewardsVault is Pausable, AccessControl, ReentrancyGuard {

    // State Variables
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    uint256 public constant RATE = 1e18 / (0.01 ether);

    ICommunityToken public immutable token;
    address public foundationWallet;

    // Custom Errors
    error ZeroAddress();
    error DirectETHNotAllowed();
    error ETHTransferFailed();
    error NothingToWithdraw();

    //Events
    event Donation(address indexed sender, uint256 value);
    event Withdrawal(address indexed treasurer, address indexed to, uint256 amount);
    event FoundationWalletUpdate(address indexed oldWallet, address indexed newWallet);


    // Constructor
    constructor(ICommunityToken token_, address admin, address foundationWallet_) {
        if (address(token_) == address(0) || admin == address(0) || foundationWallet_ == address(0)) {
            revert ZeroAddress();
        }

        token = token_;
        foundationWallet = foundationWallet_;

        // Grant Roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(AUDITOR_ROLE, admin);
    }
    
    //donate() function
    function donate() external payable nonReentrant whenNotPaused {
        uint256 value = msg.value;

        uint256 toMint = value * RATE;
        token.mint(_msgSender(), toMint);

        emit Donation(_msgSender(), value);
    }

    //Withdrawal function - Withdraw to foudationWallet
    function withdraw(uint256 amount) external onlyRole(TREASURER_ROLE) nonReentrant whenNotPaused {
        if(amount == 0 || amount > address(this).balance) revert NothingToWithdraw();
        (bool ok, ) = payable(foundationWallet).call{value: amount}("");
        if(!ok) revert ETHTransferFailed();

        emit Withdrawal(_msgSender(), foundationWallet, amount);
    }

    // 	setFoundationWallet(address) — onlyRole(DEFAULT_ADMIN_ROLE); reverts on zero address
    function setFoundationWallet(address newWallet) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newWallet == address(0)) revert ZeroAddress();
        address old = foundationWallet;
        foundationWallet = newWallet;

        emit FoundationWalletUpdate(old, newWallet);
    }

    // pause()/unpause() functions - PAUSER_ROLE
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Block Accidental Transfers
    receive() external payable { revert DirectETHNotAllowed(); }
    fallback() external payable { revert DirectETHNotAllowed(); }
}
