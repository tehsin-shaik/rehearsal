import { environment, isDemo } from "@/config/environment";
import { reportSchema } from "@/infrastructure/api-clients/contracts";
import { understandWithResearch } from "@/infrastructure/api-clients/understanding";
import { apiBoundary, requestBody, requireSession, validateOrigin } from "@/infrastructure/persistence/server-state";
export const runtime = "nodejs";
export async function POST(request: Request) { return apiBoundary(async () => { const env = environment(); if (!isDemo(env)) {
    validateOrigin(request, env);
    requireSession(request, env);
} const report = reportSchema.parse(await requestBody(request)); return Response.json(await understandWithResearch(report, env)); }); }
