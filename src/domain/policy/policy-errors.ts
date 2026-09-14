import type { PermissionClass } from "./permission-policy.ts";

export type PolicyErrorCode =
  | "blocked_permission"
  | "approval_required"
  | "pending_review"
  | "unresolved_value";

export class PolicyError extends Error {
  readonly code: PolicyErrorCode;
  readonly actionId: string;
  readonly permission: PermissionClass;

  constructor(
    message: string,
    code: PolicyErrorCode,
    actionId: string,
    permission: PermissionClass,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.actionId = actionId;
    this.permission = permission;
  }
}

export class BlockedPermissionError extends PolicyError {
  constructor(actionId: string, permission: PermissionClass) {
    super(
      `${permission} is blocked by policy for action ${actionId}.`,
      "blocked_permission",
      actionId,
      permission,
    );
  }
}

export class ApprovalRequiredError extends PolicyError {
  constructor(actionId: string, permission: PermissionClass) {
    super(
      `Approval is required for ${permission} action ${actionId}.`,
      "approval_required",
      actionId,
      permission,
    );
  }
}

export class PendingReviewError extends PolicyError {
  constructor(actionId: string, permission: PermissionClass) {
    super(
      `Human review is pending for action ${actionId}.`,
      "pending_review",
      actionId,
      permission,
    );
  }
}

export class UnresolvedValueError extends PolicyError {
  constructor(actionId: string, permission: PermissionClass) {
    super(
      `A required value remains unresolved for action ${actionId}.`,
      "unresolved_value",
      actionId,
      permission,
    );
  }
}
