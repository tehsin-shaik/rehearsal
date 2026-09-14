import type { PatternField, VariableBinding } from "./compilation-types.ts";
import { getPatternFieldDefinition } from "./field-schema.ts";

export function createVariableBinding(field: PatternField): VariableBinding {
  const definition = getPatternFieldDefinition(field);

  return {
    kind: "runtime_variable",
    field,
    derivation: definition.derivation,
    required: definition.requiredAtRuntime,
    ...(definition.dependency === undefined
      ? {}
      : { dependency: definition.dependency }),
  };
}
