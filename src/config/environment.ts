import { z } from "zod";
const optional = z.string().optional().transform(v => v?.trim() || undefined);
const schema = z.object({
    DEMO_MODE: z.enum(["true", "false"]).default("true"), NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("true"),
    REHEARSAL_ACCESS_KEY: optional, REHEARSAL_BRIDGE_KEY: optional, COPILOTKIT_ENABLED: z.enum(["true", "false"]).default("false"), REHEARSAL_BASE_URL: z.string().url().default("http://localhost:3000"), EXTENSION_ID: optional,
    OPENROUTER_API_KEY: optional, OPENROUTER_MODEL: z.string().default("openai/gpt-4.1-mini"), OPENROUTER_FALLBACK_MODELS: optional, OPENROUTER_SITE_URL: optional,
    OPENAI_API_KEY: optional, OPENAI_MODEL: z.string().default("gpt-4.1-mini"), OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    GEMINI_API_KEY: optional, GEMINI_MODEL: z.string().default("gemini-2.5-flash"), EXA_API_KEY: optional,
    GMAIL_SEND_ENABLED: z.enum(["true", "false"]).default("false"), GMAIL_ADDRESS: optional, GMAIL_APP_PASSWORD: optional, GMAIL_QUERY: z.string().default("is:unread newer_than:7d"),
    GOOGLE_CLIENT_ID: optional, GOOGLE_CLIENT_SECRET: optional, GOOGLE_REDIRECT_URI: z.string().url().default("http://localhost:3000/api/mail/callback"), GOOGLE_REFRESH_TOKEN: optional,
    CLICKUP_API_KEY: optional, CLICKUP_LIST_ID: optional, CLICKUP_TEAM_ID: optional, CLICKUP_ASSIGNEES: optional,
    JIRA_BASE_URL: optional, JIRA_EMAIL: optional, JIRA_API_TOKEN: optional, JIRA_PROJECT_KEY: optional, JIRA_ISSUE_TYPE: z.string().default("Task"), JIRA_ASSIGNEES: optional,
    AMBIGUOUS_SANDBOX: z.enum(["true", "false"]).default("false"), AMBIGUOUS_API_KEY: optional, AMBIGUOUS_BASE_URL: optional, AMBIGUOUS_CHANNEL_ID: optional,
    TRACKER: z.enum(["github", "clickup", "jira", "ambiguous"]).optional(), GITHUB_TOKEN: optional, GITHUB_REPO: optional, GITHUB_ASSIGNEES: optional,
    SLACK_WEBHOOK_URL: optional, SLACK_AREA_WEBHOOKS: optional, NEXT_PUBLIC_SLACK_AREA_CHANNELS: optional,
});
export type Environment = z.infer<typeof schema>;
export function environment(input: Record<string, string | undefined> = process.env): Environment {
    const env = schema.parse(input);
    if (env.DEMO_MODE !== env.NEXT_PUBLIC_DEMO_MODE)
        throw new Error("DEMO_MODE and NEXT_PUBLIC_DEMO_MODE must agree.");
    return env;
}
export function isDemo(env = environment()): boolean { return env.DEMO_MODE !== "false"; }
export function jsonMap(value: string | undefined): Record<string, string> { if (!value)
    return {}; return z.record(z.string(), z.string()).parse(JSON.parse(value)); }
export function selectedTracker(env: Environment): "github" | "clickup" | "jira" | "ambiguous" | null {
    if (env.TRACKER)
        return env.TRACKER;
    if (env.CLICKUP_API_KEY && env.CLICKUP_LIST_ID)
        return "clickup";
    if (env.JIRA_API_TOKEN && env.JIRA_PROJECT_KEY)
        return "jira";
    if (env.AMBIGUOUS_API_KEY)
        return "ambiguous";
    if (env.GITHUB_TOKEN && env.GITHUB_REPO)
        return "github";
    return null;
}
