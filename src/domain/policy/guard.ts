import type { PlannedAction } from "../runs/planned-action.ts";
import type { PolicyDecision } from "./policy-decision.ts";

export type PermissionClass = PlannedAction["permission"];
export const ACTION_PERMISSIONS = { analyze_report: "analyze", create_issue: "create_external", assign_owner: "create_external", send_team_notification: "send_message", reply_to_customer: "send_message" } as const;

export function checkPolicy(permission: PermissionClass, approved: boolean, resolved = true): Pick<PolicyDecision,"effect"|"reason"> {
  if (permission === "payment") return { effect: "block", reason: "Payments are disabled in this release." };
  if (!resolved) return { effect: "block", reason: "Required values need human review." };
  if (["read", "analyze", "draft"].includes(permission)) return { effect: "allow", reason: "Read, analysis, and local drafts have no external side effects." };
  if (!["create_external", "send_message", "delete"].includes(permission)) return { effect: "block", reason: "Unknown permission." };
  return approved ? { effect: "allow", reason: "Explicit approval covers this resolved action." } : { effect: "require_approval", reason: "A human must approve this external change." };
}

export function evaluateAction(action: PlannedAction, approved: boolean, resolved = true): PolicyDecision {
  const permission = ACTION_PERMISSIONS[action.action];
  const decision = permission === action.permission ? checkPolicy(permission, approved, resolved) : { effect: "block" as const, reason: "Action permission does not match the enforced taxonomy." };
  return { actionId: action.id, ...decision, evaluatedAt: new Date().toISOString() };
}
