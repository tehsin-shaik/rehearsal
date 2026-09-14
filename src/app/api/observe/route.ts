import {
  apiError,
  parseRequestBody,
} from "../../../infrastructure/http/route-response.ts";
import { observationEventBuffer } from "../../../infrastructure/observation/event-buffer.ts";
import { observationBatchSchema } from "../../../infrastructure/validation/api-schemas.ts";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
} as const;

const observationCursorSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,15})$/)
  .transform(Number)
  .refine(Number.isSafeInteger);

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequestBody(request, observationBatchSchema);
  if (!parsed.ok) {
    return withCors(parsed.response);
  }

  try {
    const appended = observationEventBuffer.append(parsed.data.events);
    const completions = observationEventBuffer.appendCompletions(
      parsed.data.completedTraceIds,
    );
    const lastSequence = Math.max(
      appended.at(-1)?.sequence ?? 0,
      completions.at(-1)?.sequence ?? 0,
    );
    return withCors(
      Response.json({
        ok: true,
        accepted: appended.length + completions.length,
        lastSequence: lastSequence === 0 ? null : lastSequence,
      }),
    );
  } catch {
    return withCors(
      apiError(
        400,
        "invalid_observation",
        "One or more semantic events could not be normalized.",
      ),
    );
  }
}

export function GET(request: Request): Response {
  const rawCursor = new URL(request.url).searchParams.get("after") ?? "0";
  const parsedCursor = observationCursorSchema.safeParse(rawCursor);
  if (!parsedCursor.success) {
    return withCors(
      apiError(400, "invalid_cursor", "The observation cursor is invalid."),
    );
  }
  const cursor = parsedCursor.data;

  const records = observationEventBuffer.after(cursor);
  const completions = observationEventBuffer.completionsAfter(cursor);
  const lastSequence = Math.max(
    records.at(-1)?.sequence ?? cursor,
    completions.at(-1)?.sequence ?? cursor,
  );
  return withCors(
    Response.json({
      ok: true,
      events: records,
      completions,
      lastSequence,
      buffered: observationEventBuffer.size,
    }),
  );
}

export function DELETE(): Response {
  observationEventBuffer.clear();
  return withCors(Response.json({ ok: true, buffered: 0 }));
}
