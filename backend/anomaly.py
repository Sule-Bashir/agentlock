def calculate_risk(
    amount,
    max_transaction,
    transactions_in_window,
    max_transactions_in_window,
):
    risk = 0
    reasons = []

    if amount > max_transaction:
        risk += 50
        reasons.append("Transaction amount exceeds the agent limit")

    if transactions_in_window >= max_transactions_in_window:
        risk += 80
        reasons.append("Transaction velocity exceeds the behavioral baseline")

    if amount > max_transaction * 0.8:
        risk += 10
        reasons.append("Transaction amount is unusually close to the maximum")

    risk = min(risk, 100)

    if risk >= 80:
        decision = "FREEZE"
    elif risk >= 30:
        decision = "REVIEW"
    else:
        decision = "ALLOW"

    return {
        "risk_score": risk,
        "decision": decision,
        "reasons": reasons,
    }
