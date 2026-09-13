# Implementation status

This document distinguishes runnable functionality from external validation and deployment work. The product is a single-user workflow-learning application, not an enterprise automation service certification.

| Area | Implemented | Remaining validation or boundary |
| --- | --- | --- |
| Branding and UI | Supplied logo, landing, onboarding, responsive workspace, graph, workflow detail, activity, privacy, Ghost Run | Real browser checks run in CI; device-specific assistive-technology review remains useful |
| Offline learning | Two semantic observations, weighted similarity, inferred understanding, confidence discount, variable provenance | Compiler intentionally supports complete support-triage workflows; arbitrary process induction is outside this release |
| Adaptation | Six departments, explicit owner/channel routing, unseen billing reassignment, ambiguous review | Model interpretation is bounded by the same schema; it cannot grant authority |
| Safety/execution | Exact-plan approval, independent policy, ordered adapters, receipts, replay suppression, resumable failures | No cross-process durable receipt ledger; uncertain real writes require reconciliation |
| Understanding/research | OpenRouter, OpenAI-compatible, Gemini, Exa, validation and deterministic fallback | Real provider credentials have not been exercised during development verification |
| Trackers/chat | GitHub Issues, ClickUp, Jira Cloud, Slack webhooks | Real account IDs, permissions, labels and custom Jira fields require setup; priority schemes are not inferred |
| Gmail | OAuth read/send scopes; optional TLS IMAP/SMTP with explicit send capability | Real OAuth consent and app-password eligibility must be tested in the user's account |
| Browser extension | MV3 pairing, privacy controls, bounded queue, supported confirmation hooks | DOM hooks are conservative and require acceptance testing against current real app UIs |
| CopilotKit | Genuine optional v2 runtime, AG-UI HttpAgent and proposal stream | Runtime availability is independently tested; it has no execution/approval authority |
| Ambiguous | Named configuration and a fail-closed adapter boundary | Vendor API contract could not be verified; integration is unavailable, not simulated |
| Deployment | Standard Node production build, standalone container recipe, optional Cloudflare demo template | No deployment performed; live multi-tenant authentication, durable storage, queues and secret management remain infrastructure work |

Default Demo Mode is designed to be independently presentable without any of the live services. Do not represent the optional adapters' mocked tests as evidence that an external account has been connected or a real action has succeeded.
