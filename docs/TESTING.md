# Testing and Verification

## Safe Offline Gate

```bash
npm run check
```

`check` runs strict TypeScript, ESLint, Prettier validation, the complete test suite, the offline behavior-to-agent verifier, and AG-UI shape verification. It requires no credentials and performs no external writes.

## Test Suites

| Command                  | Coverage                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:domain`    | Normalization, redaction, latent inference, similarity, detection, compilation, understanding, routing, planning, review, and policy.                                                    |
| `npm run test:execution` | Adapter-confirmed execution, stop-on-failure, idempotency, retry, reference rewriting, and verification.                                                                                 |
| `npm run test:state`     | Phase transitions, command parity, triggers, re-entrancy, review, reset, privacy controls, and extension-feed cursors.                                                                   |
| `npm run test:server`    | Environment defaults, model validation, research privacy, concurrency, server scrubbing, buffers, live adapter selection, Slack confirmation, approval evidence, and remote idempotency. |
| `npm run test:extension` | Manifest completeness, PNG assets, Gmail body exclusion, worker scrubbing, shared traces, delivery, and completion signals.                                                              |
| `npm test`               | Every focused suite plus the canonical headless acceptance flow.                                                                                                                         |

## Offline Behavioral Verification

```bash
npm run verify
```

The verifier installs a global fetch guard and fails on any Demo Mode network attempt. It proves:

- one observation is insufficient;
- confidence increases while the varied second observation develops;
- two traces produce a generalized pattern;
- customer and owner values are runtime variables;
- Billing routes to Tehsin;
- Preview Run values contain no unresolved placeholders;
- unapproved execution is rejected;
- approved execution creates one issue and sends one notification and one reply;
- deterministic failure stops execution;
- retry preserves the issue and performs only remaining work;
- ambiguous input remains under human review;
- sensitive payload fields are removed;
- network request count remains zero.

## AG-UI Verification

```bash
npm run verify:copilotkit
```

This checks the custom Preview Run agent in process. It requires ten progressive `proposeAction` tool calls, one complete `proposeRun`, and zero approval or execution tools.

## Credential-Gated Verification

```bash
npm run verify:live
npm run verify:surfaces
```

The commands load ignored `.env` and `.env.local` files, perform only configured read operations, and print `SKIP` for unavailable services. `verify:live` checks provider connectivity, model-output fallback behavior, Exa response bounds, and research privacy. `verify:surfaces` lists bounded Gmail and tracker data without creating records.

## External-Write Verification

```bash
npm run verify:ambiguous
```

This command skips unless all three conditions are true:

- `AMBIGUOUS_SANDBOX=true`;
- `AMBIGUOUS_BASE_URL` is configured;
- `REHEARSAL_ALLOW_EXTERNAL_WRITES=true` explicitly authorizes the disposable write.

It creates one sandbox task, verifies read-back, and revokes the sandbox. Do not set the write flag for ordinary validation.

## Build Validation

```bash
npm run build
npm run build:cloudflare
```

The normal Next.js build is the required production gate. The OpenNext build is an optional Worker-runtime packaging check and does not deploy.
