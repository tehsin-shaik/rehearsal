import type { PolicyDecision } from "../policy/policy-decision.ts";
import type { IssueUnderstanding } from "../understanding/issue-understanding.ts";
import type { ActionResult } from "./action-result.ts";
import type { PlannedAction } from "./planned-action.ts";
export interface AgentRun {
    readonly id: string;
    readonly patternId: string;
    readonly triggerReportId: string;
    readonly status: "planning" | "ghost_run" | "needs_review" | "approved" | "executing" | "completed" | "failed" | "cancelled";
    readonly understanding: IssueUnderstanding;
    readonly plannedActions: readonly PlannedAction[];
    readonly policyDecisions: readonly PolicyDecision[];
    readonly approval: {
        readonly status: "pending" | "approved" | "rejected";
        readonly approvedBy: string | null;
        readonly approvedAt: string | null;
        readonly planDigest?: string;
    };
    readonly adaptations: readonly {
        readonly field: string;
        readonly from: unknown;
        readonly to: unknown;
        readonly rule: string;
    }[];
    readonly results: readonly ActionResult[];
    readonly metrics: {
        readonly estimatedActionsAvoided: number;
        readonly estimatedSecondsSaved: number;
        readonly humanInterventions: number;
    };
}
