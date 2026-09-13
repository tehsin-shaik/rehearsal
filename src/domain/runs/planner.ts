import type { LearnedPattern } from "../patterns/learned-pattern.ts";
import type { IssueUnderstanding } from "../understanding/issue-understanding.ts";
import { routeDepartment } from "../understanding/routing.ts";
import type { AgentRun } from "./agent-run.ts";
import type { PlannedAction } from "./planned-action.ts";
import { ACTION_PERMISSIONS, evaluateAction } from "../policy/guard.ts";
let sequence = 0;
export function planRun(pattern: LearnedPattern, understanding: IssueUnderstanding, options: {
    id?: string;
    tracker?: string;
    channel?: string;
    mail?: string;
} = {}): AgentRun {
    const id = options.id ?? `run-${++sequence}`;
    const u = understanding;
    const route = routeDepartment(u.issue.department);
    const review = u.reviewRequired || u.confidence.overall < 0.75 || !route || !u.customer.email || !u.customer.name || !u.owner;
    const channel = options.channel ?? route?.channel ?? "Human review required";
    const tracker = options.tracker ?? "Demo issue tracker";
    const issueReference = `Pending issue · ${u.issue.title}`;
    const research = u.research?.length ? `\n\nPublic references:\n${u.research.map(r => `- ${r.title}: ${r.url}`).join("\n")}` : "";
    const definitions: {
        action: PlannedAction["action"];
        destination: string;
        resolvedInput: Record<string, unknown>;
    }[] = [
        { action: "analyze_report", destination: "Local understanding", resolvedInput: { title: u.issue.title, category: u.issue.category, department: u.issue.department, evidence: u.evidence } },
        { action: "create_issue", destination: tracker, resolvedInput: { title: u.issue.title, description: `${u.issue.description}${research}`, labels: u.issue.labels, severity: u.issue.severity, department: u.issue.department } },
        { action: "assign_owner", destination: tracker, resolvedInput: { issueReference, owner: u.owner, department: u.issue.department } },
        { action: "send_team_notification", destination: `#${channel}`, resolvedInput: { channel, issueReference, text: `[${u.issue.category}] ${u.customer.name ?? "Customer"}: ${u.issue.title}. ${issueReference} → ${u.owner ?? "Owner needs review"}.` } },
        { action: "reply_to_customer", destination: `${options.mail ?? "Demo mail"} → ${u.customer.email ?? "Email needs review"}`, resolvedInput: { to: u.customer.email, reportId: u.reportId, subject: `Re: ${u.issue.title}`, issueReference, text: `Hi ${u.customer.name ?? "there"},\n\nThanks for letting us know. We have recorded your report (${issueReference}). ${u.owner ?? "Our team"} from ${route?.label ?? "support"} will review it and follow up.\n\nSupport team` } },
    ];
    const plannedActions: PlannedAction[] = definitions.map((a, index) => ({ ...a, id: `${id}-action-${index + 1}`, sequence: index + 1, permission: ACTION_PERMISSIONS[a.action], risk: index === 0 ? "low" : "medium", requiresApproval: index !== 0, status: review ? "needs_review" : "planned", idempotencyKey: `${id}:${a.action}` }));
    const adaptations = ([["issue.department", u.issue.department], ["owner", u.owner], ["channel", channel]] as const).flatMap(([field, to]) => {
        const from = pattern.observedValues?.[field] ?? [];
        return from.length && !from.includes(to) ? [{ field, from: from.length === 1 ? from[0] : from, to, rule: field === "issue.department" ? "Classify literal report evidence" : "department -> owner / channel routing rule" }] : [];
    });
    return { id, patternId: pattern.id, triggerReportId: u.reportId, status: review ? "needs_review" : "ghost_run", understanding: u, plannedActions, policyDecisions: plannedActions.map(a => evaluateAction(a, false, !review)), approval: { status: "pending", approvedBy: null, approvedAt: null }, adaptations, results: [], metrics: { estimatedActionsAvoided: pattern.observedManualActionCount, estimatedSecondsSaved: Math.max(0, pattern.estimatedDurationSeconds - 15), humanInterventions: 0 } };
}
// A local integrity binding, not a cryptographic identity. Live approvals are server-owned.
export function planDigest(run: AgentRun): string {
    return JSON.stringify({ id: run.id, understanding: run.understanding, actions: run.plannedActions.map(({ id, action, permission, destination, resolvedInput, idempotencyKey }) => ({ id, action, permission, destination, resolvedInput, idempotencyKey })) });
}
export function approveRun(run: AgentRun, approvedBy: string): AgentRun {
    if (run.status !== "ghost_run" || run.understanding.reviewRequired)
        throw new Error("Resolve review before approval.");
    if (!approvedBy.trim())
        throw new Error("An attributable reviewer is required.");
    return { ...run, status: "approved", approval: { status: "approved", approvedBy: approvedBy.trim(), approvedAt: new Date().toISOString(), planDigest: planDigest(run) }, plannedActions: run.plannedActions.map(a => ({ ...a, status: "approved" })), metrics: { ...run.metrics, humanInterventions: run.metrics.humanInterventions + 1 } };
}
