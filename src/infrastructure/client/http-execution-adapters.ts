import { z } from "zod";

import type { ActionResult } from "../../domain/runs/action-result.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import type {
  CustomerMailAdapter,
  CustomerReplyInput,
  ExecutionAdapterBundle,
  IssueAssignmentInput,
  IssueAssignmentResultData,
  IssueCreateInput,
  IssueCreateResultData,
  IssueTrackerAdapter,
  MessageDeliveryResultData,
  MessagingAdapter,
  TeamMessageInput,
} from "../adapters/contracts.ts";
import { failedActionResult } from "../adapters/live/adapter-result.ts";
import { fetchJsonWithTimeout } from "../http/fetch-with-timeout.ts";

const actionResultSchema = z.object({
  actionId: z.string(),
  status: z.enum(["succeeded", "failed", "not_attempted"]),
  ok: z.boolean(),
  summary: z.string(),
  data: z.unknown().optional(),
  adapter: z.string(),
  durationMs: z.number().nonnegative(),
  attemptedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  idempotencyKey: z.string(),
  externalReference: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    })
    .optional(),
});

const executeResponseSchema = z.object({ result: actionResultSchema });

interface HttpAdapterOptions {
  readonly approvalId: string;
  readonly trackerTarget: string;
  readonly messagingTarget: string;
  readonly mailTarget: string;
}

async function executeThroughServer<ResultData>(
  action:
    | "create_issue"
    | "assign_owner"
    | "send_team_notification"
    | "reply_to_customer",
  input:
    | IssueCreateInput
    | IssueAssignmentInput
    | TeamMessageInput
    | CustomerReplyInput,
  approvalId: string,
): Promise<ActionResult<ResultData>> {
  const startedAt = performance.now();
  try {
    const actionInput = Object.fromEntries(
      Object.entries(input).filter(
        ([field]) =>
          !["actionId", "idempotencyKey", "attemptedAt"].includes(field),
      ),
    );
    const response = await fetchJsonWithTimeout("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        actionId: input.actionId,
        idempotencyKey: input.idempotencyKey,
        approved: true,
        approvalId,
        input: actionInput,
      }),
      timeoutMs: 12_000,
    });
    return executeResponseSchema.parse(response)
      .result as ActionResult<ResultData>;
  } catch {
    return failedActionResult<ResultData>(
      input,
      "rehearsal-server",
      startedAt,
      "server_execution_failed",
      "The Rehearsal server did not confirm the remote action.",
      true,
    );
  }
}

class HttpIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id = "rehearsal-http-tracker";
  readonly targetLabel: string;
  readonly #approvalId: string;

  constructor(options: HttpAdapterOptions) {
    this.#approvalId = options.approvalId;
    this.targetLabel = options.trackerTarget;
  }

  createIssue(input: IssueCreateInput) {
    return executeThroughServer<IssueCreateResultData>(
      "create_issue",
      input,
      this.#approvalId,
    );
  }

  assignIssueOwner(input: IssueAssignmentInput) {
    return executeThroughServer<IssueAssignmentResultData>(
      "assign_owner",
      input,
      this.#approvalId,
    );
  }
}

class HttpMessagingAdapter implements MessagingAdapter {
  readonly id = "rehearsal-http-messaging";
  readonly targetLabel: string;
  readonly #approvalId: string;

  constructor(options: HttpAdapterOptions) {
    this.#approvalId = options.approvalId;
    this.targetLabel = options.messagingTarget;
  }

  sendTeamMessage(input: TeamMessageInput) {
    return executeThroughServer<MessageDeliveryResultData>(
      "send_team_notification",
      input,
      this.#approvalId,
    );
  }
}

class HttpCustomerMailAdapter implements CustomerMailAdapter {
  readonly id = "rehearsal-http-mail";
  readonly targetLabel: string;
  readonly #approvalId: string;

  constructor(options: HttpAdapterOptions) {
    this.#approvalId = options.approvalId;
    this.targetLabel = options.mailTarget;
  }

  sendCustomerReply(input: CustomerReplyInput) {
    return executeThroughServer<MessageDeliveryResultData>(
      "reply_to_customer",
      input,
      this.#approvalId,
    );
  }
}

export function createHttpExecutionAdapterBundle(
  run: PreviewRun,
  targets: Omit<HttpAdapterOptions, "approvalId">,
): ExecutionAdapterBundle {
  const options: HttpAdapterOptions = {
    ...targets,
    approvalId: run.id,
  };
  return {
    issueTracker: new HttpIssueTrackerAdapter(options),
    messaging: new HttpMessagingAdapter(options),
    customerMail: new HttpCustomerMailAdapter(options),
  };
}

export function sendConfirmedTeamMessage(input: TeamMessageInput) {
  return executeThroughServer<MessageDeliveryResultData>(
    "send_team_notification",
    input,
    `manual:${input.actionId}`,
  );
}
