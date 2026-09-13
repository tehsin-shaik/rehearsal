import { z } from "zod";
import { environment } from "@/config/environment";
import { apiBoundary, requestBody, requireSession, validateOrigin, ApiError } from "@/infrastructure/persistence/server-state";
import { planningStream } from "@/infrastructure/api-clients/stream";
export const runtime = "nodejs";
export async function POST(request: Request) { return apiBoundary(async () => { const env = environment(); validateOrigin(request, env); const s = requireSession(request, env); const input = z.object({ threadId: z.string().min(1), runId: z.string().min(1), forwardedProps: z.object({ rehearsalRunId: z.string().optional() }).passthrough().optional() }).passthrough().parse(await requestBody(request)); const run = s.runs.get(input.forwardedProps?.rehearsalRunId ?? input.runId); if (!run)
    throw new ApiError(404, "Prepare a server-owned Ghost Run first."); return planningStream(run, input.threadId, input.runId); }); }
