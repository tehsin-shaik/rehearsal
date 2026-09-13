# Rehearsal

> Teach it through work. Approve before it acts.

Rehearsal is a human-supervised workflow-learning agent. It observes semantic work, detects repeated workflows, generalizes changing values, and prepares a resolved Ghost Run for review before any consequential action can occur.

The MVP is offline-first and deterministic. Its canonical workflow triages customer reports across mail, an issue tracker, and team chat without requiring accounts, API keys, or live integrations.

## Current status

The current foundation provides:

- Next.js App Router with React, strict TypeScript, and Tailwind CSS.
- ESLint and Prettier configuration.
- Framework-independent domain contracts.
- Deterministic semantic normalization, redaction, and latent-step inference.
- Weighted trace comparison and pattern-candidate detection.
- Deterministic report and workflow-trace fixtures.
- A headless acceptance test for the complete canonical workflow.
- Typed entry points for later engine phases that deliberately throw `NotImplementedError`.

The domain engine, state-machine orchestration, interface, API routes, live integrations, and browser extension are intentionally deferred to later milestones.

## Setup

Use Node.js 24 or newer so the built-in test runner can execute TypeScript directly.

```bash
npm install
npm run dev
```

No `.env` file is required for Milestone 0.

## Commands

| Command                | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Start the local Next.js development server.                       |
| `npm run typecheck`    | Check the application and acceptance test with strict TypeScript. |
| `npm run lint`         | Run ESLint for Next.js and TypeScript.                            |
| `npm run format:check` | Verify Prettier formatting.                                       |
| `npm run test:domain`  | Run focused observation and pattern-detection tests.              |
| `npm test`             | Run the focused domain tests and canonical acceptance sequence.   |
| `npm run check`        | Run type checking, linting, formatting, and tests.                |

## Acceptance test

The acceptance test describes the intended end-to-end behavior:

1. One trace does not create a pattern.
2. A varied second trace creates a generalized pattern.
3. A new billing report routes to Awaiz.
4. Execution remains blocked until approval.
5. Approved execution creates one issue and sends one notification.
6. A failed run resumes without creating a duplicate issue.
7. Ambiguous input requires human review.

Observation and pattern detection have focused passing tests. The full acceptance test currently reaches pattern compilation and then fails at its deliberate `NotImplementedError`. Compilation, understanding, planning, policy, and execution remain later milestones.

## Architecture boundaries

- `src/domain` contains framework-independent contracts and pure domain logic.
- `src/application/engine` exposes the headless engine API.
- `src/application/state-machine` is reserved for application orchestration.
- `src/infrastructure/adapters` is the boundary for all external systems.
- `src/demo/fixtures` contains deterministic offline inputs.
- `src/app` contains only the minimal Next.js scaffold.

Domain code must not depend on React or Next.js. Policy and execution semantics belong in the headless engine rather than interface state. Demo and future live modes must use the same planner, policy, and executor contracts.

`SemanticEvent.action` is now backed by the exported fixed taxonomy. `WorkflowTrace.status` adds `paused` so observation can stop and resume without losing its active trace; existing contract fields and status values remain unchanged.

## Branding

Runtime product naming and metadata are centralized in `src/config/brand.ts`.

## Specification

See `docs/REHEARSAL-PRD.md` for the product requirements, acceptance criteria, and delivery plan.
