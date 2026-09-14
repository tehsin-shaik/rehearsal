import type { SupportReport } from "../../domain/understanding/support-report.ts";
import {
  understandReportWithModel,
  type LiveUnderstandingResult,
} from "../ai/live-understanding.ts";
import type { JsonModelClient } from "../ai/openai-compatible-client.ts";
import { type ResearchClient, type ResearchResponse } from "./exa-client.ts";

export interface EnrichedReport {
  readonly understanding: LiveUnderstandingResult;
  readonly research: ResearchResponse;
}

export async function enrichReportConcurrently(
  report: SupportReport,
  modelClient: JsonModelClient,
  researchClient: ResearchClient,
): Promise<EnrichedReport> {
  const understandingPromise = understandReportWithModel(report, modelClient);
  const researchPromise = researchClient.searchReport(report);
  const [understanding, research] = await Promise.all([
    understandingPromise,
    researchPromise,
  ]);

  return { understanding, research };
}
