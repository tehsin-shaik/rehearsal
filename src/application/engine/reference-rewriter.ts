import type { PreviewPlannedAction } from "../../domain/runs/preview-run-types.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import { composeTeamNotification } from "../../domain/runs/message-composition.ts";
import type { IssueReference } from "../../infrastructure/adapters/contracts.ts";

function rewriteAction(
  action: PreviewPlannedAction,
  issue: IssueReference,
  teamNotification: string,
): PreviewPlannedAction {
  switch (action.action) {
    case "create_issue":
      return {
        ...action,
        destination: issue.url ?? `issue_tracker:${issue.key}`,
        detail: `Created issue ${issue.key}.`,
      };
    case "assign_owner":
      return {
        ...action,
        destination: issue.url ?? `issue_tracker:${issue.key}`,
        detail:
          typeof action.resolvedInput.owner === "string"
            ? `Assign ${issue.key} to ${action.resolvedInput.owner}.`
            : `Select an owner for ${issue.key}.`,
        resolvedInput: {
          ...action.resolvedInput,
          issueNumber: issue.number,
          issueId: issue.id,
          issueKey: issue.key,
          ...(issue.url === null ? {} : { issueUrl: issue.url }),
        },
      };
    case "prepare_team_notification":
      return {
        ...action,
        resolvedInput: {
          ...action.resolvedInput,
          issueNumber: issue.number,
          issueId: issue.id,
          issueKey: issue.key,
          message: teamNotification,
          ...(issue.url === null ? {} : { issueUrl: issue.url }),
        },
      };
    case "send_team_notification":
      return {
        ...action,
        resolvedInput: {
          ...action.resolvedInput,
          message: teamNotification,
        },
      };
    default:
      return action;
  }
}

export function rewriteRunIssueReference(
  run: PreviewRun,
  issue: IssueReference,
  rewrittenAt: string,
): PreviewRun {
  const teamNotification = composeTeamNotification({
    category: run.resolvedValues.category,
    customerName: run.resolvedValues.customerName,
    issueNumber: issue.number,
    owner: run.resolvedValues.owner,
    issueUrl: issue.url,
  });

  return {
    ...run,
    resolvedValues: {
      ...run.resolvedValues,
      issueNumber: issue.number,
      issueUrl: issue.url,
      teamNotification,
    },
    plannedActions: run.plannedActions.map((action) =>
      rewriteAction(action, issue, teamNotification),
    ),
    issueReference: {
      ...run.issueReference,
      actualIssueId: issue.id,
      actualIssueKey: issue.key,
      actualIssueNumber: issue.number,
      actualIssueUrl: issue.url,
      rewrittenAt,
    },
  };
}
