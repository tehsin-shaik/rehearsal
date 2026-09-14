import type { ActionResult } from "../../../domain/runs/action-result.ts";

export function successfulActionResult<ResultData>(
  input: {
    readonly actionId: string;
    readonly idempotencyKey: string;
    readonly attemptedAt: string;
  },
  adapter: string,
  startedAt: number,
  summary: string,
  data: ResultData,
  externalReference?: string,
): ActionResult<ResultData> {
  return {
    actionId: input.actionId,
    idempotencyKey: input.idempotencyKey,
    status: "succeeded",
    ok: true,
    summary,
    data,
    adapter,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    attemptedAt: input.attemptedAt,
    completedAt: new Date().toISOString(),
    ...(externalReference === undefined ? {} : { externalReference }),
  };
}

export function failedActionResult<ResultData = never>(
  input: {
    readonly actionId: string;
    readonly idempotencyKey: string;
    readonly attemptedAt: string;
  },
  adapter: string,
  startedAt: number,
  code: string,
  message: string,
  retryable: boolean,
): ActionResult<ResultData> {
  return {
    actionId: input.actionId,
    idempotencyKey: input.idempotencyKey,
    status: "failed",
    ok: false,
    summary: message,
    adapter,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    attemptedAt: input.attemptedAt,
    completedAt: new Date().toISOString(),
    error: { code, message, retryable },
  };
}

export function configuredOwnerIdentifiers(
  rawMapping: string | undefined,
): Readonly<Record<string, string>> {
  if (rawMapping === undefined) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(rawMapping);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === "string" && entry[1].trim().length > 0,
          )
          .map(([name, identifier]) => [name.trim(), identifier.trim()]),
      );
    }
  } catch {}

  return Object.fromEntries(
    rawMapping
      .split(",")
      .map((entry) => entry.split(/[:=]/, 2).map((part) => part.trim()))
      .filter(
        (entry): entry is [string, string] =>
          entry.length === 2 && entry[0].length > 0 && entry[1].length > 0,
      ),
  );
}

export function issueMarkdown(input: {
  readonly description: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly category: string;
  readonly department: string;
  readonly severity: string;
  readonly researchReferences?: readonly {
    readonly title: string;
    readonly url: string;
  }[];
}): string {
  const research = input.researchReferences ?? [];
  return [
    input.description,
    "",
    "## Triage",
    `- Customer: ${input.customerName} (${input.customerEmail})`,
    `- Category: ${input.category}`,
    `- Department: ${input.department}`,
    `- Severity: ${input.severity}`,
    ...(research.length === 0
      ? []
      : [
          "",
          "## Research references",
          ...research.map(
            (reference) => `- [${reference.title}](${reference.url})`,
          ),
        ]),
  ].join("\n");
}
