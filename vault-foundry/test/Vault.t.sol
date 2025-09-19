// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Vault.sol";

contract VaultTest is Test {
    Vault vault;
    address alice = address(0xA11CE);

    function setUp() public {
        vault = new Vault();
    }

    function test_DepositAndWithdraw() public {
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        vault.deposit{value: 0.4 ether}();

        assertEq(vault.balanceOf(alice), 0.4 ether);

        vm.prank(alice);
        vault.withdraw(0.1 ether);

        assertEq(vault.balanceOf(alice), 0.3 ether);
    }

    function test_RevertZeroDeposit() public {
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.deposit{value: 0}();
    }

    function test_RevertInsufficient() public {
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.withdraw(1 ether);
    }

}