(() => {
  const extensionApi = globalThis.chrome;
  const registry = globalThis.RehearsalExtractors ?? {};
  const extractor = Object.values(registry).find((candidate) =>
    candidate.matches(globalThis.location.hostname),
  );
  if (extensionApi === undefined || extractor === undefined) {
    return;
  }

  const compatibleActions = {
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
  const sensitiveKeyPattern =
    /password|passcode|secret|token|authorization|credential|cookie|session|csrf|otp|mfa|card|cvv|cvc|iban|routing.?number|account.?number|payment/i;
  const mechanicalKeyPattern =
    /coordinate|client[xy]|screen[xy]|page[xy]|offset[xy]|selector|xpath|keycode|rawkey|keystroke|which|copied.?text|clipboard|query.?string/i;
  const sensitiveAutocompletePattern =
    /password|cc-|credit-card|one-time-code|transaction|webauthn/i;
  const state = {};
  let enabled = true;
  let traceId = createTraceId();
  let queuedEvents = [];
  let flushTimer = null;
  let inspectionTimer = null;

  function createTraceId() {
    const identifier =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `extension-trace-${identifier}`.slice(0, 160);
  }

  function compactText(value, maximumLength) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength)
      : "";
  }

  function pageContainsPasswordField() {
    return (
      globalThis.document.querySelector(
        "input[type='password'], input[autocomplete='current-password'], input[autocomplete='new-password']",
      ) !== null
    );
  }

  function isSensitiveField(element) {
    if (!(element instanceof globalThis.Element)) {
      return true;
    }
    const identity = [
      element.getAttribute("name"),
      element.getAttribute("id"),
      element.getAttribute("aria-label"),
      element.getAttribute("autocomplete"),
    ]
      .filter(Boolean)
      .join(" ");
    const autocomplete = element.getAttribute("autocomplete") ?? "";
    return (
      sensitiveKeyPattern.test(identity) ||
      sensitiveAutocompletePattern.test(autocomplete)
    );
  }

  function sanitizePath(value) {
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

  function sanitizedPayloadValue(key, value, depth = 0) {
    if (
      depth > 3 ||
      sensitiveKeyPattern.test(key) ||
      mechanicalKeyPattern.test(key)
    ) {
      return undefined;
    }
    if (typeof value === "string") {
      if (key.toLowerCase().includes("path") || /^https?:\/\//i.test(value)) {
        return sanitizePath(value);
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
        .map((entry) => sanitizedPayloadValue(key, entry, depth + 1))
        .filter((entry) => entry !== undefined);
    }
    if (typeof value !== "object") {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 24)
        .flatMap(([nestedKey, nestedValue]) => {
          const sanitized = sanitizedPayloadValue(
            nestedKey,
            nestedValue,
            depth + 1,
          );
          return sanitized === undefined ? [] : [[nestedKey, sanitized]];
        }),
    );
  }

  function safeFallback(event) {
    if (
      event?.type !== "click" ||
      !(event.target instanceof globalThis.Element)
    ) {
      return [];
    }
    const control = event.target.closest(
      "button, [role='button'], [aria-label]",
    );
    if (control === null || isSensitiveField(control)) {
      return [];
    }
    const label = compactText(
      control.getAttribute("aria-label") ?? control.textContent ?? "",
      100,
    ).toLowerCase();
    if (
      globalThis.location.hostname === "mail.google.com" &&
      (label === "reply" || label.startsWith("reply to"))
    ) {
      return [
        {
          sourceApplication: "mail",
          action: "draft_customer_reply",
          intent: "Draft a customer reply",
          payload: { replyIntent: true },
        },
      ];
    }
    return [];
  }

  function normalizeDescriptor(descriptor) {
    if (
      descriptor === null ||
      typeof descriptor !== "object" ||
      !compatibleActions[descriptor.sourceApplication]?.has(descriptor.action)
    ) {
      return null;
    }
    const payload = sanitizedPayloadValue("payload", descriptor.payload ?? {});
    return {
      traceId,
      occurredAt: new Date().toISOString(),
      sourceApplication: descriptor.sourceApplication,
      action: descriptor.action,
      intent: compactText(descriptor.intent, 240),
      payload: payload !== null && typeof payload === "object" ? payload : {},
      confidence: 1,
      origin: "observed",
    };
  }

  function queueDescriptors(descriptors) {
    for (const descriptor of descriptors) {
      const event = normalizeDescriptor(descriptor);
      if (event !== null) {
        queuedEvents.push(event);
      }
    }
    queuedEvents = queuedEvents.slice(-50);
    if (queuedEvents.length >= 5) {
      void flushEvents();
    } else if (queuedEvents.length > 0 && flushTimer === null) {
      flushTimer = globalThis.setTimeout(() => {
        flushTimer = null;
        void flushEvents();
      }, 700);
    }
  }

  async function flushEvents() {
    if (!enabled || queuedEvents.length === 0) {
      return;
    }
    const batch = queuedEvents.splice(0, 25);
    try {
      const response = await extensionApi.runtime.sendMessage({
        type: "semantic-events",
        events: batch,
      });
      if (response?.ok !== true) {
        queuedEvents = [...batch, ...queuedEvents].slice(-50);
      }
    } catch {
      queuedEvents = [...batch, ...queuedEvents].slice(-50);
    }
  }

  function inspect(event = null) {
    if (!enabled || pageContainsPasswordField()) {
      return;
    }
    const context = {
      document: globalThis.document,
      event,
      isSensitiveField,
      location: globalThis.location,
      state,
    };
    const descriptors = extractor.inspect(context);
    queueDescriptors(
      descriptors.length === 0 ? safeFallback(event) : descriptors,
    );
  }

  function scheduleInspection() {
    if (inspectionTimer !== null) {
      return;
    }
    inspectionTimer = globalThis.setTimeout(() => {
      inspectionTimer = null;
      inspect();
    }, 250);
  }

  globalThis.document.addEventListener("click", inspect, true);
  globalThis.document.addEventListener("focusout", inspect, true);
  globalThis.addEventListener("popstate", scheduleInspection);
  globalThis.addEventListener("hashchange", scheduleInspection);
  new globalThis.MutationObserver(scheduleInspection).observe(
    globalThis.document.documentElement,
    { childList: true, subtree: true },
  );

  extensionApi.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "finish-observation") {
      return false;
    }
    void flushEvents().finally(() => {
      traceId = createTraceId();
      for (const key of Object.keys(state)) {
        delete state[key];
      }
      respond({ ok: true });
    });
    return true;
  });

  extensionApi.storage.local.get({ enabled: true }).then((stored) => {
    enabled = stored.enabled !== false;
    inspect();
  });
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.enabled !== undefined) {
      enabled = changes.enabled.newValue !== false;
    }
  });
})();
