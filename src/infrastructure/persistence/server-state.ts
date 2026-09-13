import { IntegrationError } from "../api-clients/http.ts";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { LearnedPattern } from "../../domain/patterns/learned-pattern.ts";
import type { AgentRun } from "../../domain/runs/agent-run.ts";
import type { SemanticEvent } from "../../domain/events/semantic-event.ts";
import { environment, isDemo, type Environment } from "../../config/environment.ts";
import { TrackerAdapter } from "../adapters/trackers.ts";
import { SlackAdapter } from "../adapters/slack.ts";
import { GmailAdapter } from "../adapters/gmail.ts";
import { IdempotentAdapter } from "../adapters/idempotent.ts";
import { RunExecutor } from "../../application/engine/executor.ts";
export interface ServerSession {
    id: string;
    expiresAt: number;
    runs: Map<string, AgentRun>;
    patterns: Map<string, LearnedPattern>;
    mail: GmailAdapter;
    executor: RunExecutor;
    observation: {
        sequence: number;
        event: SemanticEvent;
    }[];
    sequence: number;
    oauthState?: string;
    observerToken?: string;
}
const globalState = globalThis as typeof globalThis & {
    rehearsalServer?: Map<string, ServerSession>;
};
const sessions = globalState.rehearsalServer ??= new Map();
export function createSession(env: Environment): ServerSession {
    for (const [id, session] of sessions)
        if (session.expiresAt < Date.now())
            sessions.delete(id);
    if (sessions.size >= 100)
        throw new Error("Too many sessions. Restart the local server.");
    const id = randomBytes(32).toString("hex"), mail = new GmailAdapter(env);
    const s: ServerSession = { id, expiresAt: Date.now() + 8 * 3600000, runs: new Map(), patterns: new Map(), mail, executor: new RunExecutor({ tracker: new IdempotentAdapter(new TrackerAdapter(env)), messaging: new IdempotentAdapter(new SlackAdapter(env)), mail: new IdempotentAdapter(mail) }), observation: [], sequence: 0 };
    sessions.set(id, s);
    return s;
}
export function validAccessKey(candidate: string | undefined | null, env: Environment): boolean {
    if (!candidate || !env.REHEARSAL_ACCESS_KEY || env.REHEARSAL_ACCESS_KEY.length < 24)
        return false;
    const a = Buffer.from(candidate), b = Buffer.from(env.REHEARSAL_ACCESS_KEY);
    return a.length === b.length && timingSafeEqual(a, b);
}
export class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}
export function requireSession(request: Request, env = environment()): ServerSession {
    if (isDemo(env))
        throw new ApiError(409, "Live integrations are disabled in Demo Mode.");
    const cookie = request.headers.get("cookie")?.split(";").find(v => v.trim().startsWith("rehearsal_session="))?.trim().slice("rehearsal_session=".length);
    const session = cookie ? sessions.get(cookie) : undefined;
    if (!session || session.expiresAt < Date.now())
        throw new ApiError(401, "Unlock the local integration session first.");
    return session;
}
export function requireObserverSession(request: Request, env = environment()): ServerSession {
    if (isDemo(env))
        throw new ApiError(409, "Extension observation is disabled in Demo Mode.");
    const token = request.headers.get("x-rehearsal-observer");
    if (!token)
        return requireSession(request, env);
    if (!env.EXTENSION_ID || request.headers.get("origin") !== `chrome-extension://${env.EXTENSION_ID}`)
        throw new ApiError(403, "The browser extension ID is not trusted.");
    const session = [...sessions.values()].find(s => s.observerToken === token && s.expiresAt > Date.now());
    if (!session)
        throw new ApiError(401, "Pair this extension with an active local session.");
    return session;
}
export function validateOrigin(request: Request, env = environment()): void {
    const origin = request.headers.get("origin");
    if (!origin)
        throw new ApiError(403, "An explicit trusted Origin is required.");
    const configured = new URL(env.REHEARSAL_BASE_URL).origin;
    if (origin !== configured && origin !== `chrome-extension://${env.EXTENSION_ID}`)
        throw new ApiError(403, "This origin is not authorized.");
}
export async function apiBoundary(fn: () => Promise<Response>): Promise<Response> {
    try {
        return await fn();
    }
    catch (e) {
        if (e instanceof ApiError)
            return Response.json({ error: e.message }, { status: e.status });
        if (e instanceof IntegrationError)
            return Response.json({ error: e.message, code: e.code }, { status: 422 });
        if (e instanceof Error && e.name === "ZodError")
            return Response.json({ error: "Invalid request schema." }, { status: 400 });
        return Response.json({ error: "The request could not be completed. Check server configuration and integration access." }, { status: 500 });
    }
}
export async function requestBody(request: Request): Promise<unknown> {
    if (Number(request.headers.get("content-length") ?? 0) > 65000)
        throw new ApiError(413, "Request is too large.");
    const text = await request.text();
    if (text.length > 65000)
        throw new ApiError(413, "Request is too large.");
    try {
        return JSON.parse(text);
    }
    catch {
        throw new ApiError(400, "A valid JSON body is required.");
    }
}
