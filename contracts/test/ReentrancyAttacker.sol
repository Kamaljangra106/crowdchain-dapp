// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICrowdfund {
    function contribute(uint256 id) external payable;
    function refund(uint256 id) external;
}

/// @dev TEST-ONLY contract. Contributes to a campaign, then tries to re-enter
///      `refund` from its receive() hook to steal more than it put in.
contract ReentrancyAttacker {
    ICrowdfund public immutable target;
    uint256 public immutable campaignId;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;

    constructor(address _target, uint256 _campaignId) {
        target = ICrowdfund(_target);
        campaignId = _campaignId;
    }

    function fund() external payable {
        target.contribute{value: msg.value}(campaignId);
    }

    function attack() external {
        target.refund(campaignId);
    }

    receive() external payable {
        reentryAttempts++;
        if (address(target).balance > 0 && reentryAttempts < 3) {
            // Re-enter. The guard / zeroed balance should make this revert.
            try target.refund(campaignId) {
                reentrySucceeded = true;
            } catch {}
        }
    }
}
