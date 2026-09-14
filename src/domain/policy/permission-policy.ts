import type { PolicyDecision } from "./policy-decision.ts";
import type { PlannedSemanticAction } from "../runs/planned-action.ts";

export const PERMISSION_CLASSES = [
  "read",
  "analyze",
  "draft",
  "create_external",
  "send_message",
  "delete",
  "payment",
] as const;

export type PermissionClass = (typeof PERMISSION_CLASSES)[number];

export interface PermissionMetadata {
  readonly permission: PermissionClass;
  readonly allowed: boolean;
  readonly approvalRequired: boolean;
  readonly description: string;
}

export const PERMISSION_POLICY = {
  read: {
    permission: "read",
    allowed: true,
    approvalRequired: false,
    description: "Reading existing information is allowed without approval.",
  },
  analyze: {
    permission: "analyze",
    allowed: true,
    approvalRequired: false,
    description: "Local analysis is allowed without approval.",
  },
  draft: {
    permission: "draft",
    allowed: true,
    approvalRequired: false,
    description: "Preparing a draft is allowed without approval.",
  },
  create_external: {
    permission: "create_external",
    allowed: true,
    approvalRequired: true,
    description: "Creating or changing external records requires approval.",
  },
  send_message: {
    permission: "send_message",
    allowed: true,
    approvalRequired: true,
    description: "Sending an external message requires approval.",
  },
  delete: {
    permission: "delete",
    allowed: true,
    approvalRequired: true,
    description: "Deleting external data requires approval.",
  },
  payment: {
    permission: "payment",
    allowed: false,
    approvalRequired: false,
    description: "Payment actions are blocked in the MVP.",
  },
} as const satisfies Record<PermissionClass, PermissionMetadata>;

export const ACTION_PERMISSION_MAP = {
  read_email: "read",
  extract_issue_details: "analyze",
  classify_issue: "analyze",
  draft_ticket: "draft",
  apply_labels: "draft",
  create_issue: "create_external",
  assign_owner: "create_external",
  prepare_team_notification: "draft",
  send_team_notification: "send_message",
  reply_to_customer: "send_message",
  analyze_report: "analyze",
  delete_external: "delete",
  make_payment: "payment",
} as const satisfies Record<PlannedSemanticAction, PermissionClass>;

export interface PolicyEvaluationInput {
  readonly actionId: string;
  readonly permission: PermissionClass;
  readonly approved: boolean;
  readonly evaluatedAt: string;
  readonly approvalId?: string;
}

export function getPermissionMetadata(
  permission: PermissionClass,
): PermissionMetadata {
  return PERMISSION_POLICY[permission];
}

export function permissionRequiresApproval(
  permission: PermissionClass,
): boolean {
  return getPermissionMetadata(permission).approvalRequired;
}

export function permissionForAction(
  action: PlannedSemanticAction,
): PermissionClass {
  return ACTION_PERMISSION_MAP[action];
}

export function createPolicyDecision(
  input: PolicyEvaluationInput,
): PolicyDecision {
  const metadata = getPermissionMetadata(input.permission);

  if (!metadata.allowed) {
    return {
      actionId: input.actionId,
      permission: input.permission,
      effect: "block",
      reason: metadata.description,
      evaluatedAt: input.evaluatedAt,
    };
  }

  if (metadata.approvalRequired && !input.approved) {
    return {
      actionId: input.actionId,
      permission: input.permission,
      effect: "require_approval",
      reason: metadata.description,
      evaluatedAt: input.evaluatedAt,
    };
  }

  return {
    actionId: input.actionId,
    permission: input.permission,
    effect: "allow",
    reason: metadata.approvalRequired
      ? "The required approval is present."
      : metadata.description,
    evaluatedAt: input.evaluatedAt,
    ...(input.approvalId === undefined ? {} : { approvalId: input.approvalId }),
  };
}
