import { strict as assert } from "node:assert";
import { test } from "node:test";

import { executeAgentRun } from "../../src/application/engine/run-executor.ts";
import { RunExecutionError } from "../../src/application/engine/execution-errors.ts";
import { verifyAgentRun } from "../../src/application/engine/run-verifier.ts";
import { createDemoAdapterHarness } from "../../src/demo/adapters/in-memory-adapters.ts";
import {
  apiTimeoutTrace,
  duplicateBillingChargeReport,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/index.ts";
import { compileLearnedPattern } from "../../src/domain/patterns/pattern-compiler.ts";
import { ApprovalRequiredError } from "../../src/domain/policy/policy-errors.ts";
import type { PreviewRun } from "../../src/domain/runs/preview-run-types.ts";
import { planPreviewRun } from "../../src/domain/runs/preview-run-planner.ts";
import { approvePreviewRun } from "../../src/domain/runs/run-approval.ts";
import { understandReportDeterministically } from "../../src/domain/understanding/deterministic-understanding.ts";

function plannedBillingRun(): PreviewRun {
  const pattern = compileLearnedPattern([
    loginAuthenticationTrace,
    apiTimeoutTrace,
  ]);
  if (pattern === null) {
    throw new Error("The canonical pattern must compile for execution tests.");
  }

  return planPreviewRun({
    pattern,
    message: duplicateBillingChargeReport,
    understanding: understandReportDeterministically(
      duplicateBillingChargeReport,
    ),
    nextIssueNumber: "PREDICTED-2042",
  });
}

function approvedBillingRun(): PreviewRun {
  return approvePreviewRun(
    plannedBillingRun(),
    "reviewer-001",
    "2026-01-07T11:31:00.000Z",
  );
}

test("unapproved execution is refused without side effects", async () => {
  const run = plannedBillingRun();
  const harness = createDemoAdapterHarness();

  await assert.rejects(
    () => executeAgentRun(run, harness.adapters),
    ApprovalRequiredError,
  );
  assert.deepEqual(harness.state, {
    issues: [],
    teamMessages: [],
    customerReplies: [],
  });
});

test("approved execution completes every action and confirmed side effect", async () => {
  const harness = createDemoAdapterHarness({
    actualIssueNumber: "SUP-2042",
  });
  const progressStatuses: string[] = [];
  const completedRun = await executeAgentRun(
    approvedBillingRun(),
    harness.adapters,
    {
      onProgress: ({ stage, action }) => {
        if (stage === "action_started" && action !== null) {
          progressStatuses.push(action.status);
        }
      },
    },
  );

  assert.equal(completedRun.status, "completed");
  assert.equal(completedRun.phase, "completed");
  assert.ok(
    completedRun.plannedActions.every(
      (action) => action.status === "succeeded",
    ),
  );
  assert.equal(completedRun.results.length, 10);
  assert.ok(
    completedRun.results.every(
      (result) =>
        result.ok &&
        result.status === "succeeded" &&
        result.summary.length > 0 &&
        result.durationMs >= 0,
    ),
  );
  assert.deepEqual(progressStatuses, Array(10).fill("running"));
  assert.equal(harness.state.issues.length, 1);
  assert.equal(harness.state.issues[0]?.owner, "Awaiz");
  assert.equal(harness.state.teamMessages.length, 1);
  assert.equal(harness.state.customerReplies.length, 1);
  assert.equal(verifyAgentRun(completedRun).ok, true);
});

test("policy is rechecked immediately before every executed action", async () => {
  const harness = createDemoAdapterHarness();
  const checkedActions: string[] = [];
  const completedRun = await executeAgentRun(
    approvedBillingRun(),
    harness.adapters,
    {
      onPolicyCheck: (action) => checkedActions.push(action.action),
    },
  );

  assert.deepEqual(
    checkedActions,
    completedRun.plannedActions.map((action) => action.action),
  );
});

test("completed-run reinvocation is refused without duplicate effects", async () => {
  const harness = createDemoAdapterHarness();
  const completedRun = await executeAgentRun(
    approvedBillingRun(),
    harness.adapters,
  );

  await assert.rejects(
    () => executeAgentRun(completedRun, harness.adapters),
    (error: unknown) =>
      error instanceof RunExecutionError && error.code === "already_completed",
  );
  assert.equal(harness.state.issues.length, 1);
  assert.equal(harness.state.teamMessages.length, 1);
  assert.equal(harness.state.customerReplies.length, 1);
});

test("notification failure stops execution and leaves later work unattempted", async () => {
  const harness = createDemoAdapterHarness({
    failures: { team_notification: true },
  });
  const failedRun = await executeAgentRun(
    approvedBillingRun(),
    harness.adapters,
  );
  const createAction = failedRun.plannedActions.find(
    (action) => action.action === "create_issue",
  );
  const notificationAction = failedRun.plannedActions.find(
    (action) => action.action === "send_team_notification",
  );
  const replyAction = failedRun.plannedActions.find(
    (action) => action.action === "reply_to_customer",
  );

  assert.equal(failedRun.status, "failed");
  assert.equal(failedRun.phase, "failed");
  assert.equal(createAction?.status, "succeeded");
  assert.equal(notificationAction?.status, "failed");
  assert.equal(replyAction?.status, "not_attempted");
  assert.equal(harness.state.issues.length, 1);
  assert.equal(harness.state.teamMessages.length, 0);
  assert.equal(harness.state.customerReplies.length, 0);
  assert.equal(verifyAgentRun(failedRun).ok, false);
});

test("retry resumes at failure without creating a duplicate issue", async () => {
  const harness = createDemoAdapterHarness({
    failures: { team_notification: true },
  });
  const failedRun = await executeAgentRun(
    approvedBillingRun(),
    harness.adapters,
  );
  const retriedActions: string[] = [];
  const resumedRun = await executeAgentRun(failedRun, harness.adapters, {
    onPolicyCheck: (action) => retriedActions.push(action.action),
  });

  assert.deepEqual(retriedActions, [
    "send_team_notification",
    "reply_to_customer",
  ]);
  assert.equal(resumedRun.status, "completed");
  assert.equal(harness.state.issues.length, 1);
  assert.equal(harness.state.teamMessages.length, 1);
  assert.equal(harness.state.customerReplies.length, 1);
  assert.equal(
    resumedRun.results.filter(
      (result) =>
        result.actionId ===
          resumedRun.plannedActions.find(
            (action) => action.action === "create_issue",
          )?.id && result.ok,
    ).length,
    1,
  );
  assert.equal(verifyAgentRun(resumedRun).ok, true);
});

test("tracker identifiers rewrite downstream references before messaging", async () => {
  const harness = createDemoAdapterHarness({
    actualIssueNumber: "OPS-42",
    actualIssueUrl: "https://tracker.example.test/OPS-42",
  });
  const completedRun = await executeAgentRun(
    approvedBillingRun(),
    harness.adapters,
  );
  const sentMessage = harness.state.teamMessages[0]?.message ?? "";

  assert.equal(
    completedRun.issueReference.predictedIssueNumber,
    "PREDICTED-2042",
  );
  assert.equal(completedRun.issueReference.actualIssueNumber, "OPS-42");
  assert.equal(
    completedRun.issueReference.actualIssueUrl,
    "https://tracker.example.test/OPS-42",
  );
  assert.equal(completedRun.resolvedValues.issueNumber, "OPS-42");
  assert.match(sentMessage, /OPS-42/);
  assert.match(sentMessage, /https:\/\/tracker\.example\.test\/OPS-42/);
  assert.doesNotMatch(sentMessage, /PREDICTED-2042/);
});

test("Demo Mode execution performs no network requests", async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("Demo execution must not access the network.");
  };

  try {
    const harness = createDemoAdapterHarness();
    await executeAgentRun(approvedBillingRun(), harness.adapters);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(networkCalls, 0);
});
