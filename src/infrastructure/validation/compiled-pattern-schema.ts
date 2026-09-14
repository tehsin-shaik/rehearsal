import { z } from "zod";

import {
  FIELD_DERIVATIONS,
  PATTERN_FIELDS,
  type CompiledLearnedPattern,
} from "../../domain/patterns/compilation-types.ts";
import {
  SEMANTIC_ACTION_TAXONOMY,
  SOURCE_APPLICATIONS,
} from "../../domain/events/taxonomy.ts";
import { PERMISSION_CLASSES } from "../../domain/policy/permission-policy.ts";

const semanticActions = Object.keys(SEMANTIC_ACTION_TAXONOMY) as [
  keyof typeof SEMANTIC_ACTION_TAXONOMY,
  ...(keyof typeof SEMANTIC_ACTION_TAXONOMY)[],
];
const stageNames = [
  "Email",
  "Understand issue",
  "Create ticket",
  "Assign owner",
  "Notify team",
] as const;

const functionalDependencySchema = z
  .object({
    determinant: z.enum(PATTERN_FIELDS),
    dependent: z.enum(PATTERN_FIELDS),
    expression: z.string().min(1).max(300),
  })
  .strict();

const variableBindingSchema = z
  .object({
    kind: z.literal("runtime_variable"),
    field: z.enum(PATTERN_FIELDS),
    derivation: z.enum(FIELD_DERIVATIONS),
    required: z.boolean(),
    dependency: functionalDependencySchema.optional(),
  })
  .strict();

const provenanceSchema = z
  .object({
    derivation: z.enum(FIELD_DERIVATIONS),
    matchingTraceIds: z.array(z.string().min(1).max(200)).max(100),
    sourceEventIds: z.array(z.string().min(1).max(200)).max(200),
    sourceActions: z.array(z.enum(semanticActions)).max(20),
    heldConstant: z.boolean(),
  })
  .strict();

const compiledVariableSchema = z
  .object({
    field: z.enum(PATTERN_FIELDS),
    source: z.enum(FIELD_DERIVATIONS),
    dependsOn: z.string().min(1).max(200).optional(),
    rationale: z.string().min(1).max(1_000),
    binding: variableBindingSchema,
    provenance: provenanceSchema,
    heldConstant: z.boolean(),
  })
  .strict()
  .superRefine((variable, context) => {
    if (
      variable.source !== "generated" &&
      variable.provenance.matchingTraceIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "matchingTraceIds"],
        message: "Observed variables require matching trace provenance.",
      });
    }
  });

const compiledConstantSchema = z
  .object({
    field: z.enum(PATTERN_FIELDS),
    value: z.unknown(),
    rationale: z.string().min(1).max(1_000),
    derivation: z.literal("authored"),
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((constant, context) => {
    if (constant.provenance.matchingTraceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "matchingTraceIds"],
        message: "Constants require matching trace provenance.",
      });
    }
  });

const workflowBindingSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("variable"),
      binding: variableBindingSchema,
      direction: z.enum(["input", "output"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("constant"),
      field: z.enum(PATTERN_FIELDS),
      direction: z.enum(["input", "output"]),
    })
    .strict(),
]);

const workflowStageSchema = z
  .object({
    id: z.string().min(1).max(200),
    order: z.number().int().positive().max(20),
    name: z.enum(stageNames),
    intent: z.string().min(1).max(500),
    sourceApplication: z.enum(SOURCE_APPLICATIONS),
    action: z.enum(semanticActions),
    permissions: z.array(z.enum(PERMISSION_CLASSES)).min(1).max(10),
    bindings: z.array(workflowBindingSchema).min(1).max(30),
  })
  .strict();

const fieldGeneralizationSchema = z
  .object({
    field: z.enum(PATTERN_FIELDS),
    derivation: z.enum(FIELD_DERIVATIONS),
    heldConstant: z.boolean(),
    rationale: z.string().min(1).max(1_000),
    provenance: provenanceSchema,
  })
  .strict()
  .superRefine((generalization, context) => {
    if (
      generalization.derivation !== "generated" &&
      generalization.provenance.matchingTraceIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "matchingTraceIds"],
        message: "Observed generalizations require matching trace provenance.",
      });
    }
  });

export const compiledLearnedPatternSchema = z
  .object({
    id: z.string().min(1).max(200),
    status: z.literal("proposed"),
    trigger: z
      .object({
        sourceApplication: z.literal("mail"),
        action: z.literal("report_received"),
        intent: z.string().min(1).max(300),
      })
      .strict(),
    stages: z
      .array(workflowStageSchema)
      .length(stageNames.length)
      .superRefine((stages, context) => {
        for (const name of stageNames) {
          if (!stages.some((stage) => stage.name === name)) {
            context.addIssue({
              code: "custom",
              message: `Missing workflow stage ${name}.`,
            });
          }
        }
      }),
    variables: z
      .array(compiledVariableSchema)
      .min(1)
      .max(PATTERN_FIELDS.length),
    constants: z.array(compiledConstantSchema).max(PATTERN_FIELDS.length),
    permissions: z.array(z.enum(PERMISSION_CLASSES)).min(1).max(10),
    confidence: z.number().finite().min(0).max(1),
    evidence: z
      .object({
        matchingTraceIds: z.array(z.string().min(1).max(200)).min(2).max(100),
        sampleSize: z.number().int().min(2).max(100),
        actionSequenceSimilarity: z.number().finite().min(0).max(1),
        applicationSetSimilarity: z.number().finite().min(0).max(1),
        intentSimilarity: z.number().finite().min(0).max(1),
        sampleSizeDiscount: z.number().finite().min(0).max(1),
        fieldGeneralizations: z
          .array(fieldGeneralizationSchema)
          .max(PATTERN_FIELDS.length),
        representativeValues: z
          .array(
            z
              .object({
                field: z.enum(["department", "owner"]),
                value: z.unknown(),
              })
              .strict(),
          )
          .max(2),
      })
      .strict(),
    observedManualActionCount: z.number().int().nonnegative().max(200),
    estimatedDurationSeconds: z.number().finite().nonnegative().max(86_400),
    dependencies: z.array(functionalDependencySchema).max(20),
    observationCount: z.number().int().min(2).max(100),
    manualBaselineTraceId: z.string().min(1).max(200),
  })
  .strict();

export function parseCompiledLearnedPattern(
  value: unknown,
): CompiledLearnedPattern {
  return compiledLearnedPatternSchema.parse(value);
}
