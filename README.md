<div align="center">

# Rehearsal

**Teach it through work. Approve before it acts.**

A human-supervised agent that turns repeated work into reusable, reviewable workflows.

**Learn from actions · Preview the plan · Stay in control**

[Quick start](#quick-start) · [How it works](#how-it-works) · [Try the demo](#try-the-demo) · [Documentation](#documentation)

</div>

---

Rehearsal observes meaningful actions across supported apps, spots repeated behavior, and compiles a workflow that adapts to the next case. You review a **Preview Run** before it creates records or sends messages.

> **Start without keys.** Demo Mode is deterministic, offline, and needs no credentials. Optional live integrations use the same planner, policy, and executor contracts.

## Quick Start

Use **Node.js 22.6 or newer**; Node.js 24 LTS is recommended.

```bash
npm install
npm run dev
```

Open **[localhost:3000/workspace](http://localhost:3000/workspace)**. No `.env` file is needed for Demo Mode.

## How It Works

<p align="center">
  <strong>Observe → Detect → Compile → Preview Run → Approve → Execute</strong>
</p>

### 01 · Observe the work, not the clicks

You handle support mail, create tickets, and notify the team. Rehearsal records the **meaningful actions** that connect those tasks, rather than raw mouse positions or keystrokes. Sensitive fields are filtered out; you can pause observation or exclude applications.

<p align="center">
  <img src="assets/rehearsal-illustrations/01-observe.png" width="880" alt="A human works with mail, tickets, and team chat while Rehearsal records meaningful actions in a notebook and excludes secrets.">
</p>

### 02 · Find the pattern. Make it reusable.

**One observation is not enough.** A varied second completed trace can reveal the repeated sequence. Rehearsal compiles the shared structure while keeping customer details, issues, departments, and owners as runtime values—not hard-coded copies of the first case.

<p align="center">
  <img src="assets/rehearsal-illustrations/02-detect-and-compile.png" width="880" alt="Rehearsal aligns two completed work histories and compiles a reusable workflow with empty slots for new values.">
</p>

The illustration simplifies the sequence. The compiled workflow has **five stages**:

`Email → Understand issue → Create ticket → Assign owner → Notify team`

Inspect the workflow, its evidence, and its variable bindings, then activate it deliberately.

### 03 · Rehearse the next case

A new report is understood, classified, and routed into a fully resolved **Preview Run**. In the demo, an unseen billing report routes to **Billing → Tehsin**. Review the proposed actions, permissions, destinations, adaptations, and evidence before anything consequential happens.

<p align="center">
  <img src="assets/rehearsal-illustrations/03-understand-and-preview.png" width="880" alt="A billing report enters a protected Preview Run where Rehearsal proposes Tehsin as owner; no external writes occur and uncertain cases ask a human.">
</p>

**No external writes during preview.** Reads, analysis, and drafting can proceed; unresolved ownership requires human review, not a guess.

### 04 · Approve, execute, and check the result

After your approval, Rehearsal **creates the issue → assigns the owner → notifies the team → replies to the customer**. Policy is checked before each action, and success requires adapter-confirmed results.

<p align="center">
  <img src="assets/rehearsal-illustrations/04-approve-execute-and-verify.png" width="880" alt="A human approves an execution ledger while Rehearsal verifies results and bookmarks a failed notification so retrying does not duplicate the completed ticket.">
</p>

If an action fails, later actions stop. Resuming the run preserves confirmed earlier work instead of recreating its successful ticket. This is run-level retry protection, not a promise of durable, distributed exactly-once delivery.

## Try the Demo

Follow the happy path, then test the two cases where control matters most.

| Scenario            | What to try                                                                        | What to look for                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Learn and run**   | Complete both observations, activate the workflow, and deliver the billing report. | A resolved preview, followed by one issue, one assignment, one team notification, and one customer reply after approval. |
| **Fail and resume** | Set the failure control to **Team notification**, then approve a run and retry it. | Execution stops at the failure; the existing issue is not recreated.                                                     |
| **Ask a human**     | Deliver the ambiguous report.                                                      | Execution stays blocked until an owner is explicitly selected and the run is approved.                                   |

**Shortcuts:** `Ctrl/Cmd + K` opens the command palette. `Ctrl/Cmd + Shift + D` opens the hidden demo console.

For the complete walkthrough, see the [demo guide](docs/DEMO.md).

## Explore the App

| Route             | What you can do                                                            |
| ----------------- | -------------------------------------------------------------------------- |
| `/`               | Explore the product and behavior-to-agent flow.                            |
| `/onboarding`     | Choose observation sources and privacy settings.                           |
| `/workspace`      | Work in replica or connected operational surfaces.                         |
| `/workflows`      | Browse learned workflows.                                                  |
| `/workflows/[id]` | Inspect compiled patterns, evidence, variables, rules, and the memory map. |
| `/activity`       | Review observed traces and adapter-confirmed runs.                         |
| `/privacy`        | Manage observation, policy, targets, and prototype limits.                 |

## Under the Hood

**Next.js · React · TypeScript · Zustand · Zod**

The learning and execution core stays separate from the UI and live providers.

| Layer                                                     | Responsibility                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`src/domain`](src/domain)                                | Framework-independent events, pattern detection and compilation, understanding, policy, planning, and run contracts. |
| [`src/application`](src/application)                      | Headless executor, explicit phase machine, focused Zustand slices, atomic commands, and selectors.                   |
| [`src/infrastructure`](src/infrastructure)                | Validated HTTP boundaries, model and research clients, mail surfaces, AG-UI planning, and typed adapters.            |
| [`src/demo`](src/demo)                                    | Deterministic fixtures, in-memory adapters, failure injection, and the demo director.                                |
| [`src/components`](src/components) / [`src/app`](src/app) | Responsive interface and Node-runtime API routes.                                                                    |
| [`extension`](extension)                                  | Manifest V3 semantic observer with an independent privacy boundary.                                                  |

See the [architecture guide](docs/ARCHITECTURE.md) for the full diagram and invariants.

## Live Mode

Live Mode adds model-assisted understanding, privacy-filtered research, connected Gmail and tracker surfaces, AG-UI plan streaming, and typed external adapters.

1. Copy `.env.example` to `.env.local`.
2. Set both `DEMO_MODE=false` and `NEXT_PUBLIC_DEMO_MODE=false`.
3. Configure only the providers you intend to use. Secrets remain server-side.

Unless `TRACKER` selects a provider explicitly, tracker precedence is **ClickUp → Jira → Ambiguous workspace → GitHub → Ambiguous sandbox**.

> **Live mode is a single-user prototype.** Add authentication and authorization before exposing live API routes publicly. Ordinary verification is read-only; verification that creates external resources requires `REHEARSAL_ALLOW_EXTERNAL_WRITES=true`.

Read [integrations](docs/INTEGRATIONS.md) and [API keys](docs/KEYS.md) before enabling live mode. For hosting, see [deployment](docs/DEPLOYMENT.md): Cloudflare defaults to Demo Mode; Node-hosted live mode is recommended for IMAP and local OAuth token storage.

## Browser Extension

The extension observes supported semantic actions in **Gmail, Jira Cloud, and ClickUp**.

<details>
<summary><strong>Set up the Chrome extension</strong></summary>

1. Run `npm run extension:icons` if icon assets need regeneration.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select this repository's `extension` directory.
4. Keep the default `http://localhost:3000` endpoint or authorize an HTTPS deployment in the popup.

</details>

The extension does **not** send rendered Gmail bodies, coordinates, selectors, copied text, raw keys, credentials, authentication data, or payment information. The server validates and scrubs every event again.

See the [privacy and safety guide](docs/PRIVACY.md) for the trust boundaries and controls.

## Validation

Run the standard checks and production build:

```bash
npm run check
npm run build
```

For a focused end-to-end demo check:

```bash
npm run verify
```

This exercises the complete offline behavior-to-agent pipeline and asserts **zero network requests**.

<details>
<summary><strong>All validation commands</strong></summary>

| Command                     | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `npm test`                  | Run domain, execution, state, server, extension, and acceptance tests.         |
| `npm run verify`            | Verify the complete offline pipeline and zero network requests.                |
| `npm run verify:copilotkit` | Validate structured AG-UI action and run proposals.                            |
| `npm run verify:live`       | Verify configured model and Exa services; skip cleanly without credentials.    |
| `npm run verify:surfaces`   | Read configured mail and tracker surfaces without creating records.            |
| `npm run verify:ambiguous`  | Verify and revoke a disposable sandbox only with explicit write authorization. |
| `npm run typecheck`         | Check strict TypeScript across source, tests, scripts, and deployment config.  |
| `npm run lint`              | Run the Next.js and TypeScript ESLint rules.                                   |
| `npm run format:check`      | Verify Prettier formatting.                                                    |
| `npm run build:cloudflare`  | Produce an OpenNext Cloudflare Worker build without deploying it.              |

</details>

## Prototype Limits

Rehearsal currently implements a **supported support-triage workflow**, not arbitrary desktop automation.

- No general operating-system control or arbitrary workflow learning.
- No production encryption, multi-user authorization, or durable application-state persistence.
- Live API routes require an authentication and authorization layer before public exposure.
- Server idempotency is process-local; production writes need durable, distributed idempotency.
- Local Gmail OAuth token storage is a documented single-user prototype mechanism.

## Documentation

| Guide                                                     | Start here when you want to…                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Demo](docs/DEMO.md)                                      | Walk through learning, approval, failure recovery, and human review.            |
| [Architecture](docs/ARCHITECTURE.md)                      | Understand the layers, contracts, and invariants.                               |
| [Integrations](docs/INTEGRATIONS.md)                      | Connect live providers and external adapters.                                   |
| [API keys](docs/KEYS.md)                                  | Find the configuration required by each provider.                               |
| [Privacy and safety](docs/PRIVACY.md)                     | Review observation boundaries, redaction, and execution policy.                 |
| [Deployment](docs/DEPLOYMENT.md)                          | Build and host Demo Mode or a configured live deployment.                       |
| [Testing](docs/TESTING.md)                                | Understand the test suite and verification scripts.                             |
| [Product specification](docs/REHEARSAL-PRD.md)            | Read the authoritative product requirements.                                    |
| [Illustrations](assets/rehearsal-illustrations/README.md) | Reuse the four illustrations and inspect their captions and generation prompts. |

---

<p align="center">
  <strong>Teach it through work. Approve before it acts.</strong><br>
  <sub>Rehearsal keeps the human in the loop—from the first observation to the final action.</sub>
</p>
