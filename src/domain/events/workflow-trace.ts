import type { SemanticEvent } from "./semantic-event.ts";
export interface WorkflowTrace {
    readonly id: string;
    readonly status: "observing" | "paused" | "completed" | "abandoned";
    readonly startedAt: string;
    readonly completedAt: string | null;
    readonly events: readonly SemanticEvent[];
}
