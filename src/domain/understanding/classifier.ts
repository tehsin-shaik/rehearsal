import type { IssueUnderstanding } from "./issue-understanding.ts";
import { routeDepartment, type ResolvedDepartment } from "./routing.ts";

export interface Report {
  readonly id: string;
  readonly receivedAt: string;
  readonly subject: string;
  readonly body: string;
  readonly senderName?: string;
  readonly senderEmail?: string;
  readonly unread?: boolean;
  readonly threadId?: string;
}

type Rule = { pattern: RegExp; department: ResolvedDepartment; category: IssueUnderstanding["issue"]["category"]; severity: "medium" | "high" };
const RULES: readonly Rule[] = [
  { pattern: /duplicate (?:subscription )?charge|charge(?:d)? twice|subscription charge twice/i, department: "billing", category: "billing", severity: "medium" },
  { pattern: /authentication failed|invalid credentials|unable to (?:sign in|log in)|login failure/i, department: "technical_support", category: "authentication", severity: "high" },
  { pattern: /HTTP 504|API.*(?:time.?out|time out)|requests? (?:consistently )?time out/i, department: "technical_support", category: "api_timeout", severity: "high" },
  { pattern: /pricing quote|purchase (?:a )?licen[cs]e|enterprise pricing/i, department: "sales", category: "sales", severity: "medium" },
  { pattern: /shipment delayed|missing delivery|package not delivered/i, department: "logistics", category: "logistics", severity: "medium" },
  { pattern: /feature request|product enhancement/i, department: "engineering", category: "product", severity: "medium" },
  { pattern: /data deletion request|privacy complaint|GDPR request/i, department: "legal", category: "privacy", severity: "high" },
];

export function understandReport(report: Report): IssueUnderstanding {
  const source = `${report.subject}\n${report.body}`;
  const matches = RULES.flatMap(rule => { const match = source.match(rule.pattern); return match ? [{ rule, excerpt: match[0] }] : []; });
  const departments = new Set(matches.map(m => m.rule.department));
  const match = departments.size === 1 ? matches[0] : undefined;
  const name = report.senderName ?? report.body.match(/^Customer:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const email = report.senderEmail ?? report.body.match(/^Email:\s*([^\s]+@[^\s]+)$/m)?.[1] ?? null;
  const department = match?.rule.department ?? "unresolved";
  const confidence = match ? 0.94 : 0.28;
  return {
    reportId: report.id, customer: { name, email },
    issue: { title: report.subject, description: report.body, department, category: match?.rule.category ?? "unresolved", severity: match?.rule.severity ?? "unresolved", labels: ["support", match?.rule.category ?? "needs-review"] },
    owner: routeDepartment(department)?.owner ?? null,
    evidence: matches.map(m => ({ field: "issue.department", excerpt: m.excerpt })),
    confidence: { overall: confidence, byField: { department: confidence, customer: name && email ? 1 : 0.4 } },
    reviewRequired: !match || !name || !email,
    provenance: { provider: "deterministic", model: "support-rules-v1", validated: true, latencyMs: 0 },
  };
}

export function isSupportReport(report: Report): boolean {
  return report.unread !== false && /help|support|issue|problem|charge|fail|timeout|time out|request|504|sign in/i.test(`${report.subject} ${report.body}`);
}
