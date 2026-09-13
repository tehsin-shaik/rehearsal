import type { AgentRun } from "../../domain/runs/agent-run.ts";
import type { ExecutionAdapters } from "../../domain/runs/ports.ts";
import { evaluateAction } from "../../domain/policy/guard.ts";
import { planDigest } from "../../domain/runs/planner.ts";
export function verifyRun(run: AgentRun): boolean {
    return run.status === "completed" && run.plannedActions.every(a => a.status === "completed" && run.results.filter(r => r.actionId === a.id && r.status === "succeeded" && r.adapter && r.completedAt).length === 1) && run.results.length === run.plannedActions.length;
}
export class RunExecutor {
    readonly #adapters: ExecutionAdapters;
    readonly #inflight = new Map<string, Promise<AgentRun>>();
    readonly #latest = new Map<string, AgentRun>();
    constructor(adapters: ExecutionAdapters) { this.#adapters = adapters; }
    isRunning(runId: string): boolean { return this.#inflight.has(runId); }
    execute(input: AgentRun, onProgress?: (run: AgentRun) => void, limit = Infinity): Promise<AgentRun> {
        if (input.status === "needs_review")
            return Promise.resolve(input);
        if (input.approval.status !== "approved" || !input.approval.approvedBy)
            return Promise.reject(new Error("Explicit approval is required before execution."));
        if (input.status === "cancelled")
            return Promise.reject(new Error("Cancelled runs cannot execute."));
        const existing = this.#latest.get(input.id);
        const pending = this.#inflight.get(input.id);
        if (existing && input.approval.planDigest !== existing.approval.planDigest)
            return Promise.reject(new Error("Run ID is already bound to another plan."));
        if (pending)
            return pending;
        if (existing?.status === "completed")
            return Promise.resolve(existing);
        const run = existing ?? input;
        if (!existing && input.approval.planDigest !== planDigest(input))
            return Promise.reject(new Error("Plan changed after approval. Review it again."));
        const task = this.#execute(run, onProgress, limit).finally(() => this.#inflight.delete(input.id));
        this.#inflight.set(input.id, task);
        return task;
    }
    async #execute(input: AgentRun, onProgress?: (run: AgentRun) => void, limit = Infinity): Promise<AgentRun> {
        let run: AgentRun = { ...input, status: "executing" };
        const publish = () => { this.#latest.set(run.id, run); onProgress?.(run); };
        publish();
        let attempted = 0;
        for (let index = 0; index < run.plannedActions.length; index++) {
            const action = run.plannedActions[index];
            if (run.results.some(r => r.actionId === action.id && r.status === "succeeded"))
                continue;
            if (attempted >= limit) {
                publish();
                return run;
            }
            attempted++;
            const policy = evaluateAction(action, run.approval.status === "approved", !run.understanding.reviewRequired && !!run.understanding.owner);
            run = { ...run, policyDecisions: [...run.policyDecisions.filter(d => d.actionId !== action.id), policy] };
            if (policy.effect !== "allow")
                throw new Error(policy.reason);
            const started = new Date().toISOString();
            run = { ...run, plannedActions: run.plannedActions.map(a => a.id === action.id ? { ...a, status: "executing" } : a) };
            publish();
            const adapter = action.action === "reply_to_customer" ? this.#adapters.mail : action.action === "send_team_notification" ? this.#adapters.messaging : this.#adapters.tracker;
            let receipt;
            try {
                receipt = action.action === "analyze_report" ? { status: "succeeded" as const } : await adapter.perform(action);
            }
            catch {
                receipt = { status: "failed" as const, error: { code: "ADAPTER_FAILURE", message: "The adapter did not confirm success. Inspect the destination before retrying an uncertain live write.", retryable: false } };
            }
            const result = { ...receipt, actionId: action.id, adapter: action.action === "analyze_report" ? "local-analysis" : adapter.name, attemptedAt: started, completedAt: new Date().toISOString(), idempotencyKey: action.idempotencyKey };
            run = { ...run, results: [...run.results.filter(r => r.actionId !== action.id), result], plannedActions: run.plannedActions.map(a => a.id === action.id ? { ...a, status: receipt.status === "succeeded" ? "completed" : "failed" } : a) };
            if (receipt.status !== "succeeded") {
                run = { ...run, status: "failed", plannedActions: run.plannedActions.map((a, i) => i > index ? { ...a, status: "not_attempted" } : a) };
                publish();
                return run;
            }
            if (action.action === "create_issue" && receipt.externalReference) {
                const pending = `Pending issue · ${run.understanding.issue.title}`;
                const reference = receipt.externalReference;
                const rewrite = (value: unknown): unknown => typeof value === "string" ? value.split(pending).join(reference) : Array.isArray(value) ? value.map(rewrite) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)])) : value;
                run = { ...run, plannedActions: run.plannedActions.map((a, i) => i > index ? { ...a, resolvedInput: { ...rewrite(a.resolvedInput) as Record<string, unknown>, ...(receipt.externalUrl ? { issueUrl: receipt.externalUrl } : {}) } } : a) };
            }
            publish();
        }
        run = { ...run, status: "completed" };
        if (!verifyRun(run))
            throw new Error("Execution verification failed.");
        publish();
        return run;
    }
}
