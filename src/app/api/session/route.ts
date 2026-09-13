import { z } from "zod";
import { environment, isDemo, selectedTracker } from "@/config/environment";
import { apiBoundary, requestBody, requireSession, validateOrigin, validAccessKey, createSession, ApiError } from "@/infrastructure/persistence/server-state";
export const runtime = "nodejs";
export async function GET(request: Request) { return apiBoundary(async () => { const env = environment(); if (isDemo(env))
    return Response.json({ mode: "demo", connected: false }); const s = requireSession(request, env); return Response.json({ mode: "live", connected: true, tracker: selectedTracker(env), gmailSend: s.mail.canSend }); }); }
export async function POST(request: Request) { return apiBoundary(async () => { const env = environment(); if (isDemo(env))
    throw new ApiError(409, "Live mode is disabled. Set both demo flags to false and restart."); validateOrigin(request, env); const { key } = z.object({ key: z.string().min(24).max(200) }).strict().parse(await requestBody(request)); if (!validAccessKey(key, env))
    throw new ApiError(401, "Invalid local access key."); const s = createSession(env); const secure = new URL(env.REHEARSAL_BASE_URL).protocol === "https:"; return Response.json({ connected: true }, { headers: { "Set-Cookie": `rehearsal_session=${s.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure ? "; Secure" : ""}`, "Cache-Control": "no-store" } }); }); }
