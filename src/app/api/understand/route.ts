import { serverEnvironment } from "../../../config/server-env.ts";
import { understandReportDeterministically } from "../../../domain/understanding/deterministic-understanding.ts";
import { OpenAICompatibleJsonClient } from "../../../infrastructure/ai/openai-compatible-client.ts";
import { parseRequestBody } from "../../../infrastructure/http/route-response.ts";
import { ExaResearchClient } from "../../../infrastructure/research/exa-client.ts";
import { enrichReportConcurrently } from "../../../infrastructure/research/concurrent-enrichment.ts";
import { understandRequestSchema } from "../../../infrastructure/validation/api-schemas.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequestBody(request, understandRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (serverEnvironment.DEMO_MODE) {
    return Response.json({
      ok: true,
      mode: "demo",
      understanding: understandReportDeterministically(parsed.data.report),
      provenance: {
        source: "deterministic",
        model: null,
        fallbackReason: null,
      },
      research: {
        query: "",
        results: [],
        status: "demo_disabled",
      },
    });
  }

  const result = await enrichReportConcurrently(
    parsed.data.report,
    new OpenAICompatibleJsonClient(serverEnvironment),
    new ExaResearchClient(serverEnvironment.EXA_API_KEY),
  );

  return Response.json({
    ok: true,
    mode: "live",
    understanding: result.understanding.understanding,
    provenance: result.understanding.provenance,
    research: result.research,
  });
}
