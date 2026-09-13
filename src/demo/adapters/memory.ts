import type { ExecutionAdapters, ExecutionAdapter, TrackerIssue, ChatMessage, CustomerReply } from "../../domain/runs/ports.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import type { ActionResult } from "../../domain/runs/action-result.ts";
export class MemoryAdapters implements ExecutionAdapters {
    readonly issues: TrackerIssue[] = [];
    #nextIssue: number;
    constructor(firstIssue = 1043) {
        this.#nextIssue = firstIssue;
    }
    readonly messages: ChatMessage[] = [];
    readonly replies: CustomerReply[] = [];
    readonly #receipts = new Map<string, Awaited<ReturnType<ExecutionAdapter["perform"]>>>();
    #failure: PlannedAction["action"] | undefined;
    tracker: ExecutionAdapter = { name: "demo-tracker", perform: a => this.perform(a) };
    messaging: ExecutionAdapter = { name: "demo-chat", perform: a => this.perform(a) };
    mail: ExecutionAdapter = { name: "demo-mail", perform: a => this.perform(a) };
    reserveIssueNumber(number: number): void {
        this.#nextIssue = Math.max(this.#nextIssue, number + 1);
    }
    failOnce(action: PlannedAction["action"]): void {
        this.#failure = action;
    }
    async perform(action: PlannedAction): Promise<Pick<ActionResult, "status" | "externalReference" | "externalUrl" | "error">> {
        const prior = this.#receipts.get(action.idempotencyKey);
        if (prior)
            return prior;
        if (this.#failure === action.action) {
            this.#failure = undefined;
            return { status: "failed", error: { code: "DEMO_INJECTED_FAILURE", message: "Simulated delivery failure. Completed actions are preserved; retry is safe.", retryable: true } };
        }
        const p = action.resolvedInput;
        let reference: string | undefined;
        if (action.action === "create_issue") {
            reference = `RHR-${this.#nextIssue++}`;
            this.issues.push({ id: reference, title: String(p.title), description: String(p.description), labels: p.labels as string[], severity: String(p.severity), department: String(p.department), owner: null });
        }
        else if (action.action === "assign_owner") {
            const issue = this.issues.find(i => i.id === p.issueReference);
            if (!issue)
                throw new Error("The confirmed issue could not be found.");
            issue.owner = String(p.owner);
            reference = issue.id;
        }
        else if (action.action === "send_team_notification") {
            reference = `message-${this.messages.length + 1}`;
            this.messages.push({ id: reference, channel: String(p.channel), author: "Rehearsal", text: String(p.text), issueReference: String(p.issueReference) });
        }
        else if (action.action === "reply_to_customer") {
            reference = `reply-${this.replies.length + 1}`;
            this.replies.push({ id: reference, to: String(p.to), subject: String(p.subject), text: String(p.text), reportId: String(p.reportId) });
        }
        const result = { status: "succeeded" as const, externalReference: reference };
        this.#receipts.set(action.idempotencyKey, result);
        return result;
    }
}
