import type {
  ActionResult,
  ActionResultError,
} from "../../domain/runs/action-result.ts";
import type {
  CustomerMailAdapter,
  CustomerReplyInput,
  ExecutionAdapterBundle,
  IssueAssignmentInput,
  IssueAssignmentResultData,
  IssueCreateInput,
  IssueCreateResultData,
  IssueReference,
  IssueTrackerAdapter,
  MessageDeliveryResultData,
  MessagingAdapter,
  RecentIssue,
  TeamMessageInput,
} from "../../infrastructure/adapters/contracts.ts";

export const DEMO_FAILURE_POINTS = [
  "issue_creation",
  "owner_assignment",
  "team_notification",
  "customer_reply",
] as const;

export type DemoFailurePoint = (typeof DEMO_FAILURE_POINTS)[number];

export type DemoFailureConfiguration = Partial<
  Readonly<Record<DemoFailurePoint, number | boolean>>
>;

export interface DemoIssue extends RecentIssue {
  readonly description: string;
  readonly department: string;
  readonly severity: string;
  readonly customerName: string;
  readonly customerEmail: string;
}

export interface DemoTeamMessage {
  readonly id: string;
  readonly channel: string;
  readonly message: string;
  readonly sentAt: string;
}

export interface DemoCustomerReply {
  readonly id: string;
  readonly originatingMessageId: string;
  readonly recipient: string;
  readonly message: string;
  readonly sentAt: string;
}

export interface DemoAdapterState {
  readonly issues: DemoIssue[];
  readonly teamMessages: DemoTeamMessage[];
  readonly customerReplies: DemoCustomerReply[];
}

export interface DemoFailureController {
  set(point: DemoFailurePoint, count?: number): void;
  clear(point?: DemoFailurePoint): void;
  remaining(point: DemoFailurePoint): number;
}

export interface DemoAdapterOptions {
  readonly failures?: DemoFailureConfiguration;
  readonly actualIssueNumber?: string;
  readonly actualIssueUrl?: string | null;
  readonly durationMs?: number;
}

export interface DemoAdapterHarness {
  readonly adapters: ExecutionAdapterBundle;
  readonly state: DemoAdapterState;
  readonly failures: DemoFailureController;
}

const MAX_DEMO_RECORDS = 500;
const MAX_DEMO_IDEMPOTENCY_RESULTS = 1_000;

function retainLatest<RecordValue>(records: RecordValue[]): void {
  if (records.length > MAX_DEMO_RECORDS) {
    records.splice(0, records.length - MAX_DEMO_RECORDS);
  }
}

function rememberSuccessfulResult<ResultData>(
  results: Map<string, ActionResult<ResultData>>,
  idempotencyKey: string,
  result: ActionResult<ResultData>,
): void {
  if (
    !results.has(idempotencyKey) &&
    results.size >= MAX_DEMO_IDEMPOTENCY_RESULTS
  ) {
    const oldestKey = results.keys().next().value;
    if (oldestKey !== undefined) {
      results.delete(oldestKey);
    }
  }
  results.set(idempotencyKey, result);
}

function completedAt(attemptedAt: string, durationMs: number): string {
  return new Date(new Date(attemptedAt).getTime() + durationMs).toISOString();
}

function succeeded<ResultData>(input: {
  readonly actionId: string;
  readonly idempotencyKey: string;
  readonly attemptedAt: string;
  readonly adapter: string;
  readonly durationMs: number;
  readonly summary: string;
  readonly data: ResultData;
  readonly externalReference?: string;
}): ActionResult<ResultData> {
  return {
    actionId: input.actionId,
    status: "succeeded",
    ok: true,
    summary: input.summary,
    data: input.data,
    adapter: input.adapter,
    durationMs: input.durationMs,
    attemptedAt: input.attemptedAt,
    completedAt: completedAt(input.attemptedAt, input.durationMs),
    idempotencyKey: input.idempotencyKey,
    ...(input.externalReference === undefined
      ? {}
      : { externalReference: input.externalReference }),
  };
}

function failed<ResultData = Readonly<Record<string, never>>>(input: {
  readonly actionId: string;
  readonly idempotencyKey: string;
  readonly attemptedAt: string;
  readonly adapter: string;
  readonly durationMs: number;
  readonly summary: string;
  readonly error: ActionResultError;
}): ActionResult<ResultData> {
  return {
    actionId: input.actionId,
    status: "failed",
    ok: false,
    summary: input.summary,
    adapter: input.adapter,
    durationMs: input.durationMs,
    attemptedAt: input.attemptedAt,
    completedAt: completedAt(input.attemptedAt, input.durationMs),
    idempotencyKey: input.idempotencyKey,
    error: input.error,
  };
}

class InMemoryFailureController implements DemoFailureController {
  private readonly failures = new Map<DemoFailurePoint, number>();

  constructor(configuration: DemoFailureConfiguration = {}) {
    for (const point of DEMO_FAILURE_POINTS) {
      const configured = configuration[point];
      if (configured === true) {
        this.failures.set(point, 1);
      } else if (typeof configured === "number" && configured > 0) {
        this.failures.set(point, Math.floor(configured));
      }
    }
  }

  set(point: DemoFailurePoint, count = 1): void {
    this.failures.set(point, Math.max(0, Math.floor(count)));
  }

  clear(point?: DemoFailurePoint): void {
    if (point === undefined) {
      this.failures.clear();
      return;
    }

    this.failures.delete(point);
  }

  remaining(point: DemoFailurePoint): number {
    return this.failures.get(point) ?? 0;
  }

  consume(point: DemoFailurePoint): boolean {
    const remaining = this.remaining(point);
    if (remaining === 0) {
      return false;
    }

    if (remaining === 1) {
      this.failures.delete(point);
    } else {
      this.failures.set(point, remaining - 1);
    }

    return true;
  }
}

class InMemoryIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id = "demo-issue-tracker";
  readonly targetLabel = "Rehearsal Demo Issue Tracker";
  private readonly successfulResults = new Map<string, ActionResult<unknown>>();
  private readonly state: DemoAdapterState;
  private readonly failures: InMemoryFailureController;
  private issueSequence = 0;
  private readonly options: Required<
    Pick<DemoAdapterOptions, "durationMs" | "actualIssueNumber">
  > &
    Pick<DemoAdapterOptions, "actualIssueUrl">;

  constructor(
    state: DemoAdapterState,
    failures: InMemoryFailureController,
    options: Required<
      Pick<DemoAdapterOptions, "durationMs" | "actualIssueNumber">
    > &
      Pick<DemoAdapterOptions, "actualIssueUrl">,
  ) {
    this.state = state;
    this.failures = failures;
    this.options = options;
  }

  async createIssue(
    input: IssueCreateInput,
  ): Promise<ActionResult<IssueCreateResultData>> {
    const previous = this.successfulResults.get(input.idempotencyKey);
    if (previous !== undefined) {
      return previous as ActionResult<IssueCreateResultData>;
    }

    if (this.failures.consume("issue_creation")) {
      return failed({
        ...input,
        adapter: this.id,
        durationMs: this.options.durationMs,
        summary: "Demo issue creation failed as configured.",
        error: {
          code: "demo_issue_creation_failure",
          message: "Issue creation was deliberately failed for this demo run.",
          retryable: true,
        },
      });
    }

    const issueNumber = this.options.actualIssueNumber;
    this.issueSequence += 1;
    const issue: IssueReference = {
      id: `demo-issue-${String(this.issueSequence).padStart(3, "0")}`,
      key: issueNumber,
      number: issueNumber,
      url:
        this.options.actualIssueUrl === undefined
          ? `https://demo.rehearsal.local/issues/${issueNumber}`
          : this.options.actualIssueUrl,
    };
    this.state.issues.push({
      issue,
      title: input.title,
      description: input.description,
      department: input.department,
      severity: input.severity,
      owner: null,
      labels: [...input.labels],
      customerName: input.customerName,
      customerEmail: input.customerEmail,
    });
    retainLatest(this.state.issues);
    const result = succeeded({
      ...input,
      adapter: this.id,
      durationMs: this.options.durationMs,
      summary: `Created ${issue.key}.`,
      data: { issue },
      externalReference: issue.url ?? issue.id,
    });
    rememberSuccessfulResult(
      this.successfulResults,
      input.idempotencyKey,
      result,
    );
    return result;
  }

  async assignIssueOwner(
    input: IssueAssignmentInput,
  ): Promise<ActionResult<IssueAssignmentResultData>> {
    const previous = this.successfulResults.get(input.idempotencyKey);
    if (previous !== undefined) {
      return previous as ActionResult<IssueAssignmentResultData>;
    }

    if (this.failures.consume("owner_assignment")) {
      return failed({
        ...input,
        adapter: this.id,
        durationMs: this.options.durationMs,
        summary: "Demo owner assignment failed as configured.",
        error: {
          code: "demo_owner_assignment_failure",
          message:
            "Owner assignment was deliberately failed for this demo run.",
          retryable: true,
        },
      });
    }

    const issueIndex = this.state.issues.findIndex(
      (candidate) => candidate.issue.id === input.issue.id,
    );
    if (issueIndex === -1) {
      return failed({
        ...input,
        adapter: this.id,
        durationMs: this.options.durationMs,
        summary: "The demo issue could not be found for assignment.",
        error: {
          code: "demo_issue_not_found",
          message: `No issue exists with ID ${input.issue.id}.`,
          retryable: false,
        },
      });
    }

    const existingIssue = this.state.issues[issueIndex];
    if (existingIssue === undefined) {
      throw new RangeError("The selected demo issue unexpectedly disappeared.");
    }

    this.state.issues[issueIndex] = { ...existingIssue, owner: input.owner };
    const result = succeeded({
      ...input,
      adapter: this.id,
      durationMs: this.options.durationMs,
      summary: `Assigned ${input.issue.key} to ${input.owner}.`,
      data: { issue: input.issue, owner: input.owner },
      externalReference: input.issue.url ?? input.issue.id,
    });
    rememberSuccessfulResult(
      this.successfulResults,
      input.idempotencyKey,
      result,
    );
    return result;
  }

  async listRecentIssues(): Promise<readonly RecentIssue[]> {
    return this.state.issues.slice(-20).map((issue) => ({
      issue: { ...issue.issue },
      title: issue.title,
      owner: issue.owner,
      labels: [...issue.labels],
    }));
  }
}

class InMemoryMessagingAdapter implements MessagingAdapter {
  readonly id = "demo-team-chat";
  readonly targetLabel = "Rehearsal Demo Team Chat";
  private readonly successfulResults = new Map<
    string,
    ActionResult<MessageDeliveryResultData>
  >();
  private readonly state: DemoAdapterState;
  private readonly failures: InMemoryFailureController;
  private readonly durationMs: number;
  private messageSequence = 0;

  constructor(
    state: DemoAdapterState,
    failures: InMemoryFailureController,
    durationMs: number,
  ) {
    this.state = state;
    this.failures = failures;
    this.durationMs = durationMs;
  }

  async sendTeamMessage(
    input: TeamMessageInput,
  ): Promise<ActionResult<MessageDeliveryResultData>> {
    const previous = this.successfulResults.get(input.idempotencyKey);
    if (previous !== undefined) {
      return previous;
    }

    if (this.failures.consume("team_notification")) {
      return failed({
        ...input,
        adapter: this.id,
        durationMs: this.durationMs,
        summary: "Demo team notification failed as configured.",
        error: {
          code: "demo_team_notification_failure",
          message:
            "Team notification was deliberately failed for this demo run.",
          retryable: true,
        },
      });
    }

    this.messageSequence += 1;
    const deliveryId = `demo-team-message-${String(this.messageSequence).padStart(3, "0")}`;
    this.state.teamMessages.push({
      id: deliveryId,
      channel: input.channel,
      message: input.message,
      sentAt: completedAt(input.attemptedAt, this.durationMs),
    });
    retainLatest(this.state.teamMessages);
    const result = succeeded({
      ...input,
      adapter: this.id,
      durationMs: this.durationMs,
      summary: `Sent a team notification to ${input.channel}.`,
      data: { deliveryId, destination: input.channel },
      externalReference: deliveryId,
    });
    rememberSuccessfulResult(
      this.successfulResults,
      input.idempotencyKey,
      result,
    );
    return result;
  }
}

class InMemoryCustomerMailAdapter implements CustomerMailAdapter {
  readonly id = "demo-customer-mail";
  readonly targetLabel = "Rehearsal Demo Mail";
  private readonly successfulResults = new Map<
    string,
    ActionResult<MessageDeliveryResultData>
  >();
  private readonly state: DemoAdapterState;
  private readonly failures: InMemoryFailureController;
  private readonly durationMs: number;
  private replySequence = 0;

  constructor(
    state: DemoAdapterState,
    failures: InMemoryFailureController,
    durationMs: number,
  ) {
    this.state = state;
    this.failures = failures;
    this.durationMs = durationMs;
  }

  async sendCustomerReply(
    input: CustomerReplyInput,
  ): Promise<ActionResult<MessageDeliveryResultData>> {
    const previous = this.successfulResults.get(input.idempotencyKey);
    if (previous !== undefined) {
      return previous;
    }

    if (this.failures.consume("customer_reply")) {
      return failed({
        ...input,
        adapter: this.id,
        durationMs: this.durationMs,
        summary: "Demo customer reply failed as configured.",
        error: {
          code: "demo_customer_reply_failure",
          message: "Customer reply was deliberately failed for this demo run.",
          retryable: true,
        },
      });
    }

    this.replySequence += 1;
    const deliveryId = `demo-customer-reply-${String(this.replySequence).padStart(3, "0")}`;
    this.state.customerReplies.push({
      id: deliveryId,
      originatingMessageId: input.originatingMessageId,
      recipient: input.recipient,
      message: input.message,
      sentAt: completedAt(input.attemptedAt, this.durationMs),
    });
    retainLatest(this.state.customerReplies);
    const result = succeeded({
      ...input,
      adapter: this.id,
      durationMs: this.durationMs,
      summary: `Sent a customer reply to ${input.recipient}.`,
      data: { deliveryId, destination: input.recipient },
      externalReference: deliveryId,
    });
    rememberSuccessfulResult(
      this.successfulResults,
      input.idempotencyKey,
      result,
    );
    return result;
  }
}

export function createDemoAdapterHarness(
  options: DemoAdapterOptions = {},
): DemoAdapterHarness {
  const state: DemoAdapterState = {
    issues: [],
    teamMessages: [],
    customerReplies: [],
  };
  const failures = new InMemoryFailureController(options.failures);
  const durationMs = options.durationMs ?? 12;
  const issueTracker = new InMemoryIssueTrackerAdapter(state, failures, {
    durationMs,
    actualIssueNumber: options.actualIssueNumber ?? "SUP-1001",
    ...(options.actualIssueUrl === undefined
      ? {}
      : { actualIssueUrl: options.actualIssueUrl }),
  });
  const messaging = new InMemoryMessagingAdapter(state, failures, durationMs);
  const customerMail = new InMemoryCustomerMailAdapter(
    state,
    failures,
    durationMs,
  );

  return {
    adapters: { issueTracker, messaging, customerMail },
    state,
    failures,
  };
}
