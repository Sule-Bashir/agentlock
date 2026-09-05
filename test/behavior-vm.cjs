const fs = require("fs");
const { createVM, runTx } = require("@ethereumjs/vm");
const { createLegacyTx } = require("@ethereumjs/tx");
const {
    createAddressFromString,
    createAccount
} = require("@ethereumjs/util");
const { keccak256 } = require("ethereum-cryptography/keccak");

function word(value) {
    return BigInt(value).toString(16).padStart(64, "0");
}

function addressWord(address) {
    return address.toLowerCase().replace("0x", "").padStart(64, "0");
}

function selector(signature) {
    return Buffer.from(keccak256(Buffer.from(signature))).subarray(0, 4);
}

async function main() {
    const vm = await createVM();

    const bytecode = Buffer.from(
        fs.readFileSync(
            "build/contracts_AgentLock_sol_AgentLock.bin",
            "utf8"
        ),
        "hex"
    );

    const privateKey = Buffer.from(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "hex"
    );

    const owner = createAddressFromString(
        "0x8fd379246834eac74b8419ffda202cf8051f7a03"
    );

    const agent = createAddressFromString(
        "0x1111111111111111111111111111111111111111"
    );

    const recipient = createAddressFromString(
        "0x2222222222222222222222222222222222222222"
    );

    await vm.stateManager.putAccount(
        owner,
        createAccount({
            nonce: 0n,
            balance: 1000000000000000000n
        })
    );

    // 1. Deploy
    const deployTx = createLegacyTx({
        nonce: 0n,
        gasLimit: 3000000n,
        gasPrice: 10n,
        data: bytecode
    }).sign(privateKey);

    const deployment = await runTx(vm, { tx: deployTx });
    const contract = deployment.createdAddress;

    console.log("Contract:", contract.toString());

    // 2. Register agent
    const registerData = Buffer.concat([
        selector("registerAgent(address,uint256,uint256,uint256,uint256)"),
        Buffer.from(addressWord(agent.toString()), "hex"),
        Buffer.from(word(100), "hex"),
        Buffer.from(word(500), "hex"),
        Buffer.from(word(3), "hex"),
        Buffer.from(word(60), "hex")
    ]);

    const registerTx = createLegacyTx({
        nonce: 1n,
        gasLimit: 1000000n,
        gasPrice: 10n,
        to: contract,
        data: registerData
    }).sign(privateKey);

    const registered = await runTx(vm, { tx: registerTx });

    console.log(
        "Registration exception:",
        registered.execResult?.exceptionError?.error || "none"
    );

    // 3. Authorize transaction #1
    const authorizeData = Buffer.concat([
        selector("authorizeTransaction(address,address,uint256)"),
        Buffer.from(addressWord(agent.toString()), "hex"),
        Buffer.from(addressWord(recipient.toString()), "hex"),
        Buffer.from(word(50), "hex")
    ]);

    for (let i = 1; i <= 4; i++) {
        const tx = createLegacyTx({
            nonce: BigInt(i + 1),
            gasLimit: 1000000n,
            gasPrice: 10n,
            to: contract,
            data: authorizeData
        }).sign(privateKey);

        const result = await runTx(vm, { tx });

        const returnValue = result.execResult?.returnValue || Buffer.alloc(0);

        console.log(
            `Transaction #${i}:`,
            "exception =",
            result.execResult?.exceptionError?.error || "none",
            "gas =",
            result.totalGasSpent?.toString(),
            "return =",
            returnValue.toString("hex")
        );

        if (i === 4) {
            const returnedFalse =
                returnValue.length > 0 &&
                Array.from(returnValue).every(byte => byte === 0);

            if (!returnedFalse) {
                throw new Error("FAIL: Transaction #4 did not return false");
            }

            console.log(
                "PASS: Transaction #4 returned false and triggered the circuit breaker"
            );

            const logs = result.execResult?.logs || [];

            console.log("Transaction #4 event logs:", logs.length);

            for (let j = 0; j < logs.length; j++) {
                const log = logs[j];

                console.log(
                    `Event log #${j + 1}:`,
                    Array.from(log).map(item =>
                        Buffer.from(item).toString("hex")
                    )
                );
            }

            if (logs.length < 2) {
                throw new Error(
                    "FAIL: Expected BehavioralAnomaly and AgentFrozen events"
                );
            }

            const eventSignatures = [
                "BehavioralAnomaly(address,uint256,uint256)",
                "AgentFrozen(address,string)"
            ];

            const expectedTopics = eventSignatures.map(signature =>
                Buffer.from(
                    keccak256(Buffer.from(signature))
                ).toString("hex")
            );

            const actualTopics = logs.map(log =>
                Buffer.from(log[1][0]).toString("hex")
            );

            console.log("Expected event topics:", expectedTopics);
            console.log("Actual event topics:", actualTopics);

            for (const expected of expectedTopics) {
                if (!actualTopics.includes(expected)) {
                    throw new Error(
                        "FAIL: Expected event topic not found: " + expected
                    );
                }
            }

            console.log(
                "PASS: BehavioralAnomaly and AgentFrozen events verified"
            );
        }
    }

    // 4. Verify frozen agent rejects the next transaction
    const frozenTx = createLegacyTx({
        nonce: 6n,
        gasLimit: 1000000n,
        gasPrice: 10n,
        to: contract,
        data: authorizeData
    }).sign(privateKey);

    const frozenResult = await runTx(vm, { tx: frozenTx });

    const frozenError =
        frozenResult.execResult?.exceptionError?.error || "none";

    console.log(
        "Transaction #5 after freeze:",
        "exception =",
        frozenError
    );

    if (frozenError !== "revert") {
        throw new Error(
            "FAIL: Frozen agent did not reject Transaction #5"
        );
    }

    console.log(
        "PASS: Frozen agent rejected Transaction #5"
    );

    // 5. Resume the frozen agent
    const resumeData = Buffer.concat([
        selector("resumeAgent(address)"),
        Buffer.from(addressWord(agent.toString()), "hex")
    ]);

    const resumeTx = createLegacyTx({
        nonce: 7n,
        gasLimit: 1000000n,
        gasPrice: 10n,
        to: contract,
        data: resumeData
    }).sign(privateKey);

    const resumeResult = await runTx(vm, { tx: resumeTx });

    console.log(
        "Resume exception:",
        resumeResult.execResult?.exceptionError?.error || "none"
    );

    if (resumeResult.execResult?.exceptionError) {
        throw new Error("FAIL: Frozen agent could not be resumed");
    }

    console.log(
        "PASS: Frozen agent successfully resumed"
    );

    // 6. Authorize a transaction after resume
    const postResumeTx = createLegacyTx({
        nonce: 8n,
        gasLimit: 1000000n,
        gasPrice: 10n,
        to: contract,
        data: authorizeData
    }).sign(privateKey);

    const postResumeResult = await runTx(vm, {
        tx: postResumeTx
    });

    const postResumeReturn =
        postResumeResult.execResult?.returnValue || Buffer.alloc(0);

    console.log(
        "Post-resume transaction:",
        "exception =",
        postResumeResult.execResult?.exceptionError?.error || "none",
        "return =",
        Array.from(postResumeReturn)
    );

    const postResumeAllowed =
        postResumeReturn.length > 0 &&
        postResumeReturn[postResumeReturn.length - 1] === 1;

    if (!postResumeAllowed) {
        throw new Error(
            "FAIL: Transaction was not authorized after resume"
        );
    }

    console.log(
        "PASS: Agent successfully authorized a transaction after resume"
    );

    // 7. Read final agent state using getAgent()
    const getAgentData = Buffer.concat([
        selector("getAgent(address)"),
        Buffer.from(addressWord(agent.toString()), "hex")
    ]);

    const readTx = createLegacyTx({
        nonce: 9n,
        gasLimit: 1000000n,
        gasPrice: 10n,
        to: contract,
        data: getAgentData
    }).sign(privateKey);

    const stateResult = await runTx(vm, { tx: readTx });

    console.log(
        "Final state returned:",
        stateResult.execResult?.returnValue?.toString("hex")
    );
}

main().catch(console.error);
