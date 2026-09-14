export {
  FIELD_DERIVATIONS,
  PATTERN_FIELDS,
  type CompiledLearnedPattern,
  type CompiledPatternConstant,
  type CompiledPatternEvidence,
  type CompiledPatternVariable,
  type CompiledWorkflowStage,
  type FieldDerivation,
  type FieldGeneralizationEvidence,
  type FieldProvenance,
  type FunctionalDependency,
  type PatternField,
  type PatternPermission,
  type RepresentativeObservedValue,
  type VariableBinding,
  type WorkflowFieldBinding,
  type WorkflowStageName,
} from "./compilation-types.ts";
export {
  deterministicIdentifier,
  stableSerialize,
} from "./deterministic-serialization.ts";
export {
  classifyPatternFields,
  type CompiledFieldDecisions,
} from "./field-classification.ts";
export {
  compareFieldValues,
  type FieldValueComparison,
} from "./field-value-comparison.ts";
export { createFieldProvenance } from "./field-provenance.ts";
export {
  DEPARTMENT_OWNER_DEPENDENCY,
  getPatternFieldDefinition,
  PATTERN_FIELD_DEFINITIONS,
  type PatternFieldDefinition,
} from "./field-schema.ts";
export {
  calculateLiveMatchConfidence,
  DEFAULT_PATTERN_DETECTION_CONFIG,
  detectRepeatedPattern,
  type PatternDetectionConfig,
  type PatternDetectionResult,
  type PatternTraceComparison,
} from "./pattern-detection.ts";
export { compileLearnedPattern } from "./pattern-compiler.ts";
export { buildPatternEvidence } from "./pattern-evidence.ts";
export {
  compareWorkflowTraces,
  jaccardSimilarity,
  normalizedLevenshteinSimilarity,
  semanticIntentCosineSimilarity,
  TRACE_SIMILARITY_WEIGHTS,
  type TraceSimilarityScores,
} from "./similarity.ts";
export {
  collapseTraceFields,
  selectManualBaseline,
  type CollapsedTraceField,
  type CollapsedTraceFields,
} from "./trace-field-collapse.ts";
export { createVariableBinding } from "./variable-bindings.ts";
export { generateWorkflowStages } from "./workflow-step-generation.ts";
export type { LearnedPattern } from "./learned-pattern.ts";
