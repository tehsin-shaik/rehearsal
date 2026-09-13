import type { AgentRun } from "../../domain/runs/agent-run.ts";
import type { PlannedAction } from "../../domain/runs/planned-action.ts";
import { MemoryAdapters } from "../../demo/adapters/memory.ts";
import { RunExecutor } from "./executor.ts";
export { detectPattern } from "../../domain/patterns/compiler.ts";
export { understandReport } from "../../domain/understanding/classifier.ts";
export { planRun, approveRun } from "../../domain/runs/planner.ts";
const memory = new MemoryAdapters();
const executor = new RunExecutor(memory);
export function executeRun(run: AgentRun, options?: {
    readonly failOnAction?: PlannedAction["action"];
}): Promise<AgentRun> {
    if (options?.failOnAction)
        memory.failOnce(options.failOnAction);
    return executor.execute(run);
}
export function resumeRun(run: AgentRun): Promise<AgentRun> {
    return executor.execute(run);
}
