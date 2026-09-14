import type { PermissionClass } from "./permission-policy.ts";

export type RunRisk = "low" | "medium" | "high" | "blocked";

export interface RiskAssessmentInput {
  readonly permissions: readonly PermissionClass[];
  readonly understandingConfidence: number;
  readonly pendingReview: boolean;
}

const RISK_RANK: Readonly<Record<RunRisk, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  blocked: 3,
};

function highestRisk(left: RunRisk, right: RunRisk): RunRisk {
  return RISK_RANK[left] >= RISK_RANK[right] ? left : right;
}

function permissionRisk(permission: PermissionClass): RunRisk {
  if (permission === "payment") {
    return "blocked";
  }

  if (permission === "delete") {
    return "high";
  }

  return "low";
}

export function assessRunRisk(input: RiskAssessmentInput): RunRisk {
  const permissionLevel = input.permissions.reduce<RunRisk>(
    (risk, permission) => highestRisk(risk, permissionRisk(permission)),
    "low",
  );
  const uncertaintyLevel =
    input.pendingReview || input.understandingConfidence < 0.75
      ? "medium"
      : "low";

  return highestRisk(permissionLevel, uncertaintyLevel);
}

export function assessActionRisk(
  permission: PermissionClass,
  pendingReview = false,
): RunRisk {
  return assessRunRisk({
    permissions: [permission],
    understandingConfidence: 1,
    pendingReview,
  });
}
