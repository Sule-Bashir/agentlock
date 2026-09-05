import { expect } from "chai";
import hre from "hardhat";

describe("AgentLock", function () {
    let agentLock, owner, agent, recipient;

    beforeEach(async function () {
        [owner, agent, recipient] = await hre.ethers.getSigners();
        const AgentLock = await hre.ethers.getContractFactory("AgentLock");
        agentLock = await AgentLock.deploy();
        await agentLock.waitForDeployment();
    });

    it("should register an agent", async function () {
        await agentLock.registerAgent(agent.address, 100, 500);
        const data = await agentLock.agents(agent.address);
        expect(data.registered).to.be.true;
        expect(data.active).to.be.true;
        expect(data.maxTransaction).to.equal(100);
        expect(data.dailyLimit).to.equal(500);
    });

    it("should authorize a transaction within limits", async function () {
        await agentLock.registerAgent(agent.address, 100, 500);
        await expect(agentLock.authorizeTransaction(agent.address, recipient.address, 50))
            .to.emit(agentLock, "TransactionAuthorized");
    });

    it("should reject transactions above limit", async function () {
        await agentLock.registerAgent(agent.address, 100, 500);
        await expect(agentLock.authorizeTransaction(agent.address, recipient.address, 150))
            .to.be.revertedWith("Transaction exceeds agent limit");
    });

    it("should freeze an agent", async function () {
        await agentLock.registerAgent(agent.address, 100, 500);
        await agentLock.freezeAgent(agent.address, "Behavioral anomaly");
        expect(await agentLock.isActive(agent.address)).to.be.false;
    });

    it("should block frozen agent", async function () {
        await agentLock.registerAgent(agent.address, 100, 500);
        await agentLock.freezeAgent(agent.address, "Behavioral anomaly");
        await expect(agentLock.authorizeTransaction(agent.address, recipient.address, 50))
            .to.be.revertedWith("Agent is frozen");
    });
});
