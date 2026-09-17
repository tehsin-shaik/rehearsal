import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  ambiguousReviewReport,
  apiTimeoutTrace,
  duplicateBillingChargeReport,
  loginAuthenticationTrace,
} from "../../src/demo/fixtures/index.ts";
import { compileLearnedPattern } from "../../src/domain/patterns/pattern-compiler.ts";
import { getRunExecutionEligibility } from "../../src/domain/policy/execution-policy.ts";
import { PendingReviewError } from "../../src/domain/policy/policy-errors.ts";
import type { PreviewRun } from "../../src/domain/runs/preview-run-types.ts";
import { planPreviewRun } from "../../src/domain/runs/preview-run-planner.ts";
import { applyOwnerOverride } from "../../src/domain/runs/owner-override.ts";
import { understandReportDeterministically } from "../../src/domain/understanding/deterministic-understanding.ts";
import { TEAM_OWNERS } from "../../src/domain/understanding/team-routing.ts";

const EXPECTED_ACTIONS = [
  "read_email",
  "extract_issue_details",
  "classify_issue",
  "draft_ticket",
  "apply_labels",
  "create_issue",
  "assign_owner",
  "prepare_team_notification",
  "send_team_notification",
  "reply_to_customer",
] as const;

function canonicalPattern() {
  const pattern = compileLearnedPattern([
    loginAuthenticationTrace,
    apiTimeoutTrace,
  ]);

  if (pattern === null) {
    throw new Error("The canonical traces must compile for Preview Run tests.");
  }

  return pattern;
}

function billingRun(): PreviewRun {
  const understanding = understandReportDeterministically(
    duplicateBillingChargeReport,
  );

  return planPreviewRun({
    pattern: canonicalPattern(),
    message: duplicateBillingChargeReport,
    understanding,
    nextIssueNumber: "SUP-2042",
    issueUrl: "https://issues.example.test/SUP-2042",
  });
}

function ambiguousRun(): PreviewRun {
  const understanding = understandReportDeterministically(
    ambiguousReviewReport,
  );

  return planPreviewRun({
    pattern: canonicalPattern(),
    message: ambiguousReviewReport,
    understanding,
    nextIssueNumber: "SUP-2043",
  });
}

function containsUnresolvedValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsUnresolvedValue);
  }

  if (typeof value !== "object") {
    return false;
  }

  const record = value as Readonly<Record<string, unknown>>;
  return (
    record.kind === "runtime_variable" ||
    Object.values(record).some(containsUnresolvedValue)
  );
}

test("billing creates a deterministic unapproved Preview Run", () => {
  const firstRun = billingRun();
  const equivalentRun = billingRun();

  assert.equal(firstRun.status, "preview");
  assert.equal(firstRun.phase, "preview");
  assert.equal(firstRun.approved, false);
  assert.equal(firstRun.approval.status, "pending");
  assert.deepEqual(firstRun, equivalentRun);
});

test("the normal plan contains ten fully resolved actions in order", () => {
  const run = billingRun();

  assert.deepEqual(
    run.plannedActions.map((action) => action.action),
    EXPECTED_ACTIONS,
  );
  assert.deepEqual(
    run.plannedActions.map((action) => action.sequence),
    EXPECTED_ACTIONS.map((_, index) => index + 1),
  );
  assert.ok(
    run.plannedActions.every(
      (action) =>
        action.id.length > 0 &&
        action.sourceWorkflowStepId.length > 0 &&
        action.title.length > 0 &&
        action.detail.length > 0 &&
        action.destination.length > 0 &&
        !containsUnresolvedValue(action.resolvedInput),
    ),
  );
  assert.equal(JSON.stringify(run).includes("runtime_variable"), false);
  assert.equal(JSON.stringify(run).includes("{{"), false);
});

test("billing resolves routed values and meaningful adaptations", () => {
  const run = billingRun();
  const department = run.adaptations.find(
    (adaptation) => adaptation.field === "department",
  );
  const owner = run.adaptations.find(
    (adaptation) => adaptation.field === "owner",
  );

  assert.equal(run.resolvedValues.department, "billing");
  assert.equal(run.resolvedValues.owner, "Tehsin");
  assert.equal(run.resolvedValues.teamChannel, "#billing-finance");
  assert.equal(department?.observedValue, "Technical Support");
  assert.equal(department?.adaptedValue, "Billing");
  assert.equal(owner?.observedValue, "Elyes");
  assert.equal(owner?.adaptedValue, "Tehsin");
  assert.equal(owner?.rule, "billing -> Tehsin");
  assert.deepEqual(
    run.adaptations.map((adaptation) => adaptation.field),
    ["department", "owner"],
  );
});

test("planning composes informative drafts without claiming resolution", () => {
  const run = billingRun();

  assert.match(run.resolvedValues.teamNotification, /Leila Haddad/);
  assert.match(run.resolvedValues.teamNotification, /Tehsin/);
  assert.match(run.resolvedValues.teamNotification, /SUP-2042/);
  assert.match(
    run.resolvedValues.teamNotification,
    /https:\/\/issues\.example\.test\/SUP-2042/,
  );
  assert.match(run.resolvedValues.customerReply, /received/i);
  assert.match(run.resolvedValues.customerReply, /Billing/);
  assert.doesNotMatch(run.resolvedValues.customerReply, /fixed|resolved/i);
});

test("planning performs no network calls", () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("Planning must not access the network.");
  };

  try {
    billingRun();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(networkCalls, 0);
});

test("ambiguous input requires owner review and is not executable", () => {
  const run = ambiguousRun();
  const runBeforeEligibilityCheck = structuredClone(run);
  const ownerAction = run.plannedActions.find(
    (action) => action.action === "assign_owner",
  );
  const eligibility = getRunExecutionEligibility(run);

  assert.equal(run.understanding.issue.department, "unresolved");
  assert.equal(run.understanding.owner, null);
  assert.equal(run.status, "needs_review");
  assert.equal(run.resolvedValues.owner, null);
  assert.equal(run.resolvedValues.ownerSource, "unresolved");
  assert.deepEqual(
    run.resolutionErrors.map((error) => error.field),
    ["department", "owner"],
  );
  assert.equal(ownerAction?.status, "needs_review");
  assert.deepEqual(ownerAction?.review?.options, TEAM_OWNERS);
  assert.notEqual(run.risk, "low");
  assert.equal(eligibility.allowed, false);
  if (eligibility.allowed) {
    assert.fail("A pending owner review must prevent execution.");
  }
  assert.ok(eligibility.error instanceof PendingReviewError);
  assert.deepEqual(run, runBeforeEligibilityCheck);
  assert.equal(run.results.length, 0);
});

test("a human owner override resolves review and updates dependent drafts", () => {
  const pendingRun = ambiguousRun();
  const updatedRun = applyOwnerOverride(pendingRun, "Alex", "reviewer-001");
  const ownerAction = updatedRun.plannedActions.find(
    (action) => action.action === "assign_owner",
  );

  assert.equal(updatedRun.understanding.issue.department, "unresolved");
  assert.equal(updatedRun.status, "preview");
  assert.equal(updatedRun.resolvedValues.owner, "Alex");
  assert.equal(updatedRun.resolvedValues.ownerSource, "human");
  assert.equal(
    updatedRun.resolvedValues.department,
    "legal_privacy_and_compliance",
  );
  assert.equal(updatedRun.reviewRequests.length, 0);
  assert.equal(updatedRun.resolutionErrors.length, 0);
  assert.equal(ownerAction?.status, "planned");
  assert.equal(ownerAction?.review, undefined);
  assert.equal(ownerAction?.resolvedInput.owner, "Alex");
  assert.notEqual(
    updatedRun.resolvedValues.teamNotification,
    pendingRun.resolvedValues.teamNotification,
  );
  assert.notEqual(
    updatedRun.resolvedValues.customerReply,
    pendingRun.resolvedValues.customerReply,
  );
  assert.match(updatedRun.resolvedValues.teamNotification, /Alex/);
  assert.match(updatedRun.resolvedValues.customerReply, /Legal/);
  assert.equal(
    updatedRun.plannedActions.find(
      (action) => action.action === "send_team_notification",
    )?.resolvedInput.message,
    updatedRun.resolvedValues.teamNotification,
  );
  assert.equal(
    updatedRun.plannedActions.find(
      (action) => action.action === "reply_to_customer",
    )?.resolvedInput.message,
    updatedRun.resolvedValues.customerReply,
  );
  assert.deepEqual(updatedRun.humanSelections, [
    {
      field: "owner",
      value: "Alex",
      selectedBy: "reviewer-001",
      rule: "human selection",
    },
  ]);
  assert.equal(updatedRun.risk, "medium");
  assert.equal(updatedRun.results.length, 0);
});

test("normal Preview Run risk is low", () => {
  assert.equal(billingRun().risk, "low");
});
