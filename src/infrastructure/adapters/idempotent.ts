import type { ExecutionAdapter } from "../../domain/runs/ports.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import { IntegrationError } from "../api-clients/http.ts";
// In-process single-flight receipts. Uncertain live outcomes are deliberately not retried.
export class IdempotentAdapter implements ExecutionAdapter {
    readonly name: string;
    readonly #adapter: ExecutionAdapter;
    readonly #receipts = new Map<string, {
        digest: string;
        promise: ReturnType<ExecutionAdapter["perform"]>;
    }>();
    constructor(adapter: ExecutionAdapter) { this.#adapter = adapter; this.name = adapter.name; }
    async perform(action: PlannedAction) {
        const digest = JSON.stringify({ action: action.action, input: action.resolvedInput });
        const old = this.#receipts.get(action.idempotencyKey);
        if (old) {
            if (old.digest !== digest)
                throw new IntegrationError("IDEMPOTENCY_CONFLICT", "This action key is bound to different parameters.");
            return old.promise;
        }
        const promise = this.#adapter.perform(action).catch(error => ({ status: "failed" as const, error: { code: error instanceof IntegrationError ? error.code : "OUTCOME_UNKNOWN", message: error instanceof IntegrationError ? error.message : "The live system did not confirm the result. Reconcile the destination before another attempt.", retryable: error instanceof IntegrationError && error.retryable } }));
        this.#receipts.set(action.idempotencyKey, { digest, promise });
        const result = await promise;
        if (result.status === "failed" && result.error?.retryable)
            this.#receipts.delete(action.idempotencyKey);
        return result;
    }
}
