import { loginAuthenticationReport, apiTimeoutReport, duplicateBillingChargeReport, ambiguousReviewReport } from "./reports.ts";
import type { Report } from "../../domain/understanding/classifier.ts";
import type { TrackerIssue, ChatMessage } from "../../domain/runs/ports.ts";
export const trainingReports: readonly Report[] = [loginAuthenticationReport, apiTimeoutReport];
export const billingReport = duplicateBillingChargeReport;
export const reviewReport = ambiguousReviewReport;
export const noiseReports: readonly Report[] = [
    { id: "noise-1", receivedAt: "2026-01-06T08:40:00Z", subject: "Weekly product digest", senderName: "Product team", senderEmail: "product@example.test", body: "This week: improved exports, a faster dashboard, and our latest changelog.", unread: false },
    { id: "noise-2", receivedAt: "2026-01-06T08:15:00Z", subject: "Thursday team lunch", senderName: "Jamie Park", senderEmail: "jamie@example.test", body: "Team lunch at 12:30. See you there!", unread: false },
];
export const existingIssues: readonly TrackerIssue[] = [
    { id: "RHR-1042", title: "Improve export progress feedback", description: "Add progress feedback to long-running CSV exports.", labels: ["enhancement"], severity: "low", department: "engineering", owner: "Noor" },
    { id: "RHR-1041", title: "Update help center quickstart", description: "Refresh screenshots for the new onboarding flow.", labels: ["documentation"], severity: "medium", department: "technical_support", owner: "Umar" },
];
export const existingMessages: readonly ChatMessage[] = [
    { id: "chat-1", channel: "technical-support", author: "Umar", text: "Morning team. I’m on support rotation today — tag me on anything urgent." },
    { id: "chat-2", channel: "technical-support", author: "Noor", text: "Thanks! The API status dashboard is up to date." },
    { id: "chat-3", channel: "billing-finance", author: "Awaiz", text: "I’m reviewing subscription reports today. Please link the issue when escalating." },
];
