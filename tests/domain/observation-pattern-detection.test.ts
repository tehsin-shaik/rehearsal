import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  normalizeSemanticEvent,
  SEMANTIC_ACTION_TAXONOMY,
  SemanticTraceBuilder,
  type SemanticEventInput,
} from "../../src/domain/events/index.ts";
import {
  calculateLiveMatchConfidence,
  compareWorkflowTraces,
  DEFAULT_PATTERN_DETECTION_CONFIG,
  detectRepeatedPattern,
  TRACE_SIMILARITY_WEIGHTS,
} from "../../src/domain/patterns/index.ts";
import {
  apiTimeoutTrace,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/index.ts";

const BASE_EVENT_INPUT = {
  traceId: "trace-normalization-001",
  occurredAt: "2026-02-01T08:00:00.000Z",
  sourceApplication: "issue_tracker",
  action: "create_issue",
  intent: "  Create   a support issue  ",
  confidence: 1.2,
  estimatedEffortSeconds: 75,
} as const satisfies Omit<SemanticEventInput, "payload">;

test("the taxonomy covers the canonical semantic support actions", () => {
  assert.deepEqual(Object.keys(SEMANTIC_ACTION_TAXONOMY), [
    "report_received",
    "read_report",
    "extract_issue",
    "classify_report",
    "create_issue",
    "assign_owner",
    "draft_team_notification",
    "send_team_notification",
    "draft_customer_reply",
    "reply_to_customer",
  ]);
});

test("normalization is deterministic and associates the active trace", () => {
  const firstEvent = normalizeSemanticEvent({
    ...BASE_EVENT_INPUT,
    payload: { reportId: "report-001", category: "authentication" },
  });
  const secondEvent = normalizeSemanticEvent({
    ...BASE_EVENT_INPUT,
    payload: { category: "authentication", reportId: "report-001" },
  });

  assert.ok(firstEvent);
  assert.deepEqual(firstEvent, secondEvent);
  assert.equal(firstEvent.traceId, BASE_EVENT_INPUT.traceId);
  assert.equal(firstEvent.intent, "Create a support issue");
  assert.equal(firstEvent.confidence, 1);
});

test("sensitive fields and sensitive string values are removed recursively", () => {
  const event = normalizeSemanticEvent({
    ...BASE_EVENT_INPUT,
    payload: {
      reportId: "report-001",
      category: "authentication",
      issueDescription: "Customer cannot sign in after a password reset.",
      password: "fixture-password",
      accessToken: "fixture-access-token",
      credentials: { username: "fixture-user", secret: "fixture-secret" },
      authData: { sessionId: "fixture-session" },
      payment: { cardNumber: "4111 1111 1111 1111", cvv: "123" },
      customer: {
        email: "customer@example.test",
        sessionId: "fixture-session",
      },
      notes: "token=fixture-token-value",
    },
  });

  assert.ok(event);
  assert.deepEqual(event.payload, {
    category: "authentication",
    customer: { email: "customer@example.test" },
    issueDescription: "Customer cannot sign in after a password reset.",
    reportId: "report-001",
  });
});

test("observation mechanics are never recorded", () => {
  const event = normalizeSemanticEvent({
    ...BASE_EVENT_INPUT,
    payload: {
      reportId: "report-001",
      coordinates: { x: 120, y: 240 },
      clientX: 120,
      clientY: 240,
      selector: "#submit",
      xpath: "//button",
      rawKey: "Enter",
      keyCode: 13,
      keyboardInput: "secret input",
      clipboardText: "copied message",
      rawMessageBody: "full copied message",
      body: "full copied message",
    },
  });

  assert.ok(event);
  assert.deepEqual(event.payload, { reportId: "report-001" });
});

test("configured applications are excluded before event creation", () => {
  const event = normalizeSemanticEvent(BASE_EVENT_INPUT, {
    excludedApplications: ["issue_tracker"],
  });

  assert.equal(event, null);
});

test("issue extraction and classification are inferred before issue creation", () => {
  const builder = new SemanticTraceBuilder({
    traceId: "trace-latent-001",
    startedAt: "2026-02-01T08:00:00.000Z",
  });
  const appendedEvents = builder.append({
    occurredAt: "2026-02-01T08:01:00.000Z",
    sourceApplication: "issue_tracker",
    action: "create_issue",
    payload: {
      reportId: "report-001",
      issueTitle: "Unable to sign in",
      issueDescription: "Customer cannot access the dashboard.",
      category: "authentication",
      department: "technical_support",
      severity: "high",
      labels: ["support", "authentication"],
    },
  });

  assert.deepEqual(
    appendedEvents.map((event) => event.action),
    ["extract_issue", "classify_report", "create_issue"],
  );
  assert.deepEqual(
    appendedEvents.map((event) => event.origin),
    ["inferred", "inferred", "observed"],
  );
});

test("observation can pause and resume without recording paused activity", () => {
  const builder = new SemanticTraceBuilder({
    traceId: "trace-pause-001",
    startedAt: "2026-02-01T08:00:00.000Z",
  });
  builder.pause();

  assert.equal(builder.toTrace().status, "paused");
  assert.deepEqual(
    builder.append({
      occurredAt: "2026-02-01T08:01:00.000Z",
      sourceApplication: "mail",
      action: "report_received",
    }),
    [],
  );

  builder.resume();
  builder.append({
    occurredAt: "2026-02-01T08:02:00.000Z",
    sourceApplication: "mail",
    action: "report_received",
  });

  assert.equal(builder.toTrace().status, "observing");
  assert.equal(builder.toTrace().events.length, 1);
});

test("one completed trace is insufficient to detect a pattern", () => {
  const detection = detectRepeatedPattern([loginAuthenticationTrace]);

  assert.equal(detection.detected, false);
  assert.equal(detection.minimumObservations, 2);
  assert.equal(detection.matchingTraceCount, 1);
  assert.equal(detection.comparisons.length, 0);
});

test("two similar traces produce a discounted pattern candidate", () => {
  const detection = detectRepeatedPattern([
    loginAuthenticationTrace,
    apiTimeoutTrace,
  ]);

  assert.equal(detection.detected, true);
  assert.equal(detection.matchingTraceCount, 2);
  assert.equal(
    detection.similarityThreshold,
    DEFAULT_PATTERN_DETECTION_CONFIG.similarityThreshold,
  );
  assert.ok(detection.bestComparison);
  assert.ok(
    detection.bestComparison.weightedSimilarity >=
      detection.similarityThreshold,
  );
  assert.ok(detection.confidence < detection.bestComparison.weightedSimilarity);
  assert.equal(detection.sampleSizeDiscount, 0.666667);
});

test("the weighted comparison tolerates one additional read action", () => {
  const similarity = compareWorkflowTraces(
    loginAuthenticationTrace,
    apiTimeoutTrace,
  );

  assert.equal(TRACE_SIMILARITY_WEIGHTS.actionSequence, 0.55);
  assert.equal(TRACE_SIMILARITY_WEIGHTS.applicationSet, 0.2);
  assert.equal(TRACE_SIMILARITY_WEIGHTS.semanticIntent, 0.25);
  assert.equal(similarity.actionSequenceSimilarity, 0.875);
  assert.equal(similarity.applicationSetSimilarity, 1);
  assert.ok(
    similarity.weightedSimilarity >=
      DEFAULT_PATTERN_DETECTION_CONFIG.similarityThreshold,
  );
});

test("an unrelated trace remains below the similarity threshold", () => {
  const builder = new SemanticTraceBuilder({
    traceId: "trace-unrelated-001",
    startedAt: "2026-02-02T08:00:00.000Z",
  });
  builder.append({
    occurredAt: "2026-02-02T08:00:00.000Z",
    sourceApplication: "mail",
    action: "report_received",
    intent: "Receive a general announcement",
  });
  builder.append({
    occurredAt: "2026-02-02T08:01:00.000Z",
    sourceApplication: "mail",
    action: "read_report",
    intent: "Read unrelated correspondence",
  });
  builder.append({
    occurredAt: "2026-02-02T08:02:00.000Z",
    sourceApplication: "mail",
    action: "reply_to_customer",
    intent: "Close unrelated correspondence",
  });
  const unrelatedTrace = builder.complete("2026-02-02T08:03:00.000Z");
  const similarity = compareWorkflowTraces(
    loginAuthenticationTrace,
    unrelatedTrace,
  );
  const detection = detectRepeatedPattern([
    loginAuthenticationTrace,
    unrelatedTrace,
  ]);

  assert.ok(
    similarity.weightedSimilarity <
      DEFAULT_PATTERN_DETECTION_CONFIG.similarityThreshold,
  );
  assert.equal(detection.detected, false);
  assert.equal(detection.matchingTraceCount, 1);
});

test("live confidence increases as a matching trace progresses", () => {
  const builder = new SemanticTraceBuilder({
    traceId: "trace-live-001",
    startedAt: "2026-02-03T08:00:00.000Z",
  });
  const references = [loginAuthenticationTrace, apiTimeoutTrace];

  builder.append({
    occurredAt: "2026-02-03T08:00:00.000Z",
    sourceApplication: "mail",
    action: "report_received",
    intent: "Receive a support report",
  });
  const initialConfidence = calculateLiveMatchConfidence(
    references,
    builder.toTrace(),
  );

  builder.append({
    occurredAt: "2026-02-03T08:01:00.000Z",
    sourceApplication: "issue_tracker",
    action: "create_issue",
    intent: "Create a support issue",
    payload: {
      reportId: "report-live-001",
      issueTitle: "Duplicate subscription charge",
      issueDescription: "Customer reports a duplicate subscription charge.",
      category: "billing",
      department: "billing",
      severity: "medium",
      labels: ["support", "billing"],
    },
  });
  const middleConfidence = calculateLiveMatchConfidence(
    references,
    builder.toTrace(),
  );

  builder.append({
    occurredAt: "2026-02-03T08:02:00.000Z",
    sourceApplication: "issue_tracker",
    action: "assign_owner",
    intent: "Assign the routed issue owner",
    payload: { department: "billing", owner: "Awaiz" },
  });
  builder.append({
    occurredAt: "2026-02-03T08:03:00.000Z",
    sourceApplication: "team_chat",
    action: "send_team_notification",
    intent: "Send a team notification",
  });
  builder.append({
    occurredAt: "2026-02-03T08:04:00.000Z",
    sourceApplication: "mail",
    action: "reply_to_customer",
    intent: "Reply to the customer",
  });
  const finalConfidence = calculateLiveMatchConfidence(
    references,
    builder.toTrace(),
  );

  assert.ok(initialConfidence > 0);
  assert.ok(middleConfidence > initialConfidence);
  assert.ok(finalConfidence > middleConfidence);
});
