# Rehearsal Demo

## Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000/workspace`. Demo Mode is the default and needs no `.env` file.

## Canonical Script

1. Reset the workspace from the top bar if state is already present.
2. Run **Observation 1**. The login report follows the manual support-triage sequence. Confirm that no pattern appears after one trace.
3. Run **Observation 2**. The API-timeout report varies the sequence slightly. Watch live confidence rise, then review the discovered pattern.
4. Open the memory map and inspect generalized customer, issue, department, and owner values.
5. Activate the workflow deliberately.
6. Deliver the unseen duplicate-billing report.
7. Inspect the Preview Run. Confirm Billing routes to Tehsin, every proposed action is resolved, and the interface states that no external changes have been made.
8. Approve and execute. Confirm one issue, one assignment, one team notification, one customer reply, verification, and savings.

## Failure and Retry

1. Reset, then run both observations and activate the pattern.
2. Open the hidden demo console with `Ctrl/Cmd + Shift + D`.
3. Select **Team notification** as the deterministic failure point.
4. Deliver the billing report and approve it.
5. Confirm execution stops at notification, the issue and assignment remain successful, and later actions remain unattempted.
6. Retry. Confirm no second issue is created and only missing work resumes.

## Human Review

1. With the workflow active and no run in progress, deliver the ambiguous report.
2. Confirm the run enters `needs_review` and Execute is disabled.
3. Select a valid owner and reviewer identity.
4. Confirm the resolved choice is recorded as a human selection before approval becomes available.

## Manual Interaction

The replica Mail, Issue Tracker, and Team Chat surfaces can also teach the workflow manually. Guide rings identify the next expected semantic action. Noise mail can be read without starting a support trace.

## Shortcuts

- `Ctrl/Cmd + K` — command palette
- `Ctrl/Cmd + Shift + D` — hidden demo console
- `Escape` — close the active overlay

## Automated Proof

```bash
npm run verify
npm test
```

`npm run verify` performs the successful path, failure and retry, ambiguous review, privacy redaction, progressive confidence, generalization, and a strict zero-network assertion.
