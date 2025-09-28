// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CommunityToken is ERC20, ERC20Pausable, AccessControl {

    // State Variables
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error ZeroAddress();

    // Constructor
    constructor(string memory name_, string memory symbol_, address admin) ERC20(name_, symbol_) {

        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // Override the _update function
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, amount);
    }

    // Mint function
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // Burn function
    function burn(uint256 amount) external {
        _burn(_msgSender(), amount);
    }

    // Pause function
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    // Unpause function
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}