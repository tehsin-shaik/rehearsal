export {
  calculateLiveMatchConfidence,
  DEFAULT_PATTERN_DETECTION_CONFIG,
  detectRepeatedPattern,
  type PatternDetectionConfig,
  type PatternDetectionResult,
  type PatternTraceComparison,
} from "./pattern-detection.ts";
export {
  compareWorkflowTraces,
  jaccardSimilarity,
  normalizedLevenshteinSimilarity,
  semanticIntentCosineSimilarity,
  TRACE_SIMILARITY_WEIGHTS,
  type TraceSimilarityScores,
} from "./similarity.ts";
export type { LearnedPattern } from "./learned-pattern.ts";
