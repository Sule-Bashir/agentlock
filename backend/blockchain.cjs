const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const PROJECT_DIR = process.cwd();

const ABI_PATH = path.join(
  PROJECT_DIR,
  "build",
  "contracts_AgentLock_sol_AgentLock.abi"
);

const BYTECODE_PATH = path.join(
  PROJECT_DIR,
  "build",
  "contracts_AgentLock_sol_AgentLock.bin"
);

if (!fs.existsSync(ABI_PATH)) {
  throw new Error(`ABI file not found: ${ABI_PATH}`);
}

if (!fs.existsSync(BYTECODE_PATH)) {
  throw new Error(`Bytecode file not found: ${BYTECODE_PATH}`);
}

const abi = JSON.parse(
  fs.readFileSync(ABI_PATH, "utf8")
);

const bytecode =
  "0x" +
  fs.readFileSync(BYTECODE_PATH, "utf8").trim();

function createProvider(rpcUrl) {
  if (!rpcUrl) {
    throw new Error("RPC_URL is not configured");
  }

  return new ethers.JsonRpcProvider(rpcUrl);
}

function createWallet(privateKey, rpcUrl) {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is not configured");
  }

  const provider = createProvider(rpcUrl);

  return new ethers.Wallet(privateKey, provider);
}

function createContract(address, signerOrProvider) {
  if (!address) {
    throw new Error(
      "AGENTLOCK_CONTRACT_ADDRESS is not configured"
    );
  }

  return new ethers.Contract(
    address,
    abi,
    signerOrProvider
  );
}

async function deployContract(privateKey, rpcUrl) {
  const wallet = createWallet(
    privateKey,
    rpcUrl
  );

  const factory = new ethers.ContractFactory(
    abi,
    bytecode,
    wallet
  );

  const contract = await factory.deploy();

  await contract.waitForDeployment();

  return {
    address: await contract.getAddress(),
    deploymentTransaction:
      contract.deploymentTransaction()?.hash || null
  };
}

module.exports = {
  abi,
  bytecode,
  createProvider,
  createWallet,
  createContract,
  deployContract
};
