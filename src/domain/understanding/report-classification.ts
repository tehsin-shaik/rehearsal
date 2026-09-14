import type {
  IssueCategory,
  IssueSeverity,
  IssueUnderstanding,
} from "./issue-understanding.ts";
import type { SupportReport } from "./support-report.ts";
import type { Department } from "./team-routing.ts";

export type DeterministicIssueCategory = Extract<
  IssueCategory,
  "authentication" | "performance" | "data" | "unresolved"
>;

export interface DeterministicReportClassification {
  readonly category: DeterministicIssueCategory;
  readonly department: Department;
  readonly severity: Extract<IssueSeverity, "low" | "medium" | "high">;
  readonly labels: readonly string[];
  readonly evidence: IssueUnderstanding["evidence"];
  readonly confidence: number;
  readonly confidenceByField: Readonly<Record<string, number>>;
}

interface ClassificationProfile {
  readonly category: Exclude<DeterministicIssueCategory, "unresolved">;
  readonly department: Exclude<Department, "unresolved">;
  readonly severity: Extract<IssueSeverity, "medium" | "high">;
  readonly signals: readonly string[];
  readonly severitySignals: readonly string[];
  readonly confidence: number;
}

const CLASSIFICATION_PROFILES = [
  {
    category: "authentication",
    department: "technical_support",
    severity: "high",
    signals: [
      "authentication failed",
      "password reset",
      "unable to sign in",
      "sign-in",
      "sign in",
    ],
    severitySignals: ["blocks access", "authentication failed"],
    confidence: 0.97,
  },
  {
    category: "performance",
    department: "technical_support",
    severity: "high",
    signals: [
      "time out",
      "timeout",
      "production api",
      "orders endpoint",
      "every request",
    ],
    severitySignals: ["production", "every request", "30 seconds"],
    confidence: 0.96,
  },
  {
    category: "data",
    department: "billing",
    severity: "medium",
    signals: [
      "duplicate charge",
      "same subscription charge twice",
      "billing charge",
      "invoice",
    ],
    severitySignals: ["duplicate charge", "charge twice"],
    confidence: 0.95,
  },
] as const satisfies readonly ClassificationProfile[];

const AMBIGUITY_SIGNALS = [
  "cannot tell whether",
  "something went wrong yesterday",
  "something went wrong",
  "something changed",
  "not sure whether",
  "unclear whether",
] as const;

function findLiteralSignal(sourceText: string, signal: string): string | null {
  const index = sourceText.toLowerCase().indexOf(signal.toLowerCase());
  return index === -1 ? null : sourceText.slice(index, index + signal.length);
}

function findLiteralSignals(
  sourceText: string,
  signals: readonly string[],
): readonly string[] {
  return signals.flatMap((signal) => {
    const excerpt = findLiteralSignal(sourceText, signal);
    return excerpt === null ? [] : [excerpt];
  });
}

function unresolvedClassification(
  report: Pick<SupportReport, "subject" | "body">,
  ambiguityExcerpt: string | null,
): DeterministicReportClassification {
  const fallbackExcerpt =
    report.subject.trim() ||
    report.body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ||
    "";
  const excerpt = ambiguityExcerpt ?? fallbackExcerpt;
  const evidence =
    excerpt.length === 0
      ? []
      : [
          { field: "issue.category", excerpt },
          { field: "issue.department", excerpt },
        ];

  return {
    category: "unresolved",
    department: "unresolved",
    severity: "low",
    labels: ["support", "unresolved", "low-severity"],
    evidence,
    confidence: ambiguityExcerpt === null ? 0.2 : 0.3,
    confidenceByField: {
      "issue.category": ambiguityExcerpt === null ? 0.2 : 0.3,
      "issue.department": ambiguityExcerpt === null ? 0.2 : 0.3,
      "issue.severity": 0.4,
      "issue.labels": 0.4,
    },
  };
}

export function classifyReportText(
  report: Pick<SupportReport, "subject" | "body">,
): DeterministicReportClassification {
  const sourceText = `${report.subject}\n${report.body}`;
  const ambiguityExcerpt = findLiteralSignals(sourceText, AMBIGUITY_SIGNALS)[0];

  if (ambiguityExcerpt !== undefined) {
    return unresolvedClassification(report, ambiguityExcerpt);
  }

  const scoredProfiles = CLASSIFICATION_PROFILES.map((profile) => ({
    profile,
    signals: findLiteralSignals(sourceText, profile.signals),
  })).sort(
    (leftProfile, rightProfile) =>
      rightProfile.signals.length - leftProfile.signals.length,
  );
  const bestMatch = scoredProfiles[0];
  const secondBestMatch = scoredProfiles[1];

  if (
    bestMatch === undefined ||
    bestMatch.signals.length === 0 ||
    bestMatch.signals.length === secondBestMatch?.signals.length
  ) {
    return unresolvedClassification(report, null);
  }

  const severityExcerpt =
    findLiteralSignals(sourceText, bestMatch.profile.severitySignals)[0] ??
    bestMatch.signals[0];
  const classificationExcerpt = bestMatch.signals[0];

  return {
    category: bestMatch.profile.category,
    department: bestMatch.profile.department,
    severity: bestMatch.profile.severity,
    labels: [
      "support",
      bestMatch.profile.category,
      `${bestMatch.profile.severity}-severity`,
    ],
    evidence: [
      { field: "issue.category", excerpt: classificationExcerpt },
      { field: "issue.department", excerpt: classificationExcerpt },
      { field: "issue.severity", excerpt: severityExcerpt },
      { field: "issue.labels", excerpt: classificationExcerpt },
    ],
    confidence: bestMatch.profile.confidence,
    confidenceByField: {
      "issue.category": bestMatch.profile.confidence,
      "issue.department": bestMatch.profile.confidence,
      "issue.severity": Math.max(0.9, bestMatch.profile.confidence - 0.03),
      "issue.labels": Math.max(0.9, bestMatch.profile.confidence - 0.02),
    },
  };
}
