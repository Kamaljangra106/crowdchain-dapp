// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Crowdfund
/// @notice All-or-nothing crowdfunding. Many campaigns live in one contract.
///         - Before the deadline, anyone can contribute ETH.
///         - After the deadline, if the goal was reached the creator withdraws the funds.
///         - After the deadline, if the goal was NOT reached every backer can refund themselves.
/// @dev Educational project. Not audited. Use on testnets only.
contract Crowdfund is ReentrancyGuard {
    struct Campaign {
        address creator;
        string title;
        uint256 goal; // in wei
        uint256 deadline; // unix timestamp (seconds)
        uint256 raised; // in wei
        bool withdrawn; // true once the creator has taken the money
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) private campaigns;
    // campaign id => backer => amount contributed (wei)
    mapping(uint256 => mapping(address => uint256)) private contributions;

    event CampaignCreated(
        uint256 indexed id,
        address indexed creator,
        string title,
        uint256 goal,
        uint256 deadline
    );
    event Contributed(uint256 indexed id, address indexed backer, uint256 amount);
    event Withdrawn(uint256 indexed id, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed id, address indexed backer, uint256 amount);

    /// @notice Start a new campaign. The caller becomes its creator.
    /// @param title Short human-readable name.
    /// @param goal Target amount in wei. Must be > 0.
    /// @param durationSeconds How long the campaign accepts contributions. Must be > 0.
    /// @return id The id of the new campaign (first campaign has id 0).
    function createCampaign(
        string calldata title,
        uint256 goal,
        uint256 durationSeconds
    ) external returns (uint256 id) {
        require(bytes(title).length > 0, "Title required");
        require(goal > 0, "Goal must be > 0");
        require(durationSeconds > 0, "Duration must be > 0");

        id = campaignCount++;
        uint256 deadline = block.timestamp + durationSeconds;
        campaigns[id] = Campaign({
            creator: msg.sender,
            title: title,
            goal: goal,
            deadline: deadline,
            raised: 0,
            withdrawn: false
        });

        emit CampaignCreated(id, msg.sender, title, goal, deadline);
    }

    /// @notice Send ETH to a campaign. Only possible before its deadline.
    function contribute(uint256 id) external payable {
        Campaign storage c = _get(id);
        require(block.timestamp < c.deadline, "Campaign ended");
        require(msg.value > 0, "Send some ETH");

        c.raised += msg.value;
        contributions[id][msg.sender] += msg.value;

        emit Contributed(id, msg.sender, msg.value);
    }

    /// @notice Creator takes all raised ETH. Only after the deadline and only if the goal was met.
    function withdraw(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        require(msg.sender == c.creator, "Only creator");
        require(block.timestamp >= c.deadline, "Campaign still running");
        require(c.raised >= c.goal, "Goal not reached");
        require(!c.withdrawn, "Already withdrawn");

        // Effects before interactions: mark as withdrawn BEFORE sending ETH.
        c.withdrawn = true;
        uint256 amount = c.raised;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit Withdrawn(id, msg.sender, amount);
    }

    /// @notice Backer takes their own ETH back. Only after the deadline and only if the goal was missed.
    function refund(uint256 id) external nonReentrant {
        Campaign storage c = _get(id);
        require(block.timestamp >= c.deadline, "Campaign still running");
        require(c.raised < c.goal, "Goal was reached");

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Nothing to refund");

        // Effects before interactions: zero the balance BEFORE sending ETH.
        contributions[id][msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit Refunded(id, msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Read a campaign. Reverts if the id does not exist.
    function getCampaign(
        uint256 id
    )
        external
        view
        returns (
            address creator,
            string memory title,
            uint256 goal,
            uint256 deadline,
            uint256 raised,
            bool withdrawn
        )
    {
        Campaign storage c = _get(id);
        return (c.creator, c.title, c.goal, c.deadline, c.raised, c.withdrawn);
    }

    /// @notice How much `backer` has put into campaign `id` (0 after they refund).
    function contributionOf(uint256 id, address backer) external view returns (uint256) {
        require(id < campaignCount, "Campaign does not exist");
        return contributions[id][backer];
    }

    function _get(uint256 id) private view returns (Campaign storage) {
        require(id < campaignCount, "Campaign does not exist");
        return campaigns[id];
    }
}
