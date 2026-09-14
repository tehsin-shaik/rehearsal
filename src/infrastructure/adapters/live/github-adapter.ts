import { z } from "zod";

import { isTeamOwner } from "../../../domain/understanding/team-routing.ts";
import {
  fetchJsonWithTimeout,
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
  failedActionResult,
  issueMarkdown,
  successfulActionResult,
} from "./adapter-result.ts";

const issueSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  number: z.number().int().positive(),
  title: z.string(),
  html_url: z.string().url(),
  labels: z.array(
    z.union([z.string(), z.object({ name: z.string().nullable().optional() })]),
  ),
  assignees: z
    .array(z.object({ login: z.string() }))
    .optional()
    .default([]),
  pull_request: z.unknown().optional(),
});

const issuesSchema = z.array(issueSchema);

export interface GitHubAdapterConfiguration {
  readonly token: string;
  readonly repository: string;
  readonly fetchImplementation?: FetchImplementation;
}

function parseRepository(repository: string): {
  readonly owner: string;
  readonly name: string;
} {
  const match = repository
    .trim()
    .match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new RangeError("GITHUB_REPO must use the owner/repository format.");
  }

  return { owner: match[1], name: match[2] };
}

export class GitHubIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id = "github";
  readonly targetLabel: string;
  readonly #configuration: GitHubAdapterConfiguration;
  readonly #repository: ReturnType<typeof parseRepository>;

  constructor(configuration: GitHubAdapterConfiguration) {
    this.#configuration = configuration;
    this.#repository = parseRepository(configuration.repository);
    this.targetLabel = `GitHub · ${configuration.repository}`;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    return fetchJsonWithTimeout(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.#configuration.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      timeoutMs: 8_000,
      fetchImplementation: this.#configuration.fetchImplementation,
    });
  }

  #repositoryPath(): string {
    return `/repos/${encodeURIComponent(this.#repository.owner)}/${encodeURIComponent(
      this.#repository.name,
    )}`;
  }

  async createIssue(input: IssueCreateInput) {
    const startedAt = performance.now();
    try {
      const response = await this.#request(`${this.#repositoryPath()}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          body: issueMarkdown(input),
          labels: [...input.labels],
        }),
      });
      const parsed = issueSchema.safeParse(response);
      if (!parsed.success) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "invalid_github_response",
          "GitHub created an issue but returned an invalid response.",
          false,
        );
      }

      const number = String(parsed.data.number);
      const key = `#${number}`;
      const data: IssueCreateResultData = {
        issue: {
          id: parsed.data.id,
          key,
          number,
          url: parsed.data.html_url,
        },
      };
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Created GitHub issue ${key}.`,
        data,
        parsed.data.html_url,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "github_create_failed",
        "GitHub did not confirm issue creation.",
        true,
      );
    }
  }

  async assignIssueOwner(input: IssueAssignmentInput) {
    const startedAt = performance.now();
    try {
      await this.#request(
        `${this.#repositoryPath()}/issues/${encodeURIComponent(
          input.issue.number,
        )}`,
        {
          method: "PATCH",
          body: JSON.stringify({ assignees: [input.owner] }),
        },
      );
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Assigned ${input.issue.key} to ${input.owner} in GitHub.`,
        { issue: input.issue, owner: input.owner },
        input.issue.url ?? undefined,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "github_assignment_failed",
        `GitHub could not assign ${input.issue.key} to the mapped login ${input.owner}.`,
        false,
      );
    }
  }

  async listRecentIssues(): Promise<readonly RecentIssue[]> {
    const response = await this.#request(
      `${this.#repositoryPath()}/issues?state=open&sort=updated&direction=desc&per_page=20`,
    );
    const parsed = issuesSchema.parse(response);
    return parsed
      .filter((issue) => issue.pull_request === undefined)
      .map((issue) => {
        const ownerName = issue.assignees[0]?.login;
        return {
          issue: {
            id: issue.id,
            key: `#${issue.number}`,
            number: String(issue.number),
            url: issue.html_url,
          },
          title: issue.title,
          owner:
            ownerName !== undefined && isTeamOwner(ownerName)
              ? ownerName
              : null,
          labels: issue.labels.flatMap((label) =>
            typeof label === "string" ||
            label.name === undefined ||
            label.name === null
              ? typeof label === "string"
                ? [label]
                : []
              : [label.name],
          ),
        };
      });
  }
}
