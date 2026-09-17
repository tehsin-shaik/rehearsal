import type { StoreApi } from "zustand/vanilla";

import type {
  DemoAdapterHarness,
  DemoFailurePoint,
} from "../../demo/adapters/in-memory-adapters.ts";
import type { WorkflowTrace } from "../../domain/events/workflow-trace.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import type { IssuePriority } from "../store/types.ts";
import type {
  IntegrationMode,
  RehearsalState,
  SemanticObservationInput,
  SurfaceRefreshResult,
  WorkspaceMailMessage,
} from "../store/types.ts";
import type { PresentationTiming } from "../../config/timing.ts";
import type { SourceApplication } from "../../domain/events/taxonomy.ts";
import type { TeamOwner } from "../../domain/understanding/team-routing.ts";
import type { MailMessage } from "../../domain/understanding/mail-message.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import type { RunResearchReference } from "../../domain/runs/preview-run-types.ts";
import type { CompiledLearnedPattern } from "../../domain/patterns/compilation-types.ts";
import type { ActionResult } from "../../domain/runs/action-result.ts";
import type {
  ExecutionAdapterBundle,
  MessageDeliveryResultData,
  TeamMessageInput,
} from "../../infrastructure/adapters/contracts.ts";

export type RehearsalStore = StoreApi<RehearsalState>;

export type FixtureReportName =
  "login" | "api_timeout" | "billing" | "ambiguous";

export interface BeginTraceInput {
  readonly traceId?: string;
  readonly startedAt?: string;
  readonly messageId?: string;
}

export interface ArbitraryMailMessage extends MailMessage {
  readonly senderName?: string;
  readonly senderAddress?: string;
  readonly isSupportLike?: boolean;
}

export interface ApplicationCommandOptions {
  readonly mode?: IntegrationMode;
  readonly now?: () => string;
  readonly timing?: PresentationTiming;
  readonly createDemoHarness?: () => DemoAdapterHarness;
  readonly refreshSurfaces?: () => Promise<SurfaceRefreshResult>;
  readonly understandReport?: (report: MailMessage) => Promise<{
    readonly understanding: IssueUnderstanding;
    readonly research: {
      readonly query: string;
      readonly references: readonly RunResearchReference[];
    } | null;
  }>;
  readonly planRun?: (
    input: {
      readonly pattern: CompiledLearnedPattern;
      readonly message: MailMessage;
      readonly understanding: IssueUnderstanding;
      readonly nextIssueNumber: string;
      readonly research: {
        readonly query: string;
        readonly references: readonly RunResearchReference[];
      } | null;
    },
    onAction: (count: number) => void,
  ) => Promise<PreviewRun>;
  readonly createExecutionAdapters?: (
    run: PreviewRun,
  ) => ExecutionAdapterBundle;
  readonly sendManualTeamMessage?: (
    input: TeamMessageInput,
  ) => Promise<ActionResult<MessageDeliveryResultData>>;
}

export interface ApplicationCommands {
  initializeApplication(): void;
  resetApplication(): void;
  beginTrace(input?: BeginTraceInput): WorkflowTrace | null;
  observeSemanticAction(input: SemanticObservationInput): readonly string[];
  completeTrace(completedAt?: string): Promise<WorkflowTrace | null>;
  abandonTrace(completedAt?: string): WorkflowTrace | null;
  readMail(messageId: string): WorkflowTrace | null;
  copyReportMetadata(messageId?: string): void;
  openTrackerComposer(): void;
  populateIssueFields(): void;
  applyLabels(labels?: readonly string[]): void;
  setPriority(priority: IssuePriority): void;
  assignOwner(owner: TeamOwner): void;
  createIssueManually(): void;
  openTeamChannel(channel: string): void;
  draftNotification(message?: string): void;
  sendNotificationManually(): Promise<void>;
  replyToCustomerManually(message?: string): Promise<void>;
  inspectDiscoveredPattern(patternId?: string): void;
  activatePattern(patternId?: string): void;
  pausePattern(patternId?: string): void;
  resumePattern(patternId?: string): void;
  forgetPattern(patternId?: string): void;
  deliverFixtureReport(
    fixture: FixtureReportName,
  ): Promise<WorkspaceMailMessage>;
  deliverArbitraryMessage(
    message: ArbitraryMailMessage,
  ): Promise<WorkspaceMailMessage>;
  preparePreviewRun(messageId?: string): Promise<PreviewRun | null>;
  openPreviewRun(): PreviewRun | null;
  resolveOwnerReview(owner: TeamOwner, selectedBy?: string): PreviewRun | null;
  approveAndExecute(approvedBy?: string): Promise<PreviewRun | null>;
  cancelRun(): PreviewRun | null;
  retryFailedRun(): Promise<PreviewRun | null>;
  clearHistory(): void;
  pauseObservation(): void;
  resumeObservation(): void;
  excludeApplication(application: SourceApplication): void;
  includeApplication(application: SourceApplication): void;
  refreshConnectedSurfaces(): Promise<void>;
  selectFailurePoint(point: DemoFailurePoint | null): void;
  setHydrated(hydrated?: boolean): void;
  setCommandPaletteOpen(open: boolean): void;
  setDemoConsoleOpen(open: boolean): void;
  toggleSound(): void;
  toggleGuideAffordances(): void;
  setReplicaRowHeight(height: number): void;
  setInspectionRowHeight(height: number): void;
  requestResetConfirmation(): void;
  clearResetConfirmation(): void;
  selectTrackerSurface(surfaceId: string): void;
  getDemoHarness(): DemoAdapterHarness;
}
