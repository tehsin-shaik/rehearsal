import { assessRunRisk } from "../policy/risk-assessment.ts";
import {
  isTeamOwner,
  routeOwner,
  type TeamOwner,
} from "../understanding/team-routing.ts";
import type {
  PreviewRun,
  HumanSelection,
  RunAdaptation,
} from "./preview-run-types.ts";
import {
  buildPreviewPlannedActions,
  preserveWorkflowStepIdentifiers,
} from "./preview-run-planner.ts";
import {
  composeCustomerReply,
  composeTeamNotification,
} from "./message-composition.ts";

function humanOwnerAdaptation(
  run: PreviewRun,
  owner: TeamOwner,
): RunAdaptation {
  return {
    field: "owner",
    from: run.resolvedValues.owner,
    to: owner,
    observedValue: run.resolvedValues.owner,
    adaptedValue: owner,
    rule: "human selection",
    reason: `${owner} was selected by a person to resolve the owner review.`,
    selectedByHuman: true,
  };
}

export function applyOwnerOverride(
  run: PreviewRun,
  owner: TeamOwner,
  selectedBy: string,
): PreviewRun {
  if (!isTeamOwner(owner)) {
    throw new TypeError(`Unknown team owner: ${String(owner)}`);
  }

  const normalizedSelectedBy = selectedBy.trim();
  if (normalizedSelectedBy.length === 0) {
    throw new RangeError("An owner override requires the selecting person.");
  }

  const route = routeOwner(owner);
  const teamNotification = composeTeamNotification({
    category: run.resolvedValues.category,
    customerName: run.resolvedValues.customerName,
    issueNumber: run.resolvedValues.issueNumber,
    owner,
    issueUrl: run.resolvedValues.issueUrl,
  });
  const customerReply = composeCustomerReply({
    customerName: run.resolvedValues.customerName,
    department: route.department,
    owner,
  });
  const resolvedValues = {
    ...run.resolvedValues,
    department: route.department,
    owner,
    ownerSource: "human",
    teamChannel: route.channel,
    teamNotification,
    customerReply,
  } as const;
  const resolutionErrors = run.resolutionErrors.filter(
    (error) => error.field !== "owner" && error.field !== "department",
  );
  const ownerAdaptation = humanOwnerAdaptation(run, owner);
  const adaptations = [
    ...run.adaptations.filter((adaptation) => adaptation.field !== "owner"),
    ownerAdaptation,
  ];
  const plannedActions = buildPreviewPlannedActions({
    workflowStepIds: preserveWorkflowStepIdentifiers(run.plannedActions),
    runId: run.id,
    values: resolvedValues,
    adaptations,
    resolutionErrors,
  });
  const humanSelection: HumanSelection = {
    field: "owner",
    value: owner,
    selectedBy: normalizedSelectedBy,
    rule: "human selection",
  };
  const pendingReview = resolutionErrors.length > 0;

  return {
    ...run,
    status: pendingReview ? "needs_review" : run.previewStatus,
    approved: false,
    approval: {
      status: "pending",
      approvedBy: null,
      approvedAt: null,
    },
    plannedActions,
    adaptations,
    risk: assessRunRisk({
      permissions: plannedActions.map((action) => action.permission),
      understandingConfidence: run.understanding.confidence.overall,
      pendingReview,
    }),
    reviewRequests: [],
    resolutionErrors,
    resolvedValues,
    humanSelections: [
      ...run.humanSelections.filter((selection) => selection.field !== "owner"),
      humanSelection,
    ],
    metrics: {
      ...run.metrics,
      humanInterventions: run.metrics.humanInterventions + 1,
    },
  };
}
