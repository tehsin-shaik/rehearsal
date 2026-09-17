import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  approveRun,
  detectPattern,
  executeRun,
  planRun,
  resumeRun,
  understandReport,
} from "../../src/application/engine/index.ts";
import {
  ambiguousReviewReport,
  apiTimeoutTrace,
  duplicateBillingChargeReport,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/index.ts";
import type { AgentRun } from "../../src/domain/runs/agent-run.ts";
import type { PlannedAction } from "../../src/domain/runs/planned-action.ts";

function successfulActionCount(
  run: AgentRun,
  action: PlannedAction["action"],
): number {
  const actionIds = new Set(
    run.plannedActions
      .filter((plannedAction) => plannedAction.action === action)
      .map((plannedAction) => plannedAction.id),
  );

  return run.results.filter(
    (result) => actionIds.has(result.actionId) && result.status === "succeeded",
  ).length;
}

test("learns, previews, approves, executes, resumes, and requests review", async () => {
  const firstPattern = detectPattern([loginAuthenticationTrace]);
  assert.equal(firstPattern, null, "one trace must not create a pattern");

  const pattern = detectPattern([loginAuthenticationTrace, apiTimeoutTrace]);
  assert.ok(pattern, "a varied second trace must create a pattern");
  assert.equal(
    pattern.stages.length,
    5,
    "the workflow must contain five stages",
  );
  assert.ok(
    pattern.variables.some((variable) => variable.field === "customer.name"),
    "customer values must be generalized",
  );
  assert.ok(
    pattern.variables.some((variable) => variable.field === "owner"),
    "owner values must be generalized",
  );
  assert.equal(
    pattern.constants.some(
      (constant) =>
        constant.field === "customer.name" || constant.field === "owner",
    ),
    false,
    "customer and owner values must not become constants",
  );

  const billingUnderstanding = understandReport(duplicateBillingChargeReport);
  assert.equal(billingUnderstanding.issue.department, "billing");
  assert.equal(billingUnderstanding.owner, "Tehsin");

  const billingRun = planRun(pattern, billingUnderstanding);
  assert.equal(billingRun.status, "preview_ready");
  assert.equal(
    billingRun.plannedActions.some((action) =>
      JSON.stringify(action.resolvedInput).includes("{{"),
    ),
    false,
    "the Preview Run must not contain unresolved placeholders",
  );

  await assert.rejects(
    () => executeRun(billingRun),
    /approval/i,
    "execution must be blocked without approval",
  );

  const approvedRun = approveRun(billingRun, "reviewer-001");
  const completedRun = await executeRun(approvedRun);
  assert.equal(successfulActionCount(completedRun, "create_issue"), 1);
  assert.equal(
    successfulActionCount(completedRun, "send_team_notification"),
    1,
  );

  const failureRun = approveRun(
    planRun(pattern, billingUnderstanding),
    "reviewer-001",
  );
  const failedRun = await executeRun(failureRun, {
    failOnAction: "send_team_notification",
  });
  assert.equal(failedRun.status, "failed");
  assert.equal(successfulActionCount(failedRun, "create_issue"), 1);

  const resumedRun = await resumeRun(failedRun);
  assert.equal(successfulActionCount(resumedRun, "create_issue"), 1);
  assert.equal(successfulActionCount(resumedRun, "send_team_notification"), 1);

  const ambiguousUnderstanding = understandReport(ambiguousReviewReport);
  assert.equal(ambiguousUnderstanding.reviewRequired, true);
  assert.equal(ambiguousUnderstanding.owner, null);

  const ambiguousRun = planRun(pattern, ambiguousUnderstanding);
  assert.equal(ambiguousRun.status, "needs_review");
  assert.equal(
    ambiguousRun.results.some((result) => result.status === "succeeded"),
    false,
    "ambiguous input must cause no consequential action",
  );
});
