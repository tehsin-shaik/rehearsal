# Rehearsal

> Teach it through work. Approve before it acts.

Rehearsal is a human-supervised workflow-learning agent. It observes semantic work, detects repeated behavior, compiles generalized workflows, prepares a fully resolved Preview Run, and keeps consequential actions blocked until a person approves them.

The default Demo Mode is deterministic, offline, and requires no credentials. Optional live mode adds model-assisted understanding, privacy-filtered research, connected Gmail and tracker surfaces, AG-UI plan streaming, and typed external adapters without changing the planner, policy, or executor contracts.

## Quick Start

Use Node.js 22.6 or newer; Node.js 24 LTS is recommended.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/workspace`. No `.env` file is needed for Demo Mode.

## Product Flow

`Observe → Detect → Compile → Preview Run → Approve → Execute`

1. Run the first support-triage observation. One trace remains insufficient.
2. Run the varied second observation. Rehearsal detects and compiles a pattern.
3. Inspect and activate the learned workflow.
4. Deliver the unseen billing report. The Preview Run resolves Billing and Tehsin.
5. Review every action, permission, adaptation, evidence item, and target.
6. Approve once. Adapter-confirmed execution creates one issue, assigns it, sends one team notification, and replies to the customer.
7. Use the failure control to verify safe stop-and-resume behavior without duplicate issue creation.
8. Deliver the ambiguous report to verify mandatory human owner review.

The hidden demo console opens with `Ctrl/Cmd + Shift + D`. The command palette opens with `Ctrl/Cmd + K`.

## Routes

- `/` — product overview and behavior-to-agent flow
- `/onboarding` — observation-source and privacy setup
- `/workspace` — replica or connected operational workspace
- `/workflows` — learned workflow catalog
- `/workflows/[id]` — compiled pattern, evidence, variables, rules, and memory map
- `/activity` — observed traces and adapter-confirmed runs
- `/privacy` — observation controls, policy, targets, and prototype limits

## Architecture

- `src/domain` contains framework-independent events, pattern detection and compilation, understanding, policy, planning, and run contracts.
- `src/application` contains the headless executor, explicit phase machine, focused Zustand slices, atomic commands, and selectors.
- `src/infrastructure` contains Zod-validated HTTP boundaries, model and research clients, mail surfaces, AG-UI planning, and typed adapters.
- `src/demo` contains deterministic fixtures, in-memory adapters, failure injection, and the demo director.
- `src/components` and `src/app` contain the responsive interface and Node-runtime API routes.
- `extension` contains the Manifest V3 semantic observer and its independent privacy boundary.

See `docs/ARCHITECTURE.md` for the full diagram and invariants.

## Validation

```bash
npm run check
npm run build
```

Important commands:

| Command                     | Purpose                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `npm test`                  | Run domain, execution, state, server, extension, and acceptance tests.                    |
| `npm run verify`            | Exercise the complete offline behavior-to-agent pipeline and prove zero network requests. |
| `npm run verify:copilotkit` | Validate structured AG-UI action and run proposals.                                       |
| `npm run verify:live`       | Verify configured model and Exa services; skip cleanly without credentials.               |
| `npm run verify:surfaces`   | Read from configured mail and tracker surfaces without creating records.                  |
| `npm run verify:ambiguous`  | Verify and revoke a disposable sandbox only with explicit write authorization.            |
| `npm run typecheck`         | Check strict TypeScript across source, tests, scripts, and deployment config.             |
| `npm run lint`              | Run the Next.js and TypeScript ESLint rules.                                              |
| `npm run format:check`      | Verify Prettier formatting.                                                               |
| `npm run build:cloudflare`  | Produce an OpenNext Cloudflare Worker build without deploying it.                         |

## Live Mode

Copy `.env.example` to `.env.local`, set both `DEMO_MODE=false` and `NEXT_PUBLIC_DEMO_MODE=false`, and configure only the providers you intend to use. Secrets remain server-side. Tracker precedence is ClickUp, Jira, Ambiguous workspace, GitHub, then Ambiguous sandbox unless `TRACKER` explicitly selects a provider.

Ordinary verification is read-only. Any verification that creates an external resource requires `REHEARSAL_ALLOW_EXTERNAL_WRITES=true`.

See `docs/INTEGRATIONS.md` and `docs/KEYS.md` before enabling live mode.

## Browser Extension

1. Run `npm run extension:icons` if icon assets need regeneration.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the repository's `extension` directory.
4. Keep the default `http://localhost:3000` endpoint or authorize an HTTPS deployment in the popup.

The extension records supported semantic actions only. It does not send rendered Gmail bodies, coordinates, selectors, copied text, raw keys, credentials, authentication data, or payment information. The server validates and scrubs every event again.

## Prototype Limits

The MVP does not provide general operating-system control, arbitrary workflow learning, production encryption, multi-user authorization, or durable application-state persistence. Live API routes are single-user prototype boundaries and must not be exposed publicly without an authentication and authorization layer. Server idempotency is process-local, so production deployments need durable distributed idempotency before enabling consequential writes. Local Gmail OAuth token storage is a documented single-user prototype mechanism. Cloudflare deployment is configured for Demo Mode by default; Node-hosted live mode is recommended for IMAP and local OAuth token storage.

Further documentation is in `docs/DEMO.md`, `docs/PRIVACY.md`, `docs/INTEGRATIONS.md`, `docs/DEPLOYMENT.md`, `docs/TESTING.md`, and `docs/KEYS.md`. The authoritative product specification is `docs/REHEARSAL-PRD.md`.
