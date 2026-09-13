# ElyesTehsin

Milestone 0 establishes the typed, headless foundation for a human-supervised workflow-learning agent. Runtime branding lives only in `src/config/brand.ts`.

## Setup

Use Node.js 24 or newer so the built-in test runner can execute TypeScript directly.

```bash
npm install
npm run dev
```

## Quality commands

- `npm test` runs the canonical headless acceptance sequence. It is expected to fail with `NotImplementedError` until the domain engine milestone is implemented.
- `npm run typecheck` checks strict TypeScript contracts and tests.
- `npm run lint` runs ESLint for Next.js and TypeScript.
- `npm run format:check` checks formatting with Prettier.
- `npm run check` runs every static check followed by the acceptance test.

## Architecture boundaries

- `src/domain` contains framework-independent contracts only.
- `src/application/engine` exposes the future engine API and currently throws `NotImplementedError` deliberately.
- `src/application/state-machine` is reserved for later orchestration.
- `src/infrastructure/adapters` is the only future boundary for external systems.
- `src/demo/fixtures` contains deterministic, offline acceptance inputs.
- `src/app` is a minimal Next.js scaffold; product interface work is intentionally deferred.

No API routes, live integrations, browser extension, or complete engine are included in this milestone.
