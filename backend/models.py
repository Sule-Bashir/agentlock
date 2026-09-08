from pydantic import BaseModel


class TransactionRequest(BaseModel):
    amount: float
    max_transaction: float
    transactions_in_window: int
    max_transactions_per_window: int


class RiskResponse(BaseModel):
    risk_score: int
    decision: str
    reasons: list[str]
