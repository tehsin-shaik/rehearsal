import { z } from "zod";

import type { SurfaceRefreshResult } from "../../application/store/types.ts";
import {
  SEMANTIC_ACTION_TAXONOMY,
  SOURCE_APPLICATIONS,
} from "../../domain/events/taxonomy.ts";
import type { IssueUnderstanding } from "../../domain/understanding/issue-understanding.ts";
import type { MailMessage } from "../../domain/understanding/mail-message.ts";
import type { RunResearchReference } from "../../domain/runs/preview-run-types.ts";
import {
  isTeamOwner,
  TEAM_OWNERS,
} from "../../domain/understanding/team-routing.ts";
import { fetchJsonWithTimeout } from "../http/fetch-with-timeout.ts";

const connectedSurfaceSchema = z.object({
  id: z.string(),
  provider: z.string(),
  label: z.string(),
  status: z.enum(["connected", "available", "unavailable", "error"]),
  externalUrl: z.string().url().nullable(),
});

const mailResponseSchema = z.object({
  surface: connectedSurfaceSchema.nullable(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        receivedAt: z.string(),
        subject: z.string(),
        body: z.string(),
        senderName: z.string(),
        senderAddress: z.string(),
        isRead: z.boolean(),
      }),
    )
    .max(50),
  fallbackToReplica: z.boolean(),
  oauthConnectionUrl: z.string().nullable(),
});

const trackerResponseSchema = z.object({
  selectedTracker: z.string().nullable(),
  trackerTarget: z.string().optional(),
  trackers: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        configured: z.boolean(),
        selected: z.boolean(),
      }),
    )
    .max(10),
  issues: z
    .array(
      z.object({
        issue: z.object({
          id: z.string(),
          key: z.string(),
          number: z.string(),
          url: z.string().url().nullable(),
        }),
        title: z.string(),
        owner: z.string().nullable(),
        labels: z.array(z.string()).max(20),
      }),
    )
    .max(100),
  fallbackToReplica: z.boolean(),
});

const executionTargetsSchema = z.object({
  trackerTarget: z.string(),
  messagingTarget: z.string(),
  mailTarget: z.string(),
});

const observationResponseSchema = z.object({
  events: z
    .array(
      z.object({
        sequence: z.number().int().nonnegative(),
        receivedAt: z.string(),
        event: z.object({
          id: z.string(),
          traceId: z.string(),
          occurredAt: z.string(),
          sourceApplication: z.enum(SOURCE_APPLICATIONS),
          action: z.enum(
            Object.keys(SEMANTIC_ACTION_TAXONOMY) as [
              keyof typeof SEMANTIC_ACTION_TAXONOMY,
              ...(keyof typeof SEMANTIC_ACTION_TAXONOMY)[],
            ],
          ),
          intent: z.string(),
          payload: z.record(z.string(), z.unknown()),
          confidence: z.number().min(0).max(1),
          origin: z.enum(["observed", "inferred", "executed"]),
          estimatedEffortSeconds: z.number().nonnegative(),
        }),
      }),
    )
    .max(500),
  completions: z
    .array(
      z.object({
        sequence: z.number().int().nonnegative(),
        receivedAt: z.string(),
        traceId: z.string(),
      }),
    )
    .max(500),
  lastSequence: z.number().int().nonnegative(),
});

const understandingSchema = z
  .object({
    reportId: z.string(),
    customer: z.object({
      name: z.string().nullable(),
      email: z.string().nullable(),
    }),
    issue: z.object({
      title: z.string(),
      description: z.string(),
      category: z.enum([
        "authentication",
        "performance",
        "data",
        "api_timeout",
        "billing",
        "unresolved",
      ]),
      department: z.enum([
        "billing",
        "technical_support",
        "sales",
        "logistics",
        "product_development_and_engineering",
        "legal_privacy_and_compliance",
        "unresolved",
      ]),
      severity: z.enum(["low", "medium", "high", "unresolved"]),
      labels: z.array(z.string()),
    }),
    owner: z.enum(TEAM_OWNERS).nullable(),
    evidence: z.array(z.object({ field: z.string(), excerpt: z.string() })),
    confidence: z.object({
      overall: z.number().min(0).max(1),
      byField: z.record(z.string(), z.number().min(0).max(1)),
    }),
    reviewRequired: z.boolean(),
  })
  .passthrough();

const understandResponseSchema = z.object({
  understanding: understandingSchema,
  research: z.object({
    query: z.string(),
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        source: z.string(),
        highlight: z.string(),
      }),
    ),
    status: z.string(),
  }),
});

const SUPPORT_TERMS = [
  "support",
  "unable",
  "failed",
  "problem",
  "timeout",
  "charge",
  "invoice",
  "password",
  "api",
];

function supportLike(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`.toLowerCase();
  return SUPPORT_TERMS.some((term) => text.includes(term));
}

function preview(body: string): string {
  return body.trim().replace(/\s+/g, " ").slice(0, 140);
}

export async function loadLiveSurfaces(
  selectedTracker: string | null,
  extensionCursor = 0,
): Promise<SurfaceRefreshResult> {
  const trackerQuery =
    selectedTracker === null
      ? ""
      : `?provider=${encodeURIComponent(selectedTracker)}`;
  const [mailValue, trackerValue, targetValue, observationValue] =
    await Promise.all([
      fetchJsonWithTimeout("/api/surfaces/mail", { timeoutMs: 12_000 }),
      fetchJsonWithTimeout(`/api/surfaces/tracker${trackerQuery}`, {
        timeoutMs: 12_000,
      }),
      fetchJsonWithTimeout("/api/execute", { timeoutMs: 8_000 }),
      fetchJsonWithTimeout(
        `/api/observe?after=${encodeURIComponent(String(extensionCursor))}`,
        { timeoutMs: 8_000 },
      ).catch(() => ({
        events: [],
        completions: [],
        lastSequence: extensionCursor,
      })),
    ]);
  const mail = mailResponseSchema.parse(mailValue);
  const tracker = trackerResponseSchema.parse(trackerValue);
  const targets = executionTargetsSchema.parse(targetValue);
  const observations = observationResponseSchema.parse(observationValue);
  const trackerSurfaces = tracker.trackers.map((candidate) => ({
    id: candidate.id,
    provider: candidate.id,
    label: candidate.label,
    status: candidate.configured
      ? candidate.selected
        ? ("connected" as const)
        : ("available" as const)
      : ("unavailable" as const),
    externalUrl: null,
  }));

  return {
    mailSurface: mail.surface,
    trackerSurfaces,
    selectedTrackerSurfaceId: tracker.selectedTracker,
    oauthConnectionUrl: mail.oauthConnectionUrl,
    trackerTarget: tracker.trackerTarget ?? targets.trackerTarget,
    messagingTarget: targets.messagingTarget,
    mailTarget: targets.mailTarget,
    extensionObservations: observations.events,
    extensionCompletions: observations.completions,
    extensionFeedCursor: observations.lastSequence,
    ...(mail.fallbackToReplica
      ? {}
      : {
          mailMessages: mail.messages.map((message) => ({
            ...message,
            preview: preview(message.body),
            isNew: !message.isRead,
            isSupportLike: supportLike(message.subject, message.body),
          })),
        }),
    ...(tracker.fallbackToReplica
      ? {}
      : {
          trackerIssues: tracker.issues.map((entry) => ({
            ...entry.issue,
            title: entry.title,
            description: "Connected tracker issue",
            labels: entry.labels,
            priority: "medium" as const,
            owner:
              entry.owner !== null && isTeamOwner(entry.owner)
                ? entry.owner
                : null,
            state: "open" as const,
            createdAt: "1970-01-01T00:00:00.000Z",
            source: "live" as const,
          })),
        }),
  };
}

export async function understandReportLive(report: MailMessage): Promise<{
  readonly understanding: IssueUnderstanding;
  readonly research: {
    readonly query: string;
    readonly references: readonly RunResearchReference[];
  } | null;
}> {
  const response = understandResponseSchema.parse(
    await fetchJsonWithTimeout("/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report }),
      timeoutMs: 12_000,
    }),
  );
  return {
    understanding: response.understanding,
    research:
      response.research.query.length === 0
        ? null
        : {
            query: response.research.query,
            references: response.research.results,
          },
  };
}
