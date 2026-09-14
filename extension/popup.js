const extensionApi = globalThis.chrome;
const enabledInput = globalThis.document.querySelector("#enabled");
const endpointForm = globalThis.document.querySelector("#endpoint-form");
const endpointInput = globalThis.document.querySelector("#endpoint");
const endpointMessage = globalThis.document.querySelector("#endpoint-message");
const finishButton = globalThis.document.querySelector("#finish");
const pendingCount = globalThis.document.querySelector("#pending-count");
const deliveredCount = globalThis.document.querySelector("#delivered-count");
const statusDot = globalThis.document.querySelector("#status-dot");
const statusLabel = globalThis.document.querySelector("#status-label");
const statusDetail = globalThis.document.querySelector("#status-detail");
const eventCount = globalThis.document.querySelector("#event-count");
const recentEvents = globalThis.document.querySelector("#recent-events");
const emptyState = globalThis.document.querySelector("#empty-state");

async function send(message) {
  return extensionApi.runtime.sendMessage(message);
}

function readableAction(value) {
  return String(value).replaceAll("_", " ");
}

function statusCopy(state) {
  if (!state.enabled) {
    return ["Observation paused", "No new semantic events will be recorded"];
  }
  if (state.status === "connected") {
    return ["API connected", "Semantic events are delivery-confirmed"];
  }
  if (state.status === "delivering") {
    return ["Delivering events", "Sending a bounded semantic batch"];
  }
  if (state.status === "failed") {
    return ["Delivery pending", state.lastError ?? "The API is unavailable"];
  }
  return ["Observer ready", "Waiting for supported semantic work"];
}

function render(state) {
  enabledInput.checked = state.enabled;
  endpointInput.value = state.endpoint;
  pendingCount.textContent = String(state.pendingCount);
  deliveredCount.textContent = String(state.deliveredCount);
  statusDot.className = `status-dot ${state.status}`;
  const [label, detail] = statusCopy(state);
  statusLabel.textContent = label;
  statusDetail.textContent = detail;
  eventCount.textContent = String(state.recent.length);
  emptyState.hidden = state.recent.length > 0;
  recentEvents.replaceChildren(
    ...state.recent.map((event) => {
      const row = globalThis.document.createElement("li");
      row.className = event.status;
      const copy = globalThis.document.createElement("span");
      const title = globalThis.document.createElement("strong");
      const application = globalThis.document.createElement("small");
      const time = globalThis.document.createElement("time");
      title.textContent = readableAction(event.action);
      application.textContent = readableAction(event.sourceApplication);
      time.textContent = new Date(event.occurredAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      copy.append(title, application);
      row.append(copy, time);
      return row;
    }),
  );
}

async function refresh() {
  const response = await send({ type: "get-status" });
  if (response?.ok === true) {
    render(response.state);
  }
}

enabledInput.addEventListener("change", async () => {
  const response = await send({
    type: "set-enabled",
    enabled: enabledInput.checked,
  });
  if (response?.ok === true) {
    render(response.state);
  }
});

endpointForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  endpointMessage.textContent = "";
  try {
    const url = new URL(endpointInput.value);
    if (url.protocol === "https:") {
      const granted = await extensionApi.permissions.request({
        origins: [`${url.origin}/*`],
      });
      if (!granted) {
        throw new Error("Permission was not granted for this endpoint.");
      }
    }
    const response = await send({
      type: "set-endpoint",
      endpoint: endpointInput.value,
    });
    if (response?.ok !== true) {
      throw new Error("The endpoint could not be saved.");
    }
    endpointMessage.textContent = "Endpoint saved.";
    render(response.state);
  } catch (error) {
    endpointMessage.textContent =
      error instanceof Error ? error.message : "Invalid endpoint.";
  }
});

finishButton.addEventListener("click", async () => {
  finishButton.disabled = true;
  try {
    const tabs = await extensionApi.tabs.query({
      active: true,
      currentWindow: true,
    });
    const activeTab = tabs[0];
    if (activeTab?.id !== undefined) {
      await extensionApi.tabs
        .sendMessage(activeTab.id, { type: "finish-observation" })
        .catch(() => undefined);
    }
    await send({ type: "finish-observation" });
    await refresh();
  } finally {
    finishButton.disabled = false;
  }
});

void refresh();
globalThis.setInterval(() => void refresh(), 2_000);
