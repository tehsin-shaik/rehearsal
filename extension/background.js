const extensionApi = globalThis.chrome;
const DEFAULT_ENDPOINT = "http://localhost:3000";
const MAX_BUFFERED_EVENTS = 250;
const MAX_DELIVERY_BATCH = 25;
const MAX_RECENT_EVENTS = 12;
const MAX_RESPONSE_BYTES = 65_536;
const STORAGE_DEFAULTS = {
  activeTraceEventCount: 0,
  activeTraceId: null,
  deliveredCount: 0,
  enabled: true,
  endpoint: DEFAULT_ENDPOINT,
  lastError: null,
  pending: [],
  recent: [],
  retryAttempt: 0,
  status: "idle",
};
const sensitiveKeyPattern =
  /password|passcode|secret|token|authorization|credential|cookie|session|csrf|otp|mfa|card|cvv|cvc|iban|routing.?number|account.?number|payment/i;
const mechanicalKeyPattern =
  /coordinate|client[xy]|screen[xy]|page[xy]|offset[xy]|selector|xpath|keycode|rawkey|keystroke|which|copied.?text|clipboard|query.?string/i;
const applicationActions = {
  mail: new Set([
    "report_received",
    "read_report",
    "classify_report",
    "draft_customer_reply",
    "reply_to_customer",
  ]),
  issue_tracker: new Set(["create_issue", "assign_owner"]),
  team_chat: new Set(["draft_team_notification", "send_team_notification"]),
};
let operationQueue = Promise.resolve();

function exclusively(operation) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => undefined);
  return result;
}

function compactText(value, maximumLength) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength)
    : "";
}

function normalizedEndpoint(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new TypeError("Use HTTPS or a local development endpoint.");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

function normalizedPath(value) {
  try {
    const url = new URL(value, "https://redacted.invalid");
    return url.pathname
      .replace(/\/browse\/[A-Z][A-Z0-9]+-\d+(?=\/|$)/g, "/browse/:issue")
      .replace(/\/t\/[A-Za-z0-9_-]{2,80}(?=\/|$)/g, "/t/:task")
      .slice(0, 240);
  } catch {
    return "/";
  }
}

function scrubValue(key, value, depth = 0) {
  if (
    depth > 3 ||
    sensitiveKeyPattern.test(key) ||
    mechanicalKeyPattern.test(key)
  ) {
    return undefined;
  }
  if (typeof value === "string") {
    if (key.toLowerCase().includes("path") || /^https?:\/\//i.test(value)) {
      return normalizedPath(value);
    }
    if (
      /(?:\d[ -]?){13,19}/.test(value) ||
      /\b(?:bearer|token|secret|password)\s*[:=]\s*\S+/i.test(value)
    ) {
      return undefined;
    }
    return compactText(value, 240);
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((entry) => scrubValue(key, entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value !== "object") {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 24)
      .flatMap(([nestedKey, nestedValue]) => {
        const scrubbed = scrubValue(nestedKey, nestedValue, depth + 1);
        return scrubbed === undefined ? [] : [[nestedKey, scrubbed]];
      }),
  );
}

function createTraceId() {
  return `extension-trace-${globalThis.crypto.randomUUID()}`.slice(0, 160);
}

function sanitizeEvent(value, traceId) {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const actions = applicationActions[value.sourceApplication];
  if (actions === undefined || !actions.has(value.action)) {
    return null;
  }
  const occurredAt = new Date(value.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }
  const payload = scrubValue("payload", value.payload ?? {});
  return {
    traceId,
    occurredAt: occurredAt.toISOString(),
    sourceApplication: value.sourceApplication,
    action: value.action,
    intent: compactText(value.intent, 240),
    payload: payload !== null && typeof payload === "object" ? payload : {},
    confidence: 1,
    origin: "observed",
  };
}

async function storedState() {
  return extensionApi.storage.local.get(STORAGE_DEFAULTS);
}

async function persist(state) {
  await extensionApi.storage.local.set(state);
  const pendingCount = state.pending?.length ?? 0;
  await extensionApi.action.setBadgeBackgroundColor({ color: "#0a94b8" });
  await extensionApi.action.setBadgeText({
    text: pendingCount === 0 ? "" : String(Math.min(999, pendingCount)),
  });
}

async function enqueueEvents(values) {
  const result = await exclusively(async () => {
    const state = await storedState();
    if (state.enabled === false) {
      return { ok: false, accepted: 0 };
    }
    const activeTraceId = state.activeTraceId ?? createTraceId();
    const events = values
      .slice(0, 50)
      .map((value) => sanitizeEvent(value, activeTraceId))
      .filter(Boolean);
    if (events.length === 0) {
      return { ok: false, accepted: 0 };
    }
    const records = events.map((event) => ({
      kind: "event",
      queueId: globalThis.crypto.randomUUID(),
      event,
    }));
    const recent = [
      ...records.map((record) => ({
        action: record.event.action,
        occurredAt: record.event.occurredAt,
        sourceApplication: record.event.sourceApplication,
        status: "pending",
      })),
      ...state.recent,
    ].slice(0, MAX_RECENT_EVENTS);
    await persist({
      ...state,
      activeTraceEventCount: state.activeTraceEventCount + records.length,
      activeTraceId,
      pending: [...state.pending, ...records].slice(-MAX_BUFFERED_EVENTS),
      recent,
      status: "idle",
    });
    return { ok: true, accepted: records.length };
  });
  if (result.ok) {
    void deliverPending();
  }
  return result;
}

function scheduleRetry(attempt) {
  const delayInMinutes = Math.min(30, Math.max(0.5, 2 ** attempt / 2));
  return extensionApi.alarms.create("rehearsal-retry", {
    delayInMinutes,
  });
}

async function boundedJson(response) {
  if (response.body === null) {
    throw new TypeError("The API response was empty.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let value = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      value += decoder.decode();
      return JSON.parse(value);
    }
    byteCount += chunk.value.byteLength;
    if (byteCount > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RangeError("The API response exceeded its size limit.");
    }
    value += decoder.decode(chunk.value, { stream: true });
  }
}

async function postBatch(endpoint, records) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `${normalizedEndpoint(endpoint)}/api/observe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: records
            .filter((record) => record.kind === "event")
            .map((record) => record.event),
          completedTraceIds: records
            .filter((record) => record.kind === "completion")
            .map((record) => record.traceId),
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
      };
    }
    const value = await boundedJson(response);
    return {
      ok: value?.ok === true && value.accepted === records.length,
      retryable: false,
    };
  } catch {
    return { ok: false, retryable: true };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function deliverPending() {
  return exclusively(async () => {
    const state = await storedState();
    if (state.enabled === false || state.pending.length === 0) {
      await persist({
        ...state,
        status: state.pending.length === 0 ? "connected" : "idle",
      });
      return { ok: true, delivered: 0 };
    }
    const batch = state.pending.slice(0, MAX_DELIVERY_BATCH);
    await persist({ ...state, status: "delivering", lastError: null });
    const result = await postBatch(state.endpoint, batch);
    const current = await storedState();
    if (!result.ok) {
      const retryAttempt = Math.min(8, current.retryAttempt + 1);
      await persist({
        ...current,
        status: "failed",
        lastError: "The Rehearsal API did not accept the semantic event batch.",
        retryAttempt,
      });
      if (result.retryable) {
        await scheduleRetry(retryAttempt);
      }
      return { ok: false, delivered: 0 };
    }

    const deliveredIds = new Set(batch.map((record) => record.queueId));
    const eventBatch = batch.filter((record) => record.kind === "event");
    const recent = current.recent.map((entry) =>
      eventBatch.some(
        (record) =>
          record.event.action === entry.action &&
          record.event.occurredAt === entry.occurredAt,
      )
        ? { ...entry, status: "delivered" }
        : entry,
    );
    await persist({
      ...current,
      deliveredCount: current.deliveredCount + eventBatch.length,
      lastError: null,
      pending: current.pending.filter(
        (record) => !deliveredIds.has(record.queueId),
      ),
      recent,
      retryAttempt: 0,
      status: "connected",
    });
    return { ok: true, delivered: batch.length };
  });
}

async function finishObservation() {
  await exclusively(async () => {
    const state = await storedState();
    if (state.activeTraceEventCount === 0 || state.activeTraceId === null) {
      return;
    }
    await persist({
      ...state,
      activeTraceEventCount: 0,
      activeTraceId: createTraceId(),
      pending: [
        ...state.pending,
        {
          kind: "completion",
          queueId: globalThis.crypto.randomUUID(),
          traceId: state.activeTraceId,
        },
      ].slice(-MAX_BUFFERED_EVENTS),
    });
  });
  let delivered = 0;
  while (true) {
    const state = await storedState();
    if (state.pending.length === 0) {
      return { ok: true, delivered };
    }
    const result = await deliverPending();
    delivered += result.delivered;
    if (!result.ok || result.delivered === 0) {
      return { ok: false, delivered };
    }
  }
}

async function publicStatus() {
  const state = await storedState();
  return {
    deliveredCount: state.deliveredCount,
    enabled: state.enabled,
    endpoint: state.endpoint,
    lastError: state.lastError,
    pendingCount: state.pending.length,
    recent: state.recent,
    status: state.status,
  };
}

async function handleMessage(message) {
  switch (message?.type) {
    case "semantic-events":
      return enqueueEvents(Array.isArray(message.events) ? message.events : []);
    case "get-status":
      return { ok: true, state: await publicStatus() };
    case "set-enabled": {
      const state = await storedState();
      await persist({ ...state, enabled: message.enabled === true });
      if (message.enabled === true) {
        void deliverPending();
      }
      return { ok: true, state: await publicStatus() };
    }
    case "set-endpoint": {
      const endpoint = normalizedEndpoint(message.endpoint);
      const state = await storedState();
      await persist({ ...state, endpoint, status: "idle", lastError: null });
      void deliverPending();
      return { ok: true, state: await publicStatus() };
    }
    case "finish-observation":
      return finishObservation();
    default:
      return { ok: false };
  }
}

extensionApi.runtime.onMessage.addListener((message, _sender, respond) => {
  handleMessage(message).then(respond, () => respond({ ok: false }));
  return true;
});

extensionApi.alarms.onAlarm.addListener((alarm) => {
  if (["rehearsal-flush", "rehearsal-retry"].includes(alarm.name)) {
    void deliverPending();
  }
});

async function initialize() {
  const state = await storedState();
  await persist(state);
  await extensionApi.alarms.create("rehearsal-flush", { periodInMinutes: 1 });
  void deliverPending();
}

extensionApi.runtime.onInstalled.addListener(() => {
  void initialize();
});
extensionApi.runtime.onStartup.addListener(() => {
  void initialize();
});
void initialize();
