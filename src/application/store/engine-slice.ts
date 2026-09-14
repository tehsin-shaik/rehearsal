import type { EngineSlice } from "./types.ts";

export function createInitialEngineSlice(): EngineSlice {
  return {
    phase: "idle",
    phaseHistory: ["idle"],
    activeTrace: null,
    completedTraces: [],
    liveConfidence: 0,
    workflows: [],
    inspectedPatternId: null,
    activeRun: null,
    runHistory: [],
    planningActionCount: 0,
    runningActionIndex: null,
    metrics: {
      actionsSaved: 0,
      secondsSaved: 0,
      completedRuns: 0,
      failedRuns: 0,
      humanInterventions: 0,
    },
    timeline: [],
    observationPaused: false,
    excludedApplications: [],
    initialized: false,
  };
}
