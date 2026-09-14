import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotEndpoint,
} from "@copilotkit/runtime/v2";

import { serverEnvironment } from "../../../../config/server-env.ts";
import {
  parsePreviewAgentContext,
  streamPreviewPlanningEvents,
} from "../../../../infrastructure/agents/preview-agent.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

if (serverEnvironment.COPILOTKIT_TELEMETRY_DISABLED) {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
}

const previewAgent = new BuiltInAgent({
  type: "custom",
  factory: ({ input }) =>
    streamPreviewPlanningEvents(parsePreviewAgentContext(input)),
});

const copilotRuntime = new CopilotRuntime({
  agents: { preview: previewAgent },
  runner: new InMemoryAgentRunner(),
  exposeMemoryRoutes: false,
});

const endpoint = createCopilotEndpoint({
  runtime: copilotRuntime,
  basePath: "/api/copilotkit",
});

async function handle(request: Request): Promise<Response> {
  return endpoint.fetch(request);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
