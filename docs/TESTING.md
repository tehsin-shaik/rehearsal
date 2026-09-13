# Verification

The project uses Node 24's built-in test runner so core verification does not depend on an external test service. Tests inject adapter clients; they never write to real accounts.

| Command | What it verifies |
| --- | --- |
| `npm run typecheck` | Strict TypeScript across application and API boundaries |
| `npm run lint` | Next/React/TypeScript static checks |
| `npm test` | Domain, canonical scenario, recovery, authorization and integration contracts |
| `npm run build` | Production App Router compilation |
| `npm run check` | Typecheck, lint, tests and build |
| `npm run test:browser` | Real Chromium demonstration, routes, mobile, zero external calls |
| `npm run verify:copilotkit` | Native AG-UI transport/proposals, no execution |
| `npm test --prefix integrations/node-services` | Genuine CopilotKit SDK metadata and authenticated local mail boundary |
| `npm run verify:live` | Credential-gated structured understanding; no consequential action |
| `npm run verify:surfaces` | Credential-gated read-only mail/tracker access |
| `npm run verify:ambiguous` | Explicit unavailable status while the vendor contract is unverified |

## Coverage that matters

The tests assert that one trace is insufficient; an extra read does not prevent matching; unrelated traces fail; inferred work has provenance; sensitive metadata is discarded; owner remains a variable even when both examples agree; and incomplete workflows cannot compile.

Acceptance checks cover exact in-memory effects, approval tampering, payments, unresolved plans, concurrent/replayed execution, failure at each consequential stage, retained receipts, issue-ID substitution, and completion verification. Session checks ensure manual and fast-demo commands use the same engine, visible history clearing cannot duplicate work, and reteaching does not reuse issue numbers.

Integration checks use mock HTTP clients for provider validation/fallback, concurrent public research, evidence fidelity, GitHub IDs, Jira ADF, Slack channel matching, local bridge authentication, and uncertain writes. Real vendor connectivity and actual Chrome DOM hooks need credentialed account testing; mocked HTTP success is not evidence of real account access.

## Browser checks

Start `npm run dev` or a built `npm start` on `127.0.0.1:3000`, install Playwright/Chromium as shown in the README, and run `npm run test:browser`. To use another local port, set `REHEARSAL_TEST_URL` to the matching origin.

The browser test teaches both observations through the actual buttons, checks Awaiz/Umar in the Ghost Run, executes the plan, tests ambiguity, navigates the main routes, and asserts mobile width does not overflow. It rejects JavaScript page errors and all non-origin requests. Screenshots are saved to `test-results/`; failure also captures the current page.

GitHub Actions performs `npm ci` from the committed lock, checks the source, builds the app, installs Chromium, and uploads the browser screenshots. Its repository permission is read-only. A separate job installs and verifies the optional Node services. It never obtains live integration credentials or publishes artifacts back into repository history.

## Extension acceptance

Load the unpacked extension and inspect its popup. It must begin disabled, request explicit pairing, and record nothing while paused. Verify Gmail receipt, tracker creation/assignment, Slack delivery confirmation, and customer reply against a test account. Finishing a trace without any required stage must not produce a learned workflow. Use the popup to clear metadata and unpair, then confirm API delivery stops.
