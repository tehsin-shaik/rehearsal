import { environment, isDemo } from "@/config/environment";
import { apiBoundary, requireSession } from "@/infrastructure/persistence/server-state";
import { trainingReports, noiseReports } from "@/demo/fixtures/workspace";
export const runtime = "nodejs";
export async function GET(request: Request) { return apiBoundary(async () => { const env = environment(); if (isDemo(env))
    return Response.json({ mode: "demo", reports: [trainingReports[0], ...noiseReports] }); const s = requireSession(request, env); return Response.json({ mode: "live", reports: await s.mail.list() }, { headers: { "Cache-Control": "no-store" } }); }); }
