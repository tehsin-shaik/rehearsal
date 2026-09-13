import type { WorkflowTrace } from "../events/workflow-trace.ts";

export const TRACE_SIMILARITY_WEIGHTS = {
  actionSequence: 0.55,
  applicationSet: 0.2,
  semanticIntent: 0.25,
} as const;

export interface TraceSimilarityScores {
  readonly actionSequenceSimilarity: number;
  readonly applicationSetSimilarity: number;
  readonly semanticIntentSimilarity: number;
  readonly weightedSimilarity: number;
}

function roundScore(score: number): number {
  return Math.round(score * 1_000_000) / 1_000_000;
}

export function normalizedLevenshteinSimilarity(
  leftSequence: readonly string[],
  rightSequence: readonly string[],
): number {
  const longestLength = Math.max(leftSequence.length, rightSequence.length);
  if (longestLength === 0) {
    return 1;
  }

  let previousRow = Array.from(
    { length: rightSequence.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= leftSequence.length; leftIndex += 1) {
    const currentRow = [leftIndex];

    for (
      let rightIndex = 1;
      rightIndex <= rightSequence.length;
      rightIndex += 1
    ) {
      const substitutionCost =
        leftSequence[leftIndex - 1] === rightSequence[rightIndex - 1] ? 0 : 1;
      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );
    }

    previousRow = currentRow;
  }

  const distance = previousRow[rightSequence.length];
  return roundScore(1 - distance / longestLength);
}

export function jaccardSimilarity(
  leftValues: ReadonlySet<string>,
  rightValues: ReadonlySet<string>,
): number {
  const union = new Set([...leftValues, ...rightValues]);
  if (union.size === 0) {
    return 1;
  }

  const intersectionSize = [...leftValues].filter((value) =>
    rightValues.has(value),
  ).length;
  return roundScore(intersectionSize / union.size);
}

function tokenizeIntents(intents: readonly string[]): readonly string[] {
  return intents.flatMap(
    (intent) => intent.toLowerCase().match(/[a-z0-9]+/g) ?? [],
  );
}

function tokenFrequencies(
  tokens: readonly string[],
): ReadonlyMap<string, number> {
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  return frequencies;
}

export function semanticIntentCosineSimilarity(
  leftIntents: readonly string[],
  rightIntents: readonly string[],
): number {
  const leftFrequencies = tokenFrequencies(tokenizeIntents(leftIntents));
  const rightFrequencies = tokenFrequencies(tokenizeIntents(rightIntents));
  const vocabulary = new Set([
    ...leftFrequencies.keys(),
    ...rightFrequencies.keys(),
  ]);

  if (vocabulary.size === 0) {
    return 1;
  }

  let dotProduct = 0;
  let leftMagnitudeSquared = 0;
  let rightMagnitudeSquared = 0;

  for (const token of vocabulary) {
    const leftFrequency = leftFrequencies.get(token) ?? 0;
    const rightFrequency = rightFrequencies.get(token) ?? 0;
    dotProduct += leftFrequency * rightFrequency;
    leftMagnitudeSquared += leftFrequency * leftFrequency;
    rightMagnitudeSquared += rightFrequency * rightFrequency;
  }

  if (leftMagnitudeSquared === 0 || rightMagnitudeSquared === 0) {
    return 0;
  }

  return roundScore(
    dotProduct / Math.sqrt(leftMagnitudeSquared * rightMagnitudeSquared),
  );
}

export function compareWorkflowTraces(
  leftTrace: WorkflowTrace,
  rightTrace: WorkflowTrace,
): TraceSimilarityScores {
  const actionSequenceSimilarity = normalizedLevenshteinSimilarity(
    leftTrace.events.map((event) => event.action),
    rightTrace.events.map((event) => event.action),
  );
  const applicationSetSimilarity = jaccardSimilarity(
    new Set(leftTrace.events.map((event) => event.sourceApplication)),
    new Set(rightTrace.events.map((event) => event.sourceApplication)),
  );
  const semanticIntentSimilarity = semanticIntentCosineSimilarity(
    leftTrace.events.map((event) => event.intent),
    rightTrace.events.map((event) => event.intent),
  );
  const weightedSimilarity = roundScore(
    actionSequenceSimilarity * TRACE_SIMILARITY_WEIGHTS.actionSequence +
      applicationSetSimilarity * TRACE_SIMILARITY_WEIGHTS.applicationSet +
      semanticIntentSimilarity * TRACE_SIMILARITY_WEIGHTS.semanticIntent,
  );

  return {
    actionSequenceSimilarity,
    applicationSetSimilarity,
    semanticIntentSimilarity,
    weightedSimilarity,
  };
}
