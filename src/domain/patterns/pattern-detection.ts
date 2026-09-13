import type { WorkflowTrace } from "../events/workflow-trace.ts";
import { compareWorkflowTraces, type TraceSimilarityScores, } from "./similarity.ts";
export const DEFAULT_PATTERN_DETECTION_CONFIG = {
    minimumObservations: 2,
    similarityThreshold: 0.82,
} as const;
export interface PatternDetectionConfig {
    readonly minimumObservations?: number;
    readonly similarityThreshold?: number;
}
export interface PatternTraceComparison extends TraceSimilarityScores {
    readonly traceIds: readonly [
        string,
        string
    ];
}
export interface PatternDetectionResult {
    readonly detected: boolean;
    readonly minimumObservations: number;
    readonly similarityThreshold: number;
    readonly matchingTraceCount: number;
    readonly matchingTraceIds: readonly string[];
    readonly confidence: number;
    readonly sampleSizeDiscount: number;
    readonly bestComparison: PatternTraceComparison | null;
    readonly comparisons: readonly PatternTraceComparison[];
}
interface PatternCluster {
    readonly anchorTraceId: string;
    readonly matchingTraceIds: readonly string[];
    readonly averageSimilarity: number;
}
function roundScore(score: number): number {
    return Math.round(score * 1000000) / 1000000;
}
function sampleSizeDiscount(sampleSize: number): number {
    return sampleSize === 0 ? 0 : roundScore(sampleSize / (sampleSize + 1));
}
function validateConfiguration(config: PatternDetectionConfig): {
    readonly minimumObservations: number;
    readonly similarityThreshold: number;
} {
    const minimumObservations = config.minimumObservations ??
        DEFAULT_PATTERN_DETECTION_CONFIG.minimumObservations;
    const similarityThreshold = config.similarityThreshold ??
        DEFAULT_PATTERN_DETECTION_CONFIG.similarityThreshold;
    if (!Number.isInteger(minimumObservations) || minimumObservations < 2) {
        throw new RangeError("Minimum observations must be an integer of at least 2.");
    }
    if (similarityThreshold < 0 || similarityThreshold > 1) {
        throw new RangeError("Similarity threshold must be between 0 and 1.");
    }
    return { minimumObservations, similarityThreshold };
}
function comparisonKey(leftTraceId: string, rightTraceId: string): string {
    return [leftTraceId, rightTraceId].sort().join("\u0000");
}
function createComparisons(traces: readonly WorkflowTrace[]): readonly PatternTraceComparison[] {
    const comparisons: PatternTraceComparison[] = [];
    for (let leftIndex = 0; leftIndex < traces.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < traces.length; rightIndex += 1) {
            const leftTrace = traces[leftIndex];
            const rightTrace = traces[rightIndex];
            comparisons.push({
                traceIds: [leftTrace.id, rightTrace.id],
                ...compareWorkflowTraces(leftTrace, rightTrace),
            });
        }
    }
    return comparisons;
}
function selectCluster(traces: readonly WorkflowTrace[], comparisons: readonly PatternTraceComparison[], similarityThreshold: number): PatternCluster | null {
    if (traces.length === 0) {
        return null;
    }
    const comparisonsByTracePair = new Map(comparisons.map((comparison) => [
        comparisonKey(...comparison.traceIds),
        comparison,
    ]));
    let selectedCluster: PatternCluster | null = null;
    for (const anchorTrace of traces) {
        const matchingComparisons = traces
            .filter((trace) => trace.id !== anchorTrace.id)
            .map((trace) => comparisonsByTracePair.get(comparisonKey(anchorTrace.id, trace.id)))
            .filter((comparison): comparison is PatternTraceComparison => comparison !== undefined &&
            comparison.weightedSimilarity >= similarityThreshold);
        const matchingTraceIds = [
            anchorTrace.id,
            ...matchingComparisons.map((comparison) => comparison.traceIds[0] === anchorTrace.id
                ? comparison.traceIds[1]
                : comparison.traceIds[0]),
        ].sort();
        const averageSimilarity = matchingComparisons.length === 0
            ? 0
            : roundScore(matchingComparisons.reduce((total, comparison) => total + comparison.weightedSimilarity, 0) / matchingComparisons.length);
        const candidateCluster: PatternCluster = {
            anchorTraceId: anchorTrace.id,
            matchingTraceIds,
            averageSimilarity,
        };
        if (selectedCluster === null ||
            candidateCluster.matchingTraceIds.length >
                selectedCluster.matchingTraceIds.length ||
            (candidateCluster.matchingTraceIds.length ===
                selectedCluster.matchingTraceIds.length &&
                candidateCluster.averageSimilarity >
                    selectedCluster.averageSimilarity) ||
            (candidateCluster.matchingTraceIds.length ===
                selectedCluster.matchingTraceIds.length &&
                candidateCluster.averageSimilarity ===
                    selectedCluster.averageSimilarity &&
                candidateCluster.anchorTraceId < selectedCluster.anchorTraceId)) {
            selectedCluster = candidateCluster;
        }
    }
    return selectedCluster;
}
export function detectRepeatedPattern(traces: readonly WorkflowTrace[], config: PatternDetectionConfig = {}): PatternDetectionResult {
    const { minimumObservations, similarityThreshold } = validateConfiguration(config);
    const completedTraces = traces
        .filter((trace) => trace.status === "completed")
        .sort((leftTrace, rightTrace) => leftTrace.id.localeCompare(rightTrace.id));
    const comparisons = createComparisons(completedTraces);
    const selectedCluster = selectCluster(completedTraces, comparisons, similarityThreshold);
    const matchingTraceIds = selectedCluster?.matchingTraceIds ?? [];
    const matchingTraceCount = matchingTraceIds.length;
    const discount = sampleSizeDiscount(matchingTraceCount);
    const confidence = roundScore((selectedCluster?.averageSimilarity ?? 0) * discount);
    const bestComparison = [...comparisons].sort((leftComparison, rightComparison) => rightComparison.weightedSimilarity -
        leftComparison.weightedSimilarity ||
        comparisonKey(...leftComparison.traceIds).localeCompare(comparisonKey(...rightComparison.traceIds)))[0] ?? null;
    return {
        detected: matchingTraceCount >= minimumObservations,
        minimumObservations,
        similarityThreshold,
        matchingTraceCount,
        matchingTraceIds,
        confidence,
        sampleSizeDiscount: discount,
        bestComparison,
        comparisons,
    };
}
export function calculateLiveMatchConfidence(referenceTraces: readonly WorkflowTrace[], liveTrace: WorkflowTrace): number {
    const completedReferences = referenceTraces.filter((trace) => trace.status === "completed");
    if (completedReferences.length === 0 || liveTrace.events.length === 0) {
        return 0;
    }
    const averageSimilarity = completedReferences.reduce((total, referenceTrace) => total +
        compareWorkflowTraces(referenceTrace, liveTrace).weightedSimilarity, 0) / completedReferences.length;
    return roundScore(averageSimilarity * sampleSizeDiscount(completedReferences.length));
}
