import type {
  CompiledPatternConstant,
  CompiledPatternVariable,
} from "./compilation-types.ts";
import type { FieldValueComparison } from "./field-value-comparison.ts";
import { createFieldProvenance } from "./field-provenance.ts";
import { getPatternFieldDefinition } from "./field-schema.ts";
import { createVariableBinding } from "./variable-bindings.ts";

export interface CompiledFieldDecisions {
  readonly variables: readonly CompiledPatternVariable[];
  readonly constants: readonly CompiledPatternConstant[];
}

const DERIVATION_RATIONALES = {
  authored: "Authored values that vary must be supplied at runtime.",
  extracted: "Extracted values are resolved from each incoming report.",
  classified: "Classified values are recomputed from each report.",
  routed: "Routed values are resolved from the current routing configuration.",
  generated: "Generated values are created at runtime and are never memorized.",
} as const;

function variableRationale(comparison: FieldValueComparison): string {
  if (comparison.invariant && comparison.derivation !== "authored") {
    return `The observed value was held constant across ${comparison.totalTraceCount} matching traces but remains variable because ${DERIVATION_RATIONALES[comparison.derivation].toLowerCase()}`;
  }

  return DERIVATION_RATIONALES[comparison.derivation];
}

export function classifyPatternFields(
  comparisons: readonly FieldValueComparison[],
): CompiledFieldDecisions {
  const variables: CompiledPatternVariable[] = [];
  const constants: CompiledPatternConstant[] = [];

  for (const comparison of comparisons) {
    const definition = getPatternFieldDefinition(comparison.field);
    const heldConstant =
      comparison.invariant && comparison.totalTraceCount >= 2;
    const provenance = createFieldProvenance(
      comparison.field,
      comparison,
      heldConstant,
    );

    if (definition.derivation === "authored" && heldConstant) {
      constants.push({
        field: comparison.field,
        value: comparison.representativeValue,
        derivation: "authored",
        rationale: `Explicitly authored field remained invariant across ${comparison.totalTraceCount} matching traces.`,
        provenance,
      });
      continue;
    }

    variables.push({
      field: comparison.field,
      source: definition.derivation,
      ...(definition.dependency === undefined
        ? {}
        : { dependsOn: definition.dependency.determinant }),
      rationale: variableRationale(comparison),
      binding: createVariableBinding(comparison.field),
      provenance,
      heldConstant,
    });
  }

  return { variables, constants };
}
