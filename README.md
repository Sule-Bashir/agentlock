AgentLock

AI can act. AgentLock decides when it must stop.

AgentLock is a Web3 security layer for autonomous agents. It combines transaction authority limits with behavioral monitoring and an on-chain circuit breaker that can automatically freeze an agent when its transaction behavior exceeds a defined baseline.

The Problem

Autonomous Web3 agents can execute transactions quickly and repeatedly. A compromised agent, malicious prompt, stolen authorization, or runaway automation can turn that speed into a liability.

Traditional transaction limits answer:

 "How much can this agent spend?"

AgentLock adds another question:

 "Is this agent behaving normally?"

The Solution

AgentLock establishes an on-chain behavioral policy for an agent:

- Maximum transaction amount
- Daily spending limit
- Maximum transactions within a behavioral window
- Automatic on-chain freeze when transaction velocity exceeds the baseline
- Authorized recovery through an on-chain resume operation
- Explainable risk scoring before enforcement
The circuit breaker is enforced by the smart contract rather than only by the frontend.

    Core Flow

Autonomous Agent
       |
       v
Behavior + Transaction Check
       |
       v
Risk Assessment
       |
   +---+---+
   |       |
Normal   Anomalous
   |       |
   v       v
ALLOW   FREEZE
           |
           v
    On-chain Circuit Breaker
           |
           v
    Authorized Recovery
           |
           v
         ACTIVE


Demonstrated Attack

The prototype runs against Base Sepolia.

The configured behavioral policy allows a maximum of 3 transactions per window.

During the attack demonstration:

1. The agent operates normally.
2. A controlled transaction burst is initiated.
3. Behavioral risk reaches 80 — FREEZE.
4. The transaction window reaches its configured threshold.
5. AgentLock freezes the agent on-chain.
6. Further authorization attempts are rejected by the smart contract.
7. An authorized recovery operation resumes the agent.
8. The behavioral window resets.

The attack and recovery flow has been tested using real Base Sepolia RPC transactions.

Architecture

                    +----------------------+
                    |    Web Dashboard     |
                    |    HTML / CSS / JS   |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |      FastAPI API     |
                    |   Risk + Blockchain  |
                    +----------+-----------+
                               |
                    +----------+-----------+
                    |                      |
                    v                      v
             +-----------+          +-------------+
             | Anomaly   |          | Raw RPC     |
             | Engine    |          | Transaction |
             +-----------+          | Bridge      |
                                   +------+------+
                                          |
                                          v
                              +-----------------------+
                              | AgentLock.sol         |
                              | Base Sepolia          |
                              | On-chain enforcement  |
                              +-----------------------+


Smart Contract

contracts/AgentLock.sol implements:

* Agent registration
* Maximum transaction limits
* Daily spending limits
* Behavioral transaction-window limits
* Automatic freezing
* Recovery/resume
* On-chain authorization
* Behavioral anomaly events

The contract emits events for authorization, behavioral anomalies, freezes, and recovery.

Risk Engine

The backend risk engine evaluates:

* Transaction amount
* Maximum permitted transaction
* Transactions already observed in the behavioral window
* Maximum permitted transactions in the window

Normal Behavior

amount = 50
max transaction = 100
window transactions = 1
window limit = 3

risk = 0
decision = ALLOW


Attack Condition

amount = 50
max transaction = 100
window transactions = 3
window limit = 3

risk = 80
decision = FREEZE

The backend provides explainable reasons while the smart contract remains the final on-chain enforcement layer.

Technology

* Solidity 0.8.24
* Base Sepolia
* FastAPI
* Python
* JavaScript
* ethers.js
* JSON-RPC
* HTML/CSS/JavaScript

Project Structure

agentlock/
├── contracts/
│   └── AgentLock.sol
├── backend/
│   ├── app.py
│   ├── anomaly.py
│   ├── models.py
│   ├── blockchain.cjs
│   ├── authorize.cjs
│   └── resume.cjs
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── demo/
│   ├── normal.json
│   └── attack.json
├── scripts/
│   └── deploy.cjs
├── test/
│   └── behavior-vm.cjs
├── hardhat.config.js
├── package.json
└── README.md


Deployment

Network

Base Sepolia

Chain ID

`84532`

Contract Address

`0x35005f9f30846c5aCc44a04AB955c26BcE173bae`

Deployment Transaction

`0x45a6b5dc248a3d2dbb798eb1d0f36bc758a52f6bdd66e93e6aa8c2d73bbdcc9f`

Running Locally

Install dependencies:

```bash
npm install


Compile the contract:

```bash
rm -rf build
mkdir -p build
node_modules/.bin/solcjs \
  --bin \
  --abi \
  --base-path . \
  --include-path node_modules \
  -o build \
  contracts/AgentLock.sol


Start the backend:

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload


Start the frontend:

```bash
cd frontend
python -m http.server 3000 --bind 0.0.0.0

Open:

http://127.0.0.1:3000

Demo Flow

The recommended demonstration is:

1. Open the AgentLock dashboard.
2. Confirm the agent is **ACTIVE.
3. Run Simulate Normal Transaction to show low behavioral risk.
4. Run Simulate Attack Burst.
5. Observe the risk score reach 80 — FREEZE.
6. Observe the agent become FROZEN.
7. Observe the violating authorization being rejected by the on-chain contract.
8. Click Resume Agent.
9. Wait for Recovery confirmed on-chain.
10. Confirm the agent returns to ACTIVE and the behavioral window resets.

This demonstrates the complete protection loop rather than only a simulated risk calculation.

Security Model

AgentLock is designed as a behavioral circuit breaker rather than a replacement for wallet security.

The prototype separates:

1. Policy — what an agent is allowed to do.
2. Behavior — what the agent is actually doing.
3. Risk.— whether observed behavior is anomalous.
4. Enforcement — whether the on-chain contract permits continued authorization.
5. Recovery — how an authorized controller restores operation.

Limitations

This is a hackathon prototype and has not been independently audited.

The current prototype uses an owner-controlled enforcement model. The demonstration agent address represents the agent identity used by the policy; it is not itself the transaction sender.

The authorization demonstration validates and records transaction authorization but does not transfer real user funds.

A production implementation should additionally consider:

* Multi-signature recovery
* Timelocked recovery
* Agent-specific key management
* Recipient/context allowlists
* Policy versioning and policy hashes
* More sophisticated behavioral baselines
* External monitoring
* Formal verification
* Independent security auditing
* Integration with the actual wallet/execution layer

Why AgentLock?

Most agent security systems focus on whether an individual transaction is permitted.

AgentLock adds another security question:

 "Is the agent's behavior itself still trustworthy?"

That distinction matters for autonomous systems because a compromised agent may remain within individual transaction limits while performing a dangerous sequence of otherwise-valid actions.

AgentLock turns that behavioral boundary into an enforceable on-chain circuit breaker.

Prototype Status

AgentLock is a functional hackathon prototype demonstrating real on-chain enforcement and recovery on Base Sepolia.

The prototype is intended to demonstrate the security concept and end-to-end workflow. It is not production-ready and has not undergone an independent security audit.
