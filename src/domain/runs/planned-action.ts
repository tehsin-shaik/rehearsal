import type { PermissionClass } from "../policy/permission-policy.ts";

export type PlannedSemanticAction =
  | "read_email"
  | "extract_issue_details"
  | "classify_issue"
  | "draft_ticket"
  | "apply_labels"
  | "create_issue"
  | "assign_owner"
  | "prepare_team_notification"
  | "send_team_notification"
  | "reply_to_customer"
  | "analyze_report"
  | "delete_external"
  | "make_payment";

export interface PlannedAction {
  readonly id: string;
  readonly sequence: number;
  readonly action: PlannedSemanticAction;
  readonly permission: PermissionClass;
  readonly destination: string;
  readonly resolvedInput: Readonly<Record<string, unknown>>;
  readonly risk: "low" | "medium" | "high" | "blocked";
  readonly requiresApproval: boolean;
  readonly status:
    | "planned"
    | "approved"
    | "blocked"
    | "running"
    | "executing"
    | "succeeded"
    | "completed"
    | "failed"
    | "skipped"
    | "not_attempted"
    | "needs_review";
  readonly idempotencyKey: string;
}
