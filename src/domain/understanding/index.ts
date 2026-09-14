export {
  understandReportDeterministically,
  type DeterministicIssueUnderstanding,
} from "./deterministic-understanding.ts";
export {
  type IssueCategory,
  type IssueSeverity,
  type IssueUnderstanding,
} from "./issue-understanding.ts";
export type { MailMessage } from "./mail-message.ts";
export {
  classifyReportText,
  type DeterministicIssueCategory,
  type DeterministicReportClassification,
} from "./report-classification.ts";
export type { SupportReport } from "./support-report.ts";
export {
  DEPARTMENTS,
  isTeamOwner,
  routeDepartment,
  routeOwner,
  TEAM_OWNERS,
  TEAM_ROUTING_CONFIG,
  type Department,
  type TeamOwner,
  type TeamRoutingResult,
} from "./team-routing.ts";
