import type { WorkflowTrace } from "../../domain/events/workflow-trace.ts";
import {
  createDemoAdapterHarness,
  type DemoAdapterHarness,
  type DemoAdapterState,
  type DemoFailurePoint,
} from "../../demo/adapters/in-memory-adapters.ts";
import type { CompiledLearnedPattern } from "../../domain/patterns/compilation-types.ts";
import { compileLearnedPattern } from "../../domain/patterns/pattern-compiler.ts";
import { deterministicIdentifier } from "../../domain/patterns/deterministic-serialization.ts";
import type { LearnedPattern } from "../../domain/patterns/learned-pattern.ts";
import type { AgentRun } from "../../domain/runs/agent-run.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import { planPreviewRun } from "../../domain/runs/preview-run-planner.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import { approvePreviewRun } from "../../domain/runs/run-approval.ts";
import {
  understandReportDeterministically,
  type DeterministicIssueUnderstanding,
} from "../../domain/understanding/deterministic-understanding.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import type { MailMessage } from "../../domain/understanding/mail-message.ts";
import type { SupportReport } from "../../domain/understanding/support-report.ts";
import type { ExecutionAdapterBundle } from "../../infrastructure/adapters/contracts.ts";
import { executeAgentRun, type RunExecutionOptions } from "./run-executor.ts";
import { assertVerifiedRun } from "./run-verifier.ts";

const MAX_HEADLESS_DEMO_EXECUTIONS = 100;
const demoExecutions = new Map<string, DemoAdapterHarness>();

function rememberDemoExecution(
  runId: string,
  harness: DemoAdapterHarness,
): void {
  if (
    !demoExecutions.has(runId) &&
    demoExecutions.size >= MAX_HEADLESS_DEMO_EXECUTIONS
  ) {
    const oldestRunId = demoExecutions.keys().next().value;
    if (oldestRunId !== undefined) {
      demoExecutions.delete(oldestRunId);
    }
  }
  demoExecutions.set(runId, harness);
}

export function detectPattern(
  traces: readonly WorkflowTrace[],
): CompiledLearnedPattern | null {
  return compileLearnedPattern(traces);
}

export function understandReport(
  report: SupportReport,
): DeterministicIssueUnderstanding {
  return understandReportDeterministically(report);
}

export interface PlanRunOptions {
  readonly message?: MailMessage;
  readonly nextIssueNumber?: string;
  readonly issueUrl?: string | null;
}

function isCompiledPattern(
  pattern: LearnedPattern,
): pattern is CompiledLearnedPattern {
  return (
    "observationCount" in pattern &&
    pattern.variables.every(
      (variable) =>
        "binding" in variable &&
        typeof variable.binding === "object" &&
        variable.binding !== null,
    )
  );
}

function hasSourceMessage(
  understanding: IssueUnderstanding,
): understanding is IssueUnderstanding & {
  readonly sourceMessage: MailMessage;
} {
  if (!("sourceMessage" in understanding)) {
    return false;
  }

  const message = understanding.sourceMessage;
  return (
    typeof message === "object" &&
    message !== null &&
    "id" in message &&
    typeof message.id === "string" &&
    "receivedAt" in message &&
    typeof message.receivedAt === "string" &&
    "subject" in message &&
    typeof message.subject === "string" &&
    "body" in message &&
    typeof message.body === "string"
  );
}

function sourceMessage(
  understanding: IssueUnderstanding,
  options: PlanRunOptions,
): MailMessage {
  if (options.message !== undefined) {
    return options.message;
  }

  if (hasSourceMessage(understanding)) {
    return understanding.sourceMessage;
  }

  throw new TypeError(
    "Preview Run planning requires the source MailMessage for this understanding.",
  );
}

function predictedIssueNumber(reportId: string): string {
  return deterministicIdentifier("issue", { reportId }).toUpperCase();
}

function isPreviewRun(run: AgentRun): run is PreviewRun {
  return "phase" in run && "approved" in run && "resolvedValues" in run;
}

export function planRun(
  pattern: LearnedPattern,
  understanding: IssueUnderstanding,
  options: PlanRunOptions = {},
): PreviewRun {
  if (!isCompiledPattern(pattern)) {
    throw new TypeError("Preview Run planning requires a compiled pattern.");
  }

  const message = sourceMessage(understanding, options);

  return planPreviewRun(
    {
      pattern,
      message,
      understanding,
      nextIssueNumber:
        options.nextIssueNumber ?? predictedIssueNumber(message.id),
      ...(options.issueUrl === undefined ? {} : { issueUrl: options.issueUrl }),
    },
    { previewStatus: "preview_ready" },
  );
}

export function approveRun(run: AgentRun, approvedBy: string): AgentRun {
  if (!isPreviewRun(run)) {
    throw new TypeError("Only a Preview Run can be approved.");
  }

  return approvePreviewRun(run, approvedBy);
}

export interface ExecuteRunOptions extends RunExecutionOptions {
  readonly failOnAction?: PlannedAction["action"];
  readonly adapters?: ExecutionAdapterBundle;
}

function failurePointForAction(
  action: PlannedAction["action"] | undefined,
): DemoFailurePoint | undefined {
  switch (action) {
    case "create_issue":
      return "issue_creation";
    case "assign_owner":
      return "owner_assignment";
    case "send_team_notification":
      return "team_notification";
    case "reply_to_customer":
      return "customer_reply";
    default:
      return undefined;
  }
}

function demoHarnessFor(
  run: PreviewRun,
  failOnAction: PlannedAction["action"] | undefined,
): DemoAdapterHarness {
  if (run.results.length > 0) {
    const existing = demoExecutions.get(run.id);
    if (existing !== undefined) {
      const failurePoint = failurePointForAction(failOnAction);
      if (failurePoint !== undefined) {
        existing.failures.set(failurePoint);
      }
      return existing;
    }
  }

  const failurePoint = failurePointForAction(failOnAction);
  const harness = createDemoAdapterHarness({
    ...(failurePoint === undefined
      ? {}
      : { failures: { [failurePoint]: true } }),
  });
  rememberDemoExecution(run.id, harness);
  return harness;
}

export function getDemoExecutionState(runId: string): DemoAdapterState | null {
  return demoExecutions.get(runId)?.state ?? null;
}

export function clearDemoExecutionState(): void {
  demoExecutions.clear();
}

export async function executeRun(
  run: AgentRun,
  options: ExecuteRunOptions = {},
): Promise<AgentRun> {
  if (!isPreviewRun(run)) {
    throw new TypeError("Only a planned Preview Run can be executed.");
  }

  const harness =
    options.adapters === undefined
      ? demoHarnessFor(run, options.failOnAction)
      : undefined;
  const { adapters, failOnAction, ...executionOptions } = options;
  void failOnAction;
  const executedRun = await executeAgentRun(
    run,
    adapters ?? harness?.adapters ?? demoHarnessFor(run, undefined).adapters,
    executionOptions,
  );

  if (executedRun.status === "completed") {
    assertVerifiedRun(executedRun);
  }

  return executedRun;
}

export function resumeRun(
  run: AgentRun,
  options: ExecuteRunOptions = {},
): Promise<AgentRun> {
  if (run.status !== "failed") {
    throw new TypeError("Only a failed run can be resumed.");
  }

  return executeRun(run, options);
}
