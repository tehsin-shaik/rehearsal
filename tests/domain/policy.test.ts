import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  assertActionMayExecute,
  evaluateActionPolicy,
} from "../../src/domain/policy/execution-policy.ts";
import {
  ApprovalRequiredError,
  BlockedPermissionError,
  UnresolvedValueError,
} from "../../src/domain/policy/policy-errors.ts";
import {
  getPermissionMetadata,
  permissionForAction,
  permissionRequiresApproval,
  type PermissionClass,
} from "../../src/domain/policy/permission-policy.ts";
import {
  assessActionRisk,
  assessRunRisk,
} from "../../src/domain/policy/risk-assessment.ts";
import type {
  PlannedAction,
  PlannedSemanticAction,
} from "../../src/domain/runs/planned-action.ts";

const EVALUATED_AT = "2026-01-07T11:30:00.000Z";

function plannedAction(
  action: PlannedSemanticAction,
  permission: PermissionClass = permissionForAction(action),
): PlannedAction {
  return {
    id: `action-${action}`,
    sequence: 1,
    action,
    permission,
    destination: "test:destination",
    resolvedInput: { value: "resolved" },
    risk: assessActionRisk(permission),
    requiresApproval: permissionRequiresApproval(permission),
    status: "planned",
    idempotencyKey: `idempotency-${action}`,
  };
}

test("policy metadata and action mapping are deterministic", () => {
  assert.deepEqual(getPermissionMetadata("read"), {
    permission: "read",
    allowed: true,
    approvalRequired: false,
    description: "Reading existing information is allowed without approval.",
  });
  assert.equal(permissionForAction("read_email"), "read");
  assert.equal(permissionForAction("draft_ticket"), "draft");
  assert.equal(permissionForAction("create_issue"), "create_external");
  assert.equal(permissionForAction("send_team_notification"), "send_message");
  assert.equal(permissionForAction("make_payment"), "payment");
});

test("reads, analysis, and drafts execute without approval", () => {
  for (const action of [
    plannedAction("read_email"),
    plannedAction("classify_issue"),
    plannedAction("draft_ticket"),
  ]) {
    assert.doesNotThrow(() =>
      assertActionMayExecute(action, {
        approved: false,
        evaluatedAt: EVALUATED_AT,
      }),
    );
    assert.equal(
      evaluateActionPolicy(action, {
        approved: false,
        evaluatedAt: EVALUATED_AT,
      }).effect,
      "allow",
    );
  }
});

test("external creation and sending require approval", () => {
  for (const action of [
    plannedAction("create_issue"),
    plannedAction("send_team_notification"),
  ]) {
    assert.throws(
      () =>
        assertActionMayExecute(action, {
          approved: false,
          evaluatedAt: EVALUATED_AT,
        }),
      ApprovalRequiredError,
    );
    assert.equal(
      evaluateActionPolicy(action, {
        approved: false,
        evaluatedAt: EVALUATED_AT,
      }).effect,
      "require_approval",
    );
  }
});

test("external creation is allowed after approval", () => {
  const action = plannedAction("create_issue");

  assert.doesNotThrow(() =>
    assertActionMayExecute(action, {
      approved: true,
      evaluatedAt: EVALUATED_AT,
      approvalId: "approval-001",
    }),
  );
  assert.equal(
    evaluateActionPolicy(action, {
      approved: true,
      evaluatedAt: EVALUATED_AT,
      approvalId: "approval-001",
    }).effect,
    "allow",
  );
});

test("payment is blocked even when approved", () => {
  const action = plannedAction("make_payment");

  assert.throws(
    () =>
      assertActionMayExecute(action, {
        approved: true,
        evaluatedAt: EVALUATED_AT,
      }),
    BlockedPermissionError,
  );
  assert.equal(
    evaluateActionPolicy(action, {
      approved: true,
      evaluatedAt: EVALUATED_AT,
    }).effect,
    "block",
  );
});

test("typed variable bindings are refused at the execution boundary", () => {
  const action: PlannedAction = {
    ...plannedAction("draft_ticket"),
    resolvedInput: {
      title: {
        kind: "runtime_variable",
        field: "issue.title",
      },
    },
  };

  assert.throws(
    () =>
      assertActionMayExecute(action, {
        approved: false,
        evaluatedAt: EVALUATED_AT,
      }),
    UnresolvedValueError,
  );
});

test("risk reflects uncertainty and consequential permissions", () => {
  assert.equal(
    assessRunRisk({
      permissions: ["read", "analyze", "draft", "create_external"],
      understandingConfidence: 0.95,
      pendingReview: false,
    }),
    "low",
  );
  assert.equal(
    assessRunRisk({
      permissions: ["read"],
      understandingConfidence: 0.4,
      pendingReview: true,
    }),
    "medium",
  );
  assert.equal(assessActionRisk("delete"), "high");
  assert.equal(assessActionRisk("payment"), "blocked");
});
