"use client";

import {
  useRehearsalApplication,
  useRehearsalState,
} from "../providers/rehearsal-provider";
import { StatusDot } from "../ui/primitives";

function statusMessage(
  phase: string,
  observed: number,
  action: string | null,
): string {
  switch (phase) {
    case "idle":
      return observed === 0
        ? "Ready to observe the first workflow"
        : "Learning from observation 1 of 2";
    case "observing":
      return `Observing semantic work · trace ${observed + 1}`;
    case "comparing":
      return "Comparing traces across action order, applications, and intent";
    case "pattern_discovered":
      return "Pattern ready for review and deliberate activation";
    case "agent_ready":
      return "Workflow active · waiting for a matching report";
    case "trigger_detected":
      return "Matching trigger detected";
    case "planning":
      return "Preparing a fully resolved Preview Run";
    case "preview_ready":
      return "Waiting for human approval";
    case "needs_review":
      return "Owner review required before approval";
    case "executing":
      return `Executing ${action ?? "approved action"}`;
    case "completed":
      return "Completed and verified from adapter-confirmed results";
    case "failed":
      return `Failed at ${action ?? "an action"} · retry preserves prior work`;
    case "cancelled":
      return "Proposed run cancelled";
    default:
      return "Rehearsal ready";
  }
}

export function StatusDock() {
  const { commands } = useRehearsalApplication();
  const engine = useRehearsalState((state) => state.engine);
  const presentation = useRehearsalState((state) => state.presentation);
  const run = engine.activeRun;
  const activeAction =
    run?.plannedActions.find(
      (action) => action.status === "running" || action.status === "failed",
    )?.title ?? null;
  const tone =
    engine.phase === "failed"
      ? "rose"
      : engine.phase === "needs_review"
        ? "amber"
        : engine.phase === "completed"
          ? "teal"
          : engine.phase === "preview_ready" || engine.phase === "executing"
            ? "violet"
            : "cyan";

  return (
    <footer className="status-dock">
      <div className="status-dock__message">
        <StatusDot
          pulse={["observing", "planning", "executing"].includes(engine.phase)}
          tone={tone}
        />
        <span>
          {statusMessage(
            engine.phase,
            engine.completedTraces.length,
            activeAction,
          )}
        </span>
      </div>
      <div className="status-dock__meta">
        <label className="workspace-resize-label">
          Apps{" "}
          <input
            aria-label="Resize replica applications"
            max="440"
            min="150"
            onChange={(event) =>
              commands.setReplicaRowHeight(Number(event.target.value))
            }
            type="range"
            value={presentation.layout.replicaRowHeight}
          />
        </label>
        <span>
          {engine.activeTrace
            ? `${engine.activeTrace.events.length} events`
            : `${engine.completedTraces.length} traces`}
        </span>
        <span>
          {engine.liveConfidence > 0
            ? `${Math.round(engine.liveConfidence * 100)}% match`
            : "policy active"}
        </span>
      </div>
    </footer>
  );
}
