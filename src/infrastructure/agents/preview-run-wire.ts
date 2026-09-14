import { z } from "zod";

import {
  SEMANTIC_ACTION_TAXONOMY,
  SOURCE_APPLICATIONS,
} from "../../domain/events/taxonomy.ts";
import { PERMISSION_CLASSES } from "../../domain/policy/permission-policy.ts";
import { ACTION_PERMISSION_MAP } from "../../domain/policy/permission-policy.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import {
  DEPARTMENTS,
  TEAM_OWNERS,
} from "../../domain/understanding/team-routing.ts";
import { modelUnderstandingSchema } from "../ai/live-understanding.ts";
import { supportReportSchema } from "../validation/api-schemas.ts";

const semanticActions = Object.keys(SEMANTIC_ACTION_TAXONOMY) as [
  keyof typeof SEMANTIC_ACTION_TAXONOMY,
  ...(keyof typeof SEMANTIC_ACTION_TAXONOMY)[],
];
const plannedActions = Object.keys(ACTION_PERMISSION_MAP) as [
  keyof typeof ACTION_PERMISSION_MAP,
  ...(keyof typeof ACTION_PERMISSION_MAP)[],
];

const runResearchReferenceSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    url: z.string().url(),
    source: z.string().trim().min(1).max(200),
    highlight: z.string().trim().max(600),
  })
  .strict();

const semanticEventSchema = z
  .object({
    id: z.string().min(1).max(200),
    traceId: z.string().min(1).max(200),
    occurredAt: z.iso.datetime(),
    sourceApplication: z.enum(SOURCE_APPLICATIONS),
    action: z.enum(semanticActions),
    intent: z.string().min(1).max(500),
    payload: z.record(z.string().max(120), z.unknown()),
    confidence: z.number().finite().min(0).max(1),
    origin: z.enum(["observed", "inferred", "executed"]),
    estimatedEffortSeconds: z.number().finite().nonnegative().max(7_200),
  })
  .strict();

const runAdaptationSchema = z
  .object({
    field: z.enum(["department", "owner"]),
    from: z.unknown(),
    to: z.unknown(),
    observedValue: z.unknown(),
    adaptedValue: z.unknown(),
    rule: z.string().min(1).max(500),
    reason: z.string().min(1).max(1_000),
    selectedByHuman: z.boolean(),
  })
  .strict();

const reviewRequestSchema = z
  .object({
    id: z.string().min(1).max(200),
    field: z.literal("owner"),
    reason: z.string().min(1).max(1_000),
    options: z.array(z.enum(TEAM_OWNERS)).max(TEAM_OWNERS.length),
    status: z.enum(["pending", "resolved"]),
    selectedValue: z.enum(TEAM_OWNERS).nullable(),
    selectedBy: z.string().min(1).max(200).nullable(),
  })
  .strict();

const plannedActionSchema = z
  .object({
    id: z.string().min(1).max(200),
    sequence: z.number().int().positive().max(100),
    action: z.enum(plannedActions),
    permission: z.enum(PERMISSION_CLASSES),
    destination: z.string().min(1).max(500),
    resolvedInput: z.record(z.string().max(160), z.unknown()),
    risk: z.enum(["low", "medium", "high", "blocked"]),
    requiresApproval: z.boolean(),
    status: z.enum([
      "planned",
      "approved",
      "blocked",
      "running",
      "executing",
      "succeeded",
      "completed",
      "failed",
      "skipped",
      "not_attempted",
      "needs_review",
    ]),
    idempotencyKey: z.string().min(1).max(300),
    sourceWorkflowStepId: z.string().min(1).max(200),
    application: z.enum(SOURCE_APPLICATIONS),
    title: z.string().min(1).max(300),
    detail: z.string().min(1).max(2_000),
    adaptation: runAdaptationSchema.optional(),
    review: reviewRequestSchema.optional(),
  })
  .strict();

const policyDecisionSchema = z
  .object({
    actionId: z.string().min(1).max(200),
    permission: z.enum(PERMISSION_CLASSES).optional(),
    effect: z.enum(["allow", "require_approval", "block"]),
    reason: z.string().min(1).max(1_000),
    evaluatedAt: z.iso.datetime(),
    approvalId: z.string().min(1).max(200).optional(),
  })
  .strict();

const actionResultSchema = z
  .object({
    actionId: z.string().min(1).max(200),
    status: z.enum(["succeeded", "failed", "not_attempted"]),
    ok: z.boolean(),
    summary: z.string().min(1).max(2_000),
    data: z.unknown().optional(),
    adapter: z.string().min(1).max(200),
    durationMs: z.number().finite().nonnegative(),
    attemptedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    idempotencyKey: z.string().min(1).max(300),
    externalReference: z.string().max(2_000).optional(),
    error: z
      .object({
        code: z.string().min(1).max(200),
        message: z.string().min(1).max(2_000),
        retryable: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

const resolvedValuesSchema = z
  .object({
    messageId: z.string().min(1).max(300),
    customerName: z.string().min(1).max(300).nullable(),
    customerEmail: z.string().email().max(320).nullable(),
    issueTitle: z.string().min(1).max(500),
    issueDescription: z.string().min(1).max(20_000),
    category: z.enum([
      "authentication",
      "performance",
      "data",
      "api_timeout",
      "billing",
      "unresolved",
    ]),
    department: z.enum(DEPARTMENTS),
    severity: z.enum(["low", "medium", "high", "unresolved"]),
    labels: z.array(z.string().min(1).max(80)).max(20),
    owner: z.enum(TEAM_OWNERS).nullable(),
    ownerSource: z.enum(["routing", "human", "unresolved"]),
    issueNumber: z.string().min(1).max(100),
    teamChannel: z.string().min(1).max(200),
    teamNotification: z.string().min(1).max(10_000),
    customerReply: z.string().min(1).max(20_000),
    issueUrl: z.string().url().nullable(),
    researchQuery: z.string().min(1).max(500).nullable(),
    researchReferences: z.array(runResearchReferenceSchema).max(3),
  })
  .strict();

export const previewRunSchema = z
  .object({
    id: z.string().min(1).max(200),
    patternId: z.string().min(1).max(200),
    triggerReportId: z.string().min(1).max(200),
    status: z.enum([
      "preview",
      "preview_ready",
      "needs_review",
      "approved",
      "executing",
      "completed",
      "failed",
      "cancelled",
    ]),
    phase: z.enum(["preview", "executing", "completed", "failed"]),
    previewStatus: z.enum(["preview", "preview_ready"]),
    approved: z.boolean(),
    trigger: z
      .object({
        message: supportReportSchema,
        event: semanticEventSchema,
        summary: z.string().min(1).max(2_000),
      })
      .strict(),
    summary: z.string().min(1).max(2_000),
    understanding: modelUnderstandingSchema,
    plannedActions: z.array(plannedActionSchema).min(1).max(100),
    policyDecisions: z.array(policyDecisionSchema).max(200),
    approval: z
      .object({
        status: z.enum(["pending", "approved", "rejected"]),
        approvedBy: z.string().min(1).max(200).nullable(),
        approvedAt: z.iso.datetime().nullable(),
      })
      .strict(),
    adaptations: z.array(runAdaptationSchema).max(20),
    results: z.array(actionResultSchema).max(200),
    metrics: z
      .object({
        estimatedActionsAvoided: z.number().int().nonnegative(),
        estimatedSecondsSaved: z.number().finite().nonnegative(),
        humanInterventions: z.number().int().nonnegative(),
      })
      .strict(),
    confidence: z
      .object({
        pattern: z.number().finite().min(0).max(1),
        understanding: z.number().finite().min(0).max(1),
        overall: z.number().finite().min(0).max(1),
      })
      .strict(),
    risk: z.enum(["low", "medium", "high", "blocked"]),
    reviewRequests: z.array(reviewRequestSchema).max(20),
    resolutionErrors: z
      .array(
        z
          .object({
            code: z.enum(["missing_required_value", "unresolved_routing"]),
            field: z.string().min(1).max(200),
            message: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .max(40),
    resolvedValues: resolvedValuesSchema,
    issueReference: z
      .object({
        predictedIssueNumber: z.string().min(1).max(100),
        actualIssueId: z.string().min(1).max(200).nullable(),
        actualIssueKey: z.string().min(1).max(100).nullable(),
        actualIssueNumber: z.string().min(1).max(100).nullable(),
        actualIssueUrl: z.string().url().nullable(),
        rewrittenAt: z.iso.datetime().nullable(),
      })
      .strict(),
    humanSelections: z
      .array(
        z
          .object({
            field: z.literal("owner"),
            value: z.enum(TEAM_OWNERS),
            selectedBy: z.string().min(1).max(200),
            rule: z.literal("human selection"),
          })
          .strict(),
      )
      .max(20),
    research: z
      .object({
        query: z.string().min(1).max(500).nullable(),
        references: z.array(runResearchReferenceSchema).max(3),
      })
      .strict(),
  })
  .strict();

const previewRunToolArgumentsSchema = z
  .object({ run: previewRunSchema })
  .strict();

export function previewRunFromToolArguments(value: unknown): PreviewRun {
  return previewRunToolArgumentsSchema.parse(value).run as PreviewRun;
}
