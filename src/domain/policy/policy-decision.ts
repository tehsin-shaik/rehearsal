import type { PermissionClass } from "./permission-policy.ts";

export interface PolicyDecision {
  readonly actionId: string;
  readonly permission?: PermissionClass;
  readonly effect: "allow" | "require_approval" | "block";
  readonly reason: string;
  readonly evaluatedAt: string;
  readonly approvalId?: string;
}
