import type { Report } from "../domain/understanding/classifier.ts";
import type { TrackerIssue, ChatMessage, CustomerReply } from "../domain/runs/ports.ts";
import { existingIssues, existingMessages, noiseReports, trainingReports } from "../demo/fixtures/workspace.ts";
export interface WorkspaceSlice { reports: readonly Report[]; selectedReportId: string | null; manualStep: number; issues: readonly TrackerIssue[]; messages: readonly ChatMessage[]; replies: readonly CustomerReply[]; channel: string; }
export const initialWorkspace = (): WorkspaceSlice => ({ reports: [trainingReports[0], ...noiseReports], selectedReportId: trainingReports[0].id, manualStep: -1, issues: existingIssues, messages: existingMessages, replies: [], channel: "technical-support" });
