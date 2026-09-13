import { environment } from "@/config/environment";
import { apiBoundary, requireSession, validateOrigin, requestBody, ApiError } from "@/infrastructure/persistence/server-state";
export const runtime = "nodejs";
async function proxy(request: Request): Promise<Response> {
    return apiBoundary(async () => {
        const env = environment();
        requireSession(request, env);
        if (request.method === "POST")
            validateOrigin(request, env);
        if (env.COPILOTKIT_ENABLED !== "true" || !env.REHEARSAL_BRIDGE_KEY || env.REHEARSAL_BRIDGE_KEY.length < 24)
            throw new ApiError(503, "Enable the optional CopilotKit Node runtime. Native proposal streams are available at /api/ag-ui.");
        const url = new URL(request.url);
        const response = await fetch(`http://127.0.0.1:4001${url.pathname}${url.search}`, {
            method: request.method, redirect: "error", signal: AbortSignal.timeout(20000),
            headers: { "Content-Type": "application/json", Accept: request.headers.get("accept") ?? "application/json", cookie: request.headers.get("cookie") ?? "", "x-rehearsal-bridge": env.REHEARSAL_BRIDGE_KEY },
            ...(request.method === "POST" ? { body: JSON.stringify(await requestBody(request)) } : {}),
        });
        return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
    });
}
export const GET = proxy;
export const POST = proxy;
