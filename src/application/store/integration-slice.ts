import type { IntegrationMode, IntegrationSlice } from "./types.ts";

export function createInitialIntegrationSlice(
  mode: IntegrationMode = "demo",
): IntegrationSlice {
  return {
    mode,
    trackerTarget:
      mode === "demo" ? "Rehearsal Demo Issue Tracker" : "Not configured",
    messagingTarget:
      mode === "demo" ? "Rehearsal Demo Team Chat" : "Not configured",
    mailTarget:
      mode === "demo" ? "Rehearsal Demo Customer Mail" : "Not configured",
    mailSurface: null,
    trackerSurfaces: [],
    selectedTrackerSurfaceId: null,
    oauthConnectionUrl: null,
    extensionFeedCursor: 0,
    extensionFeedStatus: "idle",
    selectedFailurePoint: null,
  };
}
