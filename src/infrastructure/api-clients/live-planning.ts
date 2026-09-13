import { z } from "zod";
import { randomUUID } from "node:crypto";
import { reportSchema } from "./contracts.ts";
import { observationSchema, scrubObservation } from "./observation.ts";
import { detectPattern } from "../../domain/patterns/compiler.ts";
import { planRun } from "../../domain/runs/planner.ts";
import { understandWithResearch } from "./understanding.ts";
import { routeDepartment, type ResolvedDepartment } from "../../domain/understanding/routing.ts";
import { trackerDestination, configuredOwner } from "../adapters/trackers.ts";
import { slackWebhook } from "../adapters/slack.ts";
import { ApiError, type ServerSession } from "../persistence/server-state.ts";
import type { Environment } from "../../config/environment.ts";
const inputSchema = z.object({ report: reportSchema, traces: z.array(z.object({ id: z.string(), startedAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }), events: z.array(observationSchema).max(100) })).min(2).max(20) }).strict();
export async function createLivePlan(input: unknown, session: ServerSession, env: Environment) {
    const data = inputSchema.parse(input);
    const old = [...session.runs.values()].find(r => r.triggerReportId === data.report.id && r.status !== "cancelled");
    if (old)
        return old;
    const traces = data.traces.map(t => ({ ...t, status: "completed" as const, events: t.events.flatMap(e => {
            const event = scrubObservation(e);
            return event ? [event] : [];
        }) }));
    const pattern = detectPattern(traces);
    if (!pattern)
        throw new ApiError(422, "Two complete, matching observations are required.");
    const understanding = await understandWithResearch(data.report, env);
    const route = routeDepartment(understanding.issue.department);
    const tracker = trackerDestination(env);
    if (route) {
        slackWebhook(env, route.channel);
        if (!configuredOwner(env, route.owner))
            throw new ApiError(422, `Configure the external assignee ID for ${route.owner}.`);
    }
    if (!session.mail.canSend)
        throw new ApiError(422, "Connect Gmail with explicit send permission before planning customer replies.");
    let run = planRun(pattern, understanding, { id: randomUUID(), tracker, channel: route?.channel, mail: "Gmail (connected account)" });
    run = { ...run, plannedActions: run.plannedActions.map(a => a.action === "assign_owner" ? { ...a, resolvedInput: { ...a.resolvedInput, externalOwnerId: route ? configuredOwner(env, route.owner) : null } } : a.action === "reply_to_customer" ? { ...a, resolvedInput: { ...a.resolvedInput, ...(data.report.threadId ? { threadId: data.report.threadId } : {}) } } : a) };
    if (session.runs.size >= 100)
        throw new ApiError(429, "This prototype is limited to 100 runs per session.");
    session.runs.set(run.id, run);
    session.patterns.set(run.id, pattern);
    return run;
}
export function resolveLiveReview(session: ServerSession, id: string, department: ResolvedDepartment, env: Environment) {
    const prior = session.runs.get(id), pattern = session.patterns.get(id);
    if (!prior || !pattern)
        throw new ApiError(404, "Run evidence was not found.");
    if (prior.status !== "needs_review")
        throw new ApiError(409, "Only an unresolved report can be revised.");
    const route = routeDepartment(department)!;
    slackWebhook(env, route.channel);
    const ownerId = configuredOwner(env, route.owner);
    if (!ownerId)
        throw new ApiError(422, `Configure the external assignee ID for ${route.owner}.`);
    const understanding = { ...prior.understanding, issue: { ...prior.understanding.issue, department, severity: "medium" as const, labels: ["support", "human-reviewed"] }, owner: route.owner, reviewRequired: false, confidence: { ...prior.understanding.confidence, overall: 1 }, provenance: { provider: "human", model: "explicit-review", validated: true, latencyMs: 0 } };
    let run = planRun(pattern, understanding, { id, tracker: trackerDestination(env), channel: route.channel, mail: "Gmail (connected account)" });
    const threadId = prior.plannedActions.find(a => a.action === "reply_to_customer")?.resolvedInput.threadId;
    run = { ...run, plannedActions: run.plannedActions.map(a => a.action === "assign_owner" ? { ...a, resolvedInput: { ...a.resolvedInput, externalOwnerId: ownerId } } : a.action === "reply_to_customer" && threadId ? { ...a, resolvedInput: { ...a.resolvedInput, threadId } } : a) };
    session.runs.set(id, run);
    return run;
}
