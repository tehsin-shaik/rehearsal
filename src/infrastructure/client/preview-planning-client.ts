import { z } from "zod";

import type { CompiledLearnedPattern } from "../../domain/patterns/compilation-types.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import type { MailMessage } from "../../domain/understanding/mail-message.ts";
import { previewRunFromToolArguments } from "../agents/preview-run-wire.ts";
import { fetchWithTimeout } from "../http/fetch-with-timeout.ts";

const streamEventSchema = z
  .object({
    type: z.string().max(100),
    toolCallId: z.string().max(300).optional(),
    toolCallName: z.string().max(100).optional(),
    delta: z.string().max(1_000_000).optional(),
  })
  .passthrough();

const actionArgumentsSchema = z
  .object({
    index: z.number().int().positive().max(100),
    total: z.number().int().positive().max(100),
    action: z.object({ id: z.string().min(1).max(200) }).passthrough(),
  })
  .strict()
  .refine((value) => value.index <= value.total);

const MAX_AG_UI_STREAM_BYTES = 2_000_000;
const MAX_AG_UI_TOOL_CALLS = 100;
const MAX_AG_UI_TOOL_ARGUMENT_BYTES = 1_000_000;
const AG_UI_STREAM_TIMEOUT_MS = 20_000;

function portableUnderstanding(
  understanding: IssueUnderstanding,
): IssueUnderstanding {
  return {
    reportId: understanding.reportId,
    customer: understanding.customer,
    issue: understanding.issue,
    owner: understanding.owner,
    evidence: understanding.evidence,
    confidence: understanding.confidence,
    reviewRequired: understanding.reviewRequired,
  };
}

async function* responseEvents(response: Response): AsyncGenerator<unknown> {
  if (response.body === null) {
    throw new Error("The AG-UI response did not contain a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedBytes = 0;
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, AG_UI_STREAM_TIMEOUT_MS);
  try {
    while (true) {
      const chunk = await reader.read();
      if (timedOut) {
        throw new Error("The AG-UI planning stream timed out.");
      }
      receivedBytes += chunk.value?.byteLength ?? 0;
      if (receivedBytes > MAX_AG_UI_STREAM_BYTES) {
        await reader.cancel();
        throw new Error("The AG-UI planning stream exceeded its size limit.");
      }
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (data.length > 0) {
          yield JSON.parse(data) as unknown;
        }
      }

      if (chunk.done) {
        break;
      }
    }
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function planPreviewRunWithAgUi(
  input: {
    readonly pattern: CompiledLearnedPattern;
    readonly message: MailMessage;
    readonly understanding: IssueUnderstanding;
    readonly nextIssueNumber: string;
    readonly research: {
      readonly query: string;
      readonly references: readonly {
        readonly title: string;
        readonly url: string;
        readonly source: string;
        readonly highlight: string;
      }[];
    } | null;
  },
  onAction: (count: number) => void,
): Promise<PreviewRun> {
  const response = await fetchWithTimeout("/api/copilotkit/agent/preview/run", {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      threadId: `preview:${input.pattern.id}`,
      runId: `plan:${input.message.id}:${input.pattern.id}`,
      messages: [],
      tools: [],
      context: [],
      forwardedProps: {},
      state: {
        report: input.message,
        pattern: input.pattern,
        understanding: portableUnderstanding(input.understanding),
        nextIssueNumber: input.nextIssueNumber,
        research: input.research,
      },
    }),
    timeoutMs: 12_000,
  });
  const toolCalls = new Map<
    string,
    { readonly name: string; argumentsText: string }
  >();
  let plannedRun: PreviewRun | null = null;

  for await (const rawEvent of responseEvents(response)) {
    const parsed = streamEventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      throw new TypeError("The AG-UI stream contained an invalid event.");
    }
    const event = parsed.data;
    if (
      event.type === "TOOL_CALL_START" &&
      event.toolCallId !== undefined &&
      event.toolCallName !== undefined
    ) {
      if (
        !toolCalls.has(event.toolCallId) &&
        toolCalls.size >= MAX_AG_UI_TOOL_CALLS
      ) {
        throw new Error("The AG-UI stream proposed too many tool calls.");
      }
      toolCalls.set(event.toolCallId, {
        name: event.toolCallName,
        argumentsText: "",
      });
    } else if (
      event.type === "TOOL_CALL_ARGS" &&
      event.toolCallId !== undefined &&
      event.delta !== undefined
    ) {
      const toolCall = toolCalls.get(event.toolCallId);
      if (toolCall !== undefined) {
        toolCall.argumentsText += event.delta;
        if (toolCall.argumentsText.length > MAX_AG_UI_TOOL_ARGUMENT_BYTES) {
          throw new Error(
            "The AG-UI tool arguments exceeded their size limit.",
          );
        }
      }
    } else if (
      event.type === "TOOL_CALL_END" &&
      event.toolCallId !== undefined
    ) {
      const toolCall = toolCalls.get(event.toolCallId);
      if (toolCall === undefined) {
        continue;
      }
      const argumentsValue: unknown = JSON.parse(toolCall.argumentsText);
      if (toolCall.name === "proposeAction") {
        onAction(actionArgumentsSchema.parse(argumentsValue).index);
      } else if (toolCall.name === "proposeRun") {
        plannedRun = previewRunFromToolArguments(argumentsValue);
      }
    }
  }

  if (plannedRun === null) {
    throw new Error("The AG-UI stream ended without a Preview Run proposal.");
  }
  return plannedRun;
}
