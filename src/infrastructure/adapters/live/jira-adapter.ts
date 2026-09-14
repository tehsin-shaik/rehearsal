import { z } from "zod";

import {
  isTeamOwner,
  type TeamOwner,
} from "../../../domain/understanding/team-routing.ts";
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
  RecentIssue,
} from "../contracts.ts";
import {
  configuredOwnerIdentifiers,
  failedActionResult,
  issueMarkdown,
  successfulActionResult,
} from "./adapter-result.ts";

const createResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string().url().optional(),
});

const issueTypesSchema = z.object({
  values: z.array(z.object({ id: z.string(), name: z.string() })),
});

const prioritiesSchema = z.array(
  z.object({ id: z.string(), name: z.string() }),
);

const assignableUsersSchema = z.array(
  z.object({
    accountId: z.string(),
    displayName: z.string(),
    emailAddress: z.string().optional(),
  }),
);

const searchResponseSchema = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      fields: z.object({
        summary: z.string(),
        labels: z.array(z.string()).optional().default([]),
        assignee: z.object({ displayName: z.string() }).nullable().optional(),
      }),
    }),
  ),
});

export interface JiraAdapterConfiguration {
  readonly baseUrl: string;
  readonly email: string;
  readonly apiToken: string;
  readonly projectKey: string;
  readonly issueType: string;
  readonly assignees?: string;
  readonly fetchImplementation?: FetchImplementation;
}

function textDocument(markdown: string) {
  return {
    type: "doc",
    version: 1,
    content: markdown.split(/\n{2,}/).map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph.replace(/\n/g, " ") }],
    })),
  } as const;
}

function preferredPriorityNames(
  severity: IssueCreateInput["severity"],
): readonly string[] {
  switch (severity) {
    case "high":
      return ["highest", "high"];
    case "medium":
      return ["medium"];
    case "low":
    case "unresolved":
      return ["low", "lowest"];
  }
}

export class JiraIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id = "jira";
  readonly targetLabel = "Jira Cloud";
  readonly #configuration: JiraAdapterConfiguration;
  readonly #baseUrl: string;
  readonly #authorization: string;
  readonly #ownerIdentifiers: Readonly<Record<string, string>>;

  constructor(configuration: JiraAdapterConfiguration) {
    this.#configuration = configuration;
    this.#baseUrl = configuration.baseUrl.replace(/\/+$/, "");
    this.#authorization = `Basic ${Buffer.from(
      `${configuration.email}:${configuration.apiToken}`,
    ).toString("base64")}`;
    this.#ownerIdentifiers = configuredOwnerIdentifiers(
      configuration.assignees,
    );
  }

  #requestOptions(init: RequestInit): RequestInit & {
    timeoutMs: number;
    fetchImplementation?: FetchImplementation;
  } {
    return {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: this.#authorization,
        "Content-Type": "application/json",
        ...init.headers,
      },
      timeoutMs: 8_000,
      fetchImplementation: this.#configuration.fetchImplementation,
    };
  }

  async #requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
    return fetchJsonWithTimeout(
      `${this.#baseUrl}${path}`,
      this.#requestOptions(init),
    );
  }

  async #resolveIssueType(): Promise<{
    readonly id?: string;
    readonly name?: string;
  }> {
    try {
      const response = await this.#requestJson(
        `/rest/api/3/issue/createmeta/${encodeURIComponent(
          this.#configuration.projectKey,
        )}/issuetypes`,
      );
      const parsed = issueTypesSchema.safeParse(response);
      const issueType = parsed.success
        ? parsed.data.values.find(
            (candidate) =>
              candidate.name.toLowerCase() ===
              this.#configuration.issueType.toLowerCase(),
          )
        : undefined;
      return issueType === undefined
        ? { name: this.#configuration.issueType }
        : { id: issueType.id };
    } catch {
      return { name: this.#configuration.issueType };
    }
  }

  async #resolvePriority(
    severity: IssueCreateInput["severity"],
  ): Promise<{ readonly id: string } | undefined> {
    try {
      const parsed = prioritiesSchema.safeParse(
        await this.#requestJson("/rest/api/3/priority"),
      );
      if (!parsed.success) {
        return undefined;
      }

      const candidates = preferredPriorityNames(severity);
      const priority = parsed.data.find((entry) =>
        candidates.includes(entry.name.toLowerCase()),
      );
      return priority === undefined ? undefined : { id: priority.id };
    } catch {
      return undefined;
    }
  }

  async #resolveOwner(owner: TeamOwner): Promise<string | null> {
    const configured = this.#ownerIdentifiers[owner];
    if (configured !== undefined) {
      return configured;
    }

    const query = new URLSearchParams({
      project: this.#configuration.projectKey,
      query: owner,
      maxResults: "50",
    });
    const parsed = assignableUsersSchema.safeParse(
      await this.#requestJson(
        `/rest/api/3/user/assignable/search?${query.toString()}`,
      ),
    );
    if (!parsed.success) {
      return null;
    }

    const normalizedOwner = owner.toLowerCase();
    const match = parsed.data.find((user) => {
      const emailName = user.emailAddress?.split("@")[0]?.toLowerCase();
      return (
        user.displayName.toLowerCase() === normalizedOwner ||
        emailName === normalizedOwner
      );
    });
    return match?.accountId ?? null;
  }

  async createIssue(input: IssueCreateInput) {
    const startedAt = performance.now();
    try {
      const [issueType, priority] = await Promise.all([
        this.#resolveIssueType(),
        this.#resolvePriority(input.severity),
      ]);
      const response = await this.#requestJson("/rest/api/3/issue", {
        method: "POST",
        body: JSON.stringify({
          fields: {
            project: { key: this.#configuration.projectKey },
            issuetype: issueType,
            summary: input.title,
            description: textDocument(issueMarkdown(input)),
            labels: [...input.labels],
            ...(priority === undefined ? {} : { priority }),
          },
        }),
      });
      const parsed = createResponseSchema.safeParse(response);
      if (!parsed.success) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "invalid_jira_response",
          "Jira created an issue but returned an invalid response.",
          false,
        );
      }

      const number = parsed.data.key.split("-").at(-1) ?? parsed.data.key;
      const url = `${this.#baseUrl}/browse/${encodeURIComponent(parsed.data.key)}`;
      const data: IssueCreateResultData = {
        issue: { id: parsed.data.id, key: parsed.data.key, number, url },
      };
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Created Jira issue ${parsed.data.key}.`,
        data,
        url,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "jira_create_failed",
        "Jira did not confirm issue creation.",
        true,
      );
    }
  }

  async assignIssueOwner(input: IssueAssignmentInput) {
    const startedAt = performance.now();
    try {
      const accountId = await this.#resolveOwner(input.owner);
      if (accountId === null) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "jira_owner_unresolved",
          `No Jira account mapping was found for ${input.owner}.`,
          false,
        );
      }

      await fetchWithTimeout(
        `${this.#baseUrl}/rest/api/3/issue/${encodeURIComponent(
          input.issue.key,
        )}/assignee`,
        this.#requestOptions({
          method: "PUT",
          body: JSON.stringify({ accountId }),
        }),
      );
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Assigned ${input.issue.key} to ${input.owner} in Jira.`,
        { issue: input.issue, owner: input.owner },
        input.issue.url ?? undefined,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "jira_assignment_failed",
        "Jira did not confirm the owner assignment.",
        true,
      );
    }
  }

  async listRecentIssues(): Promise<readonly RecentIssue[]> {
    const query = new URLSearchParams({
      jql: `project = ${this.#configuration.projectKey} ORDER BY created DESC`,
      maxResults: "20",
      fields: "summary,labels,assignee",
    });
    const response = await this.#requestJson(
      `/rest/api/3/search/jql?${query.toString()}`,
    );
    const parsed = searchResponseSchema.parse(response);
    return parsed.issues.map((issue) => {
      const ownerName = issue.fields.assignee?.displayName;
      return {
        issue: {
          id: issue.id,
          key: issue.key,
          number: issue.key.split("-").at(-1) ?? issue.key,
          url: `${this.#baseUrl}/browse/${encodeURIComponent(issue.key)}`,
        },
        title: issue.fields.summary,
        owner:
          ownerName !== undefined && isTeamOwner(ownerName) ? ownerName : null,
        labels: issue.fields.labels,
      };
    });
  }
}
