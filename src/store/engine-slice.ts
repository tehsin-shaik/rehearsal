import type { WorkflowTrace } from "../domain/events/workflow-trace.ts";
import type { LearnedPattern } from "../domain/patterns/learned-pattern.ts";
import type { AgentRun } from "../domain/runs/agent-run.ts";
import type { Phase } from "../application/state-machine/transitions.ts";
export interface TimelineEntry {
    id: string;
    timestamp: string;
    kind: "observed" | "inferred" | "decision" | "approval" | "executed" | "failure";
    title: string;
    detail: string;
}
export interface EngineSlice {
    phase: Phase;
    traces: readonly WorkflowTrace[];
    activeTrace: WorkflowTrace | null;
    pattern: LearnedPattern | null;
    run: AgentRun | null;
    history: readonly AgentRun[];
    timeline: readonly TimelineEntry[];
    liveConfidence: number;
}
export const initialEngine = (): EngineSlice => ({ phase: "idle", traces: [], activeTrace: null, pattern: null, run: null, history: [], timeline: [], liveConfidence: 0 });
