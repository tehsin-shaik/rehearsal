import type { WorkflowTrace } from "../../domain/events/workflow-trace.ts";
import type { LearnedPattern } from "../../domain/patterns/learned-pattern.ts";
import type { AgentRun } from "../../domain/runs/agent-run.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import { NotImplementedError } from "./not-implemented-error.ts";

function pending(operation: string): never {
  throw new NotImplementedError(operation);
}

export function detectPattern(
  traces: readonly WorkflowTrace[],
): LearnedPattern | null {
  void traces;
  return pending("pattern detection and compilation");
}

export function understandReport(report: {
  readonly id: string;
  readonly receivedAt: string;
  readonly subject: string;
  readonly body: string;
}): IssueUnderstanding {
  void report;
  return pending("deterministic report understanding");
}

export function planRun(
  pattern: LearnedPattern,
  understanding: IssueUnderstanding,
): AgentRun {
  void pattern;
  void understanding;
  return pending("Ghost Run planning");
}

export function approveRun(run: AgentRun, approvedBy: string): AgentRun {
  void run;
  void approvedBy;
  return pending("run approval");
}

export function executeRun(
  run: AgentRun,
  options?: {
    readonly failOnAction?: PlannedAction["action"];
  },
): Promise<AgentRun> {
  void run;
  void options;
  return pending("policy enforcement and execution");
}

export function resumeRun(run: AgentRun): Promise<AgentRun> {
  void run;
  return pending("idempotent run resumption");
}
