import { z } from "zod";
import { normalizeSemanticEvent } from "../../domain/events/event-normalizer.ts";
import { SEMANTIC_ACTION_TAXONOMY } from "../../domain/events/taxonomy.ts";
import { redactPayload } from "../../domain/events/redaction.ts";
const payloadFields = z.object({ reportId: z.string().max(200).optional(), subject: z.string().max(500).optional(), sender: z.string().max(200).optional(), issueId: z.string().max(200).optional(), category: z.string().max(100).optional(), department: z.string().max(100).optional(), owner: z.string().max(200).optional(), channel: z.string().max(100).optional(), severity: z.string().max(30).optional(), labels: z.array(z.string().max(50)).max(10).optional(), url: z.string().url().optional(), finished: z.boolean().optional() });
export const observationSchema = z.object({ traceId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), occurredAt: z.string().datetime({ offset: true }), sourceApplication: z.enum(["mail", "issue_tracker", "team_chat", "system"]), action: z.enum(Object.keys(SEMANTIC_ACTION_TAXONOMY) as [
        keyof typeof SEMANTIC_ACTION_TAXONOMY,
        ...(keyof typeof SEMANTIC_ACTION_TAXONOMY)[]
    ]), payload: z.record(z.unknown()).default({}) }).strict();
export function scrubObservation(input: unknown) {
    const event = observationSchema.parse(input);
    const payload = payloadFields.parse(redactPayload(event.payload));
    if (payload.url) {
        const url = new URL(payload.url);
        if (url.protocol !== "https:")
            delete payload.url;
        else
            payload.url = `${url.origin}${url.pathname}`;
    }
    // The server owns intent, confidence, origin and effort. A page cannot forge these.
    return normalizeSemanticEvent({ ...event, payload, confidence: 1, origin: "observed" });
}
