# Architecture

Rehearsal separates observed evidence, a learned workflow, a proposed run, approval, and effects. React never implements classification, policy, or adapter execution rules.

## Boundaries

| Directory | Responsibility |
| --- | --- |
| `src/domain/events` | Canonical taxonomy, redaction, normalization, latent steps, trace lifecycle |
| `src/domain/patterns` | Weighted trace comparison, discovery, support-triage compilation |
| `src/domain/understanding` | Evidence-backed interpretation and explicit department routing |
| `src/domain/policy` | Permission decisions derived from action identity |
| `src/domain/runs` | Resolved plans, approvals, adapter contracts, receipts |
| `src/application` | State transitions, session commands, ordered executor |
| `src/demo` | Fixture reports and in-memory adapters with the same contracts |
| `src/store` | Zustand bridge and engine/workspace/presentation/integration slices |
| `src/infrastructure` | Model/research clients, real adapters, session authorization |
| `src/app/api` | Validated server entry points, plan ownership, approval and execution |
| `src/ui` | Work surfaces, dialogs, diagrams, timeline and privacy controls |
| `extension` | Opt-in browser observation; metadata only |
| `integrations/node-services` | Optional IMAP/SMTP and CopilotKit SDK process |

## Learning

The trace builder associates normalized semantic events with a trace. Creating an issue can imply earlier extraction and classification; inferred events retain their origin and lower confidence. Paused and excluded activity is discarded before event creation.

Trace comparison combines normalized weighted Levenshtein action similarity (55%), source-application Jaccard similarity (20%), and intent-vector cosine similarity (25%). The threshold is 0.82. Sample-size discounting prevents two examples from being advertised as certainty. The compiler requires two matching, completed support traces containing creation, assignment, team notification and customer reply.

The compiler produces five stages and thirteen variables. Identity/title/description are extracted; category/department/severity/labels are classified; owner/channel are routed; identifiers/messages are generated. Even identical example values remain variables. Only explicitly authored scalar fields that remain invariant across all matching observations can become constants. Nested objects cannot smuggle customer identity into constants.

## Planning and approval

Understanding includes literal evidence, confidence, provider provenance and a review requirement. Unknown, conflicting or insufficient evidence causes `needs_review`. Department selection by a human produces a new unapproved Ghost Run. Live plans also check tracker configuration, external owner mapping, the matching Slack webhook, and Gmail sending permission.

The proposal contains exact report-derived values and destinations. An issue number is an explicit future output of issue creation; downstream actions refer to it as a pending issue until the adapter returns the real identifier. No creation, assignment or sending occurs during preview.

Approval binds to the semantic plan. Activation only permits planning future reports; it never approves their execution. The API accepts run/action IDs, not replacement destinations, permissions, or client-provided executable plans.

## Execution

The executor runs actions in order and publishes progress after each transition. It derives required permissions independently of client labels. Payments are always blocked. A successful receipt contains the adapter identity, timestamps and external reference where applicable. Issue creation rewrites downstream references using the returned identifier and URL.

Concurrent requests share in-flight work. Confirmed receipts are reused on replay. Failure stops the sequence and marks remaining actions unattempted; retry skips completed work. Unknown network outcomes are non-retryable until reconciled because a vendor may have accepted the write before the response was lost. Completion is verified from exactly one successful receipt per action, rather than a status label alone.

The offline session keeps processed-report metadata separate from visible history. Clearing history cannot permit duplicate effects. Forgetting teaching evidence cannot reuse issue numbers. Reset is the intentional way to repeat the entire demo.

## Server and optional runtime

Live session cookies are HTTP-only, same-site Lax, short-lived and secure under HTTPS. Every mutation checks a configured Origin and session ownership. Observation pairing grants only the ability to submit metadata, never execution approval. Sessions, observations and runs are bounded.

Native `/api/ag-ui` streams complete `proposeAction` and `proposeRun` tool calls from a server-owned plan. Optional `/api/copilotkit` forwards to a loopback-only CopilotKit v2 runtime, whose `HttpAgent` consumes that stream. The SDK has no approval or execution tool. SMTP/IMAP use the same authenticated local service process. Neither optional service starts in default Demo Mode.

Memory-backed session/receipt storage is the principal deployment limitation. A production implementation should replace it with durable transactions and a job queue, tenant-scoped authorization, secret storage, and explicit reconciliation records. The domain ports are the boundary for those changes.
