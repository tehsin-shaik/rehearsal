import type { IssueUnderstanding } from "./issue-understanding.ts";
import type { MailMessage } from "./mail-message.ts";
import { classifyReportText } from "./report-classification.ts";
import type { SupportReport } from "./support-report.ts";
import { routeDepartment, type TeamRoutingResult } from "./team-routing.ts";

export interface DeterministicIssueUnderstanding extends IssueUnderstanding {
  readonly source: "deterministic";
  readonly routing: TeamRoutingResult;
  readonly sourceMessage: MailMessage;
}

interface LabeledValue {
  readonly value: string;
  readonly excerpt: string;
}

function extractLabeledValue(body: string, label: string): LabeledValue | null {
  const line = body
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) =>
      candidate.toLowerCase().startsWith(`${label.toLowerCase()}:`),
    );

  if (line === undefined) {
    return null;
  }

  const value = line.slice(line.indexOf(":") + 1).trim();
  return value.length === 0 ? null : { value, excerpt: line };
}

function issueDescriptionLines(body: string): readonly string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.toLowerCase().startsWith("customer:") &&
        !line.toLowerCase().startsWith("email:"),
    );
}

function roundConfidence(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function uniqueEvidence(
  evidence: IssueUnderstanding["evidence"],
): IssueUnderstanding["evidence"] {
  const seen = new Set<string>();

  return evidence.filter((entry) => {
    const key = `${entry.field}\u0000${entry.excerpt}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function understandReportDeterministically(
  report: SupportReport,
): DeterministicIssueUnderstanding {
  const customerName = extractLabeledValue(report.body, "Customer");
  const customerEmail = extractLabeledValue(report.body, "Email");
  const descriptionLines = issueDescriptionLines(report.body);
  const issueTitle = report.subject.trim();
  const issueDescription = descriptionLines.join(" ") || issueTitle;
  const classification = classifyReportText(report);
  const routing = routeDepartment(classification.department);
  const extractionEvidence: IssueUnderstanding["evidence"] = [
    ...(customerName === null
      ? []
      : [{ field: "customer.name", excerpt: customerName.excerpt }]),
    ...(customerEmail === null
      ? []
      : [{ field: "customer.email", excerpt: customerEmail.excerpt }]),
    ...(issueTitle.length === 0
      ? []
      : [{ field: "issue.title", excerpt: issueTitle }]),
    ...(descriptionLines[0] === undefined
      ? []
      : [{ field: "issue.description", excerpt: descriptionLines[0] }]),
  ];
  const extractionCompleteness =
    [customerName, customerEmail].filter((value) => value !== null).length / 2;
  const overallConfidence =
    classification.department === "unresolved"
      ? classification.confidence
      : roundConfidence(
          classification.confidence * 0.85 + extractionCompleteness * 0.15,
        );

  return {
    reportId: report.id,
    customer: {
      name: customerName?.value ?? null,
      email: customerEmail?.value ?? null,
    },
    issue: {
      title: issueTitle,
      description: issueDescription,
      category: classification.category,
      department: classification.department,
      severity: classification.severity,
      labels: classification.labels,
    },
    owner: routing.owner,
    evidence: uniqueEvidence([
      ...extractionEvidence,
      ...classification.evidence,
    ]),
    confidence: {
      overall: overallConfidence,
      byField: {
        "customer.name": customerName === null ? 0 : 0.99,
        "customer.email": customerEmail === null ? 0 : 0.99,
        "issue.title": issueTitle.length === 0 ? 0 : 1,
        "issue.description": descriptionLines.length === 0 ? 0.5 : 0.98,
        ...classification.confidenceByField,
        owner: routing.owner === null ? 0 : 1,
      },
    },
    reviewRequired: routing.reviewRequired,
    source: "deterministic",
    routing,
    sourceMessage: { ...report },
  };
}
