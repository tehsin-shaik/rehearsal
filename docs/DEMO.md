# Demonstration walkthrough

Allow four to six minutes. Start with `npm run dev` and the default demo flags. The original supplied logo is used throughout the product.

1. **Explain the premise.** Open the landing page: Rehearsal observes meaningful work, finds a repeating process, then asks before acting. Onboarding explains what is captured and ignored.
2. **Teach Alex's report.** In `/workspace`, select Start first observation. Read the report, inspect details, draft and label the issue, assign Umar, create it, open the team channel, draft/send the notification, then draft/send the reply. The timeline distinguishes observed work from inferred understanding. One example produces evidence, not a workflow.
3. **Teach Priya's report.** Complete the second example. The additional read is intentional variation. The same semantic process repeats despite different customer, problem, and message text.
4. **Inspect the learned workflow.** Review the comparison scores, sample-size discount, variables and five stages. The two examples both used Umar, but `owner` remains routed from `issue.department`. Activate the workflow.
5. **Challenge it with Daniel's report.** Deliver the unseen duplicate-charge report. Inspect Ghost Run. The report is Billing, the owner changes to Awaiz, and the channel changes to billing-finance. The UI shows evidence, adaptations, exact messages and required permissions. No action has executed.
6. **Approve once.** Approve & execute. The issue appears, assignment is confirmed, the team receives its notification and the customer receives a reply. Downstream messages use the created issue number. The run finishes only when all five actions have verified receipts.
7. **Show judgment.** Try the ambiguous report. Approval is absent while routing is unresolved. Choose the department explicitly, review the revised Ghost Run, then separately approve it.
8. **Show recovery and privacy.** Reset; use the demo console to teach the same two observations quickly. Arm a failure before executing the next run. Retry preserves completed receipts. Open Privacy to pause observation, exclude sources, clear visible history or forget the workflow.

## Keyboard and presentation controls

- Ctrl/Cmd+K: command palette.
- Ctrl/Cmd+Shift+D: demo console; its shortcuts invoke the same session commands.
- G: inspect an available Ghost Run when focus is outside an input.
- Escape: close a modal. Native dialogs manage focus and keyboard containment.
- Workspace height control: resize the work surfaces; only layout preferences persist locally.
- Completion sound is optional and off by default. Motion respects reduced-motion preferences.

The demo's effort and time-saved figures are estimates derived from semantic events, not measured productivity claims. Page refresh resets workflow state; client-side navigation preserves it. Use the Reset command to replay the whole scenario intentionally.
