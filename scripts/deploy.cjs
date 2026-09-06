const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!rpcUrl) throw new Error("RPC_URL is not configured");
    if (!privateKey) throw new Error("PRIVATE_KEY is not configured");

    const abiPath = path.join(
        process.cwd(),
        "build",
        "contracts_AgentLock_sol_AgentLock.abi"
    );

    const bytecodePath = path.join(
        process.cwd(),
        "build",
        "contracts_AgentLock_sol_AgentLock.bin"
    );

    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    const bytecode = "0x" + fs.readFileSync(bytecodePath, "utf8").trim();

    const provider = new ethers.JsonRpcProvider(
        rpcUrl,
        {
            name: "base-sepolia",
            chainId: 84532
        },
        {
            staticNetwork: true,
            timeout: 30000
        }
    );

    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("🚀 Deploying AgentLock...");
    console.log(`📡 Deployer: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

    const factory = new ethers.ContractFactory(
        abi,
        bytecode,
        wallet
    );

    const contract = await factory.deploy();

    console.log(`📤 Deployment transaction: ${contract.deploymentTransaction().hash}`);

    await contract.waitForDeployment();

    const address = await contract.getAddress();

    console.log(`✅ AgentLock deployed to: ${address}`);
    console.log("🌐 Network: Base Sepolia");
    console.log("🔗 Chain ID: 84532");
}

main().catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error.shortMessage || error.message);
    process.exit(1);
});
