// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Vault {
    error ZeroAmount();
    error InsufficientBalance();
    error ReentrantCall();

    mapping(address => uint256) public balanceOf;

    uint256 private _locked;
    modifier nonReentrant() {
        if (_locked == 1) revert ReentrantCall();
        _locked = 1;
        _;
        _locked = 0;
    }

    event Deposited(address indexed user, uint256 amount);
    event Withdrew(address indexed user, uint256 amount);

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        balanceOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balanceOf[msg.sender];
        if (bal < amount) revert InsufficientBalance();
        balanceOf[msg.sender] = bal - amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) { balanceOf[msg.sender] = bal; revert("ETH_SEND_FAILED"); }
        emit Withdrew(msg.sender, amount);
    }

    function withdrawAll() external nonReentrant {
        uint256 amt = balanceOf[msg.sender];
        if (amt == 0) revert InsufficientBalance();
        balanceOf[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        if (!ok) { balanceOf[msg.sender] = amt; revert("ETH_SEND_FAILED"); }
        emit Withdrew(msg.sender, amt);
    }

    function totalUserBalance(address user) external view returns (uint256) {
        return balanceOf[user];
    }

    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        balanceOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    fallback() external payable {
        if (msg.value == 0) revert ZeroAmount();
        balanceOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}
