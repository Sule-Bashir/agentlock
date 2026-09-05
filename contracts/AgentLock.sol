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
    }

    mapping(address => Agent) public agents;

    event AgentRegistered(address indexed agent, uint256 maxTransaction, uint256 dailyLimit);
    event AgentFrozen(address indexed agent, string reason);
    event AgentResumed(address indexed agent);
    event TransactionAuthorized(address indexed agent, address indexed recipient, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function registerAgent(address agent, uint256 maxTransaction, uint256 dailyLimit) external onlyOwner {
        require(agent != address(0), "Invalid agent");
        agents[agent] = Agent(true, true, maxTransaction, dailyLimit, 0, block.timestamp);
        emit AgentRegistered(agent, maxTransaction, dailyLimit);
    }

    function freezeAgent(address agent, string calldata reason) external onlyOwner {
        require(agents[agent].registered, "Agent not registered");
        agents[agent].active = false;
        emit AgentFrozen(agent, reason);
    }

    function resumeAgent(address agent) external onlyOwner {
        require(agents[agent].registered, "Agent not registered");
        agents[agent].active = true;
        emit AgentResumed(agent);
    }

    function authorizeTransaction(address agent, address recipient, uint256 amount) external onlyOwner returns (bool) {
        Agent storage a = agents[agent];
        require(a.registered, "Agent not registered");
        require(a.active, "Agent is frozen");

        if (block.timestamp >= a.lastReset + 1 days) {
            a.spentToday = 0;
            a.lastReset = block.timestamp;
        }

        require(amount <= a.maxTransaction, "Transaction exceeds agent limit");
        require(a.spentToday + amount <= a.dailyLimit, "Daily limit exceeded");

        a.spentToday += amount;
        emit TransactionAuthorized(agent, recipient, amount);
        return true;
    }

    function isActive(address agent) external view returns (bool) {
        return agents[agent].registered && agents[agent].active;
    }
}
