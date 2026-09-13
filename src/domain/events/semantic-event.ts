import type { SemanticAction, SourceApplication } from "./taxonomy.ts";
export interface SemanticEvent {
    readonly id: string;
    readonly traceId: string;
    readonly occurredAt: string;
    readonly sourceApplication: SourceApplication;
    readonly action: SemanticAction;
    readonly intent: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly confidence: number;
    readonly origin: "observed" | "inferred" | "executed";
    readonly estimatedEffortSeconds: number;
}
