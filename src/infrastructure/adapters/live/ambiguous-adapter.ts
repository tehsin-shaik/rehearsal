import { z } from "zod";

import { isTeamOwner } from "../../../domain/understanding/team-routing.ts";
import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  type FetchImplementation,
} from "../../http/index.ts";
import type {
  IssueAssignmentInput,
  IssueCreateInput,
  IssueCreateResultData,
  IssueTrackerAdapter,
  MessagingAdapter,
  RecentIssue,
  TeamMessageInput,
} from "../contracts.ts";
import {
  failedActionResult,
  issueMarkdown,
  successfulActionResult,
} from "./adapter-result.ts";

const sandboxSessionSchema = z.object({
  session_id: z.string(),
  token: z.string(),
});

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url().optional(),
  owner: z.string().nullable().optional(),
  metadata: z
    .object({ routed_owner: z.string().nullable().optional() })
    .optional(),
  labels: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

const taskListSchema = z.union([
  z.array(taskSchema),
  z.object({ tasks: z.array(taskSchema) }).transform((value) => value.tasks),
]);

const messageSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
});

function unwrapData(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Readonly<Record<string, unknown>>;
  return record.data ?? value;
}

export interface AmbiguousAdapterConfiguration {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly sandbox: boolean;
  readonly channelId?: string;
  readonly fetchImplementation?: FetchImplementation;
}

class AmbiguousClient {
  readonly #baseUrl: string;
  readonly #configuration: AmbiguousAdapterConfiguration;
  #sandboxSession: { readonly id: string; readonly token: string } | null =
    null;

  constructor(configuration: AmbiguousAdapterConfiguration) {
    const url = new URL(configuration.baseUrl);
    this.#baseUrl = url.toString().replace(/\/+$/, "");
    this.#configuration = configuration;
  }

  async #authorizationToken(): Promise<string> {
    if (this.#configuration.apiKey !== undefined) {
      return this.#configuration.apiKey;
    }

    if (!this.#configuration.sandbox) {
      throw new Error("Ambiguous workspace credentials are not configured.");
    }

    if (this.#sandboxSession !== null) {
      return this.#sandboxSession.token;
    }

    const response = await fetchJsonWithTimeout(
      `${this.#baseUrl}/api/sandbox/sessions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "rehearsal-verification" }),
        timeoutMs: 8_000,
        fetchImplementation: this.#configuration.fetchImplementation,
      },
    );
    const parsed = sandboxSessionSchema.parse(unwrapData(response));
    this.#sandboxSession = { id: parsed.session_id, token: parsed.token };
    return parsed.token;
  }

  async requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.#authorizationToken();
    return fetchJsonWithTimeout(`${this.#baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      timeoutMs: 8_000,
      fetchImplementation: this.#configuration.fetchImplementation,
    });
  }

  taskUrl(taskId: string): string {
    return `${this.#baseUrl}/tasks/${encodeURIComponent(taskId)}`;
  }

  async revokeSandbox(): Promise<boolean> {
    if (this.#sandboxSession === null) {
      return true;
    }

    const session = this.#sandboxSession;
    try {
      await fetchWithTimeout(
        `${this.#baseUrl}/api/sandbox/sessions/${encodeURIComponent(session.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.token}` },
          timeoutMs: 8_000,
          fetchImplementation: this.#configuration.fetchImplementation,
        },
      );
      this.#sandboxSession = null;
      return true;
    } catch {
      return false;
    }
  }
}

export class AmbiguousIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id: string;
  readonly targetLabel: string;
  readonly #client: AmbiguousClient;

  constructor(configuration: AmbiguousAdapterConfiguration) {
    this.#client = new AmbiguousClient(configuration);
    this.id = configuration.sandbox ? "ambiguous-sandbox" : "ambiguous";
    this.targetLabel = configuration.sandbox
      ? "Ambiguous disposable sandbox"
      : "Ambiguous workspace";
  }

  async createIssue(input: IssueCreateInput) {
    const startedAt = performance.now();
    try {
      const response = await this.#client.requestJson("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          description: issueMarkdown(input),
          status: "open",
          priority: input.severity,
          tags: [...input.labels],
          metadata: {
            category: input.category,
            department: input.department,
            predicted_issue_number: input.predictedIssueNumber,
          },
        }),
      });
      const parsed = taskSchema.safeParse(unwrapData(response));
      if (!parsed.success) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "invalid_ambiguous_response",
          "Ambiguous created a task but returned an invalid response.",
          false,
        );
      }

      const readBack = taskSchema.safeParse(
        unwrapData(
          await this.#client.requestJson(
            `/api/tasks/${encodeURIComponent(parsed.data.id)}`,
          ),
        ),
      );
      if (!readBack.success || readBack.data.id !== parsed.data.id) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "ambiguous_readback_failed",
          "Ambiguous did not provide read-back confirmation for the new task.",
          false,
        );
      }

      const url = parsed.data.url ?? this.#client.taskUrl(parsed.data.id);
      const data: IssueCreateResultData = {
        issue: {
          id: parsed.data.id,
          key: parsed.data.id,
          number: parsed.data.id,
          url,
        },
      };
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Created Ambiguous task ${parsed.data.id}.`,
        data,
        url,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "ambiguous_create_failed",
        "Ambiguous did not confirm task creation.",
        true,
      );
    }
  }

  async assignIssueOwner(input: IssueAssignmentInput) {
    const startedAt = performance.now();
    try {
      await this.#client.requestJson(
        `/api/tasks/${encodeURIComponent(input.issue.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            owner: input.owner,
            metadata: { routed_owner: input.owner },
          }),
        },
      );
      const readBack = taskSchema.safeParse(
        unwrapData(
          await this.#client.requestJson(
            `/api/tasks/${encodeURIComponent(input.issue.id)}`,
          ),
        ),
      );
      if (
        !readBack.success ||
        (readBack.data.owner !== input.owner &&
          readBack.data.metadata?.routed_owner !== input.owner)
      ) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "ambiguous_assignment_unverified",
          "Ambiguous did not provide read-back confirmation for the owner record.",
          false,
        );
      }

      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Recorded ${input.owner} as owner for ${input.issue.key} in Ambiguous.`,
        { issue: input.issue, owner: input.owner },
        input.issue.url ?? undefined,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "ambiguous_assignment_failed",
        "Ambiguous did not confirm the owner record.",
        true,
      );
    }
  }

  async listRecentIssues(): Promise<readonly RecentIssue[]> {
    const response = await this.#client.requestJson("/api/tasks?limit=20");
    const tasks = taskListSchema.parse(unwrapData(response));
    return tasks.map((task) => ({
      issue: {
        id: task.id,
        key: task.id,
        number: task.id,
        url: task.url ?? this.#client.taskUrl(task.id),
      },
      title: task.title,
      owner:
        task.owner !== undefined &&
        task.owner !== null &&
        isTeamOwner(task.owner)
          ? task.owner
          : null,
      labels: task.labels ?? task.tags ?? [],
    }));
  }

  revokeSandbox(): Promise<boolean> {
    return this.#client.revokeSandbox();
  }
}

export class AmbiguousMessagingAdapter implements MessagingAdapter {
  readonly id: string;
  readonly targetLabel: string;
  readonly #channelId: string;
  readonly #client: AmbiguousClient;

  constructor(
    configuration: AmbiguousAdapterConfiguration & {
      readonly channelId: string;
    },
  ) {
    this.#client = new AmbiguousClient(configuration);
    this.#channelId = configuration.channelId;
    this.id = configuration.sandbox
      ? "ambiguous-sandbox-chat"
      : "ambiguous-chat";
    this.targetLabel = configuration.sandbox
      ? "Ambiguous sandbox channel"
      : "Ambiguous workspace channel";
  }

  async sendTeamMessage(input: TeamMessageInput) {
    const startedAt = performance.now();
    try {
      const response = await this.#client.requestJson(
        `/api/channels/${encodeURIComponent(this.#channelId)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: input.message }),
        },
      );
      const parsed = messageSchema.safeParse(unwrapData(response));
      if (!parsed.success) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "invalid_ambiguous_message_response",
          "Ambiguous did not confirm channel delivery.",
          false,
        );
      }

      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Sent a message to the Ambiguous channel ${this.#channelId}.`,
        { deliveryId: parsed.data.id, destination: this.#channelId },
        parsed.data.id,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "ambiguous_message_failed",
        "Ambiguous did not confirm channel delivery.",
        true,
      );
    }
  }
}
