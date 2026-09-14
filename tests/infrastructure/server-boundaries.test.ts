import assert from "node:assert/strict";
import test from "node:test";
import { EventType } from "@ag-ui/core";

import { readServerEnvironment } from "../../src/config/environment-schema.ts";
import { duplicateBillingChargeReport } from "../../src/demo/fixtures/reports.ts";
import {
  apiTimeoutTrace,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/traces.ts";
import { compileLearnedPattern } from "../../src/domain/patterns/pattern-compiler.ts";
import { understandReportDeterministically } from "../../src/domain/understanding/deterministic-understanding.ts";
import {
  understandReportWithModel,
  type ModelIssueUnderstanding,
} from "../../src/infrastructure/ai/live-understanding.ts";
import type {
  JsonCompletionResult,
  JsonModelClient,
} from "../../src/infrastructure/ai/openai-compatible-client.ts";
import {
  parsePreviewAgentContext,
  streamPreviewPlanningEvents,
} from "../../src/infrastructure/agents/preview-agent.ts";
import { ObservationEventBuffer } from "../../src/infrastructure/observation/event-buffer.ts";
import { sanitizeObservationPayload } from "../../src/infrastructure/observation/event-sanitizer.ts";
import {
  MAX_API_REQUEST_BYTES,
  parseRequestBody,
} from "../../src/infrastructure/http/route-response.ts";
import { enrichReportConcurrently } from "../../src/infrastructure/research/concurrent-enrichment.ts";
import {
  buildSanitizedResearchQuery,
  ExaResearchClient,
  type ResearchClient,
  type ResearchResponse,
} from "../../src/infrastructure/research/exa-client.ts";
import { supportReportSchema } from "../../src/infrastructure/validation/api-schemas.ts";
import { previewRunFromToolArguments } from "../../src/infrastructure/agents/preview-run-wire.ts";

const modelMetadata = {
  provider: "openai" as const,
  requestedModel: "test-model",
  responseModel: "test-model",
  fallbackModels: [],
  durationMs: 1,
};

function validModelUnderstanding(): ModelIssueUnderstanding {
  const deterministic = understandReportDeterministically(
    duplicateBillingChargeReport,
  );
  return {
    reportId: deterministic.reportId,
    customer: deterministic.customer,
    issue: {
      ...deterministic.issue,
      labels: [...deterministic.issue.labels],
    },
    owner: "Awaiz",
    evidence: deterministic.evidence.map((entry) => ({ ...entry })),
    confidence: deterministic.confidence,
    reviewRequired: false,
  };
}

function modelClientWith(value: unknown): JsonModelClient {
  return {
    configured: true,
    provider: "openai",
    async completeJson(): Promise<JsonCompletionResult> {
      return { value, metadata: modelMetadata };
    },
  };
}

test("server environment defaults to safe offline mode", () => {
  const environment = readServerEnvironment({});
  assert.equal(environment.DEMO_MODE, true);
  assert.equal(environment.NEXT_PUBLIC_DEMO_MODE, true);
  assert.equal(environment.AMBIGUOUS_SANDBOX, false);
  assert.equal(environment.COPILOTKIT_TELEMETRY_DISABLED, true);
});

test("valid literal model understanding is accepted", async () => {
  const result = await understandReportWithModel(
    duplicateBillingChargeReport,
    modelClientWith(validModelUnderstanding()),
  );

  assert.equal(result.provenance.source, "model");
  assert.equal(result.provenance.fallbackReason, null);
  assert.equal(result.understanding.issue.department, "billing");
  assert.equal(result.understanding.owner, "Awaiz");
});

test("one invalid evidence phrase rejects the complete model result", async () => {
  const deterministic = understandReportDeterministically(
    duplicateBillingChargeReport,
  );
  const candidate = validModelUnderstanding();
  const result = await understandReportWithModel(
    duplicateBillingChargeReport,
    modelClientWith({
      ...candidate,
      evidence: [{ field: "issue.category", excerpt: "invented evidence" }],
    }),
  );

  assert.equal(result.provenance.source, "deterministic");
  assert.equal(result.provenance.fallbackReason, "non_literal_evidence");
  assert.deepEqual(result.understanding, deterministic);
});

test("research query excludes customer identity and opaque identifiers", () => {
  const query = buildSanitizedResearchQuery({
    ...duplicateBillingChargeReport,
    id: "report-private-1234567890abcdef1234567890",
    body: `${duplicateBillingChargeReport.body}\nToken: abcdefghijklmnopqrstuvwxyz123456`,
  });

  assert.equal(query.includes("Leila Haddad"), false);
  assert.equal(query.includes("leila.haddad@example.test"), false);
  assert.equal(query.includes("report-private"), false);
  assert.equal(query.includes("abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.match(query, /Duplicate charge/i);
});

test("research failures degrade to an empty result", async () => {
  const client = new ExaResearchClient("configured", async () => {
    throw new Error("network unavailable");
  });
  const response = await client.searchReport(duplicateBillingChargeReport);

  assert.equal(response.status, "failed");
  assert.deepEqual(response.results, []);
});

test("model understanding and research start concurrently", async () => {
  let resolveModel: ((value: JsonCompletionResult) => void) | undefined;
  let resolveResearch: ((value: ResearchResponse) => void) | undefined;
  let modelStarted = false;
  let researchStarted = false;
  const modelClient: JsonModelClient = {
    configured: true,
    provider: "openai",
    completeJson() {
      modelStarted = true;
      return new Promise((resolve) => {
        resolveModel = resolve;
      });
    },
  };
  const researchClient: ResearchClient = {
    searchReport() {
      researchStarted = true;
      return new Promise((resolve) => {
        resolveResearch = resolve;
      });
    },
  };

  const enrichment = enrichReportConcurrently(
    duplicateBillingChargeReport,
    modelClient,
    researchClient,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(modelStarted, true);
  assert.equal(researchStarted, true);

  resolveModel?.({ value: validModelUnderstanding(), metadata: modelMetadata });
  resolveResearch?.({ query: "safe query", results: [], status: "completed" });
  const result = await enrichment;
  assert.equal(result.understanding.provenance.source, "model");
  assert.equal(result.research.status, "completed");
});

test("server observation scrubbing removes mechanics and sensitive values", () => {
  const payload = sanitizeObservationPayload({
    subject: "Support request",
    password: "never-store-this",
    cardNumber: "4111111111111111",
    coordinates: { x: 44, y: 88 },
    cssSelector: "#submit",
    rawKey: "Enter",
    path: "/browse/OPS-938?token=private#details",
    nested: { safe: "retained" },
  });

  assert.deepEqual(payload, {
    nested: { safe: "retained" },
    path: "/browse/:issue",
    subject: "Support request",
  });
});

test("observation buffer is bounded and sequence values are monotonic", () => {
  const buffer = new ObservationEventBuffer(2);
  const events = ["one", "two", "three"].map((suffix, index) => ({
    traceId: `trace-${suffix}`,
    occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    sourceApplication: "mail" as const,
    action: "report_received" as const,
    payload: { reportId: `report-${suffix}` },
  }));

  const first = buffer.append(events.slice(0, 2));
  const third = buffer.append(events.slice(2));
  assert.ok(first[0] !== undefined && first[1] !== undefined);
  assert.ok(third[0] !== undefined);
  assert.ok(first[0].sequence < first[1].sequence);
  assert.ok(first[1].sequence < third[0].sequence);
  assert.equal(buffer.size, 2);
  assert.deepEqual(
    buffer.after(0).map((entry) => entry.event.traceId),
    ["trace-two", "trace-three"],
  );
  const completion = buffer.appendCompletions(["trace-three"]);
  assert.equal(completion.length, 1);
  assert.ok(completion[0] !== undefined);
  assert.ok(completion[0].sequence > third[0].sequence);
  assert.equal(
    buffer.completionsAfter(third[0].sequence)[0]?.traceId,
    "trace-three",
  );
});

test("preview agent streams action proposals and one complete run proposal", async () => {
  const pattern = compileLearnedPattern([
    loginAuthenticationTrace,
    apiTimeoutTrace,
  ]);
  assert.ok(pattern !== null);
  const understanding = validModelUnderstanding();
  const context = parsePreviewAgentContext({
    state: {
      report: duplicateBillingChargeReport,
      pattern,
      understanding,
      nextIssueNumber: "SUP-3001",
    },
  });
  const events = [];
  for await (const event of streamPreviewPlanningEvents(context)) {
    events.push(event);
  }

  assert.equal(events.length, 33);
  assert.equal(
    events.filter(
      (event) =>
        event.type === EventType.TOOL_CALL_START &&
        event.toolCallName === "proposeAction",
    ).length,
    10,
  );
  assert.equal(
    events.filter(
      (event) =>
        event.type === EventType.TOOL_CALL_START &&
        event.toolCallName === "proposeRun",
    ).length,
    1,
  );
  assert.equal(
    events.some(
      (event) =>
        event.type === EventType.TOOL_CALL_START &&
        "toolCallName" in event &&
        typeof event.toolCallName === "string" &&
        ["approve", "execute"].includes(event.toolCallName),
    ),
    false,
  );
  const proposedRunArguments = events.find(
    (event) =>
      event.type === EventType.TOOL_CALL_ARGS &&
      "toolCallId" in event &&
      typeof event.toolCallId === "string" &&
      event.toolCallId.endsWith(":run"),
  );
  assert.ok(
    proposedRunArguments !== undefined &&
      "delta" in proposedRunArguments &&
      typeof proposedRunArguments.delta === "string",
  );
  const proposedRun = previewRunFromToolArguments(
    JSON.parse(proposedRunArguments.delta) as unknown,
  );
  assert.equal(proposedRun.plannedActions.length, 10);
  assert.equal(proposedRun.resolvedValues.owner, "Awaiz");
});

test("AG-UI run proposals reject incomplete payloads", () => {
  assert.throws(
    () => previewRunFromToolArguments({ run: { id: "opaque-object" } }),
    /Invalid input/,
  );
});

test("API body parsing rejects oversized input before schema validation", async () => {
  const request = new Request("http://localhost/api/understand", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(MAX_API_REQUEST_BYTES + 1),
    },
    body: JSON.stringify({ report: duplicateBillingChargeReport }),
  });
  const parsed = await parseRequestBody(request, supportReportSchema);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.response.status, 413);
  }
});
