import { z } from "zod";
import { environment } from "@/config/environment";
import { scrubObservation } from "@/infrastructure/api-clients/observation";
import { apiBoundary, requestBody, requireSession, requireObserverSession, validateOrigin } from "@/infrastructure/persistence/server-state";
export const runtime = "nodejs";
export async function POST(request: Request) { return apiBoundary(async () => { const env = environment(); validateOrigin(request, env); const s = requireObserverSession(request, env); const input = z.object({ events: z.array(z.unknown()).min(1).max(50) }).strict().parse(await requestBody(request)); const events = input.events.flatMap(e => { const event = scrubObservation(e); return event ? [event] : []; }); for (const event of events) {
    if (s.observation.some(e => e.event.id === event.id))
        continue;
    s.observation.push({ sequence: ++s.sequence, event });
} s.observation = s.observation.slice(-500); return Response.json({ accepted: events.length, cursor: s.sequence }, { headers: { "Access-Control-Allow-Origin": request.headers.get("origin")!, "Vary": "Origin" } }); }); }
export async function GET(request: Request) { return apiBoundary(async () => { const s = requireSession(request); const cursor = z.coerce.number().int().min(0).parse(new URL(request.url).searchParams.get("after") ?? 0); return Response.json({ events: s.observation.filter(e => e.sequence > cursor), cursor: s.sequence }, { headers: { "Cache-Control": "no-store" } }); }); }
export async function DELETE(request: Request) { return apiBoundary(async () => { validateOrigin(request); const s = requireSession(request); s.observation = []; return Response.json({ cleared: true, cursor: s.sequence }); }); }
export async function OPTIONS(request: Request) { return apiBoundary(async () => { validateOrigin(request); return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": request.headers.get("origin")!, "Access-Control-Allow-Headers": "Content-Type, X-Rehearsal-Observer", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" } }); }); }
