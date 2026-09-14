import { serverEnvironment } from "../../../config/server-env.ts";
import { parseRequestBody } from "../../../infrastructure/http/route-response.ts";
import {
  buildSanitizedResearchQuery,
  ExaResearchClient,
} from "../../../infrastructure/research/exa-client.ts";
import { researchRequestSchema } from "../../../infrastructure/validation/api-schemas.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequestBody(request, researchRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (serverEnvironment.DEMO_MODE) {
    return Response.json({
      ok: true,
      query: buildSanitizedResearchQuery(parsed.data.report),
      results: [],
      status: "demo_disabled",
    });
  }

  const result = await new ExaResearchClient(
    serverEnvironment.EXA_API_KEY,
  ).searchReport(parsed.data.report);
  return Response.json({ ok: true, ...result });
}
