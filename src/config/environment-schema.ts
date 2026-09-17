import { z } from "zod";

const optionalString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).optional(),
);

const environmentBoolean = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .default("true")
  .transform((value) => value === "true" || value === "1" || value === "yes");

const disabledByDefaultBoolean = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .default("false")
  .transform((value) => value === "true" || value === "1" || value === "yes");

export const serverEnvironmentSchema = z
  .object({
    DEMO_MODE: environmentBoolean,
    NEXT_PUBLIC_DEMO_MODE: environmentBoolean,
    OPENROUTER_API_KEY: optionalString,
    OPENROUTER_MODEL: optionalString,
    OPENROUTER_FALLBACK_MODELS: optionalString,
    OPENROUTER_SITE_URL: optionalString,
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: optionalString,
    GEMINI_API_KEY: optionalString,
    GEMINI_MODEL: optionalString,
    EXA_API_KEY: optionalString,
    GMAIL_ADDRESS: optionalString,
    GMAIL_APP_PASSWORD: optionalString,
    GMAIL_QUERY: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GOOGLE_REDIRECT_URI: optionalString,
    CLICKUP_API_KEY: optionalString,
    CLICKUP_LIST_ID: optionalString,
    CLICKUP_TEAM_ID: optionalString,
    CLICKUP_ASSIGNEES: optionalString,
    JIRA_BASE_URL: optionalString,
    JIRA_EMAIL: optionalString,
    JIRA_API_TOKEN: optionalString,
    JIRA_PROJECT_KEY: optionalString,
    JIRA_ISSUE_TYPE: optionalString,
    JIRA_ASSIGNEES: optionalString,
    AMBIGUOUS_SANDBOX: disabledByDefaultBoolean,
    AMBIGUOUS_API_KEY: optionalString,
    AMBIGUOUS_BASE_URL: optionalString,
    AMBIGUOUS_CHANNEL_ID: optionalString,
    TRACKER: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim().length === 0
          ? undefined
          : value,
      z
        .enum(["clickup", "jira", "ambiguous", "ambiguous_sandbox", "github"])
        .optional(),
    ),
    GITHUB_TOKEN: optionalString,
    GITHUB_REPO: optionalString,
    SLACK_WEBHOOK_URL: optionalString,
    SLACK_BOT_TOKEN: optionalString,
    NEXT_PUBLIC_SLACK_AREA_CHANNELS: optionalString,
    COPILOTKIT_TELEMETRY_DISABLED: environmentBoolean,
  })
  .passthrough();

export type ServerEnvironment = z.output<typeof serverEnvironmentSchema>;

export function readServerEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function commaSeparatedValues(
  value: string | undefined,
): readonly string[] {
  return (
    value
      ?.split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0) ?? []
  );
}
