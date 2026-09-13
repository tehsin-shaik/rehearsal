# Privacy and execution boundaries

## Default demo

All reports are fixtures and all effects are in-memory replicas. No accounts, AI provider calls, analytics, remote fonts, browser monitoring or external requests are needed. Workflow state lives in the current browser session and disappears on refresh. Layout preferences alone use local storage.

Pausing stops observation. Source exclusions prevent events from entering a new trace. Raw keystrokes, coordinates, selectors, clipboard bodies, secrets, OTPs and payment data are never part of the semantic event contract. Redaction runs recursively before normalization and again at the live observation endpoint.

## Browser extension

The extension is disabled by default. Pair it explicitly with a local Rehearsal session and enable observation. A temporary token grants observation-only access. Recent sanitized events are bounded to 500 entries in `chrome.storage.session`; pausing stops new capture, and clearing removes metadata and the pairing token.

Supported DOM hooks emit selected metadata after observable confirmation. They do not capture mailbox bodies, raw keystrokes, the clipboard or screen recordings. Password-bearing pages are ignored. URLs lose query strings and fragments. Application UI changes can prevent detection; the compiler refuses incomplete traces rather than inventing events.

Observation controls on the demo Privacy page control replica observations. Live observation is controlled in the extension popup, and live observation history can be cleared with authenticated `DELETE /api/observe`. Closing the local server expires its in-memory context; the extension must be paired again after restarting it.

## Live data

Gmail inbox reading is a separate, explicit integration and can retrieve plain-text message bodies. If a model provider is enabled, report text is sent to that configured provider for structured interpretation. Model responses must pass schema and literal-evidence validation. Exa receives only a closed-vocabulary symptom query, not customer identity or message text. Research links remain untrusted reference data.

Provider credentials are environment variables on the server, never browser-bundled configuration. Do not place secrets in `NEXT_PUBLIC_*`. OAuth tokens stay in the server session; supplied app passwords stay in the optional local service process. Only the scoped temporary observation token is pasted into the extension.

## Authority and effects

Reading, analysis and local drafts are allowed; creating/assigning issues and sending messages require exact-plan approval. Payments are always blocked. Low confidence, missing email/name/owner, or unresolved routing prevents execution. Activating a workflow does not authorize future runs. A model, research result or browser page cannot grant approval.

Live writes require an authenticated Rehearsal session, a trusted Origin, a server-owned run, ordered action IDs and independently evaluated policy. Local loopback services require a separate server-only key. Sending through SMTP also requires `GMAIL_SEND_ENABLED=true`.

## Current limits

There is no tenant identity system, encrypted database, durable execution queue or immutable compliance ledger. The local access key is a single-user gate, not enterprise authentication. In-memory receipts and tokens disappear on process restart; reconcile any uncertain real write before starting another run. Production hosting must add appropriate durable storage, authorization, rate limiting, secret rotation and vendor-specific reconciliation.
