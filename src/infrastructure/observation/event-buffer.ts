import { normalizeSemanticEvent } from "../../domain/events/event-normalizer.ts";
import type { SemanticEvent } from "../../domain/events/semantic-event.ts";
import type { z } from "zod";

import type { observationEventSchema } from "../validation/api-schemas.ts";
import { sanitizeObservationPayload } from "./event-sanitizer.ts";

export const MAX_OBSERVATION_BATCH_SIZE = 50;
export const MAX_BUFFERED_OBSERVATIONS = 500;

export type UntrustedObservation = z.output<typeof observationEventSchema>;

export interface BufferedObservation {
  readonly sequence: number;
  readonly receivedAt: string;
  readonly event: SemanticEvent;
}

export interface BufferedTraceCompletion {
  readonly sequence: number;
  readonly receivedAt: string;
  readonly traceId: string;
}

export class ObservationEventBuffer {
  readonly #maximumSize: number;
  #lastSequence: number;
  #records: BufferedObservation[] = [];
  #completions: BufferedTraceCompletion[] = [];

  constructor(maximumSize = MAX_BUFFERED_OBSERVATIONS) {
    if (!Number.isSafeInteger(maximumSize) || maximumSize < 1) {
      throw new RangeError(
        "Observation buffer size must be a positive integer.",
      );
    }

    this.#maximumSize = maximumSize;
    this.#lastSequence = Date.now() * 1_000;
  }

  append(
    observations: readonly UntrustedObservation[],
    receivedAt = new Date().toISOString(),
  ): readonly BufferedObservation[] {
    if (observations.length > MAX_OBSERVATION_BATCH_SIZE) {
      throw new RangeError(
        `Observation batches cannot exceed ${MAX_OBSERVATION_BATCH_SIZE} events.`,
      );
    }

    const appended = observations.map((observation) => {
      const event = normalizeSemanticEvent({
        ...observation,
        payload: sanitizeObservationPayload(observation.payload ?? {}),
      });
      if (event === null) {
        throw new TypeError("The observation was excluded by policy.");
      }

      this.#lastSequence = this.#nextSequence();
      return {
        sequence: this.#lastSequence,
        receivedAt,
        event,
      };
    });

    this.#records = [...this.#records, ...appended].slice(-this.#maximumSize);
    return appended;
  }

  appendCompletions(
    traceIds: readonly string[],
    receivedAt = new Date().toISOString(),
  ): readonly BufferedTraceCompletion[] {
    const appended = [...new Set(traceIds)].map((traceId) => ({
      sequence: this.#nextSequence(),
      receivedAt,
      traceId: traceId.trim(),
    }));
    this.#completions = [...this.#completions, ...appended].slice(
      -this.#maximumSize,
    );
    return appended;
  }

  #nextSequence(): number {
    this.#lastSequence = Math.max(Date.now() * 1_000, this.#lastSequence + 1);
    return this.#lastSequence;
  }

  after(sequence: number): readonly BufferedObservation[] {
    return this.#records.filter((record) => record.sequence > sequence);
  }

  completionsAfter(sequence: number): readonly BufferedTraceCompletion[] {
    return this.#completions.filter((record) => record.sequence > sequence);
  }

  clear(): void {
    this.#records = [];
    this.#completions = [];
  }

  get size(): number {
    return this.#records.length;
  }

  get completionSize(): number {
    return this.#completions.length;
  }
}

export const observationEventBuffer = new ObservationEventBuffer();
