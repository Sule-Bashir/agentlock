const fs = require("fs");
const path = require("path");
const https = require("https");
const { ethers } = require("ethers");

const PROJECT_DIR = process.cwd();

const ABI_PATH = path.join(
    PROJECT_DIR,
    "build",
    "contracts_AgentLock_sol_AgentLock.abi"
);

const abi = JSON.parse(
    fs.readFileSync(ABI_PATH, "utf8")
);

function rpcRequest(rpcUrl, method, params) {
    return new Promise((resolve, reject) => {
        const url = new URL(rpcUrl);

        const payload = JSON.stringify({
            jsonrpc: "2.0",
            method,
            params,
            id: 1
        });

        const req = https.request(
            {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload)
                },
                timeout: 15000
            },
            (res) => {
                let body = "";

                res.on("data", (chunk) => {
                    body += chunk;
                });

                res.on("end", () => {
                    try {
                        const data = JSON.parse(body);

                        if (data.error) {
                            reject(
                                new Error(
                                    data.error.message ||
                                    "RPC error"
                                )
                            );
                            return;
                        }

                        resolve(data.result);
                    } catch {
                        reject(
                            new Error(
                                "Invalid RPC response"
                            )
                        );
                    }
                });
            }
        );

        req.on("timeout", () => {
            req.destroy(
                new Error("RPC request timeout")
            );
        });

        req.on("error", reject);

        req.write(payload);
        req.end();
    });
}

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL;
    const contractAddress =
        process.env.AGENTLOCK_CONTRACT_ADDRESS;
    const agent = process.env.AGENT_ADDRESS;

    const recipient =
        process.env.RECIPIENT_ADDRESS ||
        "0x2222222222222222222222222222222222222222";

    const amount =
        process.env.AMOUNT_WEI ||
        "10000000000000";

    if (!privateKey) {
        throw new Error("PRIVATE_KEY is not configured");
    }

    if (!rpcUrl) {
        throw new Error("RPC_URL is not configured");
    }

    if (!contractAddress) {
        throw new Error(
            "AGENTLOCK_CONTRACT_ADDRESS is not configured"
        );
    }

    if (!agent) {
        throw new Error(
            "AGENT_ADDRESS is not configured"
        );
    }

    const wallet = new ethers.Wallet(privateKey);

    const iface = new ethers.Interface(abi);

    const data = iface.encodeFunctionData(
        "authorizeTransaction",
        [
            agent,
            recipient,
            amount
        ]
    );

    const from = wallet.address;

    const nonceHex = await rpcRequest(
        rpcUrl,
        "eth_getTransactionCount",
        [from, "pending"]
    );

    const gasPriceHex = await rpcRequest(
        rpcUrl,
        "eth_gasPrice",
        []
    );

    const gasEstimateHex = await rpcRequest(
        rpcUrl,
        "eth_estimateGas",
        [
            {
                from,
                to: contractAddress,
                data
            }
        ]
    );

    const transaction = {
        to: contractAddress,
        data,
        nonce: Number(
            BigInt(nonceHex)
        ),
        gasLimit:
            BigInt(gasEstimateHex) + 50000n,
        gasPrice: BigInt(gasPriceHex),
        chainId: 84532
    };

    const signedTransaction =
        await wallet.signTransaction(
            transaction
        );

    const transactionHash =
        await rpcRequest(
            rpcUrl,
            "eth_sendRawTransaction",
            [signedTransaction]
        );

    console.log(
        JSON.stringify({
            transactionHash,
            agent,
            recipient,
            amountWei: amount
        })
    );
}

main().catch((error) => {
    console.error(
        error.shortMessage ||
        error.message
    );

    process.exit(1);
});
