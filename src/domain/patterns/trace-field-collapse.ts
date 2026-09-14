import type { SemanticEvent } from "../events/semantic-event.ts";
import type { WorkflowTrace } from "../events/workflow-trace.ts";
import type { FieldDerivation, PatternField } from "./compilation-types.ts";
import { stableSerialize } from "./deterministic-serialization.ts";
import { PATTERN_FIELD_DEFINITIONS } from "./field-schema.ts";

export interface CollapsedTraceField {
  readonly field: PatternField;
  readonly derivation: FieldDerivation;
  readonly values: readonly unknown[];
  readonly sourceEventIds: readonly string[];
  readonly sourceActions: readonly SemanticEvent["action"][];
}

export interface CollapsedTraceFields {
  readonly traceId: string;
  readonly fields: readonly CollapsedTraceField[];
  readonly observedManualActionCount: number;
  readonly estimatedManualDurationSeconds: number;
}

interface MutableCollapsedField {
  readonly valuesByKey: Map<string, unknown>;
  readonly sourceEventIds: Set<string>;
  readonly sourceActions: Set<SemanticEvent["action"]>;
}

export function collapseTraceFields(
  trace: WorkflowTrace,
): CollapsedTraceFields {
  const fieldsByName = new Map<PatternField, MutableCollapsedField>();

  for (const event of trace.events) {
    for (const definition of PATTERN_FIELD_DEFINITIONS) {
      for (const payloadKey of definition.payloadKeys) {
        if (!Object.hasOwn(event.payload, payloadKey)) {
          continue;
        }

        const value = event.payload[payloadKey];
        const collapsedField = fieldsByName.get(definition.field) ?? {
          valuesByKey: new Map<string, unknown>(),
          sourceEventIds: new Set<string>(),
          sourceActions: new Set<SemanticEvent["action"]>(),
        };
        collapsedField.valuesByKey.set(stableSerialize(value), value);
        collapsedField.sourceEventIds.add(event.id);
        collapsedField.sourceActions.add(event.action);
        fieldsByName.set(definition.field, collapsedField);
      }
    }
  }

  const manualEvents = trace.events.filter(
    (event) => event.origin === "observed",
  );

  return {
    traceId: trace.id,
    fields: PATTERN_FIELD_DEFINITIONS.flatMap((definition) => {
      const field = fieldsByName.get(definition.field);
      if (field === undefined) {
        return [];
      }

      return [
        {
          field: definition.field,
          derivation: definition.derivation,
          values: [...field.valuesByKey.entries()]
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([, value]) => value),
          sourceEventIds: [...field.sourceEventIds].sort(),
          sourceActions: [...field.sourceActions].sort(),
        },
      ];
    }),
    observedManualActionCount: manualEvents.length,
    estimatedManualDurationSeconds: manualEvents.reduce(
      (total, event) => total + event.estimatedEffortSeconds,
      0,
    ),
  };
}

export function selectManualBaseline(
  traces: readonly CollapsedTraceFields[],
): CollapsedTraceFields {
  const baseline = [...traces].sort(
    (leftTrace, rightTrace) =>
      leftTrace.observedManualActionCount -
        rightTrace.observedManualActionCount ||
      leftTrace.estimatedManualDurationSeconds -
        rightTrace.estimatedManualDurationSeconds ||
      leftTrace.traceId.localeCompare(rightTrace.traceId),
  )[0];

  if (baseline === undefined) {
    throw new RangeError("A manual baseline requires at least one trace.");
  }

  return baseline;
}
