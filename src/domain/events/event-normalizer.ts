import type { SemanticEvent } from "./semantic-event.ts";
import { redactPayload } from "./redaction.ts";
import { applicationSupportsAction, isSemanticAction, isSourceApplication, SEMANTIC_ACTION_TAXONOMY, type SemanticAction, type SourceApplication, } from "./taxonomy.ts";
export interface SemanticEventInput {
    readonly traceId: string;
    readonly occurredAt: string;
    readonly sourceApplication: SourceApplication;
    readonly action: SemanticAction;
    readonly intent?: string;
    readonly payload?: Readonly<Record<string, unknown>>;
    readonly confidence?: number;
    readonly origin?: SemanticEvent["origin"];
    readonly estimatedEffortSeconds?: number;
}
export interface EventNormalizationOptions {
    readonly excludedApplications?: readonly SourceApplication[];
}
function normalizeTimestamp(timestamp: string): string {
    const parsedTimestamp = new Date(timestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
        throw new RangeError(`Invalid event timestamp: ${timestamp}`);
    }
    return parsedTimestamp.toISOString();
}
function normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}
function normalizeConfidence(value: number | undefined): number {
    if (value === undefined) {
        return 1;
    }
    if (!Number.isFinite(value)) {
        throw new RangeError("Event confidence must be a finite number.");
    }
    return Math.min(1, Math.max(0, value));
}
function normalizeEffort(value: number | undefined, action: SemanticAction): number {
    const effort = value ?? SEMANTIC_ACTION_TAXONOMY[action].defaultEstimatedEffortSeconds;
    if (!Number.isFinite(effort) || effort < 0) {
        throw new RangeError("Estimated effort must be a non-negative number.");
    }
    return effort;
}
function stableSerialize(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
    }
    const record = value as Readonly<Record<string, unknown>>;
    const fields = Object.keys(record)
        .sort()
        .map((fieldName) => `${JSON.stringify(fieldName)}:${stableSerialize(record[fieldName])}`);
    return `{${fields.join(",")}}`;
}
function deterministicHash(value: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
export function normalizeSemanticEvent(input: SemanticEventInput, options: EventNormalizationOptions = {}): SemanticEvent | null {
    if (!isSourceApplication(input.sourceApplication)) {
        throw new TypeError(`Unknown source application: ${input.sourceApplication}`);
    }
    if (!isSemanticAction(input.action)) {
        throw new TypeError(`Unknown semantic action: ${input.action}`);
    }
    if (options.excludedApplications?.includes(input.sourceApplication)) {
        return null;
    }
    if (!applicationSupportsAction(input.sourceApplication, input.action)) {
        throw new TypeError(`${input.sourceApplication} cannot produce ${input.action} events.`);
    }
    const normalizedEvent = {
        traceId: normalizeText(input.traceId),
        occurredAt: normalizeTimestamp(input.occurredAt),
        sourceApplication: input.sourceApplication,
        action: input.action,
        intent: normalizeText(input.intent ?? SEMANTIC_ACTION_TAXONOMY[input.action].defaultIntent),
        payload: redactPayload(input.payload ?? {}),
        confidence: normalizeConfidence(input.confidence),
        origin: input.origin ?? "observed",
        estimatedEffortSeconds: normalizeEffort(input.estimatedEffortSeconds, input.action),
    } satisfies Omit<SemanticEvent, "id">;
    return {
        id: `event-${deterministicHash(stableSerialize(normalizedEvent))}`,
        ...normalizedEvent,
    };
}
