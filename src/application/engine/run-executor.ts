import type { ActionResult } from "../../domain/runs/action-result.ts";
import type {
  PreviewPlannedAction,
  PreviewRun,
} from "../../domain/runs/preview-run-types.ts";
import type { PlannedSemanticAction } from "../../domain/runs/planned-action.ts";
import {
  assertActionMayExecute,
  assertRunMayExecute,
} from "../../domain/policy/execution-policy.ts";
import type { IssueReference } from "../../infrastructure/adapters/contracts.ts";
import type { ExecutionAdapterBundle } from "../../infrastructure/adapters/contracts.ts";
import { RunExecutionError } from "./execution-errors.ts";
import { rewriteRunIssueReference } from "./reference-rewriter.ts";

export interface ExecutionDelayConfiguration {
  readonly beforeActionMs?: number;
  readonly afterActionMs?: number;
  readonly byAction?: Partial<Readonly<Record<PlannedSemanticAction, number>>>;
}

export type ExecutionProgressStage =
  "action_started" | "action_succeeded" | "action_failed" | "run_completed";

export interface ExecutionProgress {
  readonly stage: ExecutionProgressStage;
  readonly run: PreviewRun;
  readonly action: PreviewPlannedAction | null;
  readonly result: ActionResult | null;
}

export interface RunExecutionOptions {
  readonly delays?: ExecutionDelayConfiguration;
  readonly now?: () => string;
  readonly onProgress?: (progress: ExecutionProgress) => void | Promise<void>;
  readonly onPolicyCheck?: (action: PreviewPlannedAction) => void;
}

const activeRunIds = new Set<string>();
const MAX_ACTIVE_RUNS = 100;
const MAX_RUN_RESULTS = 200;

function sleep(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function actionDelay(
  action: PlannedSemanticAction,
  configuration: ExecutionDelayConfiguration | undefined,
): number {
  return Math.max(
    0,
    configuration?.byAction?.[action] ?? configuration?.beforeActionMs ?? 0,
  );
}

function defaultTimestamp(run: PreviewRun, sequence: number): string {
  const triggerTime = new Date(run.trigger.event.occurredAt).getTime();
  return new Date(triggerTime + sequence * 1_000).toISOString();
}

function localSuccess(
  action: PreviewPlannedAction,
  attemptedAt: string,
): ActionResult {
  return {
    actionId: action.id,
    status: "succeeded",
    ok: true,
    summary: `${action.title} completed locally.`,
    data: { output: action.resolvedInput },
    adapter: "local-engine",
    durationMs: 0,
    attemptedAt,
    completedAt: attemptedAt,
    idempotencyKey: action.idempotencyKey,
  };
}

function failedUnsupportedAction(
  action: PreviewPlannedAction,
  attemptedAt: string,
): ActionResult {
  return {
    actionId: action.id,
    status: "failed",
    ok: false,
    summary: `${action.action} has no configured execution handler.`,
    adapter: "local-engine",
    durationMs: 0,
    attemptedAt,
    completedAt: attemptedAt,
    idempotencyKey: action.idempotencyKey,
    error: {
      code: "unsupported_action",
      message: `No execution handler is configured for ${action.action}.`,
      retryable: false,
    },
  };
}

function currentIssueReference(run: PreviewRun): IssueReference {
  const reference = run.issueReference;
  if (
    reference.actualIssueId === null ||
    reference.actualIssueKey === null ||
    reference.actualIssueNumber === null
  ) {
    throw new RunExecutionError(
      "missing_issue_reference",
      "Owner assignment requires an adapter-confirmed issue reference.",
    );
  }

  return {
    id: reference.actualIssueId,
    key: reference.actualIssueKey,
    number: reference.actualIssueNumber,
    url: reference.actualIssueUrl,
  };
}

function requireCustomer(run: PreviewRun): {
  readonly name: string;
  readonly email: string;
} {
  const { customerName, customerEmail } = run.resolvedValues;
  if (customerName === null || customerEmail === null) {
    throw new RunExecutionError(
      "invalid_run_state",
      "Customer identity must be resolved before execution.",
    );
  }

  return { name: customerName, email: customerEmail };
}

async function executeAction(
  action: PreviewPlannedAction,
  run: PreviewRun,
  adapters: ExecutionAdapterBundle,
  attemptedAt: string,
): Promise<ActionResult> {
  const customer = requireCustomer(run);

  switch (action.action) {
    case "read_email":
    case "extract_issue_details":
    case "classify_issue":
    case "draft_ticket":
    case "apply_labels":
    case "prepare_team_notification":
    case "analyze_report":
      return localSuccess(action, attemptedAt);
    case "create_issue":
      return adapters.issueTracker.createIssue({
        actionId: action.id,
        idempotencyKey: action.idempotencyKey,
        attemptedAt,
        predictedIssueNumber: run.issueReference.predictedIssueNumber,
        title: run.resolvedValues.issueTitle,
        description: run.resolvedValues.issueDescription,
        category: run.resolvedValues.category,
        department: run.resolvedValues.department,
        severity: run.resolvedValues.severity,
        labels: run.resolvedValues.labels,
        customerName: customer.name,
        customerEmail: customer.email,
        researchReferences: run.resolvedValues.researchReferences,
      });
    case "assign_owner": {
      const owner = run.resolvedValues.owner;
      if (owner === null) {
        throw new RunExecutionError(
          "invalid_run_state",
          "Owner assignment requires a resolved owner.",
        );
      }

      return adapters.issueTracker.assignIssueOwner({
        actionId: action.id,
        idempotencyKey: action.idempotencyKey,
        attemptedAt,
        issue: currentIssueReference(run),
        owner,
      });
    }
    case "send_team_notification":
      return adapters.messaging.sendTeamMessage({
        actionId: action.id,
        idempotencyKey: action.idempotencyKey,
        attemptedAt,
        channel: run.resolvedValues.teamChannel,
        message: run.resolvedValues.teamNotification,
      });
    case "reply_to_customer":
      return adapters.customerMail.sendCustomerReply({
        actionId: action.id,
        idempotencyKey: action.idempotencyKey,
        attemptedAt,
        originatingMessageId: run.resolvedValues.messageId,
        recipient: customer.email,
        message: run.resolvedValues.customerReply,
      });
    case "delete_external":
    case "make_payment":
      return failedUnsupportedAction(action, attemptedAt);
  }
}

function issueReferenceFromResult(result: ActionResult): IssueReference | null {
  if (!result.ok || typeof result.data !== "object" || result.data === null) {
    return null;
  }

  const data = result.data as Readonly<Record<string, unknown>>;
  const issue = data.issue;
  if (typeof issue !== "object" || issue === null) {
    return null;
  }

  const reference = issue as Readonly<Record<string, unknown>>;
  if (
    typeof reference.id !== "string" ||
    typeof reference.key !== "string" ||
    typeof reference.number !== "string" ||
    (reference.url !== null && typeof reference.url !== "string")
  ) {
    return null;
  }

  return {
    id: reference.id,
    key: reference.key,
    number: reference.number,
    url: reference.url,
  };
}

function latestSuccessfulActionIds(
  results: readonly ActionResult[],
): ReadonlySet<string> {
  const latest = new Map<string, ActionResult>();
  for (const result of results) {
    latest.set(result.actionId, result);
  }

  return new Set(
    [...latest.entries()]
      .filter(([, result]) => result.ok && result.status === "succeeded")
      .map(([actionId]) => actionId),
  );
}

function updateActionStatus(
  run: PreviewRun,
  actionId: string,
  status: PreviewPlannedAction["status"],
  markLaterUnattempted = false,
): PreviewRun {
  const currentSequence = run.plannedActions.find(
    (action) => action.id === actionId,
  )?.sequence;

  return {
    ...run,
    plannedActions: run.plannedActions.map((action) => {
      if (action.id === actionId) {
        return { ...action, status };
      }

      if (
        markLaterUnattempted &&
        currentSequence !== undefined &&
        action.sequence > currentSequence &&
        action.status !== "succeeded" &&
        action.status !== "completed"
      ) {
        return { ...action, status: "not_attempted" };
      }

      return action;
    }),
  };
}

async function reportProgress(
  options: RunExecutionOptions,
  progress: ExecutionProgress,
): Promise<void> {
  await options.onProgress?.(progress);
}

function assertExecutableStatus(run: PreviewRun): void {
  if (run.status === "executing" || activeRunIds.has(run.id)) {
    throw new RunExecutionError(
      "already_executing",
      `Run ${run.id} is already executing.`,
    );
  }

  if (run.status === "completed") {
    throw new RunExecutionError(
      "already_completed",
      `Run ${run.id} is already completed.`,
    );
  }

  if (run.status !== "approved" && run.status !== "failed") {
    throw new RunExecutionError(
      "invalid_run_state",
      `Run ${run.id} cannot execute from status ${run.status}.`,
    );
  }

  if (activeRunIds.size >= MAX_ACTIVE_RUNS) {
    throw new RunExecutionError(
      "invalid_run_state",
      "The execution engine has reached its active-run capacity.",
    );
  }
}

export async function executeAgentRun(
  sourceRun: PreviewRun,
  adapters: ExecutionAdapterBundle,
  options: RunExecutionOptions = {},
): Promise<PreviewRun> {
  assertRunMayExecute(sourceRun);
  assertExecutableStatus(sourceRun);
  activeRunIds.add(sourceRun.id);

  try {
    let run: PreviewRun = {
      ...sourceRun,
      status: "executing",
      phase: "executing",
    };
    const successfulActionIds = latestSuccessfulActionIds(run.results);

    for (const initialAction of run.plannedActions) {
      if (successfulActionIds.has(initialAction.id)) {
        run = updateActionStatus(run, initialAction.id, "succeeded");
        continue;
      }

      run = updateActionStatus(run, initialAction.id, "running");
      const action = run.plannedActions.find(
        (candidate) => candidate.id === initialAction.id,
      );
      if (action === undefined) {
        throw new RangeError(`Missing planned action ${initialAction.id}.`);
      }

      await reportProgress(options, {
        stage: "action_started",
        run,
        action,
        result: null,
      });
      await sleep(actionDelay(action.action, options.delays));
      const attemptedAt =
        options.now?.() ?? defaultTimestamp(run, action.sequence);

      assertActionMayExecute(action, {
        approved: run.approval.status === "approved",
        evaluatedAt: attemptedAt,
      });
      options.onPolicyCheck?.(action);

      const result = await executeAction(action, run, adapters, attemptedAt);
      run = {
        ...run,
        results: [...run.results, result].slice(-MAX_RUN_RESULTS),
      };

      if (!result.ok || result.status === "failed") {
        run = updateActionStatus(run, action.id, "failed", true);
        run = { ...run, status: "failed", phase: "failed" };
        await reportProgress(options, {
          stage: "action_failed",
          run,
          action:
            run.plannedActions.find(
              (candidate) => candidate.id === action.id,
            ) ?? null,
          result,
        });
        return run;
      }

      run = updateActionStatus(run, action.id, "succeeded");
      if (action.action === "create_issue") {
        const issue = issueReferenceFromResult(result);
        if (issue === null) {
          throw new RunExecutionError(
            "missing_issue_reference",
            "The issue tracker reported success without an issue reference.",
          );
        }
        run = rewriteRunIssueReference(
          run,
          issue,
          result.completedAt ?? attemptedAt,
        );
      }

      await reportProgress(options, {
        stage: "action_succeeded",
        run,
        action:
          run.plannedActions.find((candidate) => candidate.id === action.id) ??
          null,
        result,
      });
      await sleep(Math.max(0, options.delays?.afterActionMs ?? 0));
    }

    run = { ...run, status: "completed", phase: "completed" };
    await reportProgress(options, {
      stage: "run_completed",
      run,
      action: null,
      result: null,
    });
    return run;
  } finally {
    activeRunIds.delete(sourceRun.id);
  }
}
