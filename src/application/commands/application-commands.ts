import { PRESENTATION_TIMING } from "../../config/timing.ts";
import { createDemoAdapterHarness } from "../../demo/adapters/in-memory-adapters.ts";
import {
  ambiguousReviewReport,
  apiTimeoutReport,
  duplicateBillingChargeReport,
  loginAuthenticationReport,
} from "../../demo/fixtures/index.ts";
import {
  SemanticTraceBuilder,
  type SemanticEvent,
  type WorkflowTrace,
} from "../../domain/events/index.ts";
import {
  calculateLiveMatchConfidence,
  compileLearnedPattern,
} from "../../domain/patterns/index.ts";
import {
  applyOwnerOverride,
  approvePreviewRun,
  composeCustomerReply,
  composeTeamNotification,
  planPreviewRun,
  type PreviewRun,
} from "../../domain/runs/index.ts";
import {
  understandReportDeterministically,
  routeDepartment,
  type MailMessage,
  type TeamOwner,
} from "../../domain/understanding/index.ts";
import { executeAgentRun } from "../engine/run-executor.ts";
import {
  assertPhaseTransition,
  type ApplicationPhase,
} from "../state-machine/phases.ts";
import { createInitialRehearsalState } from "../store/rehearsal-store.ts";
import { selectActiveWorkflow } from "../store/selectors.ts";
import type {
  ApplicationWorkflow,
  IssuePriority,
  OrbState,
  PresentationBanner,
  ReplicaIssue,
  SurfaceRefreshResult,
  TimelineEntry,
  TimelineKind,
  WorkspaceMailMessage,
  WorkspaceTeamMessage,
} from "../store/types.ts";
import type {
  ApplicationCommandOptions,
  ApplicationCommands,
  ArbitraryMailMessage,
  BeginTraceInput,
  FixtureReportName,
  RehearsalStore,
} from "./types.ts";

const MAX_TIMELINE_ENTRIES = 400;
const MAX_PHASE_HISTORY = 400;
const MAX_COMPLETED_TRACES = 100;
const MAX_WORKFLOWS = 50;
const MAX_RUN_HISTORY = 100;
const MAX_INBOX_MESSAGES = 100;
const MAX_REPLICA_ISSUES = 200;
const MAX_TEAM_MESSAGES = 400;
const MAX_CUSTOMER_REPLIES = 200;
const SUPPORT_TERMS = [
  "support",
  "unable",
  "failed",
  "problem",
  "help",
  "timeout",
  "time out",
  "charge",
  "invoice",
  "password",
  "api",
] as const;

const FIXTURE_REPORTS = {
  login: loginAuthenticationReport,
  api_timeout: apiTimeoutReport,
  billing: duplicateBillingChargeReport,
  ambiguous: ambiguousReviewReport,
} as const satisfies Record<FixtureReportName, MailMessage>;

function sleep(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function labeledBodyValue(body: string, label: string): string | null {
  const prefix = `${label.toLowerCase()}:`;
  const line = body
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.toLowerCase().startsWith(prefix));

  if (line === undefined) {
    return null;
  }

  const value = line.slice(line.indexOf(":") + 1).trim();
  return value.length === 0 ? null : value;
}

function bodyPreview(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.toLowerCase().startsWith("customer:") &&
        !line.toLowerCase().startsWith("email:"),
    )
    .join(" ")
    .slice(0, 140);
}

function looksLikeSupport(message: Pick<MailMessage, "subject" | "body">) {
  const text = `${message.subject}\n${message.body}`.toLowerCase();
  return SUPPORT_TERMS.some((term) => text.includes(term));
}

function toWorkspaceMessage(
  message: MailMessage,
  options: {
    readonly senderName?: string;
    readonly senderAddress?: string;
    readonly isNew?: boolean;
    readonly isRead?: boolean;
    readonly isSupportLike?: boolean;
  } = {},
): WorkspaceMailMessage {
  const extractedName = labeledBodyValue(message.body, "Customer");
  const extractedAddress = labeledBodyValue(message.body, "Email");

  return {
    ...message,
    senderName: options.senderName ?? extractedName ?? "External sender",
    senderAddress:
      options.senderAddress ?? extractedAddress ?? "updates@example.test",
    preview: bodyPreview(message.body),
    isRead: options.isRead ?? false,
    isNew: options.isNew ?? false,
    isSupportLike: options.isSupportLike ?? looksLikeSupport(message),
  };
}

function initialInbox(): readonly WorkspaceMailMessage[] {
  const noiseMessage: MailMessage = {
    id: "message-team-lunch-001",
    receivedAt: "2026-01-05T08:45:00.000Z",
    subject: "Team lunch menu for Friday",
    body: "The Friday lunch menu is ready. Please choose a meal by Thursday.",
  };

  return [
    toWorkspaceMessage(ambiguousReviewReport),
    toWorkspaceMessage(duplicateBillingChargeReport),
    toWorkspaceMessage(apiTimeoutReport),
    toWorkspaceMessage(loginAuthenticationReport),
    toWorkspaceMessage(noiseMessage, {
      senderName: "Workplace updates",
      senderAddress: "updates@example.test",
      isSupportLike: false,
      isRead: true,
    }),
  ];
}

function orbForPhase(phase: ApplicationPhase): OrbState {
  switch (phase) {
    case "observing":
    case "comparing":
      return "learning";
    case "pattern_discovered":
      return "pattern_discovered";
    case "trigger_detected":
    case "planning":
    case "preview_ready":
    case "needs_review":
      return "preview_ready";
    case "executing":
      return "executing";
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "idle":
    case "agent_ready":
    case "cancelled":
      return "idle";
  }
}

function bannerForPhase(phase: ApplicationPhase): PresentationBanner | null {
  switch (phase) {
    case "comparing":
      return {
        tone: "cyan",
        title: "Comparing semantic traces",
        detail: "Looking for repeated intent with generalized values.",
      };
    case "pattern_discovered":
      return {
        tone: "cyan",
        title: "Pattern discovered",
        detail: "Review the compiled workflow before activation.",
      };
    case "trigger_detected":
      return {
        tone: "violet",
        title: "Matching report detected",
        detail: "Preparing a complete Preview Run.",
      };
    case "needs_review":
      return {
        tone: "amber",
        title: "Human review required",
        detail: "Resolve the owner before approval.",
      };
    case "preview_ready":
      return {
        tone: "violet",
        title: "Preview Run ready",
        detail: "No external changes have been made.",
      };
    case "executing":
      return {
        tone: "violet",
        title: "Executing approved actions",
        detail: "Each result appears only after adapter confirmation.",
      };
    case "completed":
      return {
        tone: "teal",
        title: "Run completed and verified",
        detail: "The approved workflow finished successfully.",
      };
    case "failed":
      return {
        tone: "rose",
        title: "Run stopped safely",
        detail: "Completed work is preserved; retry resumes at the failure.",
      };
    case "cancelled":
      return {
        tone: "neutral",
        title: "Run cancelled",
        detail: "No unexecuted actions will run.",
      };
    case "idle":
    case "observing":
    case "agent_ready":
    case "planning":
      return null;
  }
}

function nextIssueNumber(current: string): string {
  const match = /^(.*?)(\d+)$/.exec(current);
  if (match === null) {
    return "SUP-1002";
  }

  const prefix = match[1] ?? "SUP-";
  const numeric = Number(match[2]);
  return `${prefix}${numeric + 1}`;
}

function priorityFromSeverity(severity: string): IssuePriority {
  return severity === "low" || severity === "high" ? severity : "medium";
}

function replaceRun(
  runs: readonly PreviewRun[],
  nextRun: PreviewRun,
): readonly PreviewRun[] {
  return [...runs.filter((run) => run.id !== nextRun.id), nextRun].slice(
    -MAX_RUN_HISTORY,
  );
}

function mergeReplicaIssue(
  issues: readonly ReplicaIssue[],
  nextIssue: ReplicaIssue,
): readonly ReplicaIssue[] {
  return [
    ...issues.filter((issue) => issue.id !== nextIssue.id),
    nextIssue,
  ].slice(-MAX_REPLICA_ISSUES);
}

export function createApplicationCommands(
  store: RehearsalStore,
  options: ApplicationCommandOptions = {},
): ApplicationCommands {
  const timing = options.timing ?? PRESENTATION_TIMING;
  const now = options.now ?? (() => new Date().toISOString());
  const harnessFactory =
    options.createDemoHarness ??
    (() => createDemoAdapterHarness({ durationMs: 0 }));
  let demoHarness = harnessFactory();
  let traceBuilder: SemanticTraceBuilder | null = null;
  let traceSequence = 0;
  let timelineSequence = 0;
  let manualNotificationInFlight = false;

  function timelineEntry(
    kind: TimelineKind,
    summary: string,
    detail: string | null,
    phase: ApplicationPhase,
  ): TimelineEntry {
    timelineSequence += 1;
    return {
      id: `timeline-${String(timelineSequence).padStart(4, "0")}`,
      occurredAt: now(),
      kind,
      summary,
      detail,
      phase,
    };
  }

  function appendTimeline(
    kind: TimelineKind,
    summary: string,
    detail: string | null = null,
  ): void {
    store.setState((state) => {
      const entry = timelineEntry(kind, summary, detail, state.engine.phase);
      return {
        ...state,
        engine: {
          ...state.engine,
          timeline: [...state.engine.timeline, entry].slice(
            -MAX_TIMELINE_ENTRIES,
          ),
        },
      };
    });
  }

  function transitionPhase(
    nextPhase: ApplicationPhase,
    summary = `Entered ${nextPhase.replaceAll("_", " ")} phase.`,
  ): void {
    store.setState((state) => {
      const currentPhase = state.engine.phase;
      if (currentPhase === nextPhase) {
        return state;
      }

      assertPhaseTransition(currentPhase, nextPhase);
      const entry = timelineEntry("phase", summary, null, nextPhase);
      return {
        ...state,
        engine: {
          ...state.engine,
          phase: nextPhase,
          phaseHistory: [...state.engine.phaseHistory, nextPhase].slice(
            -MAX_PHASE_HISTORY,
          ),
          timeline: [...state.engine.timeline, entry].slice(
            -MAX_TIMELINE_ENTRIES,
          ),
        },
        presentation: {
          ...state.presentation,
          orbState: orbForPhase(nextPhase),
          banner: bannerForPhase(nextPhase),
        },
      };
    });
  }

  function selectedMessage(): WorkspaceMailMessage | null {
    const state = store.getState();
    return (
      state.workspace.inboxMessages.find(
        (message) => message.id === state.workspace.selectedMessageId,
      ) ?? null
    );
  }

  function syncDemoWorkspace(run?: PreviewRun): void {
    store.setState((state) => {
      let replicaIssues = state.workspace.replicaIssues;
      for (const issue of demoHarness.state.issues) {
        replicaIssues = mergeReplicaIssue(replicaIssues, {
          id: issue.issue.id,
          key: issue.issue.key,
          number: issue.issue.number,
          url: issue.issue.url,
          title: issue.title,
          description: issue.description,
          labels: [...issue.labels],
          priority: priorityFromSeverity(issue.severity),
          owner: issue.owner,
          state: issue.owner === null ? "open" : "in_progress",
          createdAt: run?.trigger.event.occurredAt ?? now(),
          source: "agent",
        });
      }

      const existingTeamMessages = state.workspace.teamMessages.filter(
        (message) => message.source !== "agent",
      );
      const agentTeamMessages: readonly WorkspaceTeamMessage[] =
        demoHarness.state.teamMessages.map((message) => ({
          ...message,
          author: "Rehearsal",
          source: "agent" as const,
        }));
      const existingReplies = state.workspace.customerReplies.filter(
        (reply) => reply.source !== "agent",
      );
      const agentReplies = demoHarness.state.customerReplies.map((reply) => ({
        ...reply,
        source: "agent" as const,
      }));

      return {
        ...state,
        workspace: {
          ...state.workspace,
          replicaIssues,
          teamMessages: [...existingTeamMessages, ...agentTeamMessages].slice(
            -MAX_TEAM_MESSAGES,
          ),
          customerReplies: [...existingReplies, ...agentReplies].slice(
            -MAX_CUSTOMER_REPLIES,
          ),
        },
      };
    });
  }

  function initializeApplication(): void {
    const state = store.getState();
    if (state.engine.initialized) {
      return;
    }

    store.setState({
      ...state,
      engine: { ...state.engine, initialized: true },
      workspace: {
        ...state.workspace,
        inboxMessages: initialInbox(),
      },
    });
  }

  function resetApplication(): void {
    const previous = store.getState();
    const initial = createInitialRehearsalState(previous.integration.mode);
    traceBuilder = null;
    traceSequence = 0;
    timelineSequence = 0;
    demoHarness = harnessFactory();

    store.setState({
      ...initial,
      engine: { ...initial.engine, initialized: true },
      workspace: { ...initial.workspace, inboxMessages: initialInbox() },
      presentation: {
        ...initial.presentation,
        hydrated: previous.presentation.hydrated,
        soundEnabled: previous.presentation.soundEnabled,
        guideAffordancesEnabled: previous.presentation.guideAffordancesEnabled,
        layout: previous.presentation.layout,
      },
      integration: {
        ...initial.integration,
        mode: previous.integration.mode,
      },
    });
  }

  function normalizePhaseBeforeObservation(): boolean {
    const phase = store.getState().engine.phase;
    if (phase === "pattern_discovered") {
      transitionPhase("idle");
      return true;
    }

    if (phase === "completed" || phase === "failed" || phase === "cancelled") {
      transitionPhase("agent_ready");
      return true;
    }

    return phase === "idle" || phase === "agent_ready";
  }

  function beginTrace(input: BeginTraceInput = {}): WorkflowTrace | null {
    const state = store.getState();
    if (
      state.engine.observationPaused ||
      traceBuilder !== null ||
      !normalizePhaseBeforeObservation()
    ) {
      return state.engine.activeTrace;
    }

    traceSequence += 1;
    const startedAt = input.startedAt ?? now();
    const traceId =
      input.traceId ??
      `trace-${input.messageId ?? "manual"}-${String(traceSequence).padStart(3, "0")}`;
    traceBuilder = new SemanticTraceBuilder({ traceId, startedAt });
    transitionPhase("observing", "Started semantic observation.");
    const trace = traceBuilder.toTrace();
    store.setState((current) => ({
      ...current,
      engine: { ...current.engine, activeTrace: trace, liveConfidence: 0 },
    }));
    return trace;
  }

  function observeSemanticAction(
    input: Parameters<ApplicationCommands["observeSemanticAction"]>[0],
  ): readonly string[] {
    const state = store.getState();
    if (
      traceBuilder === null ||
      state.engine.observationPaused ||
      state.engine.excludedApplications.includes(input.sourceApplication)
    ) {
      return [];
    }

    const appended = traceBuilder.append({
      ...input,
      occurredAt: input.occurredAt ?? now(),
    });
    const trace = traceBuilder.toTrace();
    const liveConfidence = calculateLiveMatchConfidence(
      state.engine.completedTraces,
      trace,
    );
    store.setState((current) => ({
      ...current,
      engine: {
        ...current.engine,
        activeTrace: trace,
        liveConfidence,
        timeline: [
          ...current.engine.timeline,
          ...appended.map((event) =>
            timelineEntry(
              "observation",
              event.intent,
              `${event.sourceApplication}:${event.action}${
                event.origin === "inferred" ? " · inferred" : ""
              }`,
              current.engine.phase,
            ),
          ),
        ].slice(-MAX_TIMELINE_ENTRIES),
      },
    }));
    return appended.map((event) => event.id);
  }

  async function completeTrace(
    completedAt = now(),
  ): Promise<WorkflowTrace | null> {
    if (traceBuilder === null) {
      return null;
    }

    const completedTrace = traceBuilder.complete(completedAt);
    traceBuilder = null;
    const completedTraces = [
      ...store.getState().engine.completedTraces,
      completedTrace,
    ].slice(-MAX_COMPLETED_TRACES);
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        activeTrace: null,
        completedTraces,
        liveConfidence: 0,
      },
    }));

    if (completedTraces.length < 2) {
      transitionPhase("idle", "Stored the first completed observation.");
      return completedTrace;
    }

    transitionPhase("comparing", "Comparing completed semantic traces.");
    await sleep(timing.comparisonDwellMs);
    const pattern = compileLearnedPattern(completedTraces);
    if (pattern === null) {
      transitionPhase("idle", "No repeated workflow met the threshold.");
      return completedTrace;
    }

    const workflow: ApplicationWorkflow = {
      pattern,
      lifecycle: "proposed",
      createdAt: now(),
      successfulRuns: 0,
      actionsSaved: 0,
      secondsSaved: 0,
    };
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        workflows: [
          ...state.engine.workflows.filter(
            (candidate) => candidate.pattern.id !== pattern.id,
          ),
          workflow,
        ].slice(-MAX_WORKFLOWS),
        inspectedPatternId: pattern.id,
      },
      presentation: {
        ...state.presentation,
        patternCollapseActive: true,
      },
    }));
    transitionPhase("pattern_discovered", "Compiled a repeated workflow.");
    appendTimeline(
      "pattern",
      "Compiled support-triage workflow.",
      `${pattern.observationCount} observations · ${Math.round(
        pattern.confidence * 100,
      )}% confidence`,
    );
    return completedTrace;
  }

  function abandonTrace(completedAt = now()): WorkflowTrace | null {
    if (traceBuilder === null) {
      return null;
    }

    const trace = traceBuilder.abandon(completedAt);
    traceBuilder = null;
    store.setState((state) => ({
      ...state,
      engine: { ...state.engine, activeTrace: null, liveConfidence: 0 },
    }));
    transitionPhase("cancelled", "Abandoned the active observation.");
    return trace;
  }

  function readMail(
    messageId: string,
    observedTraceId?: string,
  ): WorkflowTrace | null {
    const message = store
      .getState()
      .workspace.inboxMessages.find((candidate) => candidate.id === messageId);
    if (message === undefined) {
      throw new RangeError(`Unknown inbox message: ${messageId}`);
    }

    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        selectedMessageId: messageId,
        inboxMessages: state.workspace.inboxMessages.map((candidate) =>
          candidate.id === messageId
            ? { ...candidate, isRead: true, isNew: false }
            : candidate,
        ),
      },
    }));

    if (
      !message.isSupportLike ||
      selectActiveWorkflow(store.getState()) !== null ||
      store.getState().engine.observationPaused
    ) {
      return null;
    }

    const trace = beginTrace({
      messageId,
      startedAt: message.receivedAt,
      ...(observedTraceId === undefined ? {} : { traceId: observedTraceId }),
    });
    if (trace !== null) {
      observeSemanticAction({
        occurredAt: message.receivedAt,
        sourceApplication: "mail",
        action: "report_received",
        payload: { reportId: message.id, subject: message.subject },
      });
    }
    return store.getState().engine.activeTrace;
  }

  function copyReportMetadata(messageId?: string): void {
    const message =
      messageId === undefined
        ? selectedMessage()
        : (store
            .getState()
            .workspace.inboxMessages.find(
              (candidate) => candidate.id === messageId,
            ) ?? null);
    if (message === null) {
      return;
    }

    const copiedAt = now();
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        clipboardMetadata: {
          messageId: message.id,
          subject: message.subject,
          copiedFields: ["message_id", "subject", "sender"],
          copiedAt,
        },
      },
    }));
    observeSemanticAction({
      occurredAt: copiedAt,
      sourceApplication: "mail",
      action: "read_report",
      intent: "Inspect support report metadata",
      payload: { reportId: message.id, subject: message.subject },
    });
  }

  function openTrackerComposer(): void {
    const message = selectedMessage();
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        trackerComposer: {
          ...state.workspace.trackerComposer,
          open: true,
          sourceMessageId: message?.id ?? null,
        },
      },
    }));
  }

  function populateIssueFields(): void {
    const message = selectedMessage();
    if (message === null) {
      return;
    }

    const understanding = understandReportDeterministically(message);
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        structuredUnderstanding: understanding,
        trackerComposer: {
          open: true,
          sourceMessageId: message.id,
          title: understanding.issue.title,
          description: understanding.issue.description,
          labels: [...understanding.issue.labels],
          priority: priorityFromSeverity(understanding.issue.severity),
          owner: understanding.owner as TeamOwner | null,
        },
      },
    }));
  }

  function applyLabels(labels?: readonly string[]): void {
    const understanding = store.getState().workspace.structuredUnderstanding;
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        trackerComposer: {
          ...state.workspace.trackerComposer,
          labels: [...(labels ?? understanding?.issue.labels ?? ["support"])],
        },
      },
    }));
  }

  function setPriority(priority: IssuePriority): void {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        trackerComposer: { ...state.workspace.trackerComposer, priority },
      },
    }));
  }

  function assignOwner(owner: TeamOwner): void {
    const before = store.getState();
    const hasCreatedIssue = before.workspace.replicaIssues.some(
      (issue) =>
        issue.source === "manual" &&
        issue.title === before.workspace.trackerComposer.title,
    );
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        trackerComposer: { ...state.workspace.trackerComposer, owner },
        replicaIssues: state.workspace.replicaIssues.map((issue) =>
          issue.source === "manual" &&
          issue.title === state.workspace.trackerComposer.title
            ? { ...issue, owner, state: "in_progress" as const }
            : issue,
        ),
      },
    }));
    if (hasCreatedIssue) {
      const understanding = before.workspace.structuredUnderstanding;
      observeSemanticAction({
        sourceApplication: "issue_tracker",
        action: "assign_owner",
        payload: {
          department: understanding?.issue.department,
          owner,
        },
      });
    }
  }

  function createIssueManually(): void {
    const state = store.getState();
    const message = selectedMessage();
    const understanding = state.workspace.structuredUnderstanding;
    const composer = state.workspace.trackerComposer;
    if (message === null || understanding === null || composer.title === "") {
      return;
    }

    const issueNumber = state.workspace.currentIssueNumber;
    const issue: ReplicaIssue = {
      id: `manual-${issueNumber.toLowerCase()}`,
      key: issueNumber,
      number: issueNumber,
      url: null,
      title: composer.title,
      description: composer.description,
      labels: [...composer.labels],
      priority: composer.priority,
      owner: null,
      state: "open",
      createdAt: now(),
      source: "manual",
    };
    store.setState((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        replicaIssues: [...current.workspace.replicaIssues, issue].slice(
          -MAX_REPLICA_ISSUES,
        ),
        currentIssueNumber: nextIssueNumber(issueNumber),
        trackerComposer: { ...composer, open: false },
      },
    }));
    observeSemanticAction({
      sourceApplication: "issue_tracker",
      action: "create_issue",
      payload: {
        reportId: message.id,
        customerName: understanding.customer.name,
        customerEmail: understanding.customer.email,
        issueTitle: composer.title,
        issueDescription: composer.description,
        category: understanding.issue.category,
        department: understanding.issue.department,
        severity: composer.priority,
        labels: composer.labels,
      },
    });
  }

  function openTeamChannel(channel: string): void {
    store.setState((state) => ({
      ...state,
      workspace: { ...state.workspace, activeChannel: channel },
    }));
  }

  function draftNotification(message?: string): void {
    const state = store.getState();
    const understanding = state.workspace.structuredUnderstanding;
    if (understanding === null) {
      return;
    }

    const issue = [...state.workspace.replicaIssues]
      .reverse()
      .find((candidate) => candidate.source === "manual");
    const owner = state.workspace.trackerComposer.owner;
    const draft =
      message ??
      composeTeamNotification({
        category: understanding.issue.category,
        customerName: understanding.customer.name,
        issueNumber: issue?.number ?? state.workspace.currentIssueNumber,
        owner,
      });
    store.setState((current) => ({
      ...current,
      workspace: { ...current.workspace, teamMessageDraft: draft },
    }));
  }

  async function sendNotificationManually(): Promise<void> {
    const state = store.getState();
    if (
      state.workspace.teamMessageDraft.trim() === "" ||
      manualNotificationInFlight
    ) {
      return;
    }

    const sentAt = now();
    const liveMode = state.integration.mode === "live";
    const message: WorkspaceTeamMessage = {
      id: `${liveMode ? "live" : "manual"}-team-${sentAt}-${String(state.workspace.teamMessages.length + 1).padStart(3, "0")}`,
      channel: state.workspace.activeChannel,
      author: "You",
      message: state.workspace.teamMessageDraft,
      sentAt,
      source: liveMode ? "live" : "manual",
    };
    const understanding = state.workspace.structuredUnderstanding;

    if (liveMode) {
      const sendManualTeamMessage = options.sendManualTeamMessage;
      if (sendManualTeamMessage === undefined) {
        store.setState((current) => ({
          ...current,
          presentation: {
            ...current.presentation,
            banner: {
              tone: "rose",
              title: "Slack message not sent",
              detail: "Live team messaging is not configured.",
            },
          },
        }));
        appendTimeline(
          "integration",
          "Live team message was not sent.",
          "Live team messaging is not configured.",
        );
        return;
      }

      manualNotificationInFlight = true;
      try {
        const result = await sendManualTeamMessage({
          actionId: message.id,
          idempotencyKey: `manual-send:${message.id}`,
          attemptedAt: sentAt,
          channel: message.channel,
          message: message.message,
        });
        if (!result.ok) {
          const detail = result.error?.message ?? result.summary;
          store.setState((current) => ({
            ...current,
            presentation: {
              ...current.presentation,
              banner: {
                tone: "rose",
                title: "Slack message not sent",
                detail,
              },
            },
          }));
          appendTimeline("integration", "Live team message failed.", detail);
          return;
        }

        store.setState((current) => ({
          ...current,
          presentation: {
            ...current.presentation,
            banner: {
              tone: "teal",
              title: "Slack message sent",
              detail: result.summary,
            },
          },
        }));
        appendTimeline(
          "integration",
          "Sent a live team message.",
          result.summary,
        );
      } catch {
        const detail = "The Rehearsal server did not confirm Slack delivery.";
        store.setState((current) => ({
          ...current,
          presentation: {
            ...current.presentation,
            banner: {
              tone: "rose",
              title: "Slack message not sent",
              detail,
            },
          },
        }));
        appendTimeline("integration", "Live team message failed.", detail);
        return;
      } finally {
        manualNotificationInFlight = false;
      }
    }

    store.setState((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        teamMessages: [...current.workspace.teamMessages, message].slice(
          -MAX_TEAM_MESSAGES,
        ),
        teamMessageDraft:
          current.workspace.teamMessageDraft === message.message
            ? ""
            : current.workspace.teamMessageDraft,
      },
    }));
    observeSemanticAction({
      occurredAt: sentAt,
      sourceApplication: "team_chat",
      action: "send_team_notification",
      payload: {
        channel: message.channel,
        department: understanding?.issue.department,
        owner: state.workspace.trackerComposer.owner,
      },
    });
  }

  async function replyToCustomerManually(message?: string): Promise<void> {
    const state = store.getState();
    const selected = selectedMessage();
    const understanding = state.workspace.structuredUnderstanding;
    if (selected === null || understanding === null) {
      return;
    }

    const reply =
      message ??
      composeCustomerReply({
        customerName: understanding.customer.name,
        department: understanding.issue.department,
        owner: state.workspace.trackerComposer.owner,
      });
    const sentAt = now();
    store.setState((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        customerReplyDraft: reply,
        customerReplies: [
          ...current.workspace.customerReplies,
          {
            id: `manual-reply-${String(current.workspace.customerReplies.length + 1).padStart(3, "0")}`,
            originatingMessageId: selected.id,
            recipient: selected.senderAddress,
            message: reply,
            sentAt,
            source: "manual" as const,
          },
        ].slice(-MAX_CUSTOMER_REPLIES),
      },
    }));
    observeSemanticAction({
      occurredAt: sentAt,
      sourceApplication: "mail",
      action: "reply_to_customer",
      payload: {
        reportId: selected.id,
        customerName: understanding.customer.name,
        responseType: "acknowledgement",
      },
    });
    await completeTrace(sentAt);
  }

  function workflowId(patternId?: string): string | null {
    if (patternId !== undefined) {
      return patternId;
    }

    const state = store.getState();
    return (
      state.engine.inspectedPatternId ??
      state.engine.workflows[0]?.pattern.id ??
      null
    );
  }

  function inspectDiscoveredPattern(patternId?: string): void {
    const selectedId = workflowId(patternId);
    if (selectedId === null) {
      return;
    }
    store.setState((state) => ({
      ...state,
      engine: { ...state.engine, inspectedPatternId: selectedId },
    }));
  }

  function activatePattern(patternId?: string): void {
    const selectedId = workflowId(patternId);
    if (selectedId === null) {
      return;
    }
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        inspectedPatternId: selectedId,
        workflows: state.engine.workflows.map((workflow) => ({
          ...workflow,
          lifecycle: workflow.pattern.id === selectedId ? "active" : "paused",
        })),
      },
      presentation: {
        ...state.presentation,
        patternCollapseActive: false,
      },
    }));
    if (store.getState().engine.phase !== "agent_ready") {
      transitionPhase("agent_ready", "Activated the learned workflow.");
    }
    appendTimeline("pattern", "Workflow activated.", selectedId);
  }

  function pausePattern(patternId?: string): void {
    const selectedId = workflowId(patternId);
    if (selectedId === null) {
      return;
    }
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        workflows: state.engine.workflows.map((workflow) =>
          workflow.pattern.id === selectedId
            ? { ...workflow, lifecycle: "paused" as const }
            : workflow,
        ),
      },
    }));
    if (store.getState().engine.phase === "agent_ready") {
      transitionPhase("idle", "Paused the learned workflow.");
    }
  }

  function resumePattern(patternId?: string): void {
    const selectedId = workflowId(patternId);
    if (selectedId === null) {
      return;
    }
    activatePattern(selectedId);
  }

  function forgetPattern(patternId?: string): void {
    const selectedId = workflowId(patternId);
    if (selectedId === null) {
      return;
    }
    const state = store.getState();
    if (state.engine.activeRun !== null) {
      cancelRun();
    }
    store.setState((current) => ({
      ...current,
      engine: {
        ...current.engine,
        workflows: current.engine.workflows.filter(
          (workflow) => workflow.pattern.id !== selectedId,
        ),
        inspectedPatternId: null,
        activeRun: null,
      },
    }));
    const phase = store.getState().engine.phase;
    if (phase === "agent_ready" || phase === "cancelled") {
      transitionPhase("idle", "Forgot the learned workflow.");
    }
  }

  async function deliverArbitraryMessage(
    message: ArbitraryMailMessage,
  ): Promise<WorkspaceMailMessage> {
    await sleep(timing.mailArrivalMs);
    const workspaceMessage = toWorkspaceMessage(message, {
      senderName: message.senderName,
      senderAddress: message.senderAddress,
      isSupportLike: message.isSupportLike,
      isNew: true,
      isRead: false,
    });
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        inboxMessages: [
          workspaceMessage,
          ...state.workspace.inboxMessages.filter(
            (candidate) => candidate.id !== workspaceMessage.id,
          ),
        ].slice(0, MAX_INBOX_MESSAGES),
        selectedMessageId: workspaceMessage.id,
      },
    }));

    const activeWorkflow = selectActiveWorkflow(store.getState());
    const activeRun = store.getState().engine.activeRun;
    const runBlocksTrigger =
      activeRun !== null &&
      activeRun.status !== "completed" &&
      activeRun.status !== "cancelled";
    if (
      activeWorkflow === null ||
      !workspaceMessage.isSupportLike ||
      runBlocksTrigger
    ) {
      return workspaceMessage;
    }

    const phase = store.getState().engine.phase;
    if (phase === "completed" || phase === "cancelled") {
      transitionPhase("agent_ready");
    }
    transitionPhase("trigger_detected", "Detected an active workflow trigger.");
    appendTimeline(
      "trigger",
      `Matched ${workspaceMessage.subject}.`,
      workspaceMessage.id,
    );
    await sleep(timing.triggerToPreviewMs);
    await preparePreviewRun(workspaceMessage.id);
    return workspaceMessage;
  }

  async function deliverFixtureReport(
    fixture: FixtureReportName,
  ): Promise<WorkspaceMailMessage> {
    return deliverArbitraryMessage(FIXTURE_REPORTS[fixture]);
  }

  async function preparePreviewRun(
    messageId?: string,
  ): Promise<PreviewRun | null> {
    const initialState = store.getState();
    const existingRun = initialState.engine.activeRun;
    if (
      existingRun !== null &&
      existingRun.status !== "completed" &&
      existingRun.status !== "cancelled"
    ) {
      return existingRun;
    }

    const workflow = selectActiveWorkflow(initialState);
    const message =
      messageId === undefined
        ? selectedMessage()
        : (initialState.workspace.inboxMessages.find(
            (candidate) => candidate.id === messageId,
          ) ?? null);
    if (workflow === null || message === null || !message.isSupportLike) {
      return null;
    }

    if (store.getState().engine.phase === "agent_ready") {
      transitionPhase("trigger_detected");
    }
    transitionPhase("planning", "Resolving the Preview Run.");
    store.setState((state) => ({
      ...state,
      engine: { ...state.engine, planningActionCount: 0 },
    }));
    let enrichment: Awaited<
      ReturnType<NonNullable<ApplicationCommandOptions["understandReport"]>>
    >;
    try {
      enrichment = options.understandReport
        ? await options.understandReport(message)
        : {
            understanding: understandReportDeterministically(message),
            research: null,
          };
    } catch {
      enrichment = {
        understanding: understandReportDeterministically(message),
        research: null,
      };
    }
    const understanding = enrichment.understanding;
    store.setState((state) => ({
      ...state,
      workspace: { ...state.workspace, structuredUnderstanding: understanding },
    }));
    if (enrichment.research !== null) {
      appendTimeline(
        "planning",
        "Researched sanitized support context.",
        enrichment.research.query,
      );
    }
    const issueNumber = store.getState().workspace.currentIssueNumber;
    const planInput = {
      pattern: workflow.pattern,
      message,
      understanding,
      nextIssueNumber: issueNumber,
      research: enrichment.research,
    };
    let run: PreviewRun;
    if (options.planRun === undefined) {
      run = planPreviewRun(planInput, { previewStatus: "preview_ready" });
      const actionDelay = Math.max(
        0,
        Math.round(
          timing.previewPlanMaterializationMs / run.plannedActions.length,
        ),
      );
      for (let count = 1; count <= run.plannedActions.length; count += 1) {
        await sleep(actionDelay);
        store.setState((state) => ({
          ...state,
          engine: { ...state.engine, planningActionCount: count },
        }));
      }
    } else {
      try {
        run = await options.planRun(planInput, (count) => {
          store.setState((state) => ({
            ...state,
            engine: { ...state.engine, planningActionCount: count },
          }));
        });
      } catch {
        run = planPreviewRun(planInput, { previewStatus: "preview_ready" });
        store.setState((state) => ({
          ...state,
          engine: {
            ...state.engine,
            planningActionCount: run.plannedActions.length,
          },
        }));
      }
    }
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        activeRun: run,
        planningActionCount: run.plannedActions.length,
        runningActionIndex: null,
      },
      workspace: {
        ...state.workspace,
        customerReplyDraft: run.resolvedValues.customerReply,
        teamMessageDraft: run.resolvedValues.teamNotification,
        activeChannel: run.resolvedValues.teamChannel,
      },
    }));
    transitionPhase(
      run.status === "needs_review" ? "needs_review" : "preview_ready",
      run.status === "needs_review"
        ? "Preview Run requires owner review."
        : "Preview Run is ready for approval.",
    );
    appendTimeline(
      "planning",
      `Prepared ${run.plannedActions.length} resolved actions.`,
      run.id,
    );
    return run;
  }

  function openPreviewRun(): PreviewRun | null {
    const run = store.getState().engine.activeRun;
    if (run === null) {
      return null;
    }
    store.setState((state) => ({
      ...state,
      engine: { ...state.engine, inspectedPatternId: run.patternId },
      presentation: { ...state.presentation, demoConsoleOpen: false },
    }));
    return run;
  }

  function resolveOwnerReview(
    owner: TeamOwner,
    selectedBy = "demo-reviewer",
  ): PreviewRun | null {
    const state = store.getState();
    const run = state.engine.activeRun;
    if (run === null || run.status !== "needs_review") {
      return run;
    }
    const resolvedRun = applyOwnerOverride(run, owner, selectedBy);
    store.setState((current) => ({
      ...current,
      engine: { ...current.engine, activeRun: resolvedRun },
      workspace: {
        ...current.workspace,
        structuredUnderstanding: resolvedRun.understanding,
        activeChannel: resolvedRun.resolvedValues.teamChannel,
        teamMessageDraft: resolvedRun.resolvedValues.teamNotification,
        customerReplyDraft: resolvedRun.resolvedValues.customerReply,
      },
    }));
    transitionPhase("preview_ready", `Resolved owner review with ${owner}.`);
    appendTimeline("review", `Selected ${owner} as owner.`, selectedBy);
    return resolvedRun;
  }

  function updateExecutionProgress(run: PreviewRun): void {
    const runningActionIndex = run.plannedActions.findIndex(
      (action) => action.status === "running",
    );
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        activeRun: run,
        runningActionIndex:
          runningActionIndex === -1 ? null : runningActionIndex,
      },
    }));
    if (store.getState().integration.mode === "demo") {
      syncDemoWorkspace(run);
    }
  }

  function finalizeExecution(run: PreviewRun): void {
    const previousRun = store
      .getState()
      .engine.runHistory.find((candidate) => candidate.id === run.id);
    const newlyCompleted =
      run.status === "completed" && previousRun?.status !== "completed";
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        activeRun: run,
        runHistory: replaceRun(state.engine.runHistory, run),
        runningActionIndex: null,
        metrics: {
          actionsSaved:
            state.engine.metrics.actionsSaved +
            (newlyCompleted ? run.metrics.estimatedActionsAvoided : 0),
          secondsSaved:
            state.engine.metrics.secondsSaved +
            (newlyCompleted ? run.metrics.estimatedSecondsSaved : 0),
          completedRuns:
            state.engine.metrics.completedRuns + (newlyCompleted ? 1 : 0),
          failedRuns:
            state.engine.metrics.failedRuns +
            (run.status === "failed" && previousRun?.status !== "failed"
              ? 1
              : 0),
          humanInterventions: Math.max(
            state.engine.metrics.humanInterventions,
            run.metrics.humanInterventions,
          ),
        },
        workflows: state.engine.workflows.map((workflow) =>
          workflow.pattern.id === run.patternId && newlyCompleted
            ? {
                ...workflow,
                successfulRuns: workflow.successfulRuns + 1,
                actionsSaved:
                  workflow.actionsSaved + run.metrics.estimatedActionsAvoided,
                secondsSaved:
                  workflow.secondsSaved + run.metrics.estimatedSecondsSaved,
              }
            : workflow,
        ),
      },
      workspace: {
        ...state.workspace,
        currentIssueNumber:
          run.status === "completed"
            ? nextIssueNumber(state.workspace.currentIssueNumber)
            : state.workspace.currentIssueNumber,
      },
    }));
    if (store.getState().integration.mode === "demo") {
      syncDemoWorkspace(run);
    }
    transitionPhase(
      run.status === "completed" ? "completed" : "failed",
      run.status === "completed"
        ? "Completed and verified the approved run."
        : "Stopped execution at the first failed action.",
    );
  }

  async function executeApprovedRun(run: PreviewRun): Promise<PreviewRun> {
    transitionPhase("executing", "Started approved execution.");
    const adapters =
      options.createExecutionAdapters?.(run) ?? demoHarness.adapters;
    const completedRun = await executeAgentRun(run, adapters, {
      delays: { beforeActionMs: timing.executionStepProgressMs },
      onProgress: ({ stage, run: progressedRun, action, result }) => {
        updateExecutionProgress(progressedRun);
        if (stage !== "action_started" && action !== null) {
          appendTimeline(
            "execution",
            result?.summary ?? action.title,
            `${action.action}:${stage}`,
          );
        }
      },
      onPolicyCheck: (action) => {
        appendTimeline(
          "policy",
          `Policy allowed ${action.title}.`,
          action.permission,
        );
      },
    });
    finalizeExecution(completedRun);
    if (completedRun.status === "completed") {
      if (store.getState().integration.mode === "live") {
        await refreshConnectedSurfaces();
      }
      await sleep(timing.successHoldMs);
    }
    return completedRun;
  }

  async function approveAndExecute(
    approvedBy = "demo-reviewer",
  ): Promise<PreviewRun | null> {
    const state = store.getState();
    const run = state.engine.activeRun;
    if (run === null || run.status === "needs_review") {
      return run;
    }
    if (run.status !== "preview" && run.status !== "preview_ready") {
      return run;
    }

    const approved = approvePreviewRun(run, approvedBy, now());
    const failurePoint = state.integration.selectedFailurePoint;
    if (failurePoint !== null && state.integration.mode === "demo") {
      demoHarness.failures.set(failurePoint);
      store.setState((current) => ({
        ...current,
        integration: { ...current.integration, selectedFailurePoint: null },
      }));
    }
    store.setState((current) => ({
      ...current,
      engine: { ...current.engine, activeRun: approved },
    }));
    appendTimeline("review", `Run approved by ${approvedBy}.`, approved.id);
    return executeApprovedRun(approved);
  }

  function cancelRun(): PreviewRun | null {
    const run = store.getState().engine.activeRun;
    if (
      run === null ||
      run.status === "completed" ||
      run.status === "cancelled"
    ) {
      return run;
    }
    if (run.status === "executing") {
      return run;
    }
    const cancelled: PreviewRun = { ...run, status: "cancelled" };
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        activeRun: cancelled,
        runHistory: replaceRun(state.engine.runHistory, cancelled),
        runningActionIndex: null,
      },
    }));
    transitionPhase("cancelled", "Cancelled the proposed run.");
    return cancelled;
  }

  async function retryFailedRun(): Promise<PreviewRun | null> {
    const run = store.getState().engine.activeRun;
    if (run === null || run.status !== "failed") {
      return run;
    }
    appendTimeline("execution", "Retrying from the failed action.", run.id);
    return executeApprovedRun(run);
  }

  function clearHistory(): void {
    traceBuilder = null;
    const state = store.getState();
    store.setState({
      ...state,
      engine: {
        ...state.engine,
        phase: "idle",
        phaseHistory: [...state.engine.phaseHistory, "idle" as const].slice(
          -MAX_PHASE_HISTORY,
        ),
        activeTrace: null,
        completedTraces: [],
        liveConfidence: 0,
        workflows: [],
        inspectedPatternId: null,
        activeRun: null,
        runHistory: [],
        planningActionCount: 0,
        runningActionIndex: null,
        timeline: [],
        metrics: {
          actionsSaved: 0,
          secondsSaved: 0,
          completedRuns: 0,
          failedRuns: 0,
          humanInterventions: 0,
        },
      },
      presentation: {
        ...state.presentation,
        orbState: "idle",
        banner: null,
        patternCollapseActive: false,
      },
    });
  }

  function pauseObservation(): void {
    traceBuilder?.pause();
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        observationPaused: true,
        activeTrace: traceBuilder?.toTrace() ?? state.engine.activeTrace,
      },
    }));
    appendTimeline("privacy", "Observation paused.");
  }

  function resumeObservation(): void {
    traceBuilder?.resume();
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        observationPaused: false,
        activeTrace: traceBuilder?.toTrace() ?? state.engine.activeTrace,
      },
    }));
    appendTimeline("privacy", "Observation resumed.");
  }

  function excludeApplication(
    application: Parameters<ApplicationCommands["excludeApplication"]>[0],
  ): void {
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        excludedApplications: [
          ...new Set([...state.engine.excludedApplications, application]),
        ],
      },
    }));
    appendTimeline("privacy", `Excluded ${application} from observation.`);
  }

  function includeApplication(
    application: Parameters<ApplicationCommands["includeApplication"]>[0],
  ): void {
    store.setState((state) => ({
      ...state,
      engine: {
        ...state.engine,
        excludedApplications: state.engine.excludedApplications.filter(
          (candidate) => candidate !== application,
        ),
      },
    }));
    appendTimeline("privacy", `Included ${application} in observation.`);
  }

  function defaultSurfaceRefresh(): SurfaceRefreshResult {
    if (store.getState().integration.mode === "demo") {
      return {
        mailSurface: {
          id: "demo-mail",
          provider: "demo",
          label: "Replica Mail",
          status: "connected",
          externalUrl: null,
        },
        trackerSurfaces: [
          {
            id: "demo-tracker",
            provider: "demo",
            label: "Replica Issue Tracker",
            status: "connected",
            externalUrl: null,
          },
        ],
        selectedTrackerSurfaceId: "demo-tracker",
        oauthConnectionUrl: null,
      };
    }

    return {
      mailSurface: null,
      trackerSurfaces: [],
      selectedTrackerSurfaceId: null,
      oauthConnectionUrl: null,
    };
  }

  function extensionPayload(
    event: SemanticEvent,
  ): Readonly<Record<string, unknown>> {
    if (event.action !== "create_issue" && event.action !== "assign_owner") {
      return event.payload;
    }
    const message = selectedMessage();
    if (message === null) {
      return event.payload;
    }
    const understanding = understandReportDeterministically(message);
    const route = routeDepartment(understanding.issue.department);
    store.setState((state) => ({
      ...state,
      workspace: { ...state.workspace, structuredUnderstanding: understanding },
    }));
    return {
      ...event.payload,
      reportId: message.id,
      ...(understanding.customer.name === null
        ? {}
        : { customerName: understanding.customer.name }),
      ...(understanding.customer.email === null
        ? {}
        : { customerEmail: understanding.customer.email }),
      issueTitle: understanding.issue.title,
      issueDescription: understanding.issue.description,
      category: understanding.issue.category,
      department: understanding.issue.department,
      severity: understanding.issue.severity,
      labels: understanding.issue.labels,
      ...(route.owner === null ? {} : { owner: route.owner }),
    };
  }

  async function applyExtensionFeed(
    result: SurfaceRefreshResult,
  ): Promise<void> {
    const feed = [
      ...(result.extensionObservations ?? []).map((record) => ({
        kind: "event" as const,
        sequence: record.sequence,
        record,
      })),
      ...(result.extensionCompletions ?? []).map((record) => ({
        kind: "completion" as const,
        sequence: record.sequence,
        record,
      })),
    ].sort((left, right) => left.sequence - right.sequence);

    for (const item of feed) {
      if (item.kind === "completion") {
        if (store.getState().engine.activeTrace?.id === item.record.traceId) {
          await completeTrace(item.record.receivedAt);
        }
        continue;
      }

      const event = item.record.event;
      if (store.getState().engine.activeTrace === null) {
        const reportIdentifier =
          typeof event.payload.messageId === "string"
            ? event.payload.messageId
            : typeof event.payload.reportId === "string"
              ? event.payload.reportId
              : null;
        const message =
          reportIdentifier === null
            ? null
            : (store
                .getState()
                .workspace.inboxMessages.find(
                  (candidate) => candidate.id === reportIdentifier,
                ) ?? null);
        if (
          event.action === "read_report" &&
          event.sourceApplication === "mail" &&
          message !== null
        ) {
          readMail(message.id, event.traceId);
        } else {
          beginTrace({
            traceId: event.traceId,
            startedAt: event.occurredAt,
          });
        }
      }

      const activeTrace = store.getState().engine.activeTrace;
      if (
        activeTrace?.id !== event.traceId ||
        activeTrace.events.some((candidate) => candidate.id === event.id)
      ) {
        continue;
      }
      observeSemanticAction({
        occurredAt: event.occurredAt,
        sourceApplication: event.sourceApplication,
        action: event.action,
        intent: event.intent,
        payload: extensionPayload(event),
        confidence: event.confidence,
        origin: event.origin,
        estimatedEffortSeconds: event.estimatedEffortSeconds,
      });
    }
  }

  async function refreshConnectedSurfaces(): Promise<void> {
    const previousMessageIds = new Set(
      store.getState().workspace.inboxMessages.map((message) => message.id),
    );
    store.setState((state) => ({
      ...state,
      integration: { ...state.integration, extensionFeedStatus: "polling" },
    }));
    try {
      const result = options.refreshSurfaces
        ? await options.refreshSurfaces()
        : defaultSurfaceRefresh();
      store.setState((state) => ({
        ...state,
        workspace: {
          ...state.workspace,
          inboxMessages: (
            result.mailMessages ?? state.workspace.inboxMessages
          ).slice(0, MAX_INBOX_MESSAGES),
          replicaIssues: (
            result.trackerIssues ?? state.workspace.replicaIssues
          ).slice(-MAX_REPLICA_ISSUES),
        },
        integration: {
          ...state.integration,
          mailSurface: result.mailSurface,
          trackerSurfaces: result.trackerSurfaces,
          selectedTrackerSurfaceId: result.selectedTrackerSurfaceId,
          oauthConnectionUrl: result.oauthConnectionUrl,
          trackerTarget:
            result.trackerTarget ?? state.integration.trackerTarget,
          messagingTarget:
            result.messagingTarget ?? state.integration.messagingTarget,
          mailTarget: result.mailTarget ?? state.integration.mailTarget,
          extensionFeedStatus: "connected",
        },
      }));
      await applyExtensionFeed(result);
      if (result.extensionFeedCursor !== undefined) {
        store.setState((state) => ({
          ...state,
          integration: {
            ...state.integration,
            extensionFeedCursor:
              result.extensionFeedCursor ??
              state.integration.extensionFeedCursor,
          },
        }));
      }
      appendTimeline("integration", "Refreshed connected surfaces.");

      const incomingTrigger = result.mailMessages?.find(
        (message) =>
          !previousMessageIds.has(message.id) &&
          !message.isRead &&
          message.isSupportLike,
      );
      const current = store.getState();
      const activeRun = current.engine.activeRun;
      const runBlocksTrigger =
        activeRun !== null &&
        activeRun.status !== "completed" &&
        activeRun.status !== "cancelled";
      if (
        incomingTrigger !== undefined &&
        selectActiveWorkflow(current) !== null &&
        !runBlocksTrigger
      ) {
        if (
          current.engine.phase === "completed" ||
          current.engine.phase === "cancelled"
        ) {
          transitionPhase("agent_ready");
        }
        transitionPhase(
          "trigger_detected",
          "Detected a connected-mail workflow trigger.",
        );
        appendTimeline(
          "trigger",
          `Matched ${incomingTrigger.subject}.`,
          incomingTrigger.id,
        );
        await sleep(timing.triggerToPreviewMs);
        await preparePreviewRun(incomingTrigger.id);
      }
    } catch (error) {
      store.setState((state) => ({
        ...state,
        integration: { ...state.integration, extensionFeedStatus: "error" },
      }));
      appendTimeline(
        "integration",
        "Connected surfaces could not be refreshed.",
        error instanceof Error ? error.message : "Unknown refresh error",
      );
    }
  }

  function selectFailurePoint(
    point: Parameters<ApplicationCommands["selectFailurePoint"]>[0],
  ): void {
    store.setState((state) => ({
      ...state,
      integration: { ...state.integration, selectedFailurePoint: point },
    }));
  }

  function setHydrated(hydrated = true): void {
    store.setState((state) => ({
      ...state,
      presentation: { ...state.presentation, hydrated },
    }));
  }

  function setCommandPaletteOpen(open: boolean): void {
    store.setState((state) => ({
      ...state,
      presentation: { ...state.presentation, commandPaletteOpen: open },
    }));
  }

  function setDemoConsoleOpen(open: boolean): void {
    store.setState((state) => ({
      ...state,
      presentation: { ...state.presentation, demoConsoleOpen: open },
    }));
  }

  function toggleSound(): void {
    store.setState((state) => ({
      ...state,
      presentation: {
        ...state.presentation,
        soundEnabled: !state.presentation.soundEnabled,
      },
    }));
  }

  function toggleGuideAffordances(): void {
    store.setState((state) => ({
      ...state,
      presentation: {
        ...state.presentation,
        guideAffordancesEnabled: !state.presentation.guideAffordancesEnabled,
      },
    }));
  }

  function setReplicaRowHeight(height: number): void {
    store.setState((state) => ({
      ...state,
      presentation: {
        ...state.presentation,
        layout: {
          ...state.presentation.layout,
          replicaRowHeight: Math.min(440, Math.max(150, Math.round(height))),
        },
      },
    }));
  }

  function setInspectionRowHeight(height: number): void {
    store.setState((state) => ({
      ...state,
      presentation: {
        ...state.presentation,
        layout: {
          ...state.presentation.layout,
          inspectionRowHeight: Math.min(340, Math.max(160, Math.round(height))),
        },
      },
    }));
  }

  function requestResetConfirmation(): void {
    store.setState((state) => ({
      ...state,
      presentation: { ...state.presentation, resetConfirmationPending: true },
    }));
  }

  function clearResetConfirmation(): void {
    store.setState((state) => ({
      ...state,
      presentation: {
        ...state.presentation,
        resetConfirmationPending: false,
      },
    }));
  }

  function selectTrackerSurface(surfaceId: string): void {
    const state = store.getState();
    const surface = state.integration.trackerSurfaces.find(
      (candidate) => candidate.id === surfaceId,
    );
    if (
      surface === undefined ||
      surface.status === "unavailable" ||
      surface.status === "error"
    ) {
      return;
    }
    store.setState((current) => ({
      ...current,
      integration: {
        ...current.integration,
        selectedTrackerSurfaceId: surfaceId,
      },
    }));
    if (state.integration.mode === "live") {
      void refreshConnectedSurfaces();
    }
  }

  initializeApplication();

  return {
    initializeApplication,
    resetApplication,
    beginTrace,
    observeSemanticAction,
    completeTrace,
    abandonTrace,
    readMail,
    copyReportMetadata,
    openTrackerComposer,
    populateIssueFields,
    applyLabels,
    setPriority,
    assignOwner,
    createIssueManually,
    openTeamChannel,
    draftNotification,
    sendNotificationManually,
    replyToCustomerManually,
    inspectDiscoveredPattern,
    activatePattern,
    pausePattern,
    resumePattern,
    forgetPattern,
    deliverFixtureReport,
    deliverArbitraryMessage,
    preparePreviewRun,
    openPreviewRun,
    resolveOwnerReview,
    approveAndExecute,
    cancelRun,
    retryFailedRun,
    clearHistory,
    pauseObservation,
    resumeObservation,
    excludeApplication,
    includeApplication,
    refreshConnectedSurfaces,
    selectFailurePoint,
    setHydrated,
    setCommandPaletteOpen,
    setDemoConsoleOpen,
    toggleSound,
    toggleGuideAffordances,
    setReplicaRowHeight,
    setInspectionRowHeight,
    requestResetConfirmation,
    clearResetConfirmation,
    selectTrackerSurface,
    getDemoHarness: () => demoHarness,
  };
}
