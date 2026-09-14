import type { PresentationSlice } from "./types.ts";

export function createInitialPresentationSlice(): PresentationSlice {
  return {
    hydrated: false,
    orbState: "idle",
    banner: null,
    patternCollapseActive: false,
    commandPaletteOpen: false,
    demoConsoleOpen: false,
    guideAffordancesEnabled: true,
    soundEnabled: false,
    layout: {
      replicaRowHeight: 338,
      inspectionRowHeight: 232,
    },
    resetConfirmationPending: false,
  };
}
