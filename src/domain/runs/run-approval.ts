import { deterministicIdentifier } from "../patterns/deterministic-serialization.ts";
import { assertActionMayExecute } from "../policy/execution-policy.ts";
import {
  PendingReviewError,
  UnresolvedValueError,
} from "../policy/policy-errors.ts";
import { createPolicyDecision } from "../policy/permission-policy.ts";
import type { PreviewRun } from "./preview-run-types.ts";

export function approvePreviewRun(
  run: PreviewRun,
  approvedBy: string,
  approvedAt = run.trigger.event.occurredAt,
): PreviewRun {
  const normalizedApprover = approvedBy.trim();
  if (normalizedApprover.length === 0) {
    throw new RangeError("A Preview Run approval requires an approver.");
  }

  const reviewAction = run.plannedActions.find(
    (action) => action.status === "needs_review",
  );
  if (reviewAction !== undefined || run.reviewRequests.length > 0) {
    const action = reviewAction ?? run.plannedActions[0];
    if (action === undefined) {
      throw new RangeError("A Preview Run must contain a planned action.");
    }

    throw new PendingReviewError(action.id, action.permission);
  }

  if (run.resolutionErrors.length > 0) {
    const action = run.plannedActions[0];
    if (action === undefined) {
      throw new RangeError("A Preview Run must contain a planned action.");
    }

    throw new UnresolvedValueError(action.id, action.permission);
  }

  const approvalId = deterministicIdentifier("approval", {
    runId: run.id,
    approvedBy: normalizedApprover,
    approvedAt,
  });

  for (const action of run.plannedActions) {
    assertActionMayExecute(action, {
      approved: true,
      evaluatedAt: approvedAt,
      approvalId,
    });
  }

  const plannedActions = run.plannedActions.map((action) => ({
    ...action,
    status: action.requiresApproval ? ("approved" as const) : action.status,
  }));

  return {
    ...run,
    status: "approved",
    approved: true,
    plannedActions,
    policyDecisions: plannedActions.map((action) =>
      createPolicyDecision({
        actionId: action.id,
        permission: action.permission,
        approved: true,
        evaluatedAt: approvedAt,
        approvalId,
      }),
    ),
    approval: {
      status: "approved",
      approvedBy: normalizedApprover,
      approvedAt,
    },
  };
}
