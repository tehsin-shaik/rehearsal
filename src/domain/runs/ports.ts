import type { PlannedAction } from "./planned-action.ts";
import type { ActionResult } from "./action-result.ts";

export interface ExecutionAdapter {
  readonly name: string;
  perform(action: PlannedAction): Promise<Pick<ActionResult,"status"|"externalReference"|"externalUrl"|"error">>;
}
export interface ExecutionAdapters { tracker: ExecutionAdapter; messaging: ExecutionAdapter; mail: ExecutionAdapter }
export interface TrackerIssue { id: string; url?: string; title: string; description: string; labels: readonly string[]; severity: string; owner: string | null; department: string; }
export interface ChatMessage { id: string; channel: string; author: string; text: string; issueReference?: string; }
export interface CustomerReply { id: string; to: string; subject: string; text: string; reportId: string; }
