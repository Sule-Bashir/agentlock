const API_URL = "http://127.0.0.1:8000";

const statusEl = document.getElementById("status");
const indicatorEl = document.getElementById("status-indicator");
const riskScoreEl = document.getElementById("risk-score");
const decisionEl = document.getElementById("decision");
const reasonsEl = document.getElementById("reasons");

function setStatus(status, danger = false) {
  statusEl.textContent = status;

  if (danger) {
    indicatorEl.style.background = "#ff4d6d";
    indicatorEl.style.boxShadow = "0 0 16px #ff4d6d";
  } else {
    indicatorEl.style.background = "#32d583";
    indicatorEl.style.boxShadow = "0 0 16px #32d583";
  }
}

function showReasons(reasons) {
  reasonsEl.innerHTML = "";

  if (!reasons || reasons.length === 0) {
    reasonsEl.innerHTML = "<li>No anomalies detected.</li>";
    return;
  }

  reasons.forEach((reason) => {
    const li = document.createElement("li");
    li.textContent = reason;
    reasonsEl.appendChild(li);
  });
}

async function loadBlockchainStatus() {
  try {
    const response = await fetch(`${API_URL}/blockchain/status`);

    if (!response.ok) {
      throw new Error(`Blockchain API returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.registered) {
      setStatus("NOT REGISTERED", true);
      decisionEl.textContent = "Agent is not registered";
      showReasons(["Agent not found on AgentLock contract."]);
      return;
    }

    if (result.active) {
      setStatus("ACTIVE", false);
      decisionEl.textContent = "On-chain agent is active";
    } else {
      setStatus("FROZEN", true);
      decisionEl.textContent = "On-chain circuit breaker is engaged";
    }

    showReasons([
      `On-chain transactions: ${result.transaction_count}`,
      `Window transactions: ${result.window_transaction_count}`,
      `Behavior limit: ${result.max_transactions_per_window}`
    ]);

  } catch (error) {
    setStatus("API ERROR", true);
    decisionEl.textContent = error.message;

    showReasons([
      "Unable to read AgentLock blockchain state."
    ]);

    console.error(error);
  }
}

async function analyze(data) {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const result = await response.json();

    riskScoreEl.textContent = result.risk_score;
    decisionEl.textContent = result.decision;

    if (result.decision === "FREEZE") {
      setStatus("FROZEN", true);
    } else {
      setStatus("ACTIVE", false);
    }

    showReasons(result.reasons);

  } catch (error) {
    setStatus("API ERROR", true);
    decisionEl.textContent = error.message;

    reasonsEl.innerHTML = "<li>Unable to reach AgentLock API.</li>";

    console.error(error);
  }
}

document.getElementById("normal-btn").addEventListener("click", () => {
  analyze({
    amount: 50,
    max_transaction: 100,
    transactions_in_window: 1,
    max_transactions_in_window: 3
  });
});

document.getElementById("attack-btn").addEventListener("click", () => {
  analyze({
    amount: 50,
    max_transaction: 100,
    transactions_in_window: 3,
    max_transactions_in_window: 3
  });
});

document.getElementById("resume-btn").addEventListener("click", () => {
  loadBlockchainStatus();
});

loadBlockchainStatus();
