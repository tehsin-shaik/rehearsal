import { serverEnvironment } from "../../../config/server-env.ts";
import { PolicyError } from "../../../domain/policy/policy-errors.ts";
import { createLiveAdapterSelection } from "../../../infrastructure/adapters/live/adapter-factory.ts";
import {
  authorizeRemoteAction,
  executeOneRemoteAction,
  RemoteExecutionCapacityError,
} from "../../../infrastructure/execution/remote-action-executor.ts";
import {
  apiError,
  parseRequestBody,
} from "../../../infrastructure/http/route-response.ts";
import { executeActionRequestSchema } from "../../../infrastructure/validation/api-schemas.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const selection = await createLiveAdapterSelection(serverEnvironment);
  return Response.json({
    ok: true,
    demoMode: serverEnvironment.DEMO_MODE,
    selectedTracker: selection.selectedTracker,
    trackerTarget: selection.adapters.issueTracker.targetLabel,
    messagingTarget: selection.adapters.messaging.targetLabel,
    mailTarget: selection.adapters.customerMail.targetLabel,
    trackers: selection.trackers,
  });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequestBody(request, executeActionRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    authorizeRemoteAction(parsed.data);
  } catch (error) {
    if (error instanceof PolicyError) {
      return apiError(403, error.code, error.message);
    }
    throw error;
  }

  if (serverEnvironment.DEMO_MODE) {
    return apiError(
      409,
      "demo_mode_live_execution_disabled",
      "Live execution is disabled while Demo Mode is active.",
    );
  }

  const selection = await createLiveAdapterSelection(serverEnvironment);
  let execution;
  try {
    execution = await executeOneRemoteAction(parsed.data, selection.adapters);
  } catch (error) {
    if (error instanceof RemoteExecutionCapacityError) {
      return apiError(503, "execution_at_capacity", error.message);
    }
    throw error;
  }
  return Response.json(
    { ok: execution.result.ok, ...execution },
    { status: execution.result.ok ? 200 : 502 },
  );
}
