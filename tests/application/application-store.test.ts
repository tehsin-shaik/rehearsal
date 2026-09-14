import { strict as assert } from "node:assert";
import { test } from "node:test";

import { createRehearsalApplication } from "../../src/application/rehearsal-application.ts";
import {
  selectActiveWorkflow,
  selectNextExpectedAction,
  selectObservedCount,
} from "../../src/application/store/selectors.ts";
import { TEST_PRESENTATION_TIMING } from "../../src/config/timing.ts";
import {
  apiTimeoutTrace,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/index.ts";
import type { WorkflowTrace } from "../../src/domain/events/workflow-trace.ts";
import { normalizeSemanticEvent } from "../../src/domain/events/event-normalizer.ts";

function testApplication() {
  let tick = 0;
  return createRehearsalApplication({
    timing: TEST_PRESENTATION_TIMING,
    now: () => new Date(Date.UTC(2026, 0, 10, 9, 0, tick++)).toISOString(),
  });
}

async function replayTrace(
  application: ReturnType<typeof testApplication>,
  trace: WorkflowTrace,
): Promise<void> {
  application.commands.beginTrace({
    traceId: trace.id,
    startedAt: trace.startedAt,
  });
  for (const event of trace.events.filter(
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
  }
  await application.commands.completeTrace(
    trace.completedAt ?? trace.startedAt,
  );
}

async function activateCanonicalPattern(
  application: ReturnType<typeof testApplication>,
): Promise<void> {
  await application.director.runObservationOneInstantly();
  await application.director.runObservationTwoInstantly();
  application.director.activatePattern();
}

test("first and second observations follow the deterministic discovery path", async () => {
  const application = testApplication();

  await application.director.runObservationOneInstantly();
  assert.equal(application.store.getState().engine.phase, "idle");
  assert.equal(selectObservedCount(application.store.getState()), 1);
  assert.equal(application.store.getState().engine.workflows.length, 0);

  await application.director.runObservationTwoInstantly();
  const state = application.store.getState();
  assert.equal(state.engine.phase, "pattern_discovered");
  assert.equal(selectObservedCount(state), 2);
  assert.equal(state.engine.workflows.length, 1);
  assert.equal(state.engine.workflows[0]?.lifecycle, "proposed");
  assert.ok(state.engine.phaseHistory.includes("comparing"));
});

test("reading the selected report twice keeps semantic event keys unique", () => {
  const application = testApplication();
  const message = application.store
    .getState()
    .workspace.inboxMessages.find(
      (candidate) => candidate.id === "report-ambiguous-004",
    );
  assert.ok(message);

  application.commands.readMail(message.id);
  const initialEvents = application.store.getState().engine.activeTrace?.events;
  assert.ok(initialEvents);
  application.commands.readMail(message.id);
  const repeatedEvents =
    application.store.getState().engine.activeTrace?.events ?? [];

  assert.equal(repeatedEvents.length, initialEvents.length);
  assert.equal(
    new Set(repeatedEvents.map((event) => event.id)).size,
    repeatedEvents.length,
  );
});

test("manual trace commands and instant demo controls produce the same pattern", async () => {
  const manual = testApplication();
  const directed = testApplication();

  await replayTrace(manual, loginAuthenticationTrace);
  await replayTrace(manual, apiTimeoutTrace);
  await directed.director.runObservationOneInstantly();
  await directed.director.runObservationTwoInstantly();

  const manualPattern = manual.store.getState().engine.workflows[0]?.pattern;
  const directedPattern =
    directed.store.getState().engine.workflows[0]?.pattern;
  assert.ok(manualPattern);
  assert.ok(directedPattern);
  assert.equal(manualPattern.id, directedPattern.id);
  assert.deepEqual(
    manualPattern.stages.map((stage) => stage.action),
    directedPattern.stages.map((stage) => stage.action),
  );
});

test("activation is deliberate and an active pattern handles a new trigger", async () => {
  const application = testApplication();
  await application.director.runObservationOneInstantly();
  await application.director.runObservationTwoInstantly();

  assert.equal(selectActiveWorkflow(application.store.getState()), null);
  application.director.activatePattern();
  assert.equal(application.store.getState().engine.phase, "agent_ready");
  assert.equal(
    selectActiveWorkflow(application.store.getState())?.lifecycle,
    "active",
  );

  await application.director.deliverBillingReport();
  const run = application.store.getState().engine.activeRun;
  assert.equal(application.store.getState().engine.phase, "preview_ready");
  assert.equal(run?.resolvedValues.department, "billing");
  assert.equal(run?.resolvedValues.owner, "Awaiz");
});

test("trigger re-entrancy keeps the existing unresolved run", async () => {
  const application = testApplication();
  await activateCanonicalPattern(application);
  await application.director.deliverBillingReport();
  const firstRunId = application.store.getState().engine.activeRun?.id;

  await application.director.deliverAmbiguousReport();
  assert.equal(application.store.getState().engine.activeRun?.id, firstRunId);
  assert.equal(application.store.getState().engine.phase, "preview_ready");
});

test("pending review blocks approval until a person selects an owner", async () => {
  const application = testApplication();
  await activateCanonicalPattern(application);
  await application.director.deliverAmbiguousReport();

  const pendingRun = application.store.getState().engine.activeRun;
  assert.equal(application.store.getState().engine.phase, "needs_review");
  assert.equal(pendingRun?.reviewRequests.length, 1);
  const unchanged = await application.director.approveAndExecute();
  assert.equal(unchanged?.id, pendingRun?.id);
  assert.equal(application.store.getState().engine.phase, "needs_review");
  assert.equal(
    application.director.resolveAmbiguousOwner("Huda")?.status,
    "preview_ready",
  );
  assert.equal(application.store.getState().engine.phase, "preview_ready");
});

test("approved execution updates state only from adapter-confirmed results", async () => {
  const application = testApplication();
  await activateCanonicalPattern(application);
  await application.director.deliverBillingReport();
  const completed = await application.director.approveAndExecute();
  const state = application.store.getState();

  assert.equal(completed?.status, "completed");
  assert.equal(state.engine.phase, "completed");
  assert.equal(state.engine.metrics.completedRuns, 1);
  assert.equal(application.commands.getDemoHarness().state.issues.length, 1);
  assert.equal(
    state.workspace.replicaIssues.filter((issue) => issue.source === "agent")
      .length,
    1,
  );
  assert.equal(
    state.workspace.teamMessages.filter((message) => message.source === "agent")
      .length,
    1,
  );
  assert.equal(
    state.workspace.customerReplies.filter((reply) => reply.source === "agent")
      .length,
    1,
  );
});

test("failed execution resumes without duplicating successful work", async () => {
  const application = testApplication();
  await activateCanonicalPattern(application);
  application.director.selectFailurePoint("team_notification");
  await application.director.deliverBillingReport();
  const failed = await application.director.approveAndExecute();

  assert.equal(failed?.status, "failed");
  assert.equal(application.store.getState().engine.phase, "failed");
  assert.equal(application.commands.getDemoHarness().state.issues.length, 1);
  assert.equal(
    application.commands.getDemoHarness().state.teamMessages.length,
    0,
  );

  const resumed = await application.director.retryFailedRun();
  assert.equal(resumed?.status, "completed");
  assert.equal(application.store.getState().engine.phase, "completed");
  assert.equal(application.commands.getDemoHarness().state.issues.length, 1);
  assert.equal(
    application.commands.getDemoHarness().state.teamMessages.length,
    1,
  );
  assert.equal(
    application.commands.getDemoHarness().state.customerReplies.length,
    1,
  );
});

test("pause, exclusion, selectors, and reset preserve orchestration invariants", async () => {
  const application = testApplication();
  application.commands.beginTrace({
    traceId: "trace-privacy-test",
    startedAt: "2026-01-11T09:00:00.000Z",
  });
  application.commands.excludeApplication("team_chat");
  assert.deepEqual(
    application.commands.observeSemanticAction({
      sourceApplication: "team_chat",
      action: "send_team_notification",
    }),
    [],
  );
  application.commands.pauseObservation();
  assert.equal(
    application.store.getState().engine.activeTrace?.status,
    "paused",
  );
  assert.deepEqual(
    application.commands.observeSemanticAction({
      sourceApplication: "mail",
      action: "report_received",
    }),
    [],
  );
  application.commands.resumeObservation();
  application.commands.includeApplication("team_chat");
  assert.equal(application.store.getState().engine.observationPaused, false);
  application.commands.abandonTrace();

  application.commands.resetApplication();
  await activateCanonicalPattern(application);
  await application.director.deliverBillingReport();
  assert.equal(selectObservedCount(application.store.getState()), 2);
  assert.equal(
    selectNextExpectedAction(application.store.getState())?.action,
    "read_email",
  );

  application.commands.resetApplication();
  const resetState = application.store.getState();
  assert.equal(resetState.engine.phase, "idle");
  assert.equal(resetState.engine.completedTraces.length, 0);
  assert.equal(resetState.engine.workflows.length, 0);
  assert.equal(resetState.engine.activeRun, null);
  assert.equal(resetState.workspace.inboxMessages.length, 5);
});

test("live surface refresh consumes extension events and completion cursors", async () => {
  const observedEvent = normalizeSemanticEvent({
    traceId: "extension-trace-live-observation",
    occurredAt: "2026-01-12T09:00:00.000Z",
    sourceApplication: "mail",
    action: "read_report",
    payload: { messageId: "report-login-001" },
  });
  assert.ok(observedEvent !== null);
  const application = createRehearsalApplication({
    mode: "live",
    timing: TEST_PRESENTATION_TIMING,
    refreshSurfaces: async () => ({
      mailSurface: null,
      trackerSurfaces: [],
      selectedTrackerSurfaceId: null,
      oauthConnectionUrl: null,
      extensionObservations: [
        {
          sequence: 101,
          receivedAt: "2026-01-12T09:00:01.000Z",
          event: observedEvent,
        },
      ],
      extensionCompletions: [
        {
          sequence: 102,
          receivedAt: "2026-01-12T09:00:02.000Z",
          traceId: observedEvent.traceId,
        },
      ],
      extensionFeedCursor: 102,
    }),
  });

  await application.commands.refreshConnectedSurfaces();
  const state = application.store.getState();
  assert.equal(state.integration.extensionFeedCursor, 102);
  assert.equal(state.engine.completedTraces.length, 1);
  assert.deepEqual(
    state.engine.completedTraces[0]?.events.map((event) => event.action),
    ["report_received", "read_report"],
  );
  assert.equal(state.engine.phase, "idle");
});
