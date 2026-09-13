# Integration setup

The offline demo needs none of these services. Configure live integrations only when you want the app to use real accounts. Development verification uses mocks and local services; it has not sent mail or created issues in a real account.

## Enable a local session

1. Copy `.env.example` to `.env.local` (`Copy-Item .env.example .env.local` in PowerShell, `cp .env.example .env.local` on macOS/Linux).
2. Generate a key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set `REHEARSAL_ACCESS_KEY`. Never reuse a provider credential as this key.
3. Set `DEMO_MODE=false` and `NEXT_PUBLIC_DEMO_MODE=false`. Both must agree. Keep `REHEARSAL_BASE_URL` exactly equal to the browser origin, normally `http://localhost:3000`.
4. Configure mail, a tracker, external owner mappings and channel-specific Slack webhooks. Restart development or rebuild production after changing public environment flags.
5. Open `/integrations`, unlock the session, connect Gmail if using OAuth, and open `/live`.

Live requests without an unlocked session fail. The access cookie expires after eight hours and never grants blanket approval to execute plans.

## Structured understanding and research

The first configured provider wins: OpenRouter, then OpenAI-compatible, then Gemini. Set the corresponding API key and model. OpenAI-compatible URLs must use HTTPS. OpenRouter can use a comma-separated `OPENROUTER_FALLBACK_MODELS` list. Provider output is parsed into the same strict schema and literal evidence must appear in the report. Invalid output and eight-second timeout failures fall back to deterministic understanding.

Optional Exa research starts concurrently with understanding and has a separate six-second timeout. Queries are generated from a closed vocabulary of symptoms. Failed research yields an empty reference list and does not stop the demo or grant more authority.

`npm run verify:live` uses a fixture report to check configured understanding. A deterministic fallback is not reported as a successful live-provider check. No external action is executed by this command.

## Gmail OAuth

Enable the Gmail API in a Google Cloud project. Configure an OAuth web application, add your account as a test user when applicable, and register the exact `GOOGLE_REDIRECT_URI`:

```text
http://localhost:3000/api/mail/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. After unlocking Rehearsal, use **Connect Gmail read-only**. The app requests `gmail.readonly`; no sending is permitted. **Authorize Gmail replies** requests the additional `gmail.send` scope. That consent enables the capability, while each real reply still needs Ghost Run approval. If configuring a refresh token directly, it must carry the needed scopes.

`GMAIL_QUERY` defaults to `is:unread newer_than:7d`; at most 20 messages are fetched. Plain-text MIME content is used; HTML-only messages are omitted. OAuth credentials/tokens are not stored in the extension. See [Google's scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Gmail IMAP/SMTP and optional Node services

For accounts that support Google app passwords, the optional service uses authenticated TLS IMAP and SMTP. OAuth remains available when an app password is unsuitable. IMAP reading opens INBOX read-only, requests unseen messages, and does not mark them read. SMTP reports server acceptance, not proof of delivery to the recipient's inbox.

```sh
npm install --prefix integrations/node-services
npm test --prefix integrations/node-services
```

Set `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`, and a separate generated `REHEARSAL_BRIDGE_KEY` (at least 24 characters). App-password configuration takes precedence over OAuth. Leave `GMAIL_SEND_ENABLED=false` for reading only; explicitly set it to `true` when enabling approved replies. Start the service in a second terminal:

```sh
npm start --prefix integrations/node-services
```

It binds only to `127.0.0.1:4001` and requires its server-only bridge key. The app talks to that fixed loopback address; browsers and extensions never receive the key. This optional service requires a local Node host and is not compatible with the Cloudflare demo template. A socket/network timeout during a send is an uncertain outcome and must not be blindly retried.

## Trackers and assignment

Set `TRACKER` explicitly. If omitted, configured services are selected in this order: ClickUp, Jira, Ambiguous, GitHub. Owner mappings are explicit external IDs; display names are not assumed to be service identifiers.

| Tracker | Required settings | Assignee mapping |
| --- | --- | --- |
| GitHub Issues | `GITHUB_TOKEN`, `GITHUB_REPO=owner/repository` | `GITHUB_ASSIGNEES={"Umar":"login","Awaiz":"other-login"}` |
| ClickUp | `CLICKUP_API_KEY`, `CLICKUP_LIST_ID` | `CLICKUP_ASSIGNEES={"Umar":"123","Awaiz":"456"}` |
| Jira Cloud | HTTPS `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, optional `JIRA_ISSUE_TYPE` | `JIRA_ASSIGNEES={"Umar":"account-id","Awaiz":"other-account-id"}` |

Use a token with access only to the intended test repository, list or project. Create the support labels expected by your tracker when its API requires existing labels. Jira creates an ADF description and resolves the configured issue type from project metadata. Custom required fields and organization-specific priority schemes need an adapter extension; they are not guessed. Assignment is read back and checked. GitHub issue numbers, ClickUp task IDs, Jira keys and returned URLs are used downstream.

The Ambiguous vendor contract could not be verified. Selecting it produces a clear `CONTRACT_UNAVAILABLE` error; `npm run verify:ambiguous` exits with an unavailable result without contacting it. The configuration names and adapter boundary are reserved, but no undocumented endpoint or fake success is supplied.

References: [ClickUp create task](https://developer.clickup.com/reference/createtask), [Jira issue API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/).

## Slack

Use one incoming webhook for every department channel that the workflow can reach. Configure `SLACK_AREA_WEBHOOKS` as a JSON map:

```dotenv
SLACK_AREA_WEBHOOKS={"technical-support":"https://hooks.slack.com/services/REPLACE","billing-finance":"https://hooks.slack.com/services/REPLACE"}
```

Replace each value with that channel's actual webhook. A legacy single `SLACK_WEBHOOK_URL` requires an explicit `NEXT_PUBLIC_SLACK_AREA_CHANNELS={"default":"technical-support"}` declaration and covers only that declared channel. Billing cannot silently fall back to the technical channel. Incoming webhooks are bound to their installed channel; the adapter requires the right mapping and an `ok` response. See [Slack's webhook documentation](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

| Department | Owner | Channel key |
| --- | --- | --- |
| Technical Support | Umar | `technical-support` |
| Billing | Awaiz | `billing-finance` |
| Sales | Bilal | `sales` |
| Logistics | Obaid | `logistics` |
| Product Development and Engineering | Noor | `product-engineering` |
| Legal, Privacy and Compliance | Huda | `legal-privacy` |

## Manifest V3 observer

1. Open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `extension/`.
2. Copy the extension ID into `EXTENSION_ID` in `.env.local` and restart the app.
3. Unlock Rehearsal and generate a temporary observation token in Integrations.
4. Open the extension popup, select the API origin, paste the observation token, and explicitly enable observation. Grant the supported application origins when requested.
5. Complete a manual support workflow in the supported Gmail / Jira or ClickUp / Slack pages. Finish the observation in the popup. Repeat with a second example.
6. Open `/live` and inspect the received semantic events. Only two complete matching traces can enable planning for an unread support report.

The extension observes conservative DOM confirmations, not internal app APIs. English-language success messages and supported UI layouts are the initial target. App UI changes can prevent capture; a missing stage blocks compilation. It does not fabricate a completed trace. Pause/clear controls are in the popup. The API rejects untrusted extension origins and revalidates every event.

## CopilotKit and AG-UI

Native authenticated proposal streaming is at `POST /api/ag-ui`. Supply `threadId`, a transport `runId`, and `forwardedProps.rehearsalRunId` identifying a plan previously created in the same session. The stream contains `RUN_STARTED`, complete `proposeAction`/`proposeRun` tool calls, `STATE_SNAPSHOT`, and `RUN_FINISHED`. It never approves or executes anything.

For the actual CopilotKit v2 runtime, install/start the optional Node services above, set `COPILOTKIT_ENABLED=true`, and restart the app. The catch-all `/api/copilotkit` route forwards to a real `CopilotRuntime` with an AG-UI `HttpAgent` named `rehearsal`. Runtime metadata is at `/api/copilotkit/info`; agent execution transport is `/api/copilotkit/agent/rehearsal/run`. Session cookies are forwarded server-side, and approval/execution remain separate authenticated API calls.

`npm run verify:copilotkit` validates native event structure and zero effects. `npm test --prefix integrations/node-services` imports the real SDK, starts its runtime, and verifies runtime metadata without provider credentials. References: [CopilotKit v2](https://docs.copilotkit.ai/reference/v2), [HttpAgent](https://docs.copilotkit.ai/ag-ui/sdk/js/client/http-agent).

## Troubleshooting

- **403 Origin:** match `REHEARSAL_BASE_URL` to the actual browser origin. `localhost` and `127.0.0.1` are different origins.
- **401 session:** unlock again after expiry or server restart; pair the extension again if needed.
- **Plan blocked:** check both observations are complete, recipient identity is present, and the selected route has an external assignee and Slack webhook.
- **Gmail cannot send:** authorize OAuth sending, or explicitly enable SMTP sending and run the optional service.
- **503 CopilotKit:** start optional services and set the bridge key plus runtime flag. Native AG-UI does not need the SDK service.
- **Uncertain adapter result:** inspect the real destination and reconcile before another attempt. Do not clear state to retry a possibly completed send.
