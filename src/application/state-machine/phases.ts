export const APPLICATION_PHASES = [
  "idle",
  "observing",
  "comparing",
  "pattern_discovered",
  "agent_ready",
  "trigger_detected",
  "planning",
  "preview_ready",
  "needs_review",
  "executing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type ApplicationPhase = (typeof APPLICATION_PHASES)[number];

const ALLOWED_TRANSITIONS = {
  idle: ["observing", "agent_ready", "trigger_detected"],
  observing: ["comparing", "idle", "cancelled"],
  comparing: ["pattern_discovered", "idle"],
  pattern_discovered: ["agent_ready", "idle"],
  agent_ready: ["observing", "trigger_detected", "idle"],
  trigger_detected: ["planning", "agent_ready", "cancelled"],
  planning: ["preview_ready", "needs_review", "failed", "cancelled"],
  preview_ready: ["executing", "cancelled"],
  needs_review: ["preview_ready", "cancelled"],
  executing: ["completed", "failed"],
  completed: ["agent_ready", "trigger_detected", "idle"],
  failed: ["executing", "cancelled", "agent_ready"],
  cancelled: ["agent_ready", "idle", "trigger_detected"],
} as const satisfies Record<ApplicationPhase, readonly ApplicationPhase[]>;

export class InvalidPhaseTransitionError extends Error {
  readonly from: ApplicationPhase;
  readonly to: ApplicationPhase;

  constructor(from: ApplicationPhase, to: ApplicationPhase) {
    super(`Invalid application phase transition: ${from} -> ${to}.`);
    this.name = "InvalidPhaseTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(
  from: ApplicationPhase,
  to: ApplicationPhase,
): boolean {
  if (from === to) {
    return true;
  }

  return (ALLOWED_TRANSITIONS[from] as readonly ApplicationPhase[]).includes(
    to,
  );
}

export function assertPhaseTransition(
  from: ApplicationPhase,
  to: ApplicationPhase,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidPhaseTransitionError(from, to);
  }
}

export function phaseTransitionsFrom(
  phase: ApplicationPhase,
): readonly ApplicationPhase[] {
  return [...ALLOWED_TRANSITIONS[phase]];
}
