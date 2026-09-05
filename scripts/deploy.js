const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying AgentLock...");
    const [deployer] = await hre.ethers.getSigners();
    console.log(`📡 Deployer: ${deployer.address}`);

    const AgentLock = await hre.ethers.getContractFactory("AgentLock");
    const agentLock = await AgentLock.deploy(deployer.address);
    await agentLock.waitForDeployment();

    const address = await agentLock.getAddress();
    console.log(`✅ AgentLock deployed to: ${address}`);

    await agentLock.unpause();
    console.log("🔓 Contract unpaused");
}

main().then(() => process.exit(0)).catch(console.error);
