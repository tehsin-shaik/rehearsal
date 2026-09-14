import assert from "node:assert/strict";

import { createRehearsalApplication } from "../src/application/rehearsal-application.ts";
import { executeAgentRun } from "../src/application/engine/run-executor.ts";
import { TEST_PRESENTATION_TIMING } from "../src/config/timing.ts";
import { apiTimeoutTrace } from "../src/demo/fixtures/traces.ts";
import { redactPayload } from "../src/domain/events/redaction.ts";

function createOfflineApplication() {
  return createRehearsalApplication({
    mode: "demo",
    timing: TEST_PRESENTATION_TIMING,
  });
}

async function trainApplication(
  application: ReturnType<typeof createOfflineApplication>,
): Promise<void> {
  await application.director.runObservationOneInstantly();
  assert.equal(application.store.getState().engine.workflows.length, 0);

  application.commands.beginTrace({
    traceId: apiTimeoutTrace.id,
    startedAt: apiTimeoutTrace.startedAt,
  });
  const confidenceValues: number[] = [];
  for (const event of apiTimeoutTrace.events.filter(
    (candidate) => candidate.origin === "observed",
  )) {
    application.commands.observeSemanticAction({
      occurredAt: event.occurredAt,
      sourceApplication: event.sourceApplication,
      action: event.action,
      intent: event.intent,
      payload: event.payload,
      confidence: event.confidence,
      origin: event.origin,
      estimatedEffortSeconds: event.estimatedEffortSeconds,
    });
    confidenceValues.push(application.store.getState().engine.liveConfidence);
  }
  assert.ok((confidenceValues.at(-1) ?? 0) > (confidenceValues[0] ?? 0));
  await application.commands.completeTrace(
    apiTimeoutTrace.completedAt ?? apiTimeoutTrace.startedAt,
  );
  assert.equal(application.store.getState().engine.workflows.length, 1);
}

async function verifySuccessfulRun(): Promise<void> {
  const application = createOfflineApplication();
  await trainApplication(application);
  const pattern = application.store.getState().engine.workflows[0]?.pattern;
  assert.ok(pattern !== undefined);
  const variables = new Set(
    pattern.variables.map((variable) => variable.field),
  );
  assert.equal(variables.has("customer.name"), true);
  assert.equal(variables.has("customer.email"), true);
  assert.equal(variables.has("owner"), true);

  application.commands.activatePattern(pattern.id);
  await application.director.deliverBillingReport();
  const proposedRun = application.store.getState().engine.activeRun;
  assert.ok(proposedRun !== null);
  assert.equal(proposedRun.resolvedValues.department, "billing");
  assert.equal(proposedRun.resolvedValues.owner, "Awaiz");
  assert.equal(JSON.stringify(proposedRun).includes("{{"), false);
  await assert.rejects(
    executeAgentRun(
      proposedRun,
      application.commands.getDemoHarness().adapters,
    ),
  );

  const completedRun =
    await application.commands.approveAndExecute("offline-verifier");
  assert.equal(completedRun?.status, "completed");
  const demoState = application.commands.getDemoHarness().state;
  assert.equal(demoState.issues.length, 1);
  assert.equal(demoState.teamMessages.length, 1);
  assert.equal(demoState.customerReplies.length, 1);
}

async function verifyFailureAndRetry(): Promise<void> {
  const application = createOfflineApplication();
  await trainApplication(application);
  application.commands.activatePattern();
  application.commands.selectFailurePoint("team_notification");
  await application.director.deliverBillingReport();
  const failedRun =
    await application.commands.approveAndExecute("offline-verifier");
  assert.equal(failedRun?.status, "failed");
  assert.equal(application.commands.getDemoHarness().state.issues.length, 1);
  assert.equal(
    application.commands.getDemoHarness().state.teamMessages.length,
    0,
  );

  const resumedRun = await application.commands.retryFailedRun();
  assert.equal(resumedRun?.status, "completed");
  assert.equal(application.commands.getDemoHarness().state.issues.length, 1);
  assert.equal(
    application.commands.getDemoHarness().state.teamMessages.length,
    1,
  );
}

async function verifyHumanReview(): Promise<void> {
  const application = createOfflineApplication();
  await trainApplication(application);
  application.commands.activatePattern();
  await application.director.deliverAmbiguousReport();
  const run = application.store.getState().engine.activeRun;
  assert.equal(run?.status, "needs_review");
  assert.equal(run?.reviewRequests[0]?.status, "pending");
  const unchanged =
    await application.commands.approveAndExecute("offline-verifier");
  assert.equal(unchanged?.status, "needs_review");
}

const originalFetch = globalThis.fetch;
let networkRequestCount = 0;
globalThis.fetch = async () => {
  networkRequestCount += 1;
  throw new Error("Demo Mode attempted an unexpected network request.");
};

try {
  await verifySuccessfulRun();
  await verifyFailureAndRetry();
  await verifyHumanReview();
  assert.deepEqual(
    redactPayload({
      safe: "retained",
      password: "removed",
      cardNumber: "4111111111111111",
      coordinates: { x: 12, y: 30 },
      rawKey: "Enter",
    }),
    { safe: "retained" },
  );
  assert.equal(networkRequestCount, 0);
  process.stdout.write(
    "PASS offline behavior-to-agent pipeline; Demo Mode made 0 network requests.\n",
  );
} finally {
  globalThis.fetch = originalFetch;
}
