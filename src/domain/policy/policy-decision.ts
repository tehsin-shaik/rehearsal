export interface PolicyDecision {
  readonly actionId: string;
  readonly effect: "allow" | "require_approval" | "block";
  readonly reason: string;
  readonly evaluatedAt: string;
  readonly approvalId?: string;
}
