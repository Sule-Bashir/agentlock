// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentLock {
    address public owner;

    struct Agent {
        bool registered;
        bool active;

        uint256 maxTransaction;
        uint256 dailyLimit;
        uint256 spentToday;

        uint256 lastReset;
        uint256 transactionCount;

        // Behavioral controls
        uint256 maxTransactionsPerWindow;
        uint256 windowDuration;
        uint256 windowStart;
        uint256 windowTransactionCount;
    }

    mapping(address => Agent) public agents;

    event AgentRegistered(
        address indexed agent,
        uint256 maxTransaction,
        uint256 dailyLimit,
        uint256 maxTransactionsPerWindow,
        uint256 windowDuration
    );

    event AgentFrozen(
        address indexed agent,
        string reason
    );

    event AgentResumed(
        address indexed agent
    );

    event TransactionAuthorized(
        address indexed agent,
        address indexed recipient,
        uint256 amount
    );

    event BehavioralAnomaly(
        address indexed agent,
        uint256 transactionCount,
        uint256 windowDuration
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function registerAgent(
        address agent,
        uint256 maxTransaction,
        uint256 dailyLimit,
        uint256 maxTransactionsPerWindow,
        uint256 windowDuration
    ) external onlyOwner {
        require(agent != address(0), "Invalid agent");
        require(maxTransaction > 0, "Invalid transaction limit");
        require(dailyLimit >= maxTransaction, "Daily limit too low");
        require(maxTransactionsPerWindow > 0, "Invalid behavior limit");
        require(windowDuration > 0, "Invalid window");

        agents[agent] = Agent({
            registered: true,
            active: true,
            maxTransaction: maxTransaction,
            dailyLimit: dailyLimit,
            spentToday: 0,
            lastReset: block.timestamp,
            transactionCount: 0,
            maxTransactionsPerWindow: maxTransactionsPerWindow,
            windowDuration: windowDuration,
            windowStart: block.timestamp,
            windowTransactionCount: 0
        });

        emit AgentRegistered(
            agent,
            maxTransaction,
            dailyLimit,
            maxTransactionsPerWindow,
            windowDuration
        );
    }

    function freezeAgent(
        address agent,
        string calldata reason
    ) external onlyOwner {
        require(
            agents[agent].registered,
            "Agent not registered"
        );

        agents[agent].active = false;

        emit AgentFrozen(agent, reason);
    }

    function resumeAgent(
        address agent
    ) external onlyOwner {
        require(
            agents[agent].registered,
            "Agent not registered"
        );

        agents[agent].active = true;

        Agent storage a = agents[agent];
        a.windowStart = block.timestamp;
        a.windowTransactionCount = 0;

        emit AgentResumed(agent);
    }

    function authorizeTransaction(
        address agent,
        address recipient,
        uint256 amount
    ) external onlyOwner returns (bool) {
        Agent storage a = agents[agent];

        require(
            a.registered,
            "Agent not registered"
        );

        require(
            a.active,
            "Agent is frozen"
        );

        // Reset daily spending window.
        if (block.timestamp >= a.lastReset + 1 days) {
            a.spentToday = 0;
            a.lastReset = block.timestamp;
        }

        // Reset behavioral window.
        if (block.timestamp >= a.windowStart + a.windowDuration) {
            a.windowStart = block.timestamp;
            a.windowTransactionCount = 0;
        }

        require(
            amount <= a.maxTransaction,
            "Transaction exceeds agent limit"
        );

        require(
            a.spentToday + amount <= a.dailyLimit,
            "Daily limit exceeded"
        );

        // Behavioral circuit breaker.
        if (
            a.windowTransactionCount + 1 >
            a.maxTransactionsPerWindow
        ) {
            a.active = false;

            emit BehavioralAnomaly(
                agent,
                a.windowTransactionCount + 1,
                a.windowDuration
            );

            emit AgentFrozen(
                agent,
                "Behavioral anomaly: transaction velocity exceeded"
            );

            return false;
        }

        a.spentToday += amount;
        a.transactionCount += 1;
        a.windowTransactionCount += 1;

        emit TransactionAuthorized(
            agent,
            recipient,
            amount
        );

        return true;
    }

    function isActive(
        address agent
    ) external view returns (bool) {
        return
            agents[agent].registered &&
            agents[agent].active;
    }

    function getAgent(
        address agent
    )
        external
        view
        returns (
            bool registered,
            bool active,
            uint256 maxTransaction,
            uint256 dailyLimit,
            uint256 spentToday,
            uint256 transactionCount,
            uint256 maxTransactionsPerWindow,
            uint256 windowDuration,
            uint256 windowStart,
            uint256 windowTransactionCount
        )
    {
        Agent memory a = agents[agent];

        return (
            a.registered,
            a.active,
            a.maxTransaction,
            a.dailyLimit,
            a.spentToday,
            a.transactionCount,
            a.maxTransactionsPerWindow,
            a.windowDuration,
            a.windowStart,
            a.windowTransactionCount
        );
    }
}
