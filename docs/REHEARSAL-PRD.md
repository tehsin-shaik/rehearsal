# Rehearsal Product Requirements Document

**Status:** Draft 0.1

**Product name:** Rehearsal

**Product type:** Human-supervised workflow-learning agent

**Initial scope:** From-scratch implementation of the complete Rehearsal MVP experience

## 1. Executive Summary

Rehearsal observes how a person completes a repetitive workflow, converts those observations into semantic traces, detects repetition, compiles a reusable workflow, and proposes future runs for human approval.

The first release focuses on one constrained workflow: triaging inbound customer support reports across a mail inbox, issue tracker, and team chat. The product must demonstrate that it learns the process rather than memorizing values. After observing two similar manual runs, it should recognize the pattern, adapt a third unseen report to the correct department and owner, present a fully resolved “Preview Run,” and make no external changes until a person approves it.

The MVP must work entirely offline and deterministically. Live AI and third-party integrations are later additions built behind the same interfaces.

## 2. Product Vision

Enable people to create safe automations by working normally instead of writing rules, prompts, or process documents.

**Positioning:** Teach it through work. Inspect what it learned. Approve before it acts.

## 3. Problem Statement

Knowledge workers repeatedly move information between tools, interpret it, apply organizational rules, and communicate the result. Existing automation products commonly require users to:

- Know in advance that a process should be automated.
- Manually define triggers, fields, branches, and integrations.
- Trust opaque AI behavior without seeing a resolved plan.
- Choose between brittle replay automation and unconstrained autonomous agents.

Rehearsal should bridge that gap by learning semantic behavior, generalizing variable values, and preserving human control over consequential actions.

## 4. Goals

### 4.1 MVP Goals

1. Observe a support-triage workflow as semantic actions rather than clicks or coordinates.
2. Detect repetition only after sufficient evidence.
3. Compile repeated traces into an inspectable workflow pattern.
4. Generalize customers, issue details, departments, owners, and generated messages.
5. Present a resolved Preview Run before any consequential action occurs.
6. Require human approval for external creation, messaging, deletion, or other consequential actions.
7. Execute safely, stop on failure, and resume without duplicating completed work.
8. Run without accounts, API keys, or network access in Demo Mode.
9. Explain what was observed, inferred, generalized, adapted, and executed.

### 4.2 Later Goals

- Connect real mail, issue trackers, and messaging systems.
- Use an LLM for structured report understanding with deterministic fallback.
- Add public-context research without leaking customer identity.
- Observe supported websites through a browser extension.
- Persist workflows, runs, approvals, and audit events.
- Support multiple users, teams, and workflow types.

## 5. Non-Goals for the MVP

- General-purpose desktop or OS automation.
- Learning arbitrary workflows from any application.
- Recording raw keystrokes, coordinates, screenshots, or CSS selectors.
- Fully autonomous external actions without approval.
- Automatic discovery of every business rule.
- Model training or fine-tuning.
- Production authentication, billing, multi-tenancy, encryption, or durable job execution.
- Guaranteed compatibility with changing third-party website DOMs.

## 6. Target Users

### Operations Specialist

Repeatedly triages incoming requests and wants repetitive steps automated without learning an automation builder.

### Team Lead

Wants consistent routing, visible decision evidence, approval controls, and an audit trail.

### Evaluator or Demo Viewer

Needs to understand the product’s value and safety model in one short, deterministic session.

## 7. Canonical MVP Scenario

The product will ship with three replica work surfaces: Mail, Issue Tracker, and Team Chat.

1. The user manually triages a login failure report.
2. Rehearsal records the semantic workflow but does not claim a pattern after one observation.
3. The user manually triages a second, similar API timeout report with a small variation in action sequence.
4. Rehearsal detects the repeated pattern and shows its confidence and evidence.
5. The user inspects and activates the learned workflow.
6. A third, unseen billing report arrives.
7. Rehearsal classifies the report, adapts the department from technical support to billing, and routes ownership from Umar to Awaiz.
8. A Preview Run shows every proposed action, resolved value, permission, risk, and destination.
9. Nothing external changes until the user approves the run.
10. After approval, the run creates and assigns the issue, drafts and sends the team notification, and replies to the customer.
11. A separate ambiguous report must stop for human review rather than guess.

## 8. Product Principles

1. **Meaning over mechanics:** Store semantic intent, not physical interaction details.
2. **Evidence before automation:** One observation is not a pattern.
3. **Derive instead of memorize:** A repeated value is not necessarily a constant.
4. **Preview before consequence:** Every run is inspectable before execution.
5. **Policy over model judgment:** Deterministic code decides what is allowed.
6. **Fail closed:** Missing confidence, approval, or configuration blocks consequential work.
7. **Offline first:** The core experience must not depend on network availability.
8. **Visible provenance:** Users should know where each important value came from.

## 9. Functional Requirements

### 9.1 Observation and Normalization — P0

- **OBS-01:** Capture actions using a fixed semantic action taxonomy.
- **OBS-02:** Associate events with an active workflow trace.
- **OBS-03:** Record source application, action, intent, structured data, confidence, origin, and estimated effort.
- **OBS-04:** Infer named latent steps when a semantic transition is evident but not directly clicked.
- **OBS-05:** Exclude credentials, secrets, payment data, and configured applications before event creation.
- **OBS-06:** Never store coordinates, selectors, raw key presses, or copied message bodies as observation mechanics.
- **OBS-07:** Allow observation to be paused and resumed.

### 9.2 Pattern Detection — P0

- **PAT-01:** Require at least two completed traces before proposing a pattern.
- **PAT-02:** Compare action sequence, application set, and semantic intent.
- **PAT-03:** Tolerate small variations such as an extra read action.
- **PAT-04:** Use a configurable similarity threshold, initially `0.82`.
- **PAT-05:** Discount confidence when sample size is small.
- **PAT-06:** Expose the component similarity scores and matching trace count.

### 9.3 Pattern Compilation — P0

- **COM-01:** Convert matching traces into a trigger, generalized steps, variables, constants, permissions, and evidence.
- **COM-02:** Treat extracted, classified, routed, and generated values as variables even when observations contain the same value.
- **COM-03:** Treat only explicitly authored, invariant values as candidate constants.
- **COM-04:** Support the initial dependency rule `department -> owner`.
- **COM-05:** Record why an invariant value was generalized instead of memorized.
- **COM-06:** Calculate the observed manual action count and estimated duration.

### 9.4 Report Understanding — P0

- **UND-01:** Extract customer name and email, issue title, description, category, department, severity, labels, evidence, and confidence.
- **UND-02:** Provide a deterministic offline classifier for the canonical fixtures.
- **UND-03:** Allow the result to be `unresolved` when confidence is insufficient.
- **UND-04:** Require evidence to be traceable to literal source text.
- **UND-05:** Route unresolved ownership to human review.

### 9.5 Preview Run Planning — P0

- **PRV-01:** Resolve all workflow variables against the new trigger before presentation.
- **PRV-02:** Show the trigger, understanding, proposed actions, permissions, risk, adaptations, and expected destinations.
- **PRV-03:** Mark unresolved actions as needing review.
- **PRV-04:** Record adaptations such as department and owner changes with the applied rule.
- **PRV-05:** Guarantee that opening or inspecting a Preview Run has no external side effects.

### 9.6 Policy and Approval — P0

- **POL-01:** Classify actions as `read`, `analyze`, `draft`, `create_external`, `send_message`, `delete`, or `payment`.
- **POL-02:** Allow reads, analysis, and drafts without approval.
- **POL-03:** Require approval for external creation, sending, and deletion.
- **POL-04:** Block payment actions in the MVP even when approved.
- **POL-05:** Re-check policy immediately before every action.
- **POL-06:** Refuse execution while any required value remains unresolved.

### 9.7 Execution and Verification — P0

- **EXE-01:** Execute an approved plan in order through adapter interfaces.
- **EXE-02:** Prevent duplicate execution caused by double-clicks or repeated requests.
- **EXE-03:** Stop the run immediately when an action fails.
- **EXE-04:** Preserve completed steps and mark remaining steps as not attempted.
- **EXE-05:** Resume from the failed step without repeating successful consequential actions.
- **EXE-06:** Rewrite downstream references when an external tracker returns a different issue identifier.
- **EXE-07:** Verify that every successful step has a successful adapter result.
- **EXE-08:** Record estimated actions avoided, time saved, and human interventions.

### 9.8 Demo Mode — P0

- **DEM-01:** Demo Mode is enabled by default.
- **DEM-02:** Demo Mode makes zero external network requests.
- **DEM-03:** Use deterministic fixtures, IDs, classification, and in-memory adapters.
- **DEM-04:** Provide controls to reset, run observations, deliver reports, execute runs, and inject failures.
- **DEM-05:** Demo controls must drive the same engine APIs as manual interaction.

### 9.9 User Interface — P0

- **UI-01:** Provide landing, onboarding, workspace, workflows, workflow detail, activity, and privacy views.
- **UI-02:** Present Mail, Issue Tracker, and Team Chat replica applications in the workspace.
- **UI-03:** Present the current workflow phase as a visible narrative rail.
- **UI-04:** Present pattern evidence, memory map, live timeline, and Preview Run inspection surfaces.
- **UI-05:** Keep the primary demo flow usable within one desktop viewport at common presentation sizes.
- **UI-06:** Clearly distinguish observed, inferred, planned, executing, completed, failed, and review-required states.
- **UI-07:** Never imply an external action occurred before an adapter confirms it.
- **UI-08:** Centralize Rehearsal branding so the product name, metadata, logos, and extension labels can be updated without editing domain logic.

### 9.10 Live Integrations — P1

- **LIV-01:** Add model-based understanding behind the same validated understanding contract.
- **LIV-02:** Fall back to deterministic understanding on timeout, invalid output, or unavailable credentials.
- **LIV-03:** Add privacy-filtered public research behind a separate interface.
- **LIV-04:** Support real mail retrieval, issue creation, assignment, team messaging, and customer replies through adapters.
- **LIV-05:** Keep API credentials server-side.
- **LIV-06:** Re-run policy checks on the server for every consequential request.
- **LIV-07:** Show the user the real target system before approval.

### 9.11 Browser Extension — P1

- **EXT-01:** Provide a Manifest V3 extension for explicitly supported sites.
- **EXT-02:** Convert supported DOM interactions into the same semantic event contract used by replica applications.
- **EXT-03:** Reject sensitive fields, query strings, coordinates, selectors, and raw key data.
- **EXT-04:** Revalidate and re-redact extension events on the server.
- **EXT-05:** Buffer temporary delivery failures without retaining sensitive content.

## 10. Experience Requirements

### Main States

`idle -> observing -> comparing -> pattern_discovered -> agent_ready -> trigger_detected -> planning -> preview_ready -> executing -> completed`

Alternate states include `needs_review`, `cancelled`, and `failed` with resumable execution.

### Preview Run Information Hierarchy

1. What triggered the run.
2. What Rehearsal understood and the confidence.
3. What changed from the observed examples.
4. Exactly what actions are proposed.
5. Which actions require approval and why.
6. Where external effects will land.
7. The primary approve, resolve, cancel, or retry action.

### Tone

- Calm, precise, and operational.
- Avoid anthropomorphic claims that imply awareness or certainty.
- Prefer “observed,” “inferred,” “classified,” “proposed,” and “verified.”
- State uncertainty directly and request review instead of guessing.

## 11. Core Data Entities

- **SemanticEvent:** One normalized observed or executed action.
- **WorkflowTrace:** Ordered events representing one manual workflow attempt.
- **IssueUnderstanding:** Structured interpretation of an inbound report.
- **LearnedPattern:** Trigger, generalized steps, variables, constants, confidence, and evidence.
- **PlannedAction:** One fully resolved proposed action with permission and status.
- **AgentRun:** Triggered plan, understanding, approval state, adaptations, results, and metrics.
- **PolicyDecision:** Deterministic allow, block, or approval requirement.
- **ActionResult:** Adapter-confirmed success or failure.
- **TimelineEntry:** User-visible audit event.

## 12. Recommended Architecture

The replica should preserve the current modular engine but avoid recreating a single oversized client store.

```text
src/
  domain/
    events/
    patterns/
    understanding/
    policy/
    runs/
  application/
    engine/
    state-machine/
    commands/
  infrastructure/
    adapters/
    api-clients/
    persistence/
  ui/
    workspace/
    workflows/
    preview-run/
    timeline/
  demo/
    fixtures/
    adapters/
    controls/
extension/
app/api/
```

### Architecture Rules

- Domain modules must be framework-independent TypeScript.
- The engine must run headlessly without React or Next.js.
- UI state must not own policy decisions or execution semantics.
- Demo and live behavior must share the same planner, policy, and executor.
- External systems must be accessed only through typed adapters.
- The model may propose structured understanding but may not approve or execute actions.

## 13. Safety and Privacy Requirements

1. Consequential actions require explicit, attributable approval.
2. Policy enforcement occurs in both client orchestration and server execution boundaries.
3. Sensitive observation fields are denied before storage and rechecked at ingestion.
4. Demo Mode cannot access configured live integrations.
5. External credentials never enter client bundles or browser extension storage.
6. Research queries exclude names, email addresses, and full message bodies.
7. Failed runs must not be presented as successful.
8. Retries must be idempotent for external creation and messaging.
9. The product must disclose that MVP state is browser-local and non-durable.

## 14. Success Metrics

### MVP Validation Metrics

- 100% pass rate for the deterministic headless acceptance suite.
- Zero external calls in Demo Mode.
- Zero consequential actions before approval.
- No duplicate external resource after failure and retry.
- Correct department and owner adaptation for all canonical fixtures.
- Ambiguous fixture always requests review.
- Complete canonical demo flow in under three minutes.

### Future Product Metrics

- Percentage of proposed patterns activated by users.
- Percentage of Preview Runs approved without edits.
- Human actions and time saved per completed run.
- Rate of review-required and corrected classifications.
- Execution failure and duplicate-prevention rates.
- Pattern precision measured against labeled workflows.

## 15. MVP Acceptance Criteria

The MVP is complete when all of the following are true:

1. One completed trace does not create a pattern.
2. Two similar traces with a small sequence variation create a pattern above the configured threshold.
3. The compiler produces a five-stage workflow and does not memorize customer or owner names.
4. A new billing report is classified as billing and assigned to Awaiz through the routing rule.
5. The Preview Run contains no unresolved variable placeholders.
6. An unapproved external creation or message is blocked.
7. Payment is blocked even when a run is approved.
8. An approved run creates one issue, assigns it, sends one team notification, and replies to the customer.
9. A forced notification failure preserves the created issue.
10. Retrying the failed run sends the notification without creating another issue.
11. An ambiguous report waits for owner review and performs no consequential action.
12. Observed payloads contain no coordinates, selectors, credentials, or payment fields.
13. The full flow works without an `.env` file.
14. Branding visible to users says Rehearsal and is controlled from a central configuration module.

## 16. Delivery Plan

### Milestone 0 — Specification and Scaffold

- Create the project, strict TypeScript configuration, test runner, formatting, and centralized brand configuration.
- Convert the canonical scenario and acceptance criteria into failing headless tests.

### Milestone 1 — Domain Engine

- Implement types, taxonomy, normalization, similarity, detection, compilation, understanding, routing, policy, planning, execution, and verification.
- Finish when the complete canonical flow passes headlessly.

### Milestone 2 — Demo Vertical Slice

- Add fixtures and in-memory mail, tracker, messaging, and customer-reply adapters.
- Add failure injection, deterministic timing controls, and reset behavior.

### Milestone 3 — Application Orchestration

- Implement an explicit state machine and commands around the domain engine.
- Keep engine, integration, and presentation state separated.

### Milestone 4 — Workspace UI

- Build the three replica applications, workflow rail, action panel, Preview Run, memory map, and timeline.
- Add onboarding, workflow inspection, activity, privacy, and demo controls.

### Milestone 5 — Hardening

- Add accessibility, responsive behavior, policy-boundary tests, retry tests, privacy tests, type checking, linting, and production builds.

### Milestone 6 — Optional Live Mode

- Add server APIs, validated model understanding, research, real adapters, streaming planning, and the browser extension one integration at a time.

## 17. Recommended Starting Point

Do not begin with the landing page or replica application styling.

Begin by writing one headless acceptance test that performs this sequence:

```text
build trace 1
-> confirm no pattern
-> build varied trace 2
-> detect and compile pattern
-> plan unseen billing report
-> confirm owner adapts to Awaiz
-> confirm execution is blocked without approval
-> approve and execute with in-memory adapters
-> verify one issue and one notification
-> inject failure and prove retry is idempotent
```

Once this test passes, the essential Rehearsal product exists. Everything after it is orchestration, presentation, and integration work.

## 18. Risks and Mitigations

| Risk                                                     | Mitigation                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The demo is mistaken for general computer-use automation | State the constrained taxonomy and supported workflow clearly.                                                  |
| Repeated values are memorized as constants               | Track field provenance and require derivation-aware compilation.                                                |
| A model invents evidence or routes incorrectly           | Validate structured output, require literal evidence, apply confidence floors, and fall back deterministically. |
| UI state bypasses policy                                 | Keep policy in framework-independent code and enforce again at the server boundary.                             |
| Retry creates duplicate tickets or messages              | Persist action results and resume only incomplete steps.                                                        |
| Third-party integrations make the demo unreliable        | Keep deterministic Demo Mode as the default.                                                                    |
| The browser extension captures sensitive data            | Use restricted extractors, deny sensitive fields, and re-scrub server-side.                                     |
| Branding becomes scattered during the rename             | Centralize product name, slug, metadata, copy, and assets from the first commit.                                |

## 19. Open Product Decisions

1. What visual identity and logo should Rehearsal use?
2. Should the first release visually match the current project or only reproduce its behavior?
3. Is the target a demo-quality replica or the foundation of a production product?
4. Should the canonical workflow remain customer-support triage or use a workflow closer to the intended audience?
5. Which live integration should be implemented first after the offline MVP?
