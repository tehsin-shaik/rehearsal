# Live Integrations

Live mode is optional. Demo Mode remains the safe default and uses the same planner, policy, executor, verifier, and run contracts.

## Enable Live Mode

Copy `.env.example` to `.env.local` and set:

```text
DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false
```

Restart the development or production server after changing public mode configuration. Configure only the providers you intend to use.

## Model and Research

The JSON model client chooses the first configured provider:

1. OpenRouter
2. OpenAI
3. Gemini's OpenAI-compatible endpoint

Each request uses an eight-second timeout, temperature zero, JSON response format, and safe typed errors. OpenRouter supports a primary model plus comma-separated fallback models. Model output is accepted only when the full Zod schema passes, evidence excerpts occur literally in the report, the report identifier matches, and department routing is consistent. Any failure returns the deterministic understanding as a complete fallback; unvalidated fields are never merged.

Exa research runs concurrently with model understanding. Its six-second request contains only subject, a sanitized symptom phrase, and a literal technical error when present. Customer identity, email, report identifiers, tokens, and long opaque values are removed. Failure returns an empty result.

## Tracker Selection

`TRACKER` can explicitly select `clickup`, `jira`, `ambiguous`, `github`, or `ambiguous_sandbox`. An explicit but incomplete selection fails closed. Without an override, configured providers use this deterministic precedence:

1. ClickUp
2. Jira Cloud
3. Ambiguous workspace
4. GitHub Issues
5. Ambiguous disposable sandbox

The selected target is returned before approval and displayed in the Preview Run.

## ClickUp

Required: `CLICKUP_API_KEY`, `CLICKUP_LIST_ID`.

Optional: `CLICKUP_TEAM_ID`, `CLICKUP_ASSIGNEES`.

The adapter creates a task in the configured list, uses Markdown content with up to three research references, applies tags and mapped priority, resolves owners from configured identifiers or authorized workspace members, assigns the owner, and lists recent tasks. `CLICKUP_ASSIGNEES` accepts JSON or comma-separated `Name=memberId` pairs.

## Jira Cloud

Required: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`.

Optional: `JIRA_ISSUE_TYPE`, `JIRA_ASSIGNEES`.

The adapter resolves create metadata and priority when available, sends an ADF description, applies labels, creates the issue, resolves an assignable account, assigns the owner, and lists recent project issues. `JIRA_ASSIGNEES` accepts JSON or comma-separated `Name=accountId` pairs.

## GitHub Issues

Required: `GITHUB_TOKEN`, `GITHUB_REPO` in `owner/repository` form.

The adapter creates Markdown issues with labels, returns the real issue number and URL, can assign a matching GitHub login, and lists recent issues while excluding pull requests. Use a fine-grained token limited to the selected repository with Issues read/write access.

## Ambiguous

Workspace mode requires `AMBIGUOUS_API_KEY` and `AMBIGUOUS_BASE_URL`. `AMBIGUOUS_CHANNEL_ID` enables optional channel delivery. The adapter creates tasks, records routed owners in task metadata when needed, verifies changes through read-back, and lists recent tasks.

Disposable sandbox mode requires `AMBIGUOUS_SANDBOX=true` and `AMBIGUOUS_BASE_URL`. Sandbox lifecycle endpoints are isolated behind this explicit configuration because they depend on the selected Ambiguous deployment. `npm run verify:ambiguous` performs creation, read-back, and revocation only when `REHEARSAL_ALLOW_EXTERNAL_WRITES=true` is also set.

## Slack

Configure `SLACK_WEBHOOK_URL` or `SLACK_BOT_TOKEN`. A bot token takes precedence when both are present. `NEXT_PUBLIC_SLACK_AREA_CHANNELS` maps semantic department channels to Slack channel identifiers using JSON or comma-separated `source=destination` pairs.

Webhook delivery succeeds only when Slack returns a successful HTTP response whose body is exactly `ok`. Bot delivery succeeds only when Slack returns `ok: true` and a message timestamp.

## Gmail IMAP

Configure `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD`; optionally set `GMAIL_QUERY`. The connector opens Gmail INBOX read-only, fetches at most 20 recent messages, limits each raw source to 750 KB, extracts bounded plain text, records read state, and closes the connection safely. IMAP does not authorize outbound replies.

## Gmail OAuth

Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`; `GMAIL_ADDRESS` and `GMAIL_QUERY` remain optional. Open `/api/mail/auth` from the workspace to begin the state-protected authorization flow.

OAuth requests Gmail read-only and send scopes. Access and refresh tokens are stored in ignored `.rehearsal/gmail-oauth-token.json` with restricted local permissions. Tokens never reach the browser. A connected OAuth account supplies recent messages and authorized replies to the originating thread.

## Connected Surfaces

Live mode polls every 30 seconds with an overlap guard and cleanup on unmount. Gmail messages replace replica inbox data only after a successful read; otherwise the replica remains. Ordinary mail is preserved and does not trigger automation. Only newly discovered unread support-like mail can trigger an active workflow when no run is in progress.

Tracker routes expose configured choices and recent issues. The workspace can switch among available providers. Unavailable or failed targets fall back to the replica surface and never report fake success.

## Verification

```bash
npm run verify:live
npm run verify:surfaces
npm run verify:copilotkit
```

These checks are read-only and skip unavailable providers. External write verification is separate and opt-in.
