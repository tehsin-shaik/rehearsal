import { createStore, type StoreApi } from "zustand/vanilla";

import { createInitialEngineSlice } from "./engine-slice.ts";
import { createInitialIntegrationSlice } from "./integration-slice.ts";
import { createInitialPresentationSlice } from "./presentation-slice.ts";
import type { IntegrationMode, RehearsalState } from "./types.ts";
import { createInitialWorkspaceSlice } from "./workspace-slice.ts";

export type RehearsalStore = StoreApi<RehearsalState>;

export function createInitialRehearsalState(
  mode: IntegrationMode = "demo",
): RehearsalState {
  return {
    engine: createInitialEngineSlice(),
    workspace: createInitialWorkspaceSlice(),
    presentation: createInitialPresentationSlice(),
    integration: createInitialIntegrationSlice(mode),
  };
}

export function createRehearsalStore(
  mode: IntegrationMode = "demo",
): RehearsalStore {
  return createStore<RehearsalState>(() => createInitialRehearsalState(mode));
}
