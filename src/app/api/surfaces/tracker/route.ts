import { z } from "zod";

import { serverEnvironment } from "../../../../config/server-env.ts";
import { createLiveAdapterSelection } from "../../../../infrastructure/adapters/live/adapter-factory.ts";
import { apiError } from "../../../../infrastructure/http/route-response.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providerSchema = z.enum([
  "clickup",
  "jira",
  "ambiguous",
  "github",
  "ambiguous_sandbox",
]);

export async function GET(request: Request): Promise<Response> {
  if (serverEnvironment.DEMO_MODE) {
    return Response.json({
      ok: true,
      mode: "demo",
      selectedTracker: null,
      trackers: [],
      issues: [],
      fallbackToReplica: true,
    });
  }

  const requestedProvider = new URL(request.url).searchParams.get("provider");
  const parsedProvider =
    requestedProvider === null
      ? null
      : providerSchema.safeParse(requestedProvider);
  if (parsedProvider !== null && !parsedProvider.success) {
    return apiError(400, "invalid_tracker", "Unknown tracker provider.");
  }

  const selection = await createLiveAdapterSelection({
    ...serverEnvironment,
    ...(parsedProvider === null ? {} : { TRACKER: parsedProvider.data }),
  });
  const selected = selection.trackers.find((tracker) => tracker.selected);
  if (
    selected === undefined ||
    !selected.configured ||
    selection.adapters.issueTracker.listRecentIssues === undefined
  ) {
    return Response.json({
      ok: true,
      mode: "live",
      selectedTracker: selection.selectedTracker,
      trackers: selection.trackers,
      issues: [],
      fallbackToReplica: true,
    });
  }

  try {
    const issues = await selection.adapters.issueTracker.listRecentIssues();
    return Response.json({
      ok: true,
      mode: "live",
      selectedTracker: selection.selectedTracker,
      trackerTarget: selection.adapters.issueTracker.targetLabel,
      trackers: selection.trackers,
      issues,
      fallbackToReplica: false,
    });
  } catch {
    return Response.json({
      ok: true,
      mode: "live",
      selectedTracker: selection.selectedTracker,
      trackerTarget: selection.adapters.issueTracker.targetLabel,
      trackers: selection.trackers,
      issues: [],
      fallbackToReplica: true,
    });
  }
}
