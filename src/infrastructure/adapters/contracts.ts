import type { ActionResult } from "../../domain/runs/action-result.ts";
import type {
  IssueCategory,
  IssueSeverity,
} from "../../domain/understanding/issue-understanding.ts";
import type {
  Department,
  TeamOwner,
} from "../../domain/understanding/team-routing.ts";

export interface AdapterOperationContext {
  readonly actionId: string;
  readonly idempotencyKey: string;
  readonly attemptedAt: string;
}

export interface IssueReference {
  readonly id: string;
  readonly key: string;
  readonly number: string;
  readonly url: string | null;
}

export interface IssueCreateInput extends AdapterOperationContext {
  readonly predictedIssueNumber: string;
  readonly title: string;
  readonly description: string;
  readonly category: IssueCategory;
  readonly department: Department;
  readonly severity: IssueSeverity;
  readonly labels: readonly string[];
  readonly customerName: string;
  readonly customerEmail: string;
  readonly researchReferences?: readonly {
    readonly title: string;
    readonly url: string;
  }[];
}

export interface IssueCreateResultData {
  readonly issue: IssueReference;
}

export interface IssueAssignmentInput extends AdapterOperationContext {
  readonly issue: IssueReference;
  readonly owner: TeamOwner;
}

export interface IssueAssignmentResultData {
  readonly issue: IssueReference;
  readonly owner: TeamOwner;
}

export interface RecentIssue {
  readonly issue: IssueReference;
  readonly title: string;
  readonly owner: TeamOwner | null;
  readonly labels: readonly string[];
}

export interface IssueTrackerAdapter {
  readonly id: string;
  readonly targetLabel: string;
  createIssue(
    input: IssueCreateInput,
  ): Promise<ActionResult<IssueCreateResultData>>;
  assignIssueOwner(
    input: IssueAssignmentInput,
  ): Promise<ActionResult<IssueAssignmentResultData>>;
  listRecentIssues?(): Promise<readonly RecentIssue[]>;
}

export interface TeamMessageInput extends AdapterOperationContext {
  readonly channel: string;
  readonly message: string;
}

export interface MessageDeliveryResultData {
  readonly deliveryId: string;
  readonly destination: string;
}

export interface MessagingAdapter {
  readonly id: string;
  readonly targetLabel: string;
  sendTeamMessage(
    input: TeamMessageInput,
  ): Promise<ActionResult<MessageDeliveryResultData>>;
}

export interface CustomerReplyInput extends AdapterOperationContext {
  readonly originatingMessageId: string;
  readonly recipient: string;
  readonly message: string;
}

export interface CustomerMailAdapter {
  readonly id: string;
  readonly targetLabel: string;
  sendCustomerReply(
    input: CustomerReplyInput,
  ): Promise<ActionResult<MessageDeliveryResultData>>;
}

export interface ExecutionAdapterBundle {
  readonly issueTracker: IssueTrackerAdapter;
  readonly messaging: MessagingAdapter;
  readonly customerMail: CustomerMailAdapter;
}
