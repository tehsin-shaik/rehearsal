import type { ActionResult } from "../../domain/runs/action-result.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import { ApprovalRequiredError } from "../../domain/policy/policy-errors.ts";
import {
  assertActionMayExecute,
  evaluateActionPolicy,
} from "../../domain/policy/execution-policy.ts";
import { permissionForAction } from "../../domain/policy/permission-policy.ts";
import type { PolicyDecision } from "../../domain/policy/policy-decision.ts";
import type { ExecutionAdapterBundle } from "../adapters/contracts.ts";
import type { ExecuteActionRequest } from "../validation/api-schemas.ts";

const MAX_IDEMPOTENCY_RESULTS = 200;
const MAX_IN_FLIGHT_REMOTE_ACTIONS = 100;
const confirmedResults = new Map<string, ActionResult>();
const inFlightResults = new Map<string, Promise<ActionResult>>();

export class RemoteExecutionCapacityError extends Error {
  constructor() {
    super("The remote execution boundary is at capacity.");
    this.name = "RemoteExecutionCapacityError";
  }
}

function policyAction(request: ExecuteActionRequest): PlannedAction {
  const permission = permissionForAction(request.action);
  return {
    id: request.actionId,
    sequence: 1,
    action: request.action,
    permission,
    destination: request.action.replaceAll("_", " "),
    resolvedInput: request.input,
    risk: permission === "read" || permission === "analyze" ? "low" : "medium",
    requiresApproval: true,
    status: request.approved ? "approved" : "planned",
    idempotencyKey: request.idempotencyKey,
  };
}

export function authorizeRemoteAction(
  request: ExecuteActionRequest,
  evaluatedAt = new Date().toISOString(),
): PolicyDecision {
  const action = policyAction(request);
  if (request.approved && request.approvalId === undefined) {
    throw new ApprovalRequiredError(action.id, action.permission);
  }
  const context = {
    approved: request.approved,
    evaluatedAt,
    ...(request.approvalId === undefined
      ? {}
      : { approvalId: request.approvalId }),
  };
  assertActionMayExecute(action, context);
  return evaluateActionPolicy(action, context);
}

function rememberResult(key: string, result: ActionResult): void {
  if (!result.ok) {
    return;
  }

  confirmedResults.set(key, result);
  while (confirmedResults.size > MAX_IDEMPOTENCY_RESULTS) {
    const oldestKey = confirmedResults.keys().next().value as
      string | undefined;
    if (oldestKey === undefined) {
      break;
    }
    confirmedResults.delete(oldestKey);
  }
}

export async function executeOneRemoteAction(
  request: ExecuteActionRequest,
  adapters: ExecutionAdapterBundle,
): Promise<{
  readonly decision: PolicyDecision;
  readonly result: ActionResult;
}> {
  const attemptedAt = new Date().toISOString();
  const decision = authorizeRemoteAction(request, attemptedAt);
  const cacheKey = `${request.action}:${request.idempotencyKey}`;
  const previous = confirmedResults.get(cacheKey);
  if (previous !== undefined) {
    return { decision, result: previous };
  }

  const inFlight = inFlightResults.get(cacheKey);
  if (inFlight !== undefined) {
    return { decision, result: await inFlight };
  }
  if (inFlightResults.size >= MAX_IN_FLIGHT_REMOTE_ACTIONS) {
    throw new RemoteExecutionCapacityError();
  }

  const context = {
    actionId: request.actionId,
    idempotencyKey: request.idempotencyKey,
    attemptedAt,
  };
  const operation = (async (): Promise<ActionResult> => {
    switch (request.action) {
      case "create_issue":
        return adapters.issueTracker.createIssue({
          ...context,
          ...request.input,
        });
      case "assign_owner":
        return adapters.issueTracker.assignIssueOwner({
          ...context,
          ...request.input,
        });
      case "send_team_notification":
        return adapters.messaging.sendTeamMessage({
          ...context,
          ...request.input,
        });
      case "reply_to_customer":
        return adapters.customerMail.sendCustomerReply({
          ...context,
          ...request.input,
        });
    }
  })();
  inFlightResults.set(cacheKey, operation);

  let result: ActionResult;
  try {
    result = await operation;
  } finally {
    if (inFlightResults.get(cacheKey) === operation) {
      inFlightResults.delete(cacheKey);
    }
  }

  rememberResult(cacheKey, result);
  return { decision, result };
}
