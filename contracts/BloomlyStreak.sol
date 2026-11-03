// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  BloomlyStreak
/// @notice Anonymous daily self-care check-in for the Bloomly app.
/// @dev    Stores no health data, no strings, no tokens and has no admin.
///         A check-in only says "I took care of myself today".
contract BloomlyStreak {
    struct Streak {
        uint32 current; // consecutive days, including the last check-in day
        uint32 best;    // longest streak ever
        uint32 total;   // lifetime check-ins
        uint32 lastDay; // UTC day number (block.timestamp / 1 days) of the last check-in
    }

    mapping(address => Streak) public streaks;
    uint256 public totalCheckIns;
    uint256 public members;

    event CheckedIn(address indexed user, uint256 day, uint32 current);
    event Milestone(address indexed user, uint32 streakDays);

    /// @notice Check in once per UTC day.
    function checkIn() external {
        uint32 day = uint32(block.timestamp / 1 days);
        Streak storage s = streaks[msg.sender];
        require(day > s.lastDay, "Already checked in today");

        if (s.total == 0) {
            members += 1;
        }

        if (s.total > 0 && day == s.lastDay + 1) {
            s.current += 1;
        } else {
            s.current = 1;
        }

        if (s.current > s.best) {
            s.best = s.current;
        }

        s.total += 1;
        s.lastDay = day;
        totalCheckIns += 1;

        emit CheckedIn(msg.sender, day, s.current);

        if (s.current == 7 || s.current == 30 || s.current == 100) {
            emit Milestone(msg.sender, s.current);
        }
    }

    function getStreak(address user)
        external
        view
        returns (uint32 current, uint32 best, uint32 total, uint32 lastDay)
    {
        Streak memory s = streaks[user];
        return (s.current, s.best, s.total, s.lastDay);
    }

    function stats() external view returns (uint256 _members, uint256 _totalCheckIns) {
        return (members, totalCheckIns);
    }

    /// @notice The current UTC day number, as used by checkIn().
    function currentDay() external view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }
}
