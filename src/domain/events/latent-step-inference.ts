import type { SemanticEventInput } from "./event-normalizer.ts";
import type { SemanticEvent } from "./semantic-event.ts";
const EXTRACTION_FIELDS = [
    "reportId",
    "customerName",
    "customerEmail",
    "issueTitle",
    "issueDescription",
] as const;
const CLASSIFICATION_FIELDS = [
    "category",
    "department",
    "severity",
    "labels",
] as const;
const TRANSITION_ACTIONS = new Set([
    "create_issue",
    "assign_owner",
    "send_team_notification",
]);
function selectPayloadFields(payload: Readonly<Record<string, unknown>>, fieldNames: readonly string[]): Readonly<Record<string, unknown>> {
    const selectedFields: Record<string, unknown> = {};
    for (const fieldName of fieldNames) {
        if (Object.hasOwn(payload, fieldName)) {
            selectedFields[fieldName] = payload[fieldName];
        }
    }
    return selectedFields;
}
function hasFields(payload: Readonly<Record<string, unknown>>): boolean {
    return Object.keys(payload).length > 0;
}
export function inferLatentStepInputs(existingEvents: readonly SemanticEvent[], nextEvent: SemanticEventInput): readonly SemanticEventInput[] {
    if (!TRANSITION_ACTIONS.has(nextEvent.action)) {
        return [];
    }
    const payload = nextEvent.payload ?? {};
    const confidence = Math.min(nextEvent.confidence ?? 1, 0.9);
    const inferredSteps: SemanticEventInput[] = [];
    const hasExtraction = existingEvents.some((event) => event.action === "extract_issue");
    const hasClassification = existingEvents.some((event) => event.action === "classify_report");
    const extractionPayload = selectPayloadFields(payload, EXTRACTION_FIELDS);
    const classificationPayload = selectPayloadFields(payload, CLASSIFICATION_FIELDS);
    if (!hasExtraction && hasFields(extractionPayload)) {
        inferredSteps.push({
            traceId: nextEvent.traceId,
            occurredAt: nextEvent.occurredAt,
            sourceApplication: "system",
            action: "extract_issue",
            payload: extractionPayload,
            confidence,
            origin: "inferred",
            estimatedEffortSeconds: 0,
        });
    }
    if (!hasClassification && hasFields(classificationPayload)) {
        inferredSteps.push({
            traceId: nextEvent.traceId,
            occurredAt: nextEvent.occurredAt,
            sourceApplication: "system",
            action: "classify_report",
            payload: classificationPayload,
            confidence,
            origin: "inferred",
            estimatedEffortSeconds: 0,
        });
    }
    return inferredSteps;
}
