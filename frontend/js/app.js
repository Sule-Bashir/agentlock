const API_URL = "http://127.0.0.1:8000";

const statusEl = document.getElementById("status");
const indicatorEl = document.getElementById("status-indicator");
const riskScoreEl = document.getElementById("risk-score");
const decisionEl = document.getElementById("decision");
const reasonsEl = document.getElementById("reasons");

let attackRunning = false;
let resumeRunning = false;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBlockchainStatus() {
  const response = await fetch(
    `${API_URL}/blockchain/status`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(
      `Blockchain API returned ${response.status}`
    );
  }

  return await response.json();
}

async function loadBlockchainStatus() {
  try {
    const result = await getBlockchainStatus();

    if (result.error) {
      setStatus("BLOCKCHAIN ERROR", true);
      decisionEl.textContent = result.error;

      showReasons([
        "Unable to read current AgentLock state."
      ]);

      return;
    }

    if (!result.registered) {
      setStatus("NOT REGISTERED", true);
      decisionEl.textContent =
        "Agent is not registered";

      showReasons([
        "Agent not found on AgentLock contract."
      ]);

      return;
    }

    if (result.active) {
      setStatus("ACTIVE", false);
      decisionEl.textContent =
        "On-chain agent is active";
    } else {
      setStatus("FROZEN", true);
      decisionEl.textContent =
        "On-chain circuit breaker is engaged";
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
      "Unable to reach AgentLock API."
    ]);

    console.error(error);
  }
}

async function analyze(data) {
  try {
    const response = await fetch(
      `${API_URL}/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );

    if (!response.ok) {
      throw new Error(
        `API returned ${response.status}`
      );
    }

    const result = await response.json();

    riskScoreEl.textContent =
      result.risk_score;

    decisionEl.textContent =
      result.decision;

    if (result.decision === "FREEZE") {
      setStatus("FROZEN", true);
    } else {
      setStatus("ACTIVE", false);
    }

    showReasons(result.reasons);

  } catch (error) {
    setStatus("API ERROR", true);
    decisionEl.textContent = error.message;

    showReasons([
      "Unable to reach AgentLock API."
    ]);

    console.error(error);
  }
}

async function authorizeOnChain() {
  const response = await fetch(
    `${API_URL}/blockchain/authorize`,
    {
      method: "POST",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Authorization API returned ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.error || "Authorization failed"
    );
  }

  return result;
}

async function waitForStateChange(
  previousTransactions,
  previousWindowTransactions,
  timeoutMs = 60000
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const state = await getBlockchainStatus();

    if (
      state.transaction_count >
        previousTransactions ||
      state.window_transaction_count >
        previousWindowTransactions ||
      state.active === false
    ) {
      return state;
    }

    await sleep(3000);
  }

  throw new Error(
    "Timed out waiting for on-chain confirmation"
  );
}

async function attackBurst() {
  if (attackRunning) {
    return;
  }

  attackRunning = true;

  const attackButton =
    document.getElementById("attack-btn");

  attackButton.disabled = true;

  try {
    setStatus("ATTACK DETECTED", true);
    riskScoreEl.textContent = "80";
    decisionEl.textContent =
      "Behavioral anomaly detected";

    showReasons([
      "Transaction velocity exceeds the behavioral baseline.",
      "Submitting controlled on-chain authorization burst..."
    ]);

    const transactions = [];

    for (let i = 0; i < 4; i++) {
      const before = await getBlockchainStatus();

      if (!before.active) {
        break;
      }

      showReasons([
        `Authorization ${i + 1}/4`,
        "Submitting transaction to AgentLock...",
        `Current window transactions: ${before.window_transaction_count}/${before.max_transactions_per_window}`
      ]);

      const result =
        await authorizeOnChain();

      transactions.push(
        result.transactionHash
      );

      showReasons([
        `Authorization ${i + 1}/4 submitted.`,
        "Waiting for on-chain confirmation...",
        ...transactions.map(
          (hash, index) =>
            `TX ${index + 1}: ${hash}`
        )
      ]);

      const after =
        await waitForStateChange(
          before.transaction_count,
          before.window_transaction_count
        );

      if (!after.active) {
        break;
      }

      showReasons([
        `Authorization ${i + 1}/4 confirmed on-chain.`,
        `Transactions: ${after.transaction_count}`,
        `Window transactions: ${after.window_transaction_count}`,
        `Behavior limit: ${after.max_transactions_per_window}`,
        ...transactions.map(
          (hash, index) =>
            `TX ${index + 1}: ${hash}`
        )
      ]);
    }

    const finalState =
      await getBlockchainStatus();

    if (finalState.active === false) {
      riskScoreEl.textContent = "80";
      setStatus("FROZEN", true);

      decisionEl.textContent =
        "AgentLock circuit breaker engaged";

      showReasons([
        "Behavioral anomaly confirmed.",
        "Agent automatically frozen on-chain.",
        `Transactions completed: ${finalState.transaction_count}`,
        `Window transactions: ${finalState.window_transaction_count}`,
        `Behavior limit: ${finalState.max_transactions_per_window}`,
        "The violating authorization was rejected by the circuit breaker."
      ]);

    } else {
      setStatus("ACTIVE", false);

      decisionEl.textContent =
        "Attack burst completed without freeze";

      showReasons([
        "The agent remains active.",
        `Transactions: ${finalState.transaction_count}`,
        `Window transactions: ${finalState.window_transaction_count}`,
        `Behavior limit: ${finalState.max_transactions_per_window}`
      ]);
    }

  } catch (error) {
    setStatus("ATTACK ERROR", true);
    decisionEl.textContent = error.message;

    showReasons([
      "Attack simulation stopped.",
      error.message,
      "Check the AgentLock API and blockchain connection."
    ]);

    console.error(error);

  } finally {
    attackRunning = false;
    attackButton.disabled = false;
  }
}

async function resumeAgent() {
  if (resumeRunning) {
    return;
  }

  resumeRunning = true;

  const resumeButton =
    document.getElementById("resume-btn");

  resumeButton.disabled = true;

  try {
    setStatus("RESUMING...", true);

    riskScoreEl.textContent = "80";

    decisionEl.textContent =
      "Submitting on-chain recovery transaction...";

    showReasons([
      "Requesting AgentLock recovery..."
    ]);

    let result = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        showReasons([
          `Recovery attempt ${attempt}/3`,
          "Submitting on-chain recovery transaction..."
        ]);

        const response = await fetch(
          `${API_URL}/blockchain/resume`,
          {
            method: "POST",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(
            `Resume API returned ${response.status}`
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.error ||
            "Resume transaction failed"
          );
        }

        result = data;
        break;

      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          showReasons([
            `Recovery attempt ${attempt} failed.`,
            error.message,
            "Retrying..."
          ]);

          await sleep(4000);
        }
      }
    }

    if (!result) {
      throw lastError ||
        new Error("Recovery transaction failed");
    }

    showReasons([
      "Recovery transaction submitted.",
      `Transaction: ${result.transactionHash}`,
      "Waiting for on-chain confirmation..."
    ]);

    let state = null;

    for (let attempt = 1; attempt <= 12; attempt++) {
      await sleep(3000);

      state = await getBlockchainStatus();

      if (state.active) {
        break;
      }

      showReasons([
        "Recovery transaction submitted.",
        `Confirmation check ${attempt}/12`,
        "Agent is still frozen. Waiting..."
      ]);
    }

    if (!state || !state.active) {
      throw new Error(
        "Recovery transaction submitted but agent is still frozen."
      );
    }

    setStatus("ACTIVE", false);
    riskScoreEl.textContent = "0";

    decisionEl.textContent =
      "Agent resumed on-chain";

    showReasons([
      "Recovery confirmed on-chain.",
      `Transactions: ${state.transaction_count}`,
      `Window transactions: ${state.window_transaction_count}`,
      "AgentLock circuit breaker is active again."
    ]);

  } catch (error) {
    setStatus("RECOVERY ERROR", true);
    decisionEl.textContent = error.message;

    showReasons([
      "Unable to resume the agent.",
      error.message,
      "The agent remains protected on-chain."
    ]);

    console.error(error);

  } finally {
    resumeRunning = false;
    resumeButton.disabled = false;
  }
}

document.getElementById(
  "normal-btn"
).addEventListener(
  "click",
  () => {
    analyze({
      amount: 50,
      max_transaction: 100,
      transactions_in_window: 1,
      max_transactions_per_window: 3
    });
  }
);

document.getElementById(
  "attack-btn"
).addEventListener(
  "click",
  attackBurst
);

document.getElementById(
  "resume-btn"
).addEventListener(
  "click",
  resumeAgent
);

loadBlockchainStatus();
