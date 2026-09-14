import type {
  IssueCategory,
  IssueUnderstanding,
} from "../understanding/issue-understanding.ts";
import {
  routeDepartment,
  type Department,
  type TeamOwner,
} from "../understanding/team-routing.ts";

export interface TeamNotificationInput {
  readonly category: IssueCategory;
  readonly customerName: string | null;
  readonly issueNumber: string;
  readonly owner: TeamOwner | null;
  readonly issueUrl?: string | null;
}

export interface CustomerReplyInput {
  readonly customerName: string | null;
  readonly department: Department;
  readonly owner?: TeamOwner | null;
}

function readableLabel(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function composeTeamNotification(input: TeamNotificationInput): string {
  const customerName = input.customerName ?? "Unknown customer";
  const ownerDetail =
    input.owner === null
      ? "Owner requires human review."
      : `Proposed owner: ${input.owner}.`;
  const issueLink =
    input.issueUrl === undefined || input.issueUrl === null
      ? ""
      : ` ${input.issueUrl}`;

  return `${readableLabel(input.category)} support report from ${customerName}. Proposed issue ${input.issueNumber}. ${ownerDetail}${issueLink}`;
}

export function composeCustomerReply(input: CustomerReplyInput): string {
  const customerName = input.customerName ?? "there";
  const route = routeDepartment(input.department);
  const routingDetail =
    input.department === "unresolved"
      ? "A team member will review it and determine the responsible department."
      : `The ${route.departmentName} team is responsible for reviewing it.${
          input.owner === undefined || input.owner === null
            ? ""
            : ` ${input.owner} is the proposed owner.`
        }`;

  return `Hello ${customerName}, we received your support report. ${routingDetail} We will follow up after review.`;
}

export function composeMessagesForUnderstanding(
  understanding: IssueUnderstanding,
  issueNumber: string,
  owner: TeamOwner | null,
  issueUrl?: string | null,
): { readonly teamNotification: string; readonly customerReply: string } {
  return {
    teamNotification: composeTeamNotification({
      category: understanding.issue.category,
      customerName: understanding.customer.name,
      issueNumber,
      owner,
      ...(issueUrl === undefined ? {} : { issueUrl }),
    }),
    customerReply: composeCustomerReply({
      customerName: understanding.customer.name,
      department: understanding.issue.department,
      owner,
    }),
  };
}
