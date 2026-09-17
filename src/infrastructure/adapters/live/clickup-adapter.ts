import { z } from "zod";

import type {
  IssueAssignmentInput,
  IssueCreateInput,
  IssueCreateResultData,
  IssueTrackerAdapter,
  RecentIssue,
} from "../contracts.ts";
import {
  isTeamOwner,
  type TeamOwner,
} from "../../../domain/understanding/team-routing.ts";
import {
  fetchJsonWithTimeout,
  type FetchImplementation,
} from "../../http/index.ts";
import {
  configuredOwnerIdentifiers,
  failedActionResult,
  issueMarkdown,
  successfulActionResult,
} from "./adapter-result.ts";

const clickUpAssigneeSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  username: z.string().optional(),
  email: z.string().optional(),
});

const taskSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  custom_id: z.string().nullable().optional(),
  name: z.string(),
  url: z.string().url().nullable().optional(),
  tags: z
    .array(z.object({ name: z.string() }))
    .optional()
    .default([]),
  assignees: z.array(clickUpAssigneeSchema).optional().default([]),
});

const tasksSchema = z.object({ tasks: z.array(taskSchema) });

const teamsSchema = z.object({
  teams: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).transform(String),
      members: z.array(
        z.object({
          user: z.object({
            id: z.union([z.number(), z.string()]).transform(String),
            username: z.string().optional(),
            email: z.string().optional(),
          }),
        }),
      ),
    }),
  ),
});

export interface ClickUpAdapterConfiguration {
  readonly apiKey: string;
  readonly listId: string;
  readonly teamId?: string;
  readonly assignees?: string;
  readonly fetchImplementation?: FetchImplementation;
}

function clickUpPriority(severity: IssueCreateInput["severity"]): number {
  switch (severity) {
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    case "unresolved":
      return 4;
  }
}

function resolvedTeamOwner(
  assignee: z.infer<typeof clickUpAssigneeSchema> | undefined,
  ownerIdentifiers: Readonly<Record<string, string>>,
): TeamOwner | null {
  if (assignee === undefined) {
    return null;
  }

  if (assignee.id !== undefined) {
    const mappedName = Object.entries(ownerIdentifiers).find(
      ([, identifier]) => identifier === assignee.id,
    )?.[0];
    if (mappedName !== undefined && isTeamOwner(mappedName)) {
      return mappedName;
    }
  }

  const candidates = [assignee.username, assignee.email?.split("@")[0]];
  return (
    candidates.find(
      (candidate): candidate is TeamOwner =>
        candidate !== undefined && isTeamOwner(candidate),
    ) ?? null
  );
}

export class ClickUpIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly id = "clickup";
  readonly targetLabel = "ClickUp";
  readonly #configuration: ClickUpAdapterConfiguration;
  readonly #ownerIdentifiers: Readonly<Record<string, string>>;

  constructor(configuration: ClickUpAdapterConfiguration) {
    this.#configuration = configuration;
    this.#ownerIdentifiers = configuredOwnerIdentifiers(
      configuration.assignees,
    );
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    return fetchJsonWithTimeout(`https://api.clickup.com/api/v2${path}`, {
      ...init,
      headers: {
        Authorization: this.#configuration.apiKey,
        "Content-Type": "application/json",
        ...init.headers,
      },
      timeoutMs: 8_000,
      fetchImplementation: this.#configuration.fetchImplementation,
    });
  }

  async #resolveOwner(owner: TeamOwner): Promise<string | null> {
    const configured = this.#ownerIdentifiers[owner];
    if (configured !== undefined) {
      return configured;
    }

    const response = await this.#request("/team");
    const parsed = teamsSchema.safeParse(response);
    if (!parsed.success) {
      return null;
    }

    const normalizedOwner = owner.toLowerCase();
    const workspaces =
      this.#configuration.teamId === undefined
        ? parsed.data.teams
        : parsed.data.teams.filter(
            (workspace) => workspace.id === this.#configuration.teamId,
          );
    const member = workspaces
      .flatMap((team) => team.members)
      .find((candidate) => {
        const username = candidate.user.username?.toLowerCase();
        const emailName = candidate.user.email?.split("@")[0]?.toLowerCase();
        return username === normalizedOwner || emailName === normalizedOwner;
      });
    return member?.user.id ?? null;
  }

  async createIssue(input: IssueCreateInput) {
    const startedAt = performance.now();
    try {
      const response = await this.#request(
        `/list/${encodeURIComponent(this.#configuration.listId)}/task`,
        {
          method: "POST",
          body: JSON.stringify({
            name: input.title,
            markdown_content: issueMarkdown(input),
            tags: [...input.labels],
            priority: clickUpPriority(input.severity),
            notify_all: false,
          }),
        },
      );
      const parsed = taskSchema.safeParse(response);
      if (!parsed.success) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "invalid_clickup_response",
          "ClickUp created a task but returned an invalid response.",
          false,
        );
      }

      const key = parsed.data.custom_id ?? parsed.data.id;
      const data: IssueCreateResultData = {
        issue: {
          id: parsed.data.id,
          key,
          number: key,
          url: parsed.data.url ?? null,
        },
      };
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Created ClickUp task ${key}.`,
        data,
        parsed.data.url ?? undefined,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "clickup_create_failed",
        "ClickUp did not confirm task creation.",
        true,
      );
    }
  }

  async assignIssueOwner(input: IssueAssignmentInput) {
    const startedAt = performance.now();
    try {
      const ownerIdentifier = await this.#resolveOwner(input.owner);
      if (ownerIdentifier === null) {
        return failedActionResult(
          input,
          this.id,
          startedAt,
          "clickup_owner_unresolved",
          `No ClickUp member mapping was found for ${input.owner}.`,
          false,
        );
      }

      const numericIdentifier = Number(ownerIdentifier);
      await this.#request(`/task/${encodeURIComponent(input.issue.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          assignees: {
            add: [
              Number.isSafeInteger(numericIdentifier)
                ? numericIdentifier
                : ownerIdentifier,
            ],
          },
        }),
      });
      return successfulActionResult(
        input,
        this.id,
        startedAt,
        `Assigned ${input.issue.key} to ${input.owner} in ClickUp.`,
        { issue: input.issue, owner: input.owner },
        input.issue.url ?? undefined,
      );
    } catch {
      return failedActionResult(
        input,
        this.id,
        startedAt,
        "clickup_assignment_failed",
        "ClickUp did not confirm the owner assignment.",
        true,
      );
    }
  }

  async listRecentIssues(): Promise<readonly RecentIssue[]> {
    const response = await this.#request(
      `/list/${encodeURIComponent(this.#configuration.listId)}/task?archived=false&page=0`,
    );
    const parsed = tasksSchema.parse(response);
    return parsed.tasks.slice(0, 20).map((task) => {
      const key = task.custom_id ?? task.id;
      return {
        issue: {
          id: task.id,
          key,
          number: key,
          url: task.url ?? null,
        },
        title: task.name,
        owner: resolvedTeamOwner(task.assignees[0], this.#ownerIdentifiers),
        labels: task.tags.map((tag) => tag.name),
      };
    });
  }
}
