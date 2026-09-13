import { environment } from "@/config/environment";
import { apiBoundary, requestBody, requireSession, validateOrigin } from "@/infrastructure/persistence/server-state";
import { createLivePlan } from "@/infrastructure/api-clients/live-planning";
export const runtime = "nodejs";
export async function POST(request: Request) {
    return apiBoundary(async () => {
        const env = environment();
        validateOrigin(request, env);
        const s = requireSession(request, env);
        const run = await createLivePlan(await requestBody(request), s, env);
        return Response.json(run, { status: 201, headers: { "Cache-Control": "no-store" } });
    });
}
