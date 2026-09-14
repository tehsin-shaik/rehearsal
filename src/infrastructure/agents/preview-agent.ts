import { EventType, type BaseEvent } from "@ag-ui/core";
import { z } from "zod";

import type { CompiledLearnedPattern } from "../../domain/patterns/compilation-types.ts";
import { planPreviewRun } from "../../domain/runs/index.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import {
  DEPARTMENTS,
  TEAM_OWNERS,
} from "../../domain/understanding/team-routing.ts";
import { modelUnderstandingSchema } from "../ai/live-understanding.ts";
import { supportReportSchema } from "../validation/api-schemas.ts";
import { compiledLearnedPatternSchema } from "../validation/compiled-pattern-schema.ts";

export { previewRunFromToolArguments } from "./preview-run-wire.ts";

const deterministicUnderstandingSchema = modelUnderstandingSchema
  .extend({
    source: z.literal("deterministic"),
    routing: z
      .object({
        department: z.enum(DEPARTMENTS),
        departmentName: z.string().trim().min(1).max(200),
        owner: z.enum(TEAM_OWNERS).nullable(),
        channel: z.string().trim().min(1).max(200),
        rule: z.string().trim().min(1).max(300),
        reviewRequired: z.boolean(),
      })
      .strict(),
    sourceMessage: supportReportSchema,
  })
  .strict()
  .transform((value): IssueUnderstanding => ({
    reportId: value.reportId,
    customer: value.customer,
    issue: value.issue,
    owner: value.owner,
    evidence: value.evidence,
    confidence: value.confidence,
    reviewRequired: value.reviewRequired,
  }));

const previewUnderstandingSchema = z.union([
  modelUnderstandingSchema,
  deterministicUnderstandingSchema,
]);

export const previewAgentContextSchema = z
  .object({
    report: supportReportSchema,
    pattern: compiledLearnedPatternSchema,
    understanding: previewUnderstandingSchema,
    nextIssueNumber: z.string().trim().min(1).max(100),
    research: z
      .object({
        query: z.string().trim().min(1).max(500),
        references: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(300),
                url: z.string().url(),
                source: z.string().trim().min(1).max(200),
                highlight: z.string().trim().max(600),
              })
              .strict(),
          )
          .max(3),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export interface PreviewAgentContext {
  readonly report: z.output<typeof supportReportSchema>;
  readonly pattern: CompiledLearnedPattern;
  readonly understanding: IssueUnderstanding;
  readonly nextIssueNumber: string;
  readonly research?: z.output<typeof previewAgentContextSchema>["research"];
}

function asPreviewAgentContext(
  value: z.output<typeof previewAgentContextSchema>,
): PreviewAgentContext {
  return {
    report: value.report,
    pattern: value.pattern,
    understanding: value.understanding,
    nextIssueNumber: value.nextIssueNumber,
    research: value.research ?? null,
  };
}

export function parsePreviewAgentContext(input: {
  readonly state?: unknown;
  readonly context?: readonly { readonly value: string }[];
}): PreviewAgentContext {
  const stateResult = previewAgentContextSchema.safeParse(input.state);
  if (stateResult.success) {
    return asPreviewAgentContext(stateResult.data);
  }

  for (const entry of input.context ?? []) {
    try {
      const contextResult = previewAgentContextSchema.safeParse(
        JSON.parse(entry.value),
      );
      if (contextResult.success) {
        return asPreviewAgentContext(contextResult.data);
      }
    } catch {}
  }

  throw new TypeError(
    "Preview Run planning context did not match the required schema.",
  );
}

function toolEvents(
  toolCallId: string,
  toolCallName: "proposeAction" | "proposeRun",
  value: unknown,
): readonly BaseEvent[] {
  return [
    {
      type: EventType.TOOL_CALL_START,
      toolCallId,
      toolCallName,
    },
    {
      type: EventType.TOOL_CALL_ARGS,
      toolCallId,
      delta: JSON.stringify(value),
    },
    {
      type: EventType.TOOL_CALL_END,
      toolCallId,
    },
  ];
}

export async function* streamPreviewPlanningEvents(
  context: PreviewAgentContext,
): AsyncGenerator<BaseEvent> {
  const run = planPreviewRun(
    {
      pattern: context.pattern,
      message: context.report,
      understanding: context.understanding,
      nextIssueNumber: context.nextIssueNumber,
      research: context.research,
    },
    { previewStatus: "preview_ready" },
  );

  for (const action of run.plannedActions) {
    const toolCallId = `${run.id}:action:${action.sequence}`;
    for (const event of toolEvents(toolCallId, "proposeAction", {
      action,
      index: action.sequence,
      total: run.plannedActions.length,
    })) {
      yield event;
    }
  }

  for (const event of toolEvents(`${run.id}:run`, "proposeRun", { run })) {
    yield event;
  }
}
