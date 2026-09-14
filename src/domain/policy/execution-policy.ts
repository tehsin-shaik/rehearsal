import type { AgentRun } from "../runs/agent-run.ts";
import type { PlannedAction } from "../runs/planned-action.ts";
import {
  ApprovalRequiredError,
  BlockedPermissionError,
  PendingReviewError,
  PolicyError,
  UnresolvedValueError,
} from "./policy-errors.ts";
import {
  createPolicyDecision,
  getPermissionMetadata,
} from "./permission-policy.ts";
import type { PolicyDecision } from "./policy-decision.ts";

export interface ActionExecutionContext {
  readonly approved: boolean;
  readonly evaluatedAt: string;
  readonly approvalId?: string;
}

export type RunExecutionEligibility =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly error: PolicyError;
    };

function containsUnresolvedValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0 || value.includes("{{");
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.some(containsUnresolvedValue);
  }

  if (typeof value !== "object") {
    return false;
  }

  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "runtime_variable") {
    return true;
  }

  return Object.values(record).some(containsUnresolvedValue);
}

export function evaluateActionPolicy(
  action: PlannedAction,
  context: ActionExecutionContext,
): PolicyDecision {
  return createPolicyDecision({
    actionId: action.id,
    permission: action.permission,
    approved: context.approved,
    evaluatedAt: context.evaluatedAt,
    ...(context.approvalId === undefined
      ? {}
      : { approvalId: context.approvalId }),
  });
}

export function assertActionMayExecute(
  action: PlannedAction,
  context: ActionExecutionContext,
): void {
  const metadata = getPermissionMetadata(action.permission);

  if (!metadata.allowed) {
    throw new BlockedPermissionError(action.id, action.permission);
  }

  if (action.status === "needs_review") {
    throw new PendingReviewError(action.id, action.permission);
  }

  if (containsUnresolvedValue(action.resolvedInput)) {
    throw new UnresolvedValueError(action.id, action.permission);
  }

  if (metadata.approvalRequired && !context.approved) {
    throw new ApprovalRequiredError(action.id, action.permission);
  }
}

function firstAction(run: AgentRun): PlannedAction {
  const action = run.plannedActions[0];
  if (action === undefined) {
    throw new RangeError("A run must contain at least one planned action.");
  }

  return action;
}

export function assertRunMayExecute(run: AgentRun): void {
  const blockedAction = run.plannedActions.find(
    (action) => !getPermissionMetadata(action.permission).allowed,
  );
  if (blockedAction !== undefined) {
    throw new BlockedPermissionError(
      blockedAction.id,
      blockedAction.permission,
    );
  }

  const reviewAction = run.plannedActions.find(
    (action) => action.status === "needs_review",
  );
  if (reviewAction !== undefined) {
    throw new PendingReviewError(reviewAction.id, reviewAction.permission);
  }

  const runWithResolutionErrors = run as AgentRun & {
    readonly resolutionErrors?: readonly unknown[];
  };
  if ((runWithResolutionErrors.resolutionErrors?.length ?? 0) > 0) {
    const action = firstAction(run);
    throw new UnresolvedValueError(action.id, action.permission);
  }

  const evaluatedAt =
    run.approval.approvedAt ??
    (
      run as AgentRun & {
        readonly trigger?: {
          readonly event?: { readonly occurredAt?: string };
        };
      }
    ).trigger?.event?.occurredAt ??
    "1970-01-01T00:00:00.000Z";

  for (const action of run.plannedActions) {
    assertActionMayExecute(action, {
      approved: run.approval.status === "approved",
      evaluatedAt,
    });
  }
}

export function getRunExecutionEligibility(
  run: AgentRun,
): RunExecutionEligibility {
  try {
    assertRunMayExecute(run);
    return { allowed: true };
  } catch (error) {
    if (error instanceof PolicyError) {
      return { allowed: false, error };
    }

    throw error;
  }
}
