"use client";

import type { ApplicationPhase } from "../../application/state-machine/phases";
import { useRehearsalState } from "../providers/rehearsal-provider";
import { Icon } from "../ui/icon";
import { cx } from "../ui/primitives";

const RAIL = [
  "Observe",
  "Compare",
  "Learn",
  "Preview Run",
  "Approve",
  "Execute",
] as const;

function phaseIndex(phase: ApplicationPhase): number {
  if (phase === "idle" || phase === "observing") return 0;
  if (phase === "comparing") return 1;
  if (
    phase === "pattern_discovered" ||
    phase === "agent_ready" ||
    phase === "trigger_detected" ||
    phase === "planning"
  )
    return 2;
  if (phase === "preview_ready" || phase === "needs_review") return 3;
  if (phase === "executing") return 5;
  if (phase === "completed" || phase === "failed") return 5;
  return 2;
}

export function WorkflowRail() {
  const phase = useRehearsalState((state) => state.engine.phase);
  const run = useRehearsalState((state) => state.engine.activeRun);
  const current = phaseIndex(phase);
  const approvalComplete =
    run?.approval.status === "approved" ||
    phase === "completed" ||
    phase === "failed" ||
    phase === "executing";

  return (
    <nav aria-label="Workflow progress" className="workflow-rail">
      {RAIL.map((label, index) => {
        const completed =
          index < current ||
          (index === 4 && approvalComplete) ||
          phase === "completed";
        const active =
          index === current && phase !== "completed" && phase !== "failed";
        const preview = active && (index === 3 || index === 4 || index === 5);
        return (
          <div
            className={cx(
              "rail-step",
              completed && "is-complete",
              active && "is-active",
              preview && "is-preview",
              phase === "failed" && index === 5 && "is-failed",
            )}
            key={label}
          >
            <span className="rail-step__node">
              {completed ? <Icon name="check" size={9} /> : index + 1}
            </span>
            <span className="rail-step__label">{label}</span>
          </div>
        );
      })}
    </nav>
  );
}
