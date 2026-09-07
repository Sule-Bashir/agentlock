from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.anomaly import calculate_risk
from backend.models import TransactionRequest, RiskResponse

import json
import os
import subprocess


app = FastAPI(
    title="AgentLock API",
    description="Behavioral circuit breaker API for autonomous Web3 agents",
    version="0.5.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "agentlock",
    }


@app.post("/analyze", response_model=RiskResponse)
def analyze_transaction(request: TransactionRequest):
    return calculate_risk(
        amount=request.amount,
        max_transaction=request.max_transaction,
        transactions_in_window=request.transactions_in_window,
        max_transactions_in_window=request.max_transactions_in_window,
    )


def rpc_call(method, params):
    rpc_url = os.environ.get("RPC_URL")

    if not rpc_url:
        raise RuntimeError("RPC_URL is not configured")

    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
    })

    result = subprocess.run(
        [
            "curl",
            "-s",
            "--max-time",
            "15",
            "-X",
            "POST",
            rpc_url,
            "-H",
            "Content-Type: application/json",
            "--data",
            payload,
        ],
        capture_output=True,
        text=True,
        timeout=20,
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or "RPC request failed"
        )

    response = json.loads(result.stdout)

    if "error" in response:
        raise RuntimeError(
            response["error"].get("message", "RPC error")
        )

    return response["result"]


def encode_get_agent(agent):
    selector = "0xfb3551ff"

    address = agent.lower().replace("0x", "")

    return (
        selector
        + address.rjust(64, "0")
    )


def decode_get_agent(result):
    data = result[2:] if result.startswith("0x") else result

    if len(data) < 640:
        raise RuntimeError(
            "Unexpected getAgent response length"
        )

    words = [
        data[i:i + 64]
        for i in range(0, 640, 64)
    ]

    return {
        "registered": int(words[0], 16) != 0,
        "active": int(words[1], 16) != 0,
        "max_transaction": int(words[2], 16),
        "daily_limit": int(words[3], 16),
        "spent_today": int(words[4], 16),
        "transaction_count": int(words[5], 16),
        "max_transactions_per_window": int(words[6], 16),
        "window_duration": int(words[7], 16),
        "window_start": int(words[8], 16),
        "window_transaction_count": int(words[9], 16),
    }


@app.get("/blockchain/status")
def blockchain_status():
    contract = os.environ.get(
        "AGENTLOCK_CONTRACT_ADDRESS"
    )

    agent = os.environ.get("AGENT_ADDRESS")

    if not contract:
        return {
            "configured": False,
            "active": None,
            "error": (
                "AGENTLOCK_CONTRACT_ADDRESS "
                "is not configured"
            ),
        }

    if not agent:
        return {
            "configured": False,
            "active": None,
            "error": (
                "AGENT_ADDRESS "
                "is not configured"
            ),
        }

    try:
        block_number = rpc_call(
            "eth_blockNumber",
            [],
        )

        code = rpc_call(
            "eth_getCode",
            [contract, "latest"],
        )

        if code == "0x":
            return {
                "configured": True,
                "active": None,
                "error": (
                    "No contract code found "
                    "at configured address"
                ),
            }

        call_data = encode_get_agent(agent)

        raw_state = rpc_call(
            "eth_call",
            [
                {
                    "to": contract,
                    "data": call_data,
                },
                "latest",
            ],
        )

        state = decode_get_agent(raw_state)

        return {
            "configured": True,
            "network": "Base Sepolia",
            "chain_id": 84532,
            "contract": contract,
            "agent": agent,
            "rpc_block": int(block_number, 16),
            "contract_deployed": True,
            "registered": state["registered"],
            "active": state["active"],
            "max_transaction_wei": state["max_transaction"],
            "daily_limit_wei": state["daily_limit"],
            "spent_today_wei": state["spent_today"],
            "transaction_count": state["transaction_count"],
            "max_transactions_per_window": state[
                "max_transactions_per_window"
            ],
            "window_duration": state["window_duration"],
            "window_transaction_count": state[
                "window_transaction_count"
            ],
        }

    except subprocess.TimeoutExpired:
        return {
            "configured": True,
            "active": None,
            "error": (
                "Blockchain RPC request timed out"
            ),
        }

    except Exception as error:
        return {
            "configured": True,
            "active": None,
            "error": str(error),
        }


@app.post("/blockchain/authorize")
def blockchain_authorize():
    contract = os.environ.get(
        "AGENTLOCK_CONTRACT_ADDRESS"
    )

    agent = os.environ.get("AGENT_ADDRESS")

    private_key = os.environ.get("PRIVATE_KEY")
    rpc_url = os.environ.get("RPC_URL")

    recipient = os.environ.get(
        "RECIPIENT_ADDRESS",
        "0x2222222222222222222222222222222222222222"
    )

    amount = os.environ.get(
        "AMOUNT_WEI",
        "10000000000000"
    )

    if not contract:
        return {
            "success": False,
            "error": "AGENTLOCK_CONTRACT_ADDRESS is not configured",
        }

    if not agent:
        return {
            "success": False,
            "error": "AGENT_ADDRESS is not configured",
        }

    if not private_key:
        return {
            "success": False,
            "error": "PRIVATE_KEY is not configured",
        }

    if not rpc_url:
        return {
            "success": False,
            "error": "RPC_URL is not configured",
        }

    try:
        result = subprocess.run(
            ["node", "backend/authorize.cjs"],
            capture_output=True,
            text=True,
            timeout=45,
            env=os.environ.copy(),
        )

        if result.returncode != 0:
            return {
                "success": False,
                "error": (
                    result.stderr.strip()
                    or "Authorization transaction failed"
                ),
            }

        data = json.loads(result.stdout)

        return {
            "success": True,
            "transactionHash": data["transactionHash"],
            "agent": data["agent"],
            "recipient": data["recipient"],
            "amountWei": data["amountWei"],
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Authorization request timed out",
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Invalid response from authorization bridge",
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error),
        }


@app.post("/blockchain/resume")
def blockchain_resume():
    contract = os.environ.get(
        "AGENTLOCK_CONTRACT_ADDRESS"
    )

    agent = os.environ.get("AGENT_ADDRESS")

    private_key = os.environ.get("PRIVATE_KEY")
    rpc_url = os.environ.get("RPC_URL")

    if not contract:
        return {
            "success": False,
            "error": (
                "AGENTLOCK_CONTRACT_ADDRESS "
                "is not configured"
            ),
        }

    if not agent:
        return {
            "success": False,
            "error": (
                "AGENT_ADDRESS "
                "is not configured"
            ),
        }

    if not private_key:
        return {
            "success": False,
            "error": "PRIVATE_KEY is not configured",
        }

    if not rpc_url:
        return {
            "success": False,
            "error": "RPC_URL is not configured",
        }

    try:
        result = subprocess.run(
            ["node", "backend/resume.cjs"],
            capture_output=True,
            text=True,
            timeout=45,
            env=os.environ.copy(),
        )

        if result.returncode != 0:
            return {
                "success": False,
                "error": (
                    result.stderr.strip()
                    or "Resume transaction failed"
                ),
            }

        data = json.loads(result.stdout)

        return {
            "success": True,
            "transactionHash": data["transactionHash"],
            "agent": data["agent"],
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Resume request timed out",
        }

    except json.JSONDecodeError:
        return {
            "success": False,
            "error": "Invalid response from resume bridge",
        }

    except Exception as error:
        return {
            "success": False,
            "error": str(error),
        }
