import { SemanticTraceBuilder } from "../../domain/events/trace-builder.ts";
import type { WorkflowTrace } from "../../domain/events/workflow-trace.ts";
import { apiTimeoutReport, loginAuthenticationReport } from "./reports.ts";

interface SupportTriageTraceInput {
  readonly traceId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly report: {
    readonly id: string;
    readonly subject: string;
  };
  readonly customerName: string;
  readonly customerEmail: string;
  readonly issueDescription: string;
  readonly category: "authentication" | "api_timeout";
  readonly severity: "high";
  readonly includeAdditionalRead: boolean;
}

function buildSupportTriageTrace(
  input: SupportTriageTraceInput,
): WorkflowTrace {
  const builder = new SemanticTraceBuilder({
    traceId: input.traceId,
    startedAt: input.startedAt,
  });
  const startTime = new Date(input.startedAt).getTime();
  const eventTime = (minuteOffset: number): string =>
    new Date(startTime + minuteOffset * 60_000).toISOString();

  builder.append({
    occurredAt: eventTime(0),
    sourceApplication: "mail",
    action: "report_received",
    intent: "Receive a support report",
    payload: { reportId: input.report.id, subject: input.report.subject },
  });

  if (input.includeAdditionalRead) {
    builder.append({
      occurredAt: eventTime(1),
      sourceApplication: "mail",
      action: "read_report",
      intent: "Read additional support report detail",
      payload: { reportId: input.report.id },
      estimatedEffortSeconds: 20,
    });
  }

  builder.append({
    occurredAt: eventTime(2),
    sourceApplication: "issue_tracker",
    action: "create_issue",
    intent: "Create a support issue",
    payload: {
      reportId: input.report.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      issueTitle: input.report.subject,
      issueDescription: input.issueDescription,
      category: input.category,
      department: "technical_support",
      severity: input.severity,
      labels: ["support", input.category],
    },
    confidence: 0.98,
    estimatedEffortSeconds: 75,
  });

  builder.append({
    occurredAt: eventTime(3),
    sourceApplication: "issue_tracker",
    action: "assign_owner",
    intent: "Assign the routed issue owner",
    payload: { department: "technical_support", owner: "Umar" },
    estimatedEffortSeconds: 30,
  });

  builder.append({
    occurredAt: eventTime(4),
    sourceApplication: "team_chat",
    action: "send_team_notification",
    intent: "Send a team notification",
    payload: {
      channel: "#technical-support",
      department: "technical_support",
      owner: "Umar",
    },
    estimatedEffortSeconds: 45,
  });

  builder.append({
    occurredAt: eventTime(5),
    sourceApplication: "mail",
    action: "reply_to_customer",
    intent: "Reply to the customer",
    payload: {
      reportId: input.report.id,
      customerName: input.customerName,
      responseType: "acknowledgement",
    },
    estimatedEffortSeconds: 60,
  });

  return builder.complete(input.completedAt);
}

export const loginAuthenticationTrace = buildSupportTriageTrace({
  traceId: "trace-login-001",
  startedAt: "2026-01-05T09:02:00.000Z",
  completedAt: "2026-01-05T09:07:00.000Z",
  report: loginAuthenticationReport,
  customerName: "Maya Chen",
  customerEmail: "maya.chen@example.test",
  issueDescription: "Customer cannot sign in after resetting a password.",
  category: "authentication",
  severity: "high",
  includeAdditionalRead: false,
});

export const apiTimeoutTrace = buildSupportTriageTrace({
  traceId: "trace-api-002",
  startedAt: "2026-01-06T10:17:00.000Z",
  completedAt: "2026-01-06T10:23:00.000Z",
  report: apiTimeoutReport,
  customerName: "Noah Williams",
  customerEmail: "noah.williams@example.test",
  issueDescription: "Production order requests consistently time out.",
  category: "api_timeout",
  severity: "high",
  includeAdditionalRead: true,
});
