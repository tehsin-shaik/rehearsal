import type { WorkflowTrace } from "../events/workflow-trace.ts";
import type { LearnedPattern } from "./learned-pattern.ts";
import { detectRepeatedPattern } from "./pattern-detection.ts";

const FIELDS = [
  ["customer.name", "extracted", "customerName"], ["customer.email", "extracted", "customerEmail"],
  ["issue.title", "extracted", "issueTitle"], ["issue.description", "extracted", "issueDescription"],
  ["issue.category", "classified", "category"], ["issue.department", "classified", "department"],
  ["issue.severity", "classified", "severity"], ["issue.labels", "classified", "labels"],
  ["owner", "routed", "owner"], ["channel", "routed", "channel"],
  ["issue.number", "generated", "issueNumber"], ["notification", "generated", "notification"], ["reply", "generated", "reply"],
] as const;

export function detectPattern(traces: readonly WorkflowTrace[]): LearnedPattern | null {
  const detection = detectRepeatedPattern(traces);
  if (!detection.detected || !detection.bestComparison) return null;
  const matched = traces.filter(t => detection.matchingTraceIds.includes(t.id));
  // This compiler deliberately supports only complete support-triage traces.
  const required = ["create_issue", "assign_owner", "send_team_notification", "reply_to_customer"];
  if (matched.some(t => required.some(action => !t.events.some(e => e.action === action)))) return null;
  const observedValues = Object.fromEntries(FIELDS.map(([field, , key]) => [field, [...new Set(matched.flatMap(t => t.events.flatMap(e => e.payload[key] === undefined ? [] : [e.payload[key]])))]]));
  const constantCandidates = matched.map(t => Object.assign({}, ...t.events.map(e => e.payload.authoredConstants ?? {})) as Record<string, unknown>);
  const derivedNames = new Set<string>(FIELDS.flatMap(([field, , key]) => [field, key]));
  const constants = Object.entries(constantCandidates[0]).filter(([field, value]) => !derivedNames.has(field) && constantCandidates.every(c => JSON.stringify(c[field]) === JSON.stringify(value))).map(([field, value]) => ({ field, value, rationale: "Explicitly authored and invariant across every matching observation." }));
  const s = detection.bestComparison;
  return {
    id: "support-triage", status: "proposed", trigger: { sourceApplication: "mail", action: "report_received", intent: "An unread customer support report arrives" },
    stages: [
      { id: "understand", order: 1, intent: "Understand the report", sourceApplication: "system", action: "classify_report" },
      { id: "create", order: 2, intent: "Create a structured issue", sourceApplication: "issue_tracker", action: "create_issue" },
      { id: "route", order: 3, intent: "Route to the right owner", sourceApplication: "issue_tracker", action: "assign_owner" },
      { id: "notify", order: 4, intent: "Notify the team", sourceApplication: "team_chat", action: "send_team_notification" },
      { id: "reply", order: 5, intent: "Reply to the customer", sourceApplication: "mail", action: "reply_to_customer" },
    ],
    variables: FIELDS.map(([field, source]) => ({ field, source, ...(source === "routed" ? { dependsOn: "issue.department" } : {}), rationale: source === "routed" ? "Derived through department → owner/channel. Repeated values are evidence, never an ownership constant." : `Recomputed from each new report (${source}); identical observations do not imply a constant.` })),
    constants, observedValues, permissions: ["read", "analyze", "draft", "create_external", "send_message"], confidence: detection.confidence,
    evidence: { matchingTraceIds: detection.matchingTraceIds, sampleSize: matched.length, actionSequenceSimilarity: s.actionSequenceSimilarity, applicationSetSimilarity: s.applicationSetSimilarity, intentSimilarity: s.semanticIntentSimilarity },
    observedManualActionCount: Math.round(matched.reduce((n,t) => n+t.events.filter(e => e.origin === "observed").length,0)/matched.length),
    estimatedDurationSeconds: Math.round(matched.reduce((n,t) => n+t.events.reduce((sum,e) => sum+e.estimatedEffortSeconds,0),0)/matched.length),
  };
}
