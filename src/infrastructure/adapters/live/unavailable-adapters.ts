import type {
  CustomerMailAdapter,
  CustomerReplyInput,
  IssueAssignmentInput,
  IssueCreateInput,
  IssueTrackerAdapter,
  MessagingAdapter,
  TeamMessageInput,
} from "../contracts.ts";
import { failedActionResult } from "./adapter-result.ts";

export class UnavailableIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id = "unavailable-issue-tracker";
  readonly targetLabel: string;

  constructor(targetLabel = "No issue tracker configured") {
    this.targetLabel = targetLabel;
  }

  async createIssue(input: IssueCreateInput) {
    return failedActionResult(
      input,
      this.id,
      performance.now(),
      "tracker_not_configured",
      "No live issue tracker is configured.",
      false,
    );
  }

  async assignIssueOwner(input: IssueAssignmentInput) {
    return failedActionResult(
      input,
      this.id,
      performance.now(),
      "tracker_not_configured",
      "No live issue tracker is configured.",
      false,
    );
  }
}

export class UnavailableMessagingAdapter implements MessagingAdapter {
  readonly id = "unavailable-messaging";
  readonly targetLabel = "No messaging target configured";

  async sendTeamMessage(input: TeamMessageInput) {
    return failedActionResult(
      input,
      this.id,
      performance.now(),
      "messaging_not_configured",
      "No live messaging target is configured.",
      false,
    );
  }
}

export class UnavailableCustomerMailAdapter implements CustomerMailAdapter {
  readonly id = "unavailable-customer-mail";
  readonly targetLabel = "No authorized mail sender configured";

  async sendCustomerReply(input: CustomerReplyInput) {
    return failedActionResult(
      input,
      this.id,
      performance.now(),
      "mail_not_configured",
      "No authorized customer-mail sender is configured.",
      false,
    );
  }
}
