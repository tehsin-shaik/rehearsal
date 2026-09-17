import assert from "node:assert/strict";
import test from "node:test";

import { readServerEnvironment } from "../../src/config/environment-schema.ts";
import { ApprovalRequiredError } from "../../src/domain/policy/policy-errors.ts";
import type { ActionResult } from "../../src/domain/runs/action-result.ts";
import type {
  ExecutionAdapterBundle,
  IssueCreateResultData,
} from "../../src/infrastructure/adapters/contracts.ts";
import { createLiveAdapterSelection } from "../../src/infrastructure/adapters/live/adapter-factory.ts";
import { AmbiguousIssueTrackerAdapter } from "../../src/infrastructure/adapters/live/ambiguous-adapter.ts";
import { ClickUpIssueTrackerAdapter } from "../../src/infrastructure/adapters/live/clickup-adapter.ts";
import { SlackMessagingAdapter } from "../../src/infrastructure/adapters/live/slack-adapter.ts";
import {
  authorizeRemoteAction,
  executeOneRemoteAction,
} from "../../src/infrastructure/execution/remote-action-executor.ts";
import { executeActionRequestSchema } from "../../src/infrastructure/validation/api-schemas.ts";

function configuredTrackers(overrides: Record<string, string> = {}) {
  return readServerEnvironment({
    DEMO_MODE: "false",
    NEXT_PUBLIC_DEMO_MODE: "false",
    CLICKUP_API_KEY: "clickup-test-key",
    CLICKUP_LIST_ID: "123",
    JIRA_BASE_URL: "https://example.atlassian.net",
    JIRA_EMAIL: "test@example.test",
    JIRA_API_TOKEN: "jira-test-token",
    JIRA_PROJECT_KEY: "SUP",
    ...overrides,
  });
}

function createIssueRequest(
  overrides: {
    readonly approved?: boolean;
    readonly approvalId?: string;
    readonly idempotencyKey?: string;
  } = {},
) {
  return executeActionRequestSchema.parse({
    action: "create_issue",
    actionId: "action-live-create",
    idempotencyKey: overrides.idempotencyKey ?? "live-create-once",
    approved: overrides.approved ?? true,
    ...(overrides.approvalId === undefined
      ? {}
      : { approvalId: overrides.approvalId }),
    input: {
      predictedIssueNumber: "SUP-42",
      title: "Duplicate billing charge",
      description: "The customer reports a duplicate charge.",
      category: "billing",
      department: "billing",
      severity: "high",
      labels: ["billing", "duplicate-charge"],
      customerName: "Test Customer",
      customerEmail: "customer@example.test",
    },
  });
}

test("tracker selection uses deterministic precedence and explicit override", async () => {
  const defaultSelection =
    await createLiveAdapterSelection(configuredTrackers());
  assert.equal(defaultSelection.selectedTracker, "clickup");
  assert.equal(defaultSelection.adapters.issueTracker.id, "clickup");

  const overriddenSelection = await createLiveAdapterSelection(
    configuredTrackers({ TRACKER: "jira" }),
  );
  assert.equal(overriddenSelection.selectedTracker, "jira");
  assert.equal(overriddenSelection.adapters.issueTracker.id, "jira");
});

test("an explicit unconfigured tracker fails closed", async () => {
  const selection = await createLiveAdapterSelection(
    configuredTrackers({ TRACKER: "github" }),
  );
  assert.equal(selection.selectedTracker, "github");
  assert.equal(selection.adapters.issueTracker.id, "unavailable-issue-tracker");
  assert.equal(
    selection.trackers.find((tracker) => tracker.id === "github")?.configured,
    false,
  );
});

test("Slack webhook success requires Slack's exact confirmation", async () => {
  const rejectedAdapter = new SlackMessagingAdapter({
    webhookUrl: "https://hooks.slack.test/services/example",
    fetchImplementation: async () => new Response("accepted", { status: 200 }),
  });
  const rejected = await rejectedAdapter.sendTeamMessage({
    actionId: "action-slack-rejected",
    idempotencyKey: "slack-rejected",
    attemptedAt: "2026-01-01T00:00:00.000Z",
    channel: "#billing",
    message: "A support issue is ready.",
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, "failed");

  const confirmedAdapter = new SlackMessagingAdapter({
    webhookUrl: "https://hooks.slack.test/services/example",
    fetchImplementation: async () => new Response("ok", { status: 200 }),
  });
  const confirmed = await confirmedAdapter.sendTeamMessage({
    actionId: "action-slack-confirmed",
    idempotencyKey: "slack-confirmed",
    attemptedAt: "2026-01-01T00:00:01.000Z",
    channel: "#billing",
    message: "A support issue is ready.",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.status, "succeeded");
});

test("ClickUp member IDs resolve to Rehearsal owner names", async () => {
  const adapter = new ClickUpIssueTrackerAdapter({
    apiKey: "clickup-test-key",
    listId: "123",
    assignees: JSON.stringify({ Tehsin: "42" }),
    fetchImplementation: async () =>
      new Response(
        JSON.stringify({
          tasks: [
            {
              id: "task-42",
              name: "Duplicate billing charge",
              url: "https://app.clickup.test/t/task-42",
              tags: [{ name: "billing" }],
              assignees: [
                {
                  id: 42,
                  username: "tehsin.workspace",
                  email: "tehsin@example.test",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const issues = await adapter.listRecentIssues();

  assert.equal(issues[0]?.owner, "Tehsin");
});

test("Ambiguous owner assignment requires matching read-back evidence", async () => {
  const adapter = new AmbiguousIssueTrackerAdapter({
    baseUrl: "https://ambiguous.example.test",
    apiKey: "ambiguous-test-key",
    sandbox: false,
    fetchImplementation: async (_input, init) => {
      const body =
        init?.method === "PATCH"
          ? { id: "task-42", title: "Duplicate charge" }
          : {
              id: "task-42",
              title: "Duplicate charge",
              owner: "Elyes",
              metadata: { routed_owner: "Elyes" },
            };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await adapter.assignIssueOwner({
    actionId: "action-ambiguous-assign",
    idempotencyKey: "ambiguous-assign-readback",
    attemptedAt: "2026-01-01T00:00:00.000Z",
    issue: {
      id: "task-42",
      key: "task-42",
      number: "task-42",
      url: "https://ambiguous.example.test/tasks/task-42",
    },
    owner: "Tehsin",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "ambiguous_assignment_unverified");
});

test("remote execution requires approval evidence", () => {
  assert.throws(
    () => authorizeRemoteAction(createIssueRequest({ approved: false })),
    ApprovalRequiredError,
  );
  assert.throws(
    () => authorizeRemoteAction(createIssueRequest({ approved: true })),
    ApprovalRequiredError,
  );
  assert.equal(
    authorizeRemoteAction(
      createIssueRequest({ approved: true, approvalId: "run-approved" }),
    ).effect,
    "allow",
  );
});

test("server execution idempotency calls a remote create operation once", async () => {
  let createCount = 0;
  const adapters: ExecutionAdapterBundle = {
    issueTracker: {
      id: "test-tracker",
      targetLabel: "Test tracker",
      async createIssue(input): Promise<ActionResult<IssueCreateResultData>> {
        createCount += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return {
          actionId: input.actionId,
          status: "succeeded",
          ok: true,
          summary: "Created one test issue.",
          data: {
            issue: {
              id: "issue-42",
              key: "SUP-42",
              number: "42",
              url: "https://tracker.example.test/SUP-42",
            },
          },
          adapter: "test-tracker",
          durationMs: 0,
          attemptedAt: input.attemptedAt,
          completedAt: input.attemptedAt,
          idempotencyKey: input.idempotencyKey,
        };
      },
      async assignIssueOwner() {
        throw new Error("Unexpected assignment call.");
      },
    },
    messaging: {
      id: "test-messaging",
      targetLabel: "Test messaging",
      async sendTeamMessage() {
        throw new Error("Unexpected messaging call.");
      },
    },
    customerMail: {
      id: "test-mail",
      targetLabel: "Test mail",
      async sendCustomerReply() {
        throw new Error("Unexpected mail call.");
      },
    },
  };
  const request = createIssueRequest({
    approved: true,
    approvalId: "run-idempotent",
    idempotencyKey: "live-create-idempotency-test",
  });

  const [first, second] = await Promise.all([
    executeOneRemoteAction(request, adapters),
    executeOneRemoteAction(request, adapters),
  ]);
  assert.equal(first.result.ok, true);
  assert.deepEqual(second.result, first.result);
  assert.equal(createCount, 1);
});
