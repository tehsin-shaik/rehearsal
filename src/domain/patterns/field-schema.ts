import type {
  FieldDerivation,
  FunctionalDependency,
  PatternField,
} from "./compilation-types.ts";

export interface PatternFieldDefinition {
  readonly field: PatternField;
  readonly payloadKeys: readonly string[];
  readonly derivation: FieldDerivation;
  readonly requiredAtRuntime: boolean;
  readonly dependency?: FunctionalDependency;
}

export const DEPARTMENT_OWNER_DEPENDENCY = {
  determinant: "department",
  dependent: "owner",
  expression: "department -> owner",
} as const satisfies FunctionalDependency;

export const PATTERN_FIELD_DEFINITIONS = [
  {
    field: "channel",
    payloadKeys: ["channel"],
    derivation: "authored",
    requiredAtRuntime: true,
  },
  {
    field: "report.id",
    payloadKeys: ["reportId"],
    derivation: "extracted",
    requiredAtRuntime: true,
  },
  {
    field: "customer.name",
    payloadKeys: ["customerName"],
    derivation: "extracted",
    requiredAtRuntime: true,
  },
  {
    field: "customer.email",
    payloadKeys: ["customerEmail"],
    derivation: "extracted",
    requiredAtRuntime: true,
  },
  {
    field: "issue.title",
    payloadKeys: ["issueTitle", "subject"],
    derivation: "extracted",
    requiredAtRuntime: true,
  },
  {
    field: "issue.description",
    payloadKeys: ["issueDescription"],
    derivation: "extracted",
    requiredAtRuntime: true,
  },
  {
    field: "category",
    payloadKeys: ["category"],
    derivation: "classified",
    requiredAtRuntime: true,
  },
  {
    field: "department",
    payloadKeys: ["department"],
    derivation: "classified",
    requiredAtRuntime: true,
  },
  {
    field: "severity",
    payloadKeys: ["severity"],
    derivation: "classified",
    requiredAtRuntime: true,
  },
  {
    field: "labels",
    payloadKeys: ["labels"],
    derivation: "classified",
    requiredAtRuntime: true,
  },
  {
    field: "owner",
    payloadKeys: ["owner"],
    derivation: "routed",
    requiredAtRuntime: true,
    dependency: DEPARTMENT_OWNER_DEPENDENCY,
  },
  {
    field: "issue.number",
    payloadKeys: ["issueNumber"],
    derivation: "generated",
    requiredAtRuntime: true,
  },
  {
    field: "team.message",
    payloadKeys: ["teamMessage", "notificationMessage"],
    derivation: "generated",
    requiredAtRuntime: true,
  },
  {
    field: "customer.reply",
    payloadKeys: ["customerReply", "replyMessage"],
    derivation: "generated",
    requiredAtRuntime: true,
  },
] as const satisfies readonly PatternFieldDefinition[];

export function getPatternFieldDefinition(
  field: PatternField,
): PatternFieldDefinition {
  const definition = PATTERN_FIELD_DEFINITIONS.find(
    (candidate) => candidate.field === field,
  );

  if (definition === undefined) {
    throw new TypeError(`Unknown pattern field: ${field}`);
  }

  return definition;
}
