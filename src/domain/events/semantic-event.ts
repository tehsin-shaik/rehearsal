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

export function deduplicateSemanticEvents(
  events: readonly SemanticEvent[],
): readonly SemanticEvent[] {
  const eventIds = new Set<string>();

  return events.filter((event) => {
    if (eventIds.has(event.id)) {
      return false;
    }

    eventIds.add(event.id);
    return true;
  });
}
