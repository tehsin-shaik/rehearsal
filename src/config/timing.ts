export interface PresentationTiming {
  readonly mailArrivalMs: number;
  readonly previewPlanMaterializationMs: number;
  readonly executionStepProgressMs: number;
  readonly comparisonDwellMs: number;
  readonly triggerToPreviewMs: number;
  readonly successHoldMs: number;
}

export const PRESENTATION_TIMING: PresentationTiming = {
  mailArrivalMs: 420,
  previewPlanMaterializationMs: 110,
  executionStepProgressMs: 220,
  comparisonDwellMs: 680,
  triggerToPreviewMs: 520,
  successHoldMs: 1_200,
};

export const TEST_PRESENTATION_TIMING: PresentationTiming = {
  mailArrivalMs: 0,
  previewPlanMaterializationMs: 0,
  executionStepProgressMs: 0,
  comparisonDwellMs: 0,
  triggerToPreviewMs: 0,
  successHoldMs: 0,
};
