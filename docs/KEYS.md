# Credentials and Keys

Rehearsal needs no credentials in Demo Mode. Keep all secrets in ignored `.env.local` files for development or in the deployment platform's encrypted secret store.

## Setup

```bash
copy .env.example .env.local
```

Set both `DEMO_MODE=false` and `NEXT_PUBLIC_DEMO_MODE=false` only when live mode is intentional. Never commit `.env.local`, `.dev.vars`, OAuth token files, or copied credentials.

## User Configuration Files

- `.env.local` — optional local runtime configuration copied from `.env.example`; this is the only file a local live-mode user normally edits.
- `wrangler.jsonc` — non-secret Worker name, compatibility, asset, and Demo Mode defaults for Cloudflare packaging. Keep credentials in Cloudflare secrets instead.
- `.rehearsal/gmail-oauth-token.json` — generated ignored single-user OAuth state. Do not edit or commit it; delete it to disconnect locally.

The extension endpoint and enabled state are configured in its popup and persisted in browser extension storage, not in a repository file.

## Model Providers

- `OPENROUTER_API_KEY` — server-side OpenRouter key. Optional model, fallback-model, and site URL fields select routing metadata.
- `OPENAI_API_KEY` — server-side OpenAI API key used only when OpenRouter is absent.
- `GEMINI_API_KEY` — server-side Gemini API key used only when OpenRouter and OpenAI are absent.
- `EXA_API_KEY` — server-side Exa key for sanitized research queries.

Use separate development keys, provider spending limits, and the smallest available project scope. No model or research key is exposed in API responses.

## Gmail

- `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` enable bounded read-only IMAP. Use a dedicated account or mailbox and a revocable app password.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` enable Gmail OAuth.
- OAuth requests Gmail read-only and send scopes because connected execution can reply to the originating customer thread.

The local prototype stores OAuth access and refresh tokens in `.rehearsal/gmail-oauth-token.json`. The directory is ignored. Delete that file to disconnect locally and revoke the grant in the Google account when no longer needed.

## ClickUp

- `CLICKUP_API_KEY` — token for a dedicated integration identity.
- `CLICKUP_LIST_ID` — exact destination list.
- `CLICKUP_TEAM_ID` — optional workspace restriction for member lookup.
- `CLICKUP_ASSIGNEES` — optional owner-name to member-ID mapping.

Limit access to the intended workspace and list.

## Jira Cloud

- `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` authenticate a dedicated Jira integration identity.
- `JIRA_PROJECT_KEY` and `JIRA_ISSUE_TYPE` constrain issue creation.
- `JIRA_ASSIGNEES` maps Rehearsal owner names to Jira account IDs.

Grant only project browse, issue create/edit, assign, and user-lookup capabilities required by the adapter.

## GitHub Issues

- `GITHUB_TOKEN` — fine-grained personal access token.
- `GITHUB_REPO` — one `owner/repository` destination.

Limit the token to that repository with Issues read/write access. Do not use a broad classic token.

## Slack

- `SLACK_WEBHOOK_URL` — incoming webhook for one configured destination.
- `SLACK_BOT_TOKEN` — optional bot token for mapped channels.
- `NEXT_PUBLIC_SLACK_AREA_CHANNELS` — department-to-channel mapping; do not place tokens or private message content in it.

Prefer a single-purpose webhook. If using a bot, grant only message-posting access to required channels.

## Ambiguous

- `AMBIGUOUS_API_KEY` — workspace key.
- `AMBIGUOUS_BASE_URL` — selected deployment base URL.
- `AMBIGUOUS_CHANNEL_ID` — optional channel destination.
- `AMBIGUOUS_SANDBOX` — explicit disposable-sandbox mode, disabled by default.

Sandbox verification is additionally blocked unless `REHEARSAL_ALLOW_EXTERNAL_WRITES=true`.

## Rotation and Incident Response

1. Disable live mode.
2. Revoke the affected provider credential.
3. Delete local ignored token state when Gmail OAuth is involved.
4. Issue a replacement with narrower scope where possible.
5. Run read-only verification before restoring live mode.

Errors and timelines are intentionally fixed or sanitized and must never include credential values.
