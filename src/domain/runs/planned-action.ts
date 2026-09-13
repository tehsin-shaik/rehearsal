export interface PlannedAction {
    readonly id: string;
    readonly sequence: number;
    readonly action: "analyze_report" | "create_issue" | "assign_owner" | "send_team_notification" | "reply_to_customer";
    readonly permission: "read" | "analyze" | "draft" | "create_external" | "send_message" | "delete" | "payment";
    readonly destination: string;
    readonly resolvedInput: Readonly<Record<string, unknown>>;
    readonly risk: "low" | "medium" | "high";
    readonly requiresApproval: boolean;
    readonly status: "planned" | "approved" | "blocked" | "executing" | "completed" | "failed" | "not_attempted" | "needs_review";
    readonly idempotencyKey: string;
}
