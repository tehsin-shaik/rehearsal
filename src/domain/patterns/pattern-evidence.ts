import type {
  CompiledPatternEvidence,
  CompiledPatternVariable,
  RepresentativeObservedValue,
} from "./compilation-types.ts";
import type { FieldValueComparison } from "./field-value-comparison.ts";
import type {
  PatternDetectionResult,
  PatternTraceComparison,
} from "./pattern-detection.ts";

function comparisonKey(comparison: PatternTraceComparison): string {
  return [...comparison.traceIds].sort().join("\u0000");
}

function selectEvidenceComparison(
  detection: PatternDetectionResult,
): PatternTraceComparison {
  const matchingTraceIds = new Set(detection.matchingTraceIds);
  const comparison = detection.comparisons
    .filter((candidate) =>
      candidate.traceIds.every((traceId) => matchingTraceIds.has(traceId)),
    )
    .sort(
      (leftComparison, rightComparison) =>
        rightComparison.weightedSimilarity -
          leftComparison.weightedSimilarity ||
        comparisonKey(leftComparison).localeCompare(
          comparisonKey(rightComparison),
        ),
    )[0];

  if (comparison === undefined) {
    throw new RangeError("Pattern evidence requires two matching traces.");
  }

  return comparison;
}

export function buildPatternEvidence(
  detection: PatternDetectionResult,
  variables: readonly CompiledPatternVariable[],
  fieldComparisons: readonly FieldValueComparison[],
): CompiledPatternEvidence {
  const comparison = selectEvidenceComparison(detection);
  const representativeValues = fieldComparisons.flatMap(
    (fieldComparison): readonly RepresentativeObservedValue[] => {
      if (
        !fieldComparison.invariant ||
        (fieldComparison.field !== "department" &&
          fieldComparison.field !== "owner")
      ) {
        return [];
      }

      return [
        {
          field: fieldComparison.field,
          value: fieldComparison.representativeValue,
        },
      ];
    },
  );

  return {
    matchingTraceIds: [...detection.matchingTraceIds],
    sampleSize: detection.matchingTraceCount,
    actionSequenceSimilarity: comparison.actionSequenceSimilarity,
    applicationSetSimilarity: comparison.applicationSetSimilarity,
    intentSimilarity: comparison.semanticIntentSimilarity,
    sampleSizeDiscount: detection.sampleSizeDiscount,
    fieldGeneralizations: variables.map((variable) => ({
      field: variable.field,
      derivation: variable.source,
      heldConstant: variable.heldConstant,
      rationale: variable.rationale,
      provenance: variable.provenance,
    })),
    representativeValues,
  };
}
