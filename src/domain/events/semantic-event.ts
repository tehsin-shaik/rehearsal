export interface SemanticEvent {
  readonly id: string;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly sourceApplication: "mail" | "issue_tracker" | "team_chat" | "system";
  readonly action:
    | "report_received"
    | "read_report"
    | "classify_report"
    | "create_issue"
    | "assign_owner"
    | "send_team_notification"
    | "reply_to_customer";
  readonly intent: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly confidence: number;
  readonly origin: "observed" | "inferred" | "executed";
  readonly estimatedEffortSeconds: number;
}
