import {
  normalizeSemanticEvent,
  type EventNormalizationOptions,
  type SemanticEventInput,
} from "./event-normalizer.ts";
import { inferLatentStepInputs } from "./latent-step-inference.ts";
import type { SemanticEvent } from "./semantic-event.ts";
import type { WorkflowTrace } from "./workflow-trace.ts";

export type TraceEventInput = Omit<SemanticEventInput, "traceId">;
export const MAX_TRACE_EVENTS = 200;

interface SemanticTraceBuilderOptions extends EventNormalizationOptions {
  readonly traceId: string;
  readonly startedAt: string;
}

function normalizedTimestamp(timestamp: string): string {
  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    throw new RangeError(`Invalid trace timestamp: ${timestamp}`);
  }

  return parsedTimestamp.toISOString();
}

export class SemanticTraceBuilder {
  readonly #traceId: string;
  readonly #startedAt: string;
  readonly #normalizationOptions: EventNormalizationOptions;
  readonly #events: SemanticEvent[] = [];
  #status: WorkflowTrace["status"] = "observing";
  #completedAt: string | null = null;

  constructor(options: SemanticTraceBuilderOptions) {
    this.#traceId = options.traceId.trim();
    this.#startedAt = normalizedTimestamp(options.startedAt);
    this.#normalizationOptions = {
      excludedApplications: options.excludedApplications,
    };
  }

  append(input: TraceEventInput): readonly SemanticEvent[] {
    if (this.#status === "paused") {
      return [];
    }

    if (this.#status !== "observing") {
      throw new Error(`Cannot append events to a ${this.#status} trace.`);
    }

    const eventInput: SemanticEventInput = {
      ...input,
      traceId: this.#traceId,
    };
    const observedEvent = normalizeSemanticEvent(
      eventInput,
      this.#normalizationOptions,
    );

    if (observedEvent === null) {
      return [];
    }

    const inferredEvents = inferLatentStepInputs(
      this.#events,
      eventInput,
    ).flatMap((inferredInput) => {
      const inferredEvent = normalizeSemanticEvent(
        inferredInput,
        this.#normalizationOptions,
      );
      return inferredEvent === null ? [] : [inferredEvent];
    });
    const knownEventIds = new Set(this.#events.map((event) => event.id));
    const appendedEvents = [...inferredEvents, observedEvent].filter(
      (event) => {
        if (knownEventIds.has(event.id)) {
          return false;
        }

        knownEventIds.add(event.id);
        return true;
      },
    );
    if (this.#events.length + appendedEvents.length > MAX_TRACE_EVENTS) {
      throw new RangeError(
        `A semantic trace cannot exceed ${MAX_TRACE_EVENTS} events.`,
      );
    }
    this.#events.push(...appendedEvents);
    return appendedEvents;
  }

  pause(): void {
    if (this.#status === "observing") {
      this.#status = "paused";
    }
  }

  resume(): void {
    if (this.#status === "paused") {
      this.#status = "observing";
      return;
    }

    if (this.#status !== "observing") {
      throw new Error(`Cannot resume a ${this.#status} trace.`);
    }
  }

  complete(completedAt: string): WorkflowTrace {
    if (this.#status !== "observing" && this.#status !== "paused") {
      throw new Error(`Cannot complete a ${this.#status} trace.`);
    }

    this.#status = "completed";
    this.#completedAt = normalizedTimestamp(completedAt);
    return this.toTrace();
  }

  abandon(completedAt: string): WorkflowTrace {
    if (this.#status === "completed" || this.#status === "abandoned") {
      throw new Error(`Cannot abandon a ${this.#status} trace.`);
    }

    this.#status = "abandoned";
    this.#completedAt = normalizedTimestamp(completedAt);
    return this.toTrace();
  }

  toTrace(): WorkflowTrace {
    return {
      id: this.#traceId,
      status: this.#status,
      startedAt: this.#startedAt,
      completedAt: this.#completedAt,
      events: [...this.#events],
    };
  }
}
