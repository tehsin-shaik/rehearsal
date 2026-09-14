import type { PreviewPlannedAction } from "../../domain/runs/preview-run-types.ts";
import type {
  ApplicationWorkflow,
  RehearsalState,
  WorkspaceMailMessage,
} from "./types.ts";

export function selectActiveWorkflow(
  state: RehearsalState,
): ApplicationWorkflow | null {
  return (
    state.engine.workflows.find(
      (workflow) => workflow.lifecycle === "active",
    ) ?? null
  );
}

export function selectInspectedWorkflow(
  state: RehearsalState,
): ApplicationWorkflow | null {
  const inspectedPatternId = state.engine.inspectedPatternId;
  if (inspectedPatternId === null) {
    return null;
  }

  return (
    state.engine.workflows.find(
      (workflow) => workflow.pattern.id === inspectedPatternId,
    ) ?? null
  );
}

export function selectObservedCount(state: RehearsalState): number {
  return state.engine.completedTraces.filter(
    (trace) => trace.status === "completed",
  ).length;
}

export function selectSelectedMessage(
  state: RehearsalState,
): WorkspaceMailMessage | null {
  return (
    state.workspace.inboxMessages.find(
      (message) => message.id === state.workspace.selectedMessageId,
    ) ?? null
  );
}

export function selectNextExpectedAction(
  state: RehearsalState,
): PreviewPlannedAction | null {
  const run = state.engine.activeRun;
  if (run === null) {
    return null;
  }

  return (
    run.plannedActions.find(
      (action) =>
        action.status === "planned" ||
        action.status === "approved" ||
        action.status === "needs_review" ||
        action.status === "failed" ||
        action.status === "not_attempted",
    ) ?? null
  );
}

export function selectStoredObservationCount(state: RehearsalState): number {
  return (
    state.engine.completedTraces.reduce(
      (count, trace) => count + trace.events.length,
      0,
    ) + (state.engine.activeTrace?.events.length ?? 0)
  );
}
