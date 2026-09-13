export type Phase = "idle" | "observing" | "comparing" | "pattern_discovered" | "agent_ready" | "trigger_detected" | "planning" | "ghost_run" | "needs_review" | "executing" | "completed" | "failed" | "cancelled";
const transitions: Record<Phase, readonly Phase[]> = {
    idle: ["observing"], observing: ["comparing", "idle"], comparing: ["observing", "pattern_discovered", "idle"],
    pattern_discovered: ["agent_ready", "idle"], agent_ready: ["trigger_detected", "idle"],
    trigger_detected: ["planning"], planning: ["ghost_run", "needs_review", "failed"],
    ghost_run: ["executing", "cancelled", "planning"], needs_review: ["planning", "cancelled"],
    executing: ["completed", "failed"], completed: ["trigger_detected", "idle"], failed: ["executing", "cancelled", "idle"], cancelled: ["trigger_detected", "idle"],
};
export function transition(from: Phase, to: Phase): Phase {
    if (from === to)
        return from;
    if (!transitions[from].includes(to))
        throw new Error(`Cannot move from ${from} to ${to}.`);
    return to;
}
