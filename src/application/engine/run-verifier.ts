import type { ActionResult } from "../../domain/runs/action-result.ts";
import type { AgentRun } from "../../domain/runs/agent-run.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";

export type RunVerificationIssueCode =
  | "run_not_completed"
  | "action_not_succeeded"
  | "missing_success_result"
  | "inconsistent_result"
  | "missing_consequential_output";

export interface RunVerificationIssue {
  readonly code: RunVerificationIssueCode;
  readonly message: string;
  readonly actionId?: string;
}

export interface RunVerification {
  readonly ok: boolean;
  readonly issues: readonly RunVerificationIssue[];
  readonly metrics: AgentRun["metrics"];
}

export class RunVerificationError extends Error {
  readonly verification: RunVerification;

  constructor(verification: RunVerification) {
    super(
      verification.issues.map((issue) => issue.message).join(" ") ||
        "Run verification failed.",
    );
    this.name = "RunVerificationError";
    this.verification = verification;
  }
}

function latestResultsByAction(
  results: readonly ActionResult[],
): ReadonlyMap<string, ActionResult> {
  const latest = new Map<string, ActionResult>();
  for (const result of results) {
    latest.set(result.actionId, result);
  }
  return latest;
}

function requiresConsequentialOutput(action: PlannedAction): boolean {
  return (
    action.action === "create_issue" ||
    action.action === "assign_owner" ||
    action.action === "send_team_notification" ||
    action.action === "reply_to_customer"
  );
}

function hasResultData(result: ActionResult): boolean {
  return (
    result.data !== undefined &&
    typeof result.data === "object" &&
    result.data !== null &&
    Object.keys(result.data).length > 0
  );
}

export function verifyAgentRun(run: AgentRun): RunVerification {
  const issues: RunVerificationIssue[] = [];
  const latestResults = latestResultsByAction(run.results);

  if (run.status !== "completed") {
    issues.push({
      code: "run_not_completed",
      message: `Run ${run.id} has status ${run.status}, not completed.`,
    });
  }

  for (const action of run.plannedActions) {
    const result = latestResults.get(action.id);
    if (action.status !== "succeeded" && action.status !== "completed") {
      issues.push({
        code: "action_not_succeeded",
        actionId: action.id,
        message: `${action.action} has status ${action.status}.`,
      });
    }

    if (result === undefined || result.status !== "succeeded") {
      issues.push({
        code: "missing_success_result",
        actionId: action.id,
        message: `${action.action} has no successful result.`,
      });
      continue;
    }

    if (!result.ok || result.error !== undefined) {
      issues.push({
        code: "inconsistent_result",
        actionId: action.id,
        message: `${action.action} is marked successful but its result is not.`,
      });
    }

    if (requiresConsequentialOutput(action) && !hasResultData(result)) {
      issues.push({
        code: "missing_consequential_output",
        actionId: action.id,
        message: `${action.action} has no adapter-confirmed output.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    metrics: { ...run.metrics },
  };
}

export function assertVerifiedRun(run: AgentRun): void {
  const verification = verifyAgentRun(run);
  if (!verification.ok) {
    throw new RunVerificationError(verification);
  }
}
