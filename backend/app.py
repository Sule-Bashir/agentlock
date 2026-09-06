from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.anomaly import calculate_risk
from backend.models import TransactionRequest, RiskResponse


app = FastAPI(
    title="AgentLock API",
    description="Behavioral circuit breaker API for autonomous Web3 agents",
    version="0.1.0",
)


# Allow the local AgentLock dashboard to communicate with the API.
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
