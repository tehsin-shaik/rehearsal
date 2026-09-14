# Privacy and Safety

## Observed

Rehearsal records only the semantic information needed to describe supported workflow actions:

- source application;
- semantic action and intent;
- bounded timestamps and trace identifiers;
- support-report fields needed for deterministic extraction and routing;
- confirmed issue identifiers and owner-selection intent;
- action confidence, origin, and estimated manual effort.

Applications can be excluded, and observation can be paused or cleared from `/privacy`.

## Ignored

Domain normalization, the browser extension, and the server observation route remove or reject:

- passwords, passcodes, credentials, secrets, access tokens, cookies, and authentication data;
- card numbers, security codes, bank identifiers, account numbers, and payment information;
- coordinates, pointer positions, selectors, XPath, key codes, raw keys, and keystrokes;
- clipboard and copied text;
- hidden and password input fields;
- sensitive autocomplete fields;
- query strings, URL fragments, and unstable identifiers in normalized paths;
- rendered Gmail message bodies in the extension.

The extension never declares tracker creation from click intent alone. Jira and ClickUp creation events are emitted only after a confirmed issue or task URL appears.

## Independent Trust Boundaries

Content scripts sanitize before batching. The background worker validates and scrubs again, replaces tab-controlled trace identifiers with one extension-owned trace, and stores only bounded queues. `/api/observe` then validates with Zod, redacts again, normalizes paths, truncates text, and writes to a bounded in-memory buffer.

The browser extension is always treated as untrusted input.

## Bounds

- Extension content queue: 50 events
- Extension worker queue: 250 events
- Extension delivery batch: 25 events
- Extension recent list: 12 events
- API request batch: 50 events and 10 trace completions
- API observation buffer: 500 events and 500 completions
- API request body: 1 MB
- Bounded network response body: 2 MB; extension API response: 64 KB
- Workflow trace: 200 semantic events
- Application timeline: 400 entries
- Phase history: 400 entries
- Completed traces: 100; workflows: 50; run history: 100
- Inbox: 100 messages; replica issues: 200
- Team messages: 400; customer replies: 200
- Active local executions: 100; results per run: 200
- Server idempotency cache: 200 successful remote results
- Concurrent remote writes: 100
- Demo adapter records: 500 per collection; idempotency entries: 1,000 per adapter
- Connected mail and tracker lists: 20 recent items
- Research references: 3 results
- AG-UI planning: 100 actions, 100 tool calls, and 1 MB tool arguments

## Approval and External Writes

Reading, local analysis, and drafting can proceed without approval. Creating or modifying an external record and sending a message require explicit approval. Payments are blocked. Policy is deterministic and runs immediately before every action. Models and AG-UI planning never decide approval or execution.

The UI reports success only after an adapter returns a successful `ActionResult`. Slack incoming webhooks require both successful HTTP status and Slack's exact `ok` response. Failed execution stops later actions and preserves confirmed earlier work.

## Secrets

Secrets are accepted only through ignored local environment files or deployment-secret systems. API routes never return keys or refresh tokens. Errors use fixed safe messages. `.env*`, `.dev.vars*`, `.rehearsal`, build output, caches, logs, and dependencies are ignored.

## Prototype Limitations

The MVP does not provide general operating-system control, arbitrary workflow learning, production encryption, multi-user authorization, durable application persistence, distributed idempotency, or a remote token vault. `/api/execute`, `/api/observe`, connected-surface routes, and OAuth routes are single-user prototype endpoints; place the application behind access control before exposing live mode. Gmail OAuth tokens use an ignored local file intended only for a single-user local prototype. The extension supports Gmail, Jira Cloud, and ClickUp conservatively and may need extractor maintenance when those applications change their DOM.
