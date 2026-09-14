import type { WorkflowTrace } from "../events/workflow-trace.ts";
import type {
  CompiledLearnedPattern,
  PatternPermission,
} from "./compilation-types.ts";
import { deterministicIdentifier } from "./deterministic-serialization.ts";
import { classifyPatternFields } from "./field-classification.ts";
import { compareFieldValues } from "./field-value-comparison.ts";
import { DEPARTMENT_OWNER_DEPENDENCY } from "./field-schema.ts";
import { detectRepeatedPattern } from "./pattern-detection.ts";
import { buildPatternEvidence } from "./pattern-evidence.ts";
import {
  collapseTraceFields,
  selectManualBaseline,
} from "./trace-field-collapse.ts";
import { generateWorkflowStages } from "./workflow-step-generation.ts";

function selectMatchingTraces(
  traces: readonly WorkflowTrace[],
  matchingTraceIds: readonly string[],
): readonly WorkflowTrace[] {
  const completedTracesById = new Map(
    traces
      .filter((trace) => trace.status === "completed")
      .map((trace) => [trace.id, trace]),
  );

  return matchingTraceIds.map((traceId) => {
    const trace = completedTracesById.get(traceId);
    if (trace === undefined) {
      throw new RangeError(`Missing matching completed trace: ${traceId}`);
    }

    return trace;
  });
}

export function compileLearnedPattern(
  traces: readonly WorkflowTrace[],
): CompiledLearnedPattern | null {
  const detection = detectRepeatedPattern(traces);
  if (!detection.detected) {
    return null;
  }

  const matchingTraces = selectMatchingTraces(
    traces,
    detection.matchingTraceIds,
  );
  const collapsedTraces = matchingTraces.map(collapseTraceFields);
  const fieldComparisons = compareFieldValues(collapsedTraces);
  const { variables, constants } = classifyPatternFields(fieldComparisons);
  const stages = generateWorkflowStages(variables, constants);
  const manualBaseline = selectManualBaseline(collapsedTraces);
  const permissions = [
    ...new Set(stages.flatMap((stage) => stage.permissions)),
  ] as PatternPermission[];
  const evidence = buildPatternEvidence(detection, variables, fieldComparisons);
  const patternIdentity = {
    matchingTraceIds: evidence.matchingTraceIds,
    stages: stages.map((stage) => ({
      id: stage.id,
      action: stage.action,
      bindings: stage.bindings,
    })),
    variables: variables.map((variable) => ({
      field: variable.field,
      derivation: variable.source,
      heldConstant: variable.heldConstant,
    })),
    constants: constants.map((constant) => ({
      field: constant.field,
      value: constant.value,
    })),
  };

  return {
    id: deterministicIdentifier("pattern", patternIdentity),
    status: "proposed",
    trigger: {
      sourceApplication: "mail",
      action: "report_received",
      intent: "Receive a support report",
    },
    stages,
    variables,
    constants,
    permissions,
    confidence: detection.confidence,
    evidence,
    dependencies: [DEPARTMENT_OWNER_DEPENDENCY],
    observationCount: detection.matchingTraceCount,
    manualBaselineTraceId: manualBaseline.traceId,
    observedManualActionCount: manualBaseline.observedManualActionCount,
    estimatedDurationSeconds: manualBaseline.estimatedManualDurationSeconds,
  };
}
