import type { SemanticEvent } from "../events/semantic-event.ts";
import type { PolicyDecision } from "../policy/policy-decision.ts";
import type { RunRisk } from "../policy/risk-assessment.ts";
import type {
  IssueCategory,
  IssueSeverity,
  IssueUnderstanding,
} from "../understanding/issue-understanding.ts";
import type { MailMessage } from "../understanding/mail-message.ts";
import type { Department, TeamOwner } from "../understanding/team-routing.ts";
import type { AgentRun } from "./agent-run.ts";
import type { PlannedAction } from "./planned-action.ts";

export interface RunAdaptation {
  readonly field: "department" | "owner";
  readonly from: unknown;
  readonly to: unknown;
  readonly observedValue: unknown;
  readonly adaptedValue: unknown;
  readonly rule: string;
  readonly reason: string;
  readonly selectedByHuman: boolean;
}

export interface HumanReviewRequest {
  readonly id: string;
  readonly field: "owner";
  readonly reason: string;
  readonly options: readonly TeamOwner[];
  readonly status: "pending" | "resolved";
  readonly selectedValue: TeamOwner | null;
  readonly selectedBy: string | null;
}

export interface HumanSelection {
  readonly field: "owner";
  readonly value: TeamOwner;
  readonly selectedBy: string;
  readonly rule: "human selection";
}

export interface VariableResolutionError {
  readonly code: "missing_required_value" | "unresolved_routing";
  readonly field: string;
  readonly message: string;
}

export interface ResolvedRunValues {
  readonly messageId: string;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly issueTitle: string;
  readonly issueDescription: string;
  readonly category: IssueCategory;
  readonly department: Department;
  readonly severity: IssueSeverity;
  readonly labels: readonly string[];
  readonly owner: TeamOwner | null;
  readonly ownerSource: "routing" | "human" | "unresolved";
  readonly issueNumber: string;
  readonly teamChannel: string;
  readonly teamNotification: string;
  readonly customerReply: string;
  readonly issueUrl: string | null;
  readonly researchQuery: string | null;
  readonly researchReferences: readonly RunResearchReference[];
}

export interface RunResearchReference {
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly highlight: string;
}

export interface IssueReferenceAudit {
  readonly predictedIssueNumber: string;
  readonly actualIssueId: string | null;
  readonly actualIssueKey: string | null;
  readonly actualIssueNumber: string | null;
  readonly actualIssueUrl: string | null;
  readonly rewrittenAt: string | null;
}

export interface PreviewPlannedAction extends PlannedAction {
  readonly sourceWorkflowStepId: string;
  readonly application: SemanticEvent["sourceApplication"];
  readonly title: string;
  readonly detail: string;
  readonly adaptation?: RunAdaptation;
  readonly review?: HumanReviewRequest;
}

export interface PreviewRun extends AgentRun {
  readonly status:
    | "preview"
    | "preview_ready"
    | "needs_review"
    | "approved"
    | "executing"
    | "completed"
    | "failed"
    | "cancelled";
  readonly phase: "preview" | "executing" | "completed" | "failed";
  readonly previewStatus: "preview" | "preview_ready";
  readonly approved: boolean;
  readonly trigger: {
    readonly message: MailMessage;
    readonly event: SemanticEvent;
    readonly summary: string;
  };
  readonly summary: string;
  readonly understanding: IssueUnderstanding;
  readonly plannedActions: readonly PreviewPlannedAction[];
  readonly policyDecisions: readonly PolicyDecision[];
  readonly adaptations: readonly RunAdaptation[];
  readonly confidence: {
    readonly pattern: number;
    readonly understanding: number;
    readonly overall: number;
  };
  readonly risk: RunRisk;
  readonly reviewRequests: readonly HumanReviewRequest[];
  readonly resolutionErrors: readonly VariableResolutionError[];
  readonly resolvedValues: ResolvedRunValues;
  readonly issueReference: IssueReferenceAudit;
  readonly humanSelections: readonly HumanSelection[];
  readonly research: {
    readonly query: string | null;
    readonly references: readonly RunResearchReference[];
  };
}
