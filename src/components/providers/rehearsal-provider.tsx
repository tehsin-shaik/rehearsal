"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { z } from "zod";

import {
  createRehearsalApplication,
  type RehearsalApplication,
} from "../../application/rehearsal-application.ts";
import type { RehearsalState } from "../../application/store/types.ts";
import {
  createHttpExecutionAdapterBundle,
  loadLiveSurfaces,
  planPreviewRunWithAgUi,
  understandReportLive,
} from "../../infrastructure/client/index.ts";

const RehearsalContext = createContext<RehearsalApplication | null>(null);
const PREFERENCES_KEY = "rehearsal:presentation-preferences";

const storedPreferencesSchema = z
  .object({
    soundEnabled: z.boolean().optional(),
    guideAffordancesEnabled: z.boolean().optional(),
    replicaRowHeight: z.number().finite().min(100).max(800).optional(),
    inspectionRowHeight: z.number().finite().min(100).max(800).optional(),
  })
  .strict();

type StoredPreferences = z.output<typeof storedPreferencesSchema>;

function readStoredPreferences(): StoredPreferences | null {
  try {
    const value = window.localStorage.getItem(PREFERENCES_KEY);
    if (value === null) {
      return null;
    }
    const parsed = storedPreferencesSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function RehearsalProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const applicationRef = useRef<RehearsalApplication | null>(null);
  if (applicationRef.current === null) {
    const mode =
      process.env.NEXT_PUBLIC_DEMO_MODE === "false" ? "live" : "demo";
    applicationRef.current = createRehearsalApplication({
      mode,
      ...(mode === "demo"
        ? {}
        : {
            understandReport: understandReportLive,
            planRun: planPreviewRunWithAgUi,
            refreshSurfaces: () =>
              loadLiveSurfaces(
                applicationRef.current?.store.getState().integration
                  .selectedTrackerSurfaceId ?? null,
                applicationRef.current?.store.getState().integration
                  .extensionFeedCursor ?? 0,
              ),
            createExecutionAdapters: (run) => {
              const integration =
                applicationRef.current?.store.getState().integration;
              return createHttpExecutionAdapterBundle(run, {
                trackerTarget:
                  integration?.trackerTarget ?? "Connected issue tracker",
                messagingTarget:
                  integration?.messagingTarget ?? "Connected team messaging",
                mailTarget:
                  integration?.mailTarget ?? "Connected customer mail",
              });
            },
          }),
    });
  }
  const application = applicationRef.current;

  useEffect(() => {
    const preferences = readStoredPreferences();
    if (preferences?.soundEnabled === true) {
      application.commands.toggleSound();
    }
    if (preferences?.guideAffordancesEnabled === false) {
      application.commands.toggleGuideAffordances();
    }
    if (typeof preferences?.replicaRowHeight === "number") {
      application.commands.setReplicaRowHeight(preferences.replicaRowHeight);
    }
    if (typeof preferences?.inspectionRowHeight === "number") {
      application.commands.setInspectionRowHeight(
        preferences.inspectionRowHeight,
      );
    }
    application.commands.setHydrated();

    return application.store.subscribe((state) => {
      if (!state.presentation.hydrated) {
        return;
      }
      const nextPreferences: StoredPreferences = {
        soundEnabled: state.presentation.soundEnabled,
        guideAffordancesEnabled: state.presentation.guideAffordancesEnabled,
        replicaRowHeight: state.presentation.layout.replicaRowHeight,
        inspectionRowHeight: state.presentation.layout.inspectionRowHeight,
      };
      try {
        window.localStorage.setItem(
          PREFERENCES_KEY,
          JSON.stringify(nextPreferences),
        );
      } catch {
        return;
      }
    });
  }, [application]);

  useEffect(() => {
    if (application.store.getState().integration.mode !== "live") {
      return;
    }

    let stopped = false;
    let refreshing = false;
    const refresh = async () => {
      if (stopped || refreshing) {
        return;
      }
      refreshing = true;
      try {
        await application.commands.refreshConnectedSurfaces();
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const pollingInterval = window.setInterval(() => {
      void refresh();
    }, 30_000);

    return () => {
      stopped = true;
      window.clearInterval(pollingInterval);
    };
  }, [application]);

  return (
    <RehearsalContext.Provider value={application}>
      {children}
    </RehearsalContext.Provider>
  );
}

export function useRehearsalApplication(): RehearsalApplication {
  const application = useContext(RehearsalContext);
  if (application === null) {
    throw new Error("RehearsalProvider is required for application state.");
  }
  return application;
}

export function useRehearsalState<Selection>(
  selector: (state: RehearsalState) => Selection,
): Selection {
  const application = useRehearsalApplication();
  return useStore(application.store, selector);
}
