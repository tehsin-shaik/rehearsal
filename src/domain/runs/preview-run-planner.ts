import { normalizeSemanticEvent } from "../events/event-normalizer.ts";
import type { SourceApplication } from "../events/taxonomy.ts";
import type {
  CompiledLearnedPattern,
  PatternField,
  WorkflowStageName,
} from "../patterns/compilation-types.ts";
import { deterministicIdentifier } from "../patterns/deterministic-serialization.ts";
import { assessActionRisk, assessRunRisk } from "../policy/risk-assessment.ts";
import {
  createPolicyDecision,
  getPermissionMetadata,
  permissionForAction,
} from "../policy/permission-policy.ts";
import type { IssueUnderstanding } from "../understanding/issue-understanding.ts";
import type { MailMessage } from "../understanding/mail-message.ts";
import { TEAM_OWNERS } from "../understanding/team-routing.ts";
import { detectRunAdaptations } from "./adaptation-detection.ts";
import type {
  PreviewPlannedAction,
  PreviewRun,
  HumanReviewRequest,
  ResolvedRunValues,
  RunAdaptation,
  VariableResolutionError,
} from "./preview-run-types.ts";
import type { PlannedSemanticAction } from "./planned-action.ts";
import { resolvePatternVariables } from "./variable-resolution.ts";

export interface PlanPreviewRunInput {
  readonly pattern: CompiledLearnedPattern;
  readonly message: MailMessage;
  readonly understanding: IssueUnderstanding;
  readonly nextIssueNumber: string;
  readonly issueUrl?: string | null;
  readonly research?: {
    readonly query: string;
    readonly references: readonly {
      readonly title: string;
      readonly url: string;
      readonly source: string;
      readonly highlight: string;
    }[];
  } | null;
}

export interface PreviewRunPlannerOptions {
  readonly previewStatus?: "preview" | "preview_ready";
}

interface ActionDefinition {
  readonly action: PlannedSemanticAction;
  readonly stage: WorkflowStageName;
  readonly application: SourceApplication;
  readonly title: string;
  readonly detail: (values: ResolvedRunValues) => string;
  readonly destination: (values: ResolvedRunValues) => string;
  readonly requiredFields: readonly PatternField[];
  readonly resolvedInput: (
    values: ResolvedRunValues,
  ) => Readonly<Record<string, unknown>>;
  readonly adaptationField?: RunAdaptation["field"];
  readonly carriesOwnerReview?: boolean;
}

const ACTION_DEFINITIONS: readonly ActionDefinition[] = [
  {
    action: "read_email",
    stage: "Email",
    application: "mail",
    title: "Read email",
    detail: (values) => `Read support report ${values.messageId}.`,
    destination: (values) => `mail:${values.messageId}`,
    requiredFields: ["report.id"],
    resolvedInput: (values) => ({ messageId: values.messageId }),
  },
  {
    action: "extract_issue_details",
    stage: "Understand issue",
    application: "system",
    title: "Extract issue details",
    detail: (values) =>
      `Extract customer and issue details for ${values.issueTitle}.`,
    destination: () => "local:understanding",
    requiredFields: [
      "report.id",
      "customer.name",
      "customer.email",
      "issue.title",
      "issue.description",
    ],
    resolvedInput: (values) => ({
      messageId: values.messageId,
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      issueTitle: values.issueTitle,
      issueDescription: values.issueDescription,
    }),
  },
  {
    action: "classify_issue",
    stage: "Understand issue",
    application: "system",
    title: "Classify issue",
    detail: (values) =>
      `Classify the report as ${values.category} for ${values.department}.`,
    destination: () => "local:understanding",
    requiredFields: ["category", "department", "severity", "labels"],
    resolvedInput: (values) => ({
      category: values.category,
      department: values.department,
      severity: values.severity,
      labels: values.labels,
    }),
    adaptationField: "department",
  },
  {
    action: "draft_ticket",
    stage: "Create ticket",
    application: "issue_tracker",
    title: "Draft ticket",
    detail: (values) => `Draft proposed issue ${values.issueNumber}.`,
    destination: () => "issue_tracker:draft",
    requiredFields: [
      "issue.title",
      "issue.description",
      "category",
      "department",
      "severity",
      "labels",
      "issue.number",
    ],
    resolvedInput: (values) => ({
      issueNumber: values.issueNumber,
      title: values.issueTitle,
      description: values.issueDescription,
      category: values.category,
      department: values.department,
      severity: values.severity,
      labels: values.labels,
      ...(values.researchReferences.length === 0
        ? {}
        : { researchReferences: values.researchReferences }),
    }),
  },
  {
    action: "apply_labels",
    stage: "Create ticket",
    application: "issue_tracker",
    title: "Apply labels",
    detail: (values) =>
      `Prepare ${values.labels.length} labels for ${values.issueNumber}.`,
    destination: () => "issue_tracker:draft",
    requiredFields: ["labels", "issue.number"],
    resolvedInput: (values) => ({
      issueNumber: values.issueNumber,
      labels: values.labels,
    }),
  },
  {
    action: "create_issue",
    stage: "Create ticket",
    application: "issue_tracker",
    title: "Create issue",
    detail: (values) => `Create proposed issue ${values.issueNumber}.`,
    destination: (values) => `issue_tracker:${values.issueNumber}`,
    requiredFields: [
      "customer.name",
      "customer.email",
      "issue.title",
      "issue.description",
      "category",
      "department",
      "severity",
      "labels",
      "issue.number",
    ],
    resolvedInput: (values) => ({
      issueNumber: values.issueNumber,
      title: values.issueTitle,
      description: values.issueDescription,
      category: values.category,
      department: values.department,
      severity: values.severity,
      labels: values.labels,
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      ...(values.researchReferences.length === 0
        ? {}
        : { researchReferences: values.researchReferences }),
    }),
  },
  {
    action: "assign_owner",
    stage: "Assign owner",
    application: "issue_tracker",
    title: "Assign owner",
    detail: (values) =>
      values.owner === null
        ? `Select an owner for ${values.issueNumber}.`
        : `Assign ${values.issueNumber} to ${values.owner}.`,
    destination: (values) => `issue_tracker:${values.issueNumber}`,
    requiredFields: ["issue.number", "department", "owner"],
    resolvedInput: (values) => ({
      issueNumber: values.issueNumber,
      department: values.department,
      owner: values.owner,
    }),
    adaptationField: "owner",
    carriesOwnerReview: true,
  },
  {
    action: "prepare_team_notification",
    stage: "Notify team",
    application: "team_chat",
    title: "Prepare team notification",
    detail: (values) => `Prepare a notification for ${values.teamChannel}.`,
    destination: (values) => `team_chat:${values.teamChannel}`,
    requiredFields: [
      "customer.name",
      "category",
      "owner",
      "issue.number",
      "channel",
      "team.message",
    ],
    resolvedInput: (values) => ({
      issueNumber: values.issueNumber,
      category: values.category,
      customerName: values.customerName,
      owner: values.owner,
      channel: values.teamChannel,
      message: values.teamNotification,
      ...(values.issueUrl === null ? {} : { issueUrl: values.issueUrl }),
    }),
  },
  {
    action: "send_team_notification",
    stage: "Notify team",
    application: "team_chat",
    title: "Send team notification",
    detail: (values) =>
      `Send the proposed notification to ${values.teamChannel}.`,
    destination: (values) => `team_chat:${values.teamChannel}`,
    requiredFields: ["owner", "channel", "team.message"],
    resolvedInput: (values) => ({
      channel: values.teamChannel,
      message: values.teamNotification,
    }),
  },
  {
    action: "reply_to_customer",
    stage: "Email",
    application: "mail",
    title: "Reply to customer",
    detail: (values) =>
      values.customerEmail === null
        ? "Prepare a reply after the customer email is reviewed."
        : `Send the proposed acknowledgement to ${values.customerEmail}.`,
    destination: (values) => `mail:${values.customerEmail ?? "needs-review"}`,
    requiredFields: [
      "customer.name",
      "customer.email",
      "department",
      "owner",
      "customer.reply",
    ],
    resolvedInput: (values) => ({
      customerEmail: values.customerEmail,
      message: values.customerReply,
    }),
  },
];

function workflowStepId(
  pattern: CompiledLearnedPattern,
  stageName: WorkflowStageName,
): string {
  const stage = pattern.stages.find(
    (candidate) => candidate.name === stageName,
  );
  if (stage === undefined) {
    throw new RangeError(`Compiled pattern is missing the ${stageName} stage.`);
  }

  return stage.id;
}

export type WorkflowStepIdentifiers = Readonly<
  Record<WorkflowStageName, string>
>;

export function getWorkflowStepIdentifiers(
  pattern: CompiledLearnedPattern,
): WorkflowStepIdentifiers {
  return {
    Email: workflowStepId(pattern, "Email"),
    "Understand issue": workflowStepId(pattern, "Understand issue"),
    "Create ticket": workflowStepId(pattern, "Create ticket"),
    "Assign owner": workflowStepId(pattern, "Assign owner"),
    "Notify team": workflowStepId(pattern, "Notify team"),
  };
}

const REPRESENTATIVE_STAGE_ACTIONS = {
  Email: "read_email",
  "Understand issue": "extract_issue_details",
  "Create ticket": "draft_ticket",
  "Assign owner": "assign_owner",
  "Notify team": "prepare_team_notification",
} as const satisfies Readonly<Record<WorkflowStageName, PlannedSemanticAction>>;

export function preserveWorkflowStepIdentifiers(
  actions: readonly PreviewPlannedAction[],
): WorkflowStepIdentifiers {
  const findIdentifier = (stage: WorkflowStageName): string => {
    const representativeAction = actions.find(
      (action) => action.action === REPRESENTATIVE_STAGE_ACTIONS[stage],
    );
    if (representativeAction === undefined) {
      throw new RangeError(
        `The existing Preview Run is missing its ${stage} workflow step.`,
      );
    }

    return representativeAction.sourceWorkflowStepId;
  };

  return {
    Email: findIdentifier("Email"),
    "Understand issue": findIdentifier("Understand issue"),
    "Create ticket": findIdentifier("Create ticket"),
    "Assign owner": findIdentifier("Assign owner"),
    "Notify team": findIdentifier("Notify team"),
  };
}

function fieldsWithErrors(
  errors: readonly VariableResolutionError[],
): ReadonlySet<string> {
  return new Set(errors.map((error) => error.field));
}

function actionNeedsReview(
  definition: ActionDefinition,
  errorFields: ReadonlySet<string>,
): boolean {
  return definition.requiredFields.some((field) => errorFields.has(field));
}

function roundConfidence(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export interface BuildPreviewActionsInput {
  readonly workflowStepIds: WorkflowStepIdentifiers;
  readonly runId: string;
  readonly values: ResolvedRunValues;
  readonly adaptations: readonly RunAdaptation[];
  readonly resolutionErrors: readonly VariableResolutionError[];
  readonly reviewRequest?: HumanReviewRequest;
}

export function buildPreviewPlannedActions(
  input: BuildPreviewActionsInput,
): readonly PreviewPlannedAction[] {
  const errorFields = fieldsWithErrors(input.resolutionErrors);

  return ACTION_DEFINITIONS.map((definition, index) => {
    const sequence = index + 1;
    const permission = permissionForAction(definition.action);
    const permissionMetadata = getPermissionMetadata(permission);
    const needsReview = actionNeedsReview(definition, errorFields);
    const adaptation =
      definition.adaptationField === undefined
        ? undefined
        : input.adaptations.find(
            (candidate) => candidate.field === definition.adaptationField,
          );
    const review = definition.carriesOwnerReview
      ? input.reviewRequest
      : undefined;
    const id = deterministicIdentifier("action", {
      runId: input.runId,
      sequence,
      action: definition.action,
    });

    return {
      id,
      sequence,
      sourceWorkflowStepId: input.workflowStepIds[definition.stage],
      action: definition.action,
      application: definition.application,
      title: definition.title,
      detail: definition.detail(input.values),
      permission,
      destination: definition.destination(input.values),
      resolvedInput: definition.resolvedInput(input.values),
      risk: assessActionRisk(permission, needsReview),
      requiresApproval: permissionMetadata.approvalRequired,
      status: !permissionMetadata.allowed
        ? "blocked"
        : needsReview
          ? "needs_review"
          : "planned",
      idempotencyKey: deterministicIdentifier("idempotency", {
        runId: input.runId,
        action: definition.action,
      }),
      ...(adaptation === undefined ? {} : { adaptation }),
      ...(review === undefined ? {} : { review }),
    } satisfies PreviewPlannedAction;
  });
}

function createOwnerReviewRequest(runId: string): HumanReviewRequest {
  return {
    id: deterministicIdentifier("review", { runId, field: "owner" }),
    field: "owner",
    reason:
      "The report did not resolve to one department, so an owner must be selected by a person.",
    options: [...TEAM_OWNERS],
    status: "pending",
    selectedValue: null,
    selectedBy: null,
  };
}

export function planPreviewRun(
  input: PlanPreviewRunInput,
  options: PreviewRunPlannerOptions = {},
): PreviewRun {
  const previewStatus = options.previewStatus ?? "preview";
  const runId = deterministicIdentifier("run", {
    patternId: input.pattern.id,
    message: input.message,
    understanding: input.understanding,
    nextIssueNumber: input.nextIssueNumber,
    issueUrl: input.issueUrl ?? null,
    research: input.research ?? null,
  });
  const resolution = resolvePatternVariables(input);
  const adaptations = detectRunAdaptations(input.pattern, resolution.values);
  const ownerReviewRequired = resolution.errors.some(
    (error) => error.field === "owner" || error.field === "department",
  );
  const reviewRequest = ownerReviewRequired
    ? createOwnerReviewRequest(runId)
    : undefined;
  const plannedActions = buildPreviewPlannedActions({
    workflowStepIds: getWorkflowStepIdentifiers(input.pattern),
    runId,
    values: resolution.values,
    adaptations,
    resolutionErrors: resolution.errors,
    ...(reviewRequest === undefined ? {} : { reviewRequest }),
  });
  const triggerEvent = normalizeSemanticEvent({
    traceId: runId,
    occurredAt: input.message.receivedAt,
    sourceApplication: "mail",
    action: "report_received",
    intent: input.pattern.trigger.intent,
    payload: {
      reportId: input.message.id,
      subject: input.message.subject,
    },
  });

  if (triggerEvent === null) {
    throw new TypeError(
      "The Preview Run trigger event was unexpectedly excluded.",
    );
  }

  const policyDecisions = plannedActions.map((action) =>
    createPolicyDecision({
      actionId: action.id,
      permission: action.permission,
      approved: false,
      evaluatedAt: triggerEvent.occurredAt,
    }),
  );
  const pendingReview = resolution.errors.length > 0;
  const overallConfidence = roundConfidence(
    (input.pattern.confidence + input.understanding.confidence.overall) / 2,
  );

  return {
    id: runId,
    patternId: input.pattern.id,
    triggerReportId: input.message.id,
    status: pendingReview ? "needs_review" : previewStatus,
    phase: "preview",
    previewStatus,
    approved: false,
    trigger: {
      message: { ...input.message },
      event: triggerEvent,
      summary: `Support report received: ${input.message.subject.trim()}`,
    },
    summary: `Proposed ${plannedActions.length}-action support triage for ${input.message.subject.trim()}.`,
    understanding: input.understanding,
    plannedActions,
    policyDecisions,
    approval: {
      status: "pending",
      approvedBy: null,
      approvedAt: null,
    },
    adaptations,
    confidence: {
      pattern: input.pattern.confidence,
      understanding: input.understanding.confidence.overall,
      overall: overallConfidence,
    },
    risk: assessRunRisk({
      permissions: plannedActions.map((action) => action.permission),
      understandingConfidence: input.understanding.confidence.overall,
      pendingReview,
    }),
    reviewRequests: reviewRequest === undefined ? [] : [reviewRequest],
    resolutionErrors: resolution.errors,
    resolvedValues: resolution.values,
    issueReference: {
      predictedIssueNumber: resolution.values.issueNumber,
      actualIssueId: null,
      actualIssueKey: null,
      actualIssueNumber: null,
      actualIssueUrl: null,
      rewrittenAt: null,
    },
    humanSelections: [],
    research: {
      query: input.research?.query ?? null,
      references: input.research?.references ?? [],
    },
    results: [],
    metrics: {
      estimatedActionsAvoided: input.pattern.observedManualActionCount,
      estimatedSecondsSaved: input.pattern.estimatedDurationSeconds,
      humanInterventions: 0,
    },
  };
}
