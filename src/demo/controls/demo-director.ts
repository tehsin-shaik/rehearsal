import type { ApplicationCommands } from "../../application/commands/types.ts";
import type { RehearsalStore } from "../../application/store/rehearsal-store.ts";
import type { DemoFailurePoint } from "../adapters/in-memory-adapters.ts";
import {
  apiTimeoutTrace,
  loginAuthenticationTrace,
} from "../fixtures/index.ts";
import type { WorkflowTrace } from "../../domain/events/workflow-trace.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import type { TeamOwner } from "../../domain/understanding/team-routing.ts";

export interface DemoDirector {
  reset(): void;
  runObservationOneInstantly(): Promise<WorkflowTrace | null>;
  runObservationTwoInstantly(): Promise<WorkflowTrace | null>;
  inspectPattern(): void;
  activatePattern(): void;
  deliverBillingReport(): Promise<void>;
  openPreviewRun(): PreviewRun | null;
  approveAndExecute(): Promise<PreviewRun | null>;
  deliverAmbiguousReport(): Promise<void>;
  resolveAmbiguousOwner(owner?: TeamOwner): PreviewRun | null;
  retryFailedRun(): Promise<PreviewRun | null>;
  selectFailurePoint(point: DemoFailurePoint | null): void;
  toggleSound(): void;
  toggleGuideAffordances(): void;
  toggleObservationPause(): void;
}

async function replayObservedTrace(
  commands: ApplicationCommands,
  trace: WorkflowTrace,
): Promise<WorkflowTrace | null> {
  commands.beginTrace({ traceId: trace.id, startedAt: trace.startedAt });
  for (const event of trace.events) {
    if (event.origin !== "observed") {
      continue;
    }
    commands.observeSemanticAction({
      occurredAt: event.occurredAt,
      sourceApplication: event.sourceApplication,
      action: event.action,
      intent: event.intent,
      payload: event.payload,
      confidence: event.confidence,
      origin: event.origin,
      estimatedEffortSeconds: event.estimatedEffortSeconds,
    });
  }
  return commands.completeTrace(trace.completedAt ?? trace.startedAt);
}

export function createDemoDirector(
  store: RehearsalStore,
  commands: ApplicationCommands,
): DemoDirector {
  return {
    reset: commands.resetApplication,
    async runObservationOneInstantly() {
      if (store.getState().engine.completedTraces.length > 0) {
        commands.resetApplication();
      }
      await replayObservedTrace(commands, loginAuthenticationTrace);
      return store.getState().engine.completedTraces.at(-1) ?? null;
    },
    async runObservationTwoInstantly() {
      if (store.getState().engine.completedTraces.length === 0) {
        await replayObservedTrace(commands, loginAuthenticationTrace);
      }
      await replayObservedTrace(commands, apiTimeoutTrace);
      return store.getState().engine.completedTraces.at(-1) ?? null;
    },
    inspectPattern: commands.inspectDiscoveredPattern,
    activatePattern: commands.activatePattern,
    async deliverBillingReport() {
      await commands.deliverFixtureReport("billing");
    },
    openPreviewRun: commands.openPreviewRun,
    approveAndExecute: commands.approveAndExecute,
    async deliverAmbiguousReport() {
      await commands.deliverFixtureReport("ambiguous");
    },
    resolveAmbiguousOwner(owner = "Elyes") {
      return commands.resolveOwnerReview(owner, "demo-reviewer");
    },
    retryFailedRun: commands.retryFailedRun,
    selectFailurePoint: commands.selectFailurePoint,
    toggleSound: commands.toggleSound,
    toggleGuideAffordances: commands.toggleGuideAffordances,
    toggleObservationPause() {
      if (store.getState().engine.observationPaused) {
        commands.resumeObservation();
      } else {
        commands.pauseObservation();
      }
    },
  };
}
