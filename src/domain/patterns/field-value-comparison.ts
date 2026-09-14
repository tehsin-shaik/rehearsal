import type { FieldDerivation, PatternField } from "./compilation-types.ts";
import { stableSerialize } from "./deterministic-serialization.ts";
import { PATTERN_FIELD_DEFINITIONS } from "./field-schema.ts";
import type {
  CollapsedTraceField,
  CollapsedTraceFields,
} from "./trace-field-collapse.ts";

export interface FieldValueComparison {
  readonly field: PatternField;
  readonly derivation: FieldDerivation;
  readonly totalTraceCount: number;
  readonly observedTraceCount: number;
  readonly distinctValueCount: number;
  readonly observedInEveryTrace: boolean;
  readonly invariant: boolean;
  readonly representativeValue: unknown;
  readonly observations: readonly {
    readonly traceId: string;
    readonly field: CollapsedTraceField;
  }[];
}

export function compareFieldValues(
  traces: readonly CollapsedTraceFields[],
): readonly FieldValueComparison[] {
  return PATTERN_FIELD_DEFINITIONS.map((definition) => {
    const observations = traces.flatMap((trace) => {
      const field = trace.fields.find(
        (candidate) => candidate.field === definition.field,
      );
      return field === undefined ? [] : [{ traceId: trace.traceId, field }];
    });
    const distinctValues = new Map<string, unknown>();

    for (const observation of observations) {
      for (const value of observation.field.values) {
        distinctValues.set(stableSerialize(value), value);
      }
    }

    const observedInEveryTrace = observations.length === traces.length;
    const invariant =
      traces.length > 0 &&
      observedInEveryTrace &&
      distinctValues.size === 1 &&
      observations.every(
        (observation) => observation.field.values.length === 1,
      );

    return {
      field: definition.field,
      derivation: definition.derivation,
      totalTraceCount: traces.length,
      observedTraceCount: observations.length,
      distinctValueCount: distinctValues.size,
      observedInEveryTrace,
      invariant,
      representativeValue: [...distinctValues.values()][0],
      observations,
    };
  });
}
