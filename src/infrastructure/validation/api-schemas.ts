import { z } from "zod";

import { SOURCE_APPLICATIONS } from "../../domain/events/taxonomy.ts";
import { SEMANTIC_ACTION_TAXONOMY } from "../../domain/events/taxonomy.ts";
import { TEAM_OWNERS } from "../../domain/understanding/team-routing.ts";

export const supportReportSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    receivedAt: z.iso.datetime(),
    subject: z.string().trim().min(1).max(300),
    body: z.string().min(1).max(20_000),
  })
  .strict();

export const understandRequestSchema = z
  .object({ report: supportReportSchema })
  .strict();

export const researchRequestSchema = z
  .object({ report: supportReportSchema })
  .strict();

const observationPayloadSchema = z.record(z.string().max(120), z.unknown());

export const observationEventSchema = z
  .object({
    traceId: z.string().trim().min(1).max(160),
    occurredAt: z.iso.datetime(),
    sourceApplication: z.enum(SOURCE_APPLICATIONS),
    action: z.enum(
      Object.keys(SEMANTIC_ACTION_TAXONOMY) as [
        keyof typeof SEMANTIC_ACTION_TAXONOMY,
        ...(keyof typeof SEMANTIC_ACTION_TAXONOMY)[],
      ],
    ),
    intent: z.string().trim().min(1).max(240).optional(),
    payload: observationPayloadSchema.optional(),
    confidence: z.number().finite().min(0).max(1).optional(),
    origin: z.enum(["observed", "inferred", "executed"]).optional(),
    estimatedEffortSeconds: z.number().finite().min(0).max(7_200).optional(),
  })
  .strict();

export const observationBatchSchema = z
  .object({
    events: z.array(observationEventSchema).max(50).default([]),
    completedTraceIds: z
      .array(z.string().trim().min(1).max(160))
      .max(10)
      .default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.events.length === 0 && value.completedTraceIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one event or completed trace is required.",
      });
    }
  });

export const issueReferenceSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    key: z.string().trim().min(1).max(100),
    number: z.string().trim().min(1).max(100),
    url: z.string().url().nullable(),
  })
  .strict();

const actionEnvelopeSchema = z.object({
  actionId: z.string().trim().min(1).max(160),
  idempotencyKey: z.string().trim().min(1).max(200),
  approved: z.boolean(),
  approvalId: z.string().trim().min(1).max(160).optional(),
});

export const executeActionRequestSchema = z.discriminatedUnion("action", [
  actionEnvelopeSchema
    .extend({
      action: z.literal("create_issue"),
      input: z
        .object({
          predictedIssueNumber: z.string().trim().min(1).max(100),
          title: z.string().trim().min(1).max(300),
          description: z.string().trim().min(1).max(20_000),
          category: z.enum([
            "authentication",
            "performance",
            "data",
            "api_timeout",
            "billing",
            "unresolved",
          ]),
          department: z.enum([
            "billing",
            "technical_support",
            "sales",
            "logistics",
            "product_development_and_engineering",
            "legal_privacy_and_compliance",
            "unresolved",
          ]),
          severity: z.enum(["low", "medium", "high", "unresolved"]),
          labels: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
          customerName: z.string().trim().min(1).max(200),
          customerEmail: z.string().email().max(320),
          researchReferences: z
            .array(
              z
                .object({
                  title: z.string().trim().min(1).max(300),
                  url: z.string().url(),
                })
                .strict(),
            )
            .max(3)
            .optional(),
        })
        .strict(),
    })
    .strict(),
  actionEnvelopeSchema
    .extend({
      action: z.literal("assign_owner"),
      input: z
        .object({
          issue: issueReferenceSchema,
          owner: z.enum(TEAM_OWNERS),
        })
        .strict(),
    })
    .strict(),
  actionEnvelopeSchema
    .extend({
      action: z.literal("send_team_notification"),
      input: z
        .object({
          channel: z.string().trim().min(1).max(160),
          message: z.string().trim().min(1).max(4_000),
        })
        .strict(),
    })
    .strict(),
  actionEnvelopeSchema
    .extend({
      action: z.literal("reply_to_customer"),
      input: z
        .object({
          originatingMessageId: z.string().trim().min(1).max(300),
          recipient: z.string().email().max(320),
          message: z.string().trim().min(1).max(20_000),
        })
        .strict(),
    })
    .strict(),
]);

export type ExecuteActionRequest = z.output<typeof executeActionRequestSchema>;
