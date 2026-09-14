import type { DemoFailurePoint } from "../../demo/adapters/in-memory-adapters.ts";
import type { SemanticEvent } from "../../domain/events/semantic-event.ts";
import type { SourceApplication } from "../../domain/events/taxonomy.ts";
import type { WorkflowTrace } from "../../domain/events/workflow-trace.ts";
import type { CompiledLearnedPattern } from "../../domain/patterns/compilation-types.ts";
import type { PreviewRun } from "../../domain/runs/preview-run-types.ts";
import type {
  IssueSeverity,
  IssueUnderstanding,
} from "../../domain/understanding/issue-understanding.ts";
import type { MailMessage } from "../../domain/understanding/mail-message.ts";
import type { TeamOwner } from "../../domain/understanding/team-routing.ts";
import type { ApplicationPhase } from "../state-machine/phases.ts";

export type PatternLifecycle = "proposed" | "active" | "paused";

export interface ApplicationWorkflow {
  readonly pattern: CompiledLearnedPattern;
  readonly lifecycle: PatternLifecycle;
  readonly createdAt: string;
  readonly successfulRuns: number;
  readonly actionsSaved: number;
  readonly secondsSaved: number;
}

export type TimelineKind =
  | "phase"
  | "observation"
  | "pattern"
  | "trigger"
  | "planning"
  | "policy"
  | "execution"
  | "review"
  | "integration"
  | "privacy";

export interface TimelineEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly kind: TimelineKind;
  readonly summary: string;
  readonly detail: string | null;
  readonly phase: ApplicationPhase;
}

export interface EngineMetrics {
  readonly actionsSaved: number;
  readonly secondsSaved: number;
  readonly completedRuns: number;
  readonly failedRuns: number;
  readonly humanInterventions: number;
}

export interface EngineSlice {
  readonly phase: ApplicationPhase;
  readonly phaseHistory: readonly ApplicationPhase[];
  readonly activeTrace: WorkflowTrace | null;
  readonly completedTraces: readonly WorkflowTrace[];
  readonly liveConfidence: number;
  readonly workflows: readonly ApplicationWorkflow[];
  readonly inspectedPatternId: string | null;
  readonly activeRun: PreviewRun | null;
  readonly runHistory: readonly PreviewRun[];
  readonly planningActionCount: number;
  readonly runningActionIndex: number | null;
  readonly metrics: EngineMetrics;
  readonly timeline: readonly TimelineEntry[];
  readonly observationPaused: boolean;
  readonly excludedApplications: readonly SourceApplication[];
  readonly initialized: boolean;
}

export interface WorkspaceMailMessage extends MailMessage {
  readonly senderName: string;
  readonly senderAddress: string;
  readonly preview: string;
  readonly isRead: boolean;
  readonly isNew: boolean;
  readonly isSupportLike: boolean;
}

export interface ClipboardMetadata {
  readonly messageId: string;
  readonly subject: string;
  readonly copiedFields: readonly ("message_id" | "subject" | "sender")[];
  readonly copiedAt: string;
}

export type IssuePriority = Exclude<IssueSeverity, "unresolved">;

export interface TrackerComposerState {
  readonly open: boolean;
  readonly sourceMessageId: string | null;
  readonly title: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly priority: IssuePriority;
  readonly owner: TeamOwner | null;
}

export interface ReplicaIssue {
  readonly id: string;
  readonly key: string;
  readonly number: string;
  readonly url: string | null;
  readonly title: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly priority: IssuePriority;
  readonly owner: TeamOwner | null;
  readonly state: "open" | "in_progress" | "resolved";
  readonly createdAt: string;
  readonly source: "existing" | "manual" | "agent" | "live";
}

export interface WorkspaceTeamMessage {
  readonly id: string;
  readonly channel: string;
  readonly author: string;
  readonly message: string;
  readonly sentAt: string;
  readonly source: "existing" | "manual" | "agent" | "live";
}

export interface TeamChannel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface WorkspaceCustomerReply {
  readonly id: string;
  readonly originatingMessageId: string;
  readonly recipient: string;
  readonly message: string;
  readonly sentAt: string;
  readonly source: "manual" | "agent" | "live";
}

export interface WorkspaceSlice {
  readonly inboxMessages: readonly WorkspaceMailMessage[];
  readonly selectedMessageId: string | null;
  readonly clipboardMetadata: ClipboardMetadata | null;
  readonly structuredUnderstanding: IssueUnderstanding | null;
  readonly trackerComposer: TrackerComposerState;
  readonly replicaIssues: readonly ReplicaIssue[];
  readonly currentIssueNumber: string;
  readonly teamChannels: readonly TeamChannel[];
  readonly teamMessages: readonly WorkspaceTeamMessage[];
  readonly activeChannel: string;
  readonly teamMessageDraft: string;
  readonly customerReplyDraft: string;
  readonly customerReplies: readonly WorkspaceCustomerReply[];
}

export type OrbState =
  | "idle"
  | "learning"
  | "pattern_discovered"
  | "preview_ready"
  | "executing"
  | "success"
  | "error";

export interface PresentationBanner {
  readonly tone: "neutral" | "cyan" | "violet" | "teal" | "amber" | "rose";
  readonly title: string;
  readonly detail: string | null;
}

export interface LayoutPreferences {
  readonly replicaRowHeight: number;
  readonly inspectionRowHeight: number;
}

export interface PresentationSlice {
  readonly hydrated: boolean;
  readonly orbState: OrbState;
  readonly banner: PresentationBanner | null;
  readonly patternCollapseActive: boolean;
  readonly commandPaletteOpen: boolean;
  readonly demoConsoleOpen: boolean;
  readonly guideAffordancesEnabled: boolean;
  readonly soundEnabled: boolean;
  readonly layout: LayoutPreferences;
  readonly resetConfirmationPending: boolean;
}

export type IntegrationMode = "demo" | "live";

export interface ConnectedSurface {
  readonly id: string;
  readonly provider: string;
  readonly label: string;
  readonly status: "connected" | "available" | "unavailable" | "error";
  readonly externalUrl: string | null;
}

export interface IntegrationSlice {
  readonly mode: IntegrationMode;
  readonly trackerTarget: string;
  readonly messagingTarget: string;
  readonly mailTarget: string;
  readonly mailSurface: ConnectedSurface | null;
  readonly trackerSurfaces: readonly ConnectedSurface[];
  readonly selectedTrackerSurfaceId: string | null;
  readonly oauthConnectionUrl: string | null;
  readonly extensionFeedCursor: number;
  readonly extensionFeedStatus: "idle" | "polling" | "connected" | "error";
  readonly selectedFailurePoint: DemoFailurePoint | null;
}

export interface RehearsalState {
  readonly engine: EngineSlice;
  readonly workspace: WorkspaceSlice;
  readonly presentation: PresentationSlice;
  readonly integration: IntegrationSlice;
}

export interface SurfaceRefreshResult {
  readonly mailSurface: ConnectedSurface | null;
  readonly trackerSurfaces: readonly ConnectedSurface[];
  readonly selectedTrackerSurfaceId: string | null;
  readonly oauthConnectionUrl: string | null;
  readonly trackerTarget?: string;
  readonly messagingTarget?: string;
  readonly mailTarget?: string;
  readonly mailMessages?: readonly WorkspaceMailMessage[];
  readonly trackerIssues?: readonly ReplicaIssue[];
  readonly extensionObservations?: readonly {
    readonly sequence: number;
    readonly receivedAt: string;
    readonly event: SemanticEvent;
  }[];
  readonly extensionCompletions?: readonly {
    readonly sequence: number;
    readonly receivedAt: string;
    readonly traceId: string;
  }[];
  readonly extensionFeedCursor?: number;
}

export interface SemanticObservationInput {
  readonly occurredAt?: string;
  readonly sourceApplication: SourceApplication;
  readonly action: SemanticEvent["action"];
  readonly intent?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly confidence?: number;
  readonly origin?: SemanticEvent["origin"];
  readonly estimatedEffortSeconds?: number;
}
