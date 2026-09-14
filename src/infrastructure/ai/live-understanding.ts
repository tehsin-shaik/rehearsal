import { z } from "zod";

import { understandReportDeterministically } from "../../domain/understanding/deterministic-understanding.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import type { SupportReport } from "../../domain/understanding/support-report.ts";
import {
  DEPARTMENTS,
  routeDepartment,
  TEAM_OWNERS,
} from "../../domain/understanding/team-routing.ts";
import {
  ModelClientError,
  type JsonModelClient,
  type ModelProviderMetadata,
} from "./openai-compatible-client.ts";

const issueCategorySchema = z.enum([
  "authentication",
  "performance",
  "data",
  "api_timeout",
  "billing",
  "unresolved",
]);

const issueSeveritySchema = z.enum(["low", "medium", "high", "unresolved"]);

export const modelUnderstandingSchema = z
  .object({
    reportId: z.string().min(1),
    customer: z
      .object({
        name: z.string().min(1).nullable(),
        email: z.string().email().nullable(),
      })
      .strict(),
    issue: z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        category: issueCategorySchema,
        department: z.enum(DEPARTMENTS),
        severity: issueSeveritySchema,
        labels: z.array(z.string().min(1).max(80)).max(20),
      })
      .strict(),
    owner: z.enum(TEAM_OWNERS).nullable(),
    evidence: z
      .array(
        z
          .object({
            field: z.string().min(1).max(160),
            excerpt: z.string().min(1).max(500),
          })
          .strict(),
      )
      .max(30),
    confidence: z
      .object({
        overall: z.number().finite().min(0).max(1),
        byField: z.record(
          z.string().min(1).max(160),
          z.number().finite().min(0).max(1),
        ),
      })
      .strict(),
    reviewRequired: z.boolean(),
  })
  .strict();

export type ModelIssueUnderstanding = z.output<typeof modelUnderstandingSchema>;

export type UnderstandingFallbackReason =
  | "model_not_configured"
  | "model_request_failed"
  | "invalid_model_output"
  | "report_id_mismatch"
  | "non_literal_evidence"
  | "routing_mismatch";

export interface UnderstandingProvenance {
  readonly source: "model" | "deterministic";
  readonly model: ModelProviderMetadata | null;
  readonly fallbackReason: UnderstandingFallbackReason | null;
}

export interface LiveUnderstandingResult {
  readonly understanding: IssueUnderstanding;
  readonly provenance: UnderstandingProvenance;
}

function fallback(
  report: SupportReport,
  fallbackReason: UnderstandingFallbackReason,
  metadata: ModelProviderMetadata | null = null,
): LiveUnderstandingResult {
  return {
    understanding: understandReportDeterministically(report),
    provenance: {
      source: "deterministic",
      model: metadata,
      fallbackReason,
    },
  };
}

function everyEvidenceExcerptIsLiteral(
  understanding: ModelIssueUnderstanding,
  report: SupportReport,
): boolean {
  const source = `${report.subject}\n${report.body}`;
  return understanding.evidence.every((entry) =>
    source.includes(entry.excerpt),
  );
}

function routingIsConsistent(understanding: ModelIssueUnderstanding): boolean {
  const routing = routeDepartment(understanding.issue.department);
  return (
    understanding.owner === routing.owner &&
    understanding.reviewRequired === routing.reviewRequired
  );
}

const SYSTEM_PROMPT = [
  "Extract a support report into the requested JSON object.",
  "Use only the supplied report.",
  "Every evidence excerpt must be copied literally from the subject or body.",
  "Use unresolved for uncertain category, department, or severity values.",
  "Do not decide permissions, approval, or execution.",
].join(" ");

export async function understandReportWithModel(
  report: SupportReport,
  client: JsonModelClient,
): Promise<LiveUnderstandingResult> {
  if (!client.configured) {
    return fallback(report, "model_not_configured");
  }

  let completion;
  try {
    completion = await client.completeJson({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ report }),
    });
  } catch (error) {
    return fallback(
      report,
      error instanceof ModelClientError && error.code === "not_configured"
        ? "model_not_configured"
        : "model_request_failed",
    );
  }

  const parsed = modelUnderstandingSchema.safeParse(completion.value);
  if (!parsed.success) {
    return fallback(report, "invalid_model_output", completion.metadata);
  }

  if (parsed.data.reportId !== report.id) {
    return fallback(report, "report_id_mismatch", completion.metadata);
  }

  if (!everyEvidenceExcerptIsLiteral(parsed.data, report)) {
    return fallback(report, "non_literal_evidence", completion.metadata);
  }

  if (!routingIsConsistent(parsed.data)) {
    return fallback(report, "routing_mismatch", completion.metadata);
  }

  return {
    understanding: parsed.data,
    provenance: {
      source: "model",
      model: completion.metadata,
      fallbackReason: null,
    },
  };
}
