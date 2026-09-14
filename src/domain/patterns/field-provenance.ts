import type { FieldProvenance, PatternField } from "./compilation-types.ts";
import type { FieldValueComparison } from "./field-value-comparison.ts";
import { getPatternFieldDefinition } from "./field-schema.ts";

export function createFieldProvenance(
  field: PatternField,
  comparison: FieldValueComparison,
  heldConstant: boolean,
): FieldProvenance {
  const definition = getPatternFieldDefinition(field);

  return {
    derivation: definition.derivation,
    matchingTraceIds: comparison.observations
      .map((observation) => observation.traceId)
      .sort(),
    sourceEventIds: [
      ...new Set(
        comparison.observations.flatMap(
          (observation) => observation.field.sourceEventIds,
        ),
      ),
    ].sort(),
    sourceActions: [
      ...new Set(
        comparison.observations.flatMap(
          (observation) => observation.field.sourceActions,
        ),
      ),
    ].sort(),
    heldConstant,
  };
}
