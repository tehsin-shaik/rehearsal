import type { ServerEnvironment } from "../../../config/environment-schema.ts";
import type {
  CustomerMailAdapter,
  ExecutionAdapterBundle,
  IssueTrackerAdapter,
  MessagingAdapter,
} from "../contracts.ts";
import {
  GmailImapSurface,
  GmailOAuthClient,
  type ReadOnlyMailSurface,
} from "../../mail/index.ts";
import {
  AmbiguousIssueTrackerAdapter,
  AmbiguousMessagingAdapter,
} from "./ambiguous-adapter.ts";
import { ClickUpIssueTrackerAdapter } from "./clickup-adapter.ts";
import { GitHubIssueTrackerAdapter } from "./github-adapter.ts";
import { JiraIssueTrackerAdapter } from "./jira-adapter.ts";
import { SlackMessagingAdapter } from "./slack-adapter.ts";
import {
  UnavailableCustomerMailAdapter,
  UnavailableIssueTrackerAdapter,
  UnavailableMessagingAdapter,
} from "./unavailable-adapters.ts";

export type TrackerProvider =
  "clickup" | "jira" | "ambiguous" | "github" | "ambiguous_sandbox";

export const TRACKER_PRECEDENCE: readonly TrackerProvider[] = [
  "clickup",
  "jira",
  "ambiguous",
  "github",
  "ambiguous_sandbox",
];

export interface TargetAvailability {
  readonly id: TrackerProvider;
  readonly label: string;
  readonly configured: boolean;
  readonly selected: boolean;
}

export interface LiveAdapterSelection {
  readonly adapters: ExecutionAdapterBundle;
  readonly selectedTracker: TrackerProvider | null;
  readonly trackers: readonly TargetAvailability[];
  readonly mailSurface: ReadOnlyMailSurface | null;
  readonly oauthClient: GmailOAuthClient | null;
}

function configuredTrackerProviders(
  environment: ServerEnvironment,
): Readonly<Record<TrackerProvider, boolean>> {
  return {
    clickup:
      environment.CLICKUP_API_KEY !== undefined &&
      environment.CLICKUP_LIST_ID !== undefined,
    jira:
      environment.JIRA_BASE_URL !== undefined &&
      environment.JIRA_EMAIL !== undefined &&
      environment.JIRA_API_TOKEN !== undefined &&
      environment.JIRA_PROJECT_KEY !== undefined,
    ambiguous:
      environment.AMBIGUOUS_API_KEY !== undefined &&
      environment.AMBIGUOUS_BASE_URL !== undefined,
    github:
      environment.GITHUB_TOKEN !== undefined &&
      environment.GITHUB_REPO !== undefined,
    ambiguous_sandbox:
      environment.AMBIGUOUS_SANDBOX &&
      environment.AMBIGUOUS_BASE_URL !== undefined,
  };
}

function selectedTrackerProvider(
  environment: ServerEnvironment,
  configured: Readonly<Record<TrackerProvider, boolean>>,
): TrackerProvider | null {
  if (environment.TRACKER !== undefined) {
    return environment.TRACKER;
  }

  return TRACKER_PRECEDENCE.find((provider) => configured[provider]) ?? null;
}

function requiredConfiguration(
  value: string | undefined,
  variableName: string,
): string {
  if (value === undefined) {
    throw new RangeError(`${variableName} is required for this adapter.`);
  }
  return value;
}

function createTracker(
  provider: TrackerProvider | null,
  environment: ServerEnvironment,
  configured: Readonly<Record<TrackerProvider, boolean>>,
): IssueTrackerAdapter {
  if (provider === null || !configured[provider]) {
    return new UnavailableIssueTrackerAdapter(
      provider === null
        ? undefined
        : `${provider.replaceAll("_", " ")} is not configured`,
    );
  }

  switch (provider) {
    case "clickup":
      return new ClickUpIssueTrackerAdapter({
        apiKey: requiredConfiguration(
          environment.CLICKUP_API_KEY,
          "CLICKUP_API_KEY",
        ),
        listId: requiredConfiguration(
          environment.CLICKUP_LIST_ID,
          "CLICKUP_LIST_ID",
        ),
        teamId: environment.CLICKUP_TEAM_ID,
        assignees: environment.CLICKUP_ASSIGNEES,
      });
    case "jira":
      return new JiraIssueTrackerAdapter({
        baseUrl: requiredConfiguration(
          environment.JIRA_BASE_URL,
          "JIRA_BASE_URL",
        ),
        email: requiredConfiguration(environment.JIRA_EMAIL, "JIRA_EMAIL"),
        apiToken: requiredConfiguration(
          environment.JIRA_API_TOKEN,
          "JIRA_API_TOKEN",
        ),
        projectKey: requiredConfiguration(
          environment.JIRA_PROJECT_KEY,
          "JIRA_PROJECT_KEY",
        ),
        issueType: environment.JIRA_ISSUE_TYPE ?? "Task",
        assignees: environment.JIRA_ASSIGNEES,
      });
    case "ambiguous":
      return new AmbiguousIssueTrackerAdapter({
        baseUrl: requiredConfiguration(
          environment.AMBIGUOUS_BASE_URL,
          "AMBIGUOUS_BASE_URL",
        ),
        apiKey: environment.AMBIGUOUS_API_KEY,
        sandbox: false,
        channelId: environment.AMBIGUOUS_CHANNEL_ID,
      });
    case "github":
      return new GitHubIssueTrackerAdapter({
        token: requiredConfiguration(environment.GITHUB_TOKEN, "GITHUB_TOKEN"),
        repository: requiredConfiguration(
          environment.GITHUB_REPO,
          "GITHUB_REPO",
        ),
      });
    case "ambiguous_sandbox":
      return new AmbiguousIssueTrackerAdapter({
        baseUrl: requiredConfiguration(
          environment.AMBIGUOUS_BASE_URL,
          "AMBIGUOUS_BASE_URL",
        ),
        sandbox: true,
        channelId: environment.AMBIGUOUS_CHANNEL_ID,
      });
  }
}

function createMessaging(
  provider: TrackerProvider | null,
  environment: ServerEnvironment,
): MessagingAdapter {
  if (
    environment.SLACK_WEBHOOK_URL !== undefined ||
    environment.SLACK_BOT_TOKEN !== undefined
  ) {
    return new SlackMessagingAdapter({
      webhookUrl: environment.SLACK_WEBHOOK_URL,
      botToken: environment.SLACK_BOT_TOKEN,
      areaChannels: environment.NEXT_PUBLIC_SLACK_AREA_CHANNELS,
    });
  }

  if (
    (provider === "ambiguous" || provider === "ambiguous_sandbox") &&
    environment.AMBIGUOUS_BASE_URL !== undefined &&
    environment.AMBIGUOUS_CHANNEL_ID !== undefined
  ) {
    return new AmbiguousMessagingAdapter({
      baseUrl: environment.AMBIGUOUS_BASE_URL,
      apiKey: environment.AMBIGUOUS_API_KEY,
      sandbox: provider === "ambiguous_sandbox",
      channelId: environment.AMBIGUOUS_CHANNEL_ID,
    });
  }

  return new UnavailableMessagingAdapter();
}

function createOAuthClient(
  environment: ServerEnvironment,
): GmailOAuthClient | null {
  if (
    environment.GOOGLE_CLIENT_ID === undefined ||
    environment.GOOGLE_CLIENT_SECRET === undefined ||
    environment.GOOGLE_REDIRECT_URI === undefined
  ) {
    return null;
  }

  return new GmailOAuthClient({
    clientId: environment.GOOGLE_CLIENT_ID,
    clientSecret: environment.GOOGLE_CLIENT_SECRET,
    redirectUri: environment.GOOGLE_REDIRECT_URI,
    address: environment.GMAIL_ADDRESS,
    query: environment.GMAIL_QUERY,
  });
}

async function selectMailSurface(
  environment: ServerEnvironment,
  oauthClient: GmailOAuthClient | null,
): Promise<ReadOnlyMailSurface | null> {
  if (oauthClient !== null && (await oauthClient.isConnected())) {
    return oauthClient;
  }

  if (
    environment.GMAIL_ADDRESS !== undefined &&
    environment.GMAIL_APP_PASSWORD !== undefined
  ) {
    return new GmailImapSurface({
      address: environment.GMAIL_ADDRESS,
      appPassword: environment.GMAIL_APP_PASSWORD,
      query: environment.GMAIL_QUERY,
    });
  }

  return null;
}

const TRACKER_LABELS: Readonly<Record<TrackerProvider, string>> = {
  clickup: "ClickUp",
  jira: "Jira Cloud",
  ambiguous: "Ambiguous workspace",
  github: "GitHub Issues",
  ambiguous_sandbox: "Ambiguous disposable sandbox",
};

export async function createLiveAdapterSelection(
  environment: ServerEnvironment,
): Promise<LiveAdapterSelection> {
  const configured = configuredTrackerProviders(environment);
  const selectedTracker = selectedTrackerProvider(environment, configured);
  const issueTracker = createTracker(selectedTracker, environment, configured);
  const messaging = createMessaging(selectedTracker, environment);
  const oauthClient = createOAuthClient(environment);
  const mailSurface = await selectMailSurface(environment, oauthClient);
  const customerMail: CustomerMailAdapter =
    oauthClient !== null && mailSurface === oauthClient
      ? oauthClient
      : new UnavailableCustomerMailAdapter();

  return {
    adapters: { issueTracker, messaging, customerMail },
    selectedTracker,
    trackers: TRACKER_PRECEDENCE.map((provider) => ({
      id: provider,
      label: TRACKER_LABELS[provider],
      configured: configured[provider],
      selected: provider === selectedTracker,
    })),
    mailSurface,
    oauthClient,
  };
}
