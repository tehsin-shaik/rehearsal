import type { SemanticEvent } from "../events/semantic-event.ts";
import type { LearnedPattern } from "./learned-pattern.ts";

export const FIELD_DERIVATIONS = [
  "authored",
  "extracted",
  "classified",
  "routed",
  "generated",
] as const;

export type FieldDerivation = (typeof FIELD_DERIVATIONS)[number];

export const PATTERN_FIELDS = [
  "channel",
  "report.id",
  "customer.name",
  "customer.email",
  "issue.title",
  "issue.description",
  "category",
  "department",
  "severity",
  "labels",
  "owner",
  "issue.number",
  "team.message",
  "customer.reply",
] as const;

export type PatternField = (typeof PATTERN_FIELDS)[number];

export interface FunctionalDependency {
  readonly determinant: PatternField;
  readonly dependent: PatternField;
  readonly expression: string;
}

export interface VariableBinding {
  readonly kind: "runtime_variable";
  readonly field: PatternField;
  readonly derivation: FieldDerivation;
  readonly required: boolean;
  readonly dependency?: FunctionalDependency;
}

export interface FieldProvenance {
  readonly derivation: FieldDerivation;
  readonly matchingTraceIds: readonly string[];
  readonly sourceEventIds: readonly string[];
  readonly sourceActions: readonly SemanticEvent["action"][];
  readonly heldConstant: boolean;
}

type PatternVariable = LearnedPattern["variables"][number];
type PatternConstant = LearnedPattern["constants"][number];
type PatternStage = LearnedPattern["stages"][number];
type PatternEvidence = LearnedPattern["evidence"];

export interface CompiledPatternVariable extends PatternVariable {
  readonly field: PatternField;
  readonly source: FieldDerivation;
  readonly binding: VariableBinding;
  readonly provenance: FieldProvenance;
  readonly heldConstant: boolean;
}

export interface CompiledPatternConstant extends PatternConstant {
  readonly field: PatternField;
  readonly derivation: "authored";
  readonly provenance: FieldProvenance;
}

export type WorkflowStageName =
  | "Email"
  | "Understand issue"
  | "Create ticket"
  | "Assign owner"
  | "Notify team";

export type PatternPermission = LearnedPattern["permissions"][number];

export type WorkflowFieldBinding =
  | {
      readonly kind: "variable";
      readonly binding: VariableBinding;
      readonly direction: "input" | "output";
    }
  | {
      readonly kind: "constant";
      readonly field: PatternField;
      readonly direction: "input" | "output";
    };

export interface CompiledWorkflowStage extends PatternStage {
  readonly name: WorkflowStageName;
  readonly permissions: readonly PatternPermission[];
  readonly bindings: readonly WorkflowFieldBinding[];
}

export interface FieldGeneralizationEvidence {
  readonly field: PatternField;
  readonly derivation: FieldDerivation;
  readonly heldConstant: boolean;
  readonly rationale: string;
  readonly provenance: FieldProvenance;
}

export interface RepresentativeObservedValue {
  readonly field: Extract<PatternField, "department" | "owner">;
  readonly value: unknown;
}

export interface CompiledPatternEvidence extends PatternEvidence {
  readonly sampleSizeDiscount: number;
  readonly fieldGeneralizations: readonly FieldGeneralizationEvidence[];
  readonly representativeValues: readonly RepresentativeObservedValue[];
}

export interface CompiledLearnedPattern extends LearnedPattern {
  readonly status: "proposed";
  readonly stages: readonly CompiledWorkflowStage[];
  readonly variables: readonly CompiledPatternVariable[];
  readonly constants: readonly CompiledPatternConstant[];
  readonly evidence: CompiledPatternEvidence;
  readonly dependencies: readonly FunctionalDependency[];
  readonly observationCount: number;
  readonly manualBaselineTraceId: string;
}
