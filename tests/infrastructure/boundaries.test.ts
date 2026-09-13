import { test } from "node:test";
import { strict as assert } from "node:assert";
import { environment } from "../../src/config/environment.ts";
import { understandWithResearch, modelUnderstanding, researchQuery } from "../../src/infrastructure/api-clients/understanding.ts";
import { duplicateBillingChargeReport } from "../../src/demo/fixtures/reports.ts";
import { scrubObservation } from "../../src/infrastructure/api-clients/observation.ts";
import { planningEvents } from "../../src/infrastructure/api-clients/stream.ts";
import { detectPattern, planRun, understandReport } from "../../src/application/engine/index.ts";
import { loginAuthenticationTrace, apiTimeoutTrace } from "../../src/demo/fixtures/index.ts";
import { IdempotentAdapter } from "../../src/infrastructure/adapters/idempotent.ts";
import { TrackerAdapter, jiraDocument } from "../../src/infrastructure/adapters/trackers.ts";
import { slackWebhook } from "../../src/infrastructure/adapters/slack.ts";
import { validateOrigin, validAccessKey, requireSession, ApiError } from "../../src/infrastructure/persistence/server-state.ts";
const live = environment({ DEMO_MODE: "false", NEXT_PUBLIC_DEMO_MODE: "false", OPENAI_API_KEY: "fixture-key", EXA_API_KEY: "fixture-key" });
const report = duplicateBillingChargeReport;
const run = planRun(detectPattern([loginAuthenticationTrace, apiTimeoutTrace])!, understandReport(report));
const model = (data: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }] }));
const valid = { category: "billing", department: "billing", severity: "medium", labels: ["support", "billing"], confidence: .95, evidence: ["same subscription charge twice"] };
test("demo ignores configured live model and research credentials", async () => { const env = environment({ OPENAI_API_KEY: "fixture", EXA_API_KEY: "fixture" }); const result = await understandWithResearch(report, env, () => { throw new Error("No network"); }); assert.equal(result.owner, "Awaiz"); assert.deepEqual(result.research, []); });
test("model evidence must literally occur in the report", async () => { const result = await modelUnderstanding(report, live, async () => model({ ...valid, evidence: ["made up evidence"] })); assert.equal(result.provenance?.provider, "deterministic"); assert.match(result.provenance?.fallbackReason ?? "", /failed validation/); });
test("valid structured model output uses explicit routing rules", async () => { const result = await modelUnderstanding(report, live, async () => model(valid)); assert.equal(result.provenance?.provider, "OpenAI-compatible"); assert.equal(result.owner, "Awaiz"); });
test("invalid JSON, unknown fields and timeouts fall back deterministically", async () => { for (const client of [async () => new Response("not JSON"), async () => model({ ...valid, approved: true }), async () => { throw new Error("timeout"); }]) {
    const result = await modelUnderstanding(report, live, client);
    assert.equal(result.owner, "Awaiz");
    assert.equal(result.provenance?.provider, "deterministic");
} });
test("research queries cannot include identities or arbitrary report tokens", () => { const query = researchQuery({ ...report, senderName: "Confidential Acme", senderEmail: "private@example.test", body: report.body + " secret_unique_123" }); assert.equal(query, "duplicate subscription charge troubleshooting"); assert.ok(!query.includes("Daniel") && !query.includes("@") && !query.includes("secret_unique")); });
test("model understanding and research start concurrently", async () => { const calls: string[] = []; let release: () => void = () => { }; const barrier = new Promise<void>(r => { release = r; }); const client: typeof fetch = async (url) => { calls.push(String(url)); if (calls.length === 2)
    release(); await barrier; return String(url).includes("exa.ai") ? new Response(JSON.stringify({ results: [] })) : model(valid); }; const result = await understandWithResearch(report, live, client); assert.equal(calls.length, 2); assert.equal(result.owner, "Awaiz"); });
test("extension input is allowlisted, redacted again, and query strings are discarded", () => { const event = scrubObservation({ traceId: "trace-1", occurredAt: "2026-01-01T00:00:00Z", sourceApplication: "mail", action: "read_report", payload: { reportId: "report-1", password: "never-store", body: "never-copy", x: 20, selector: "#private", url: "https://mail.google.com/mail/u/0?token=private#inbox" } })!; assert.equal(event.payload.password, undefined); assert.equal(event.payload.body, undefined); assert.equal(event.payload.selector, undefined); assert.ok(!JSON.stringify(event).includes("token=")); });
test("AG-UI proposal stream has complete tool calls and no execution event", () => { const events = planningEvents(run, "thread"); assert.equal(events[0].type, "RUN_STARTED"); assert.equal(events.at(-1)?.type, "RUN_FINISHED"); assert.equal(events.filter(e => e.type === "TOOL_CALL_START").length, 6); assert.equal(events.filter(e => e.type === "TOOL_CALL_END").length, 6); assert.equal(run.results.length, 0); });
test("live idempotency receipt prevents duplicate and conflicting writes", async () => { let count = 0; const adapter = new IdempotentAdapter({ name: "fake-tracker", perform: async () => { count++; return { status: "succeeded", externalReference: "EXTERNAL-92" }; } }); const a = run.plannedActions[1]; await Promise.all([adapter.perform(a), adapter.perform(a)]); assert.equal(count, 1); await assert.rejects(adapter.perform({ ...a, resolvedInput: { title: "Changed" } }), /different parameters/); });
test("uncertain writes cannot be silently retried", async () => { let count = 0; const adapter = new IdempotentAdapter({ name: "fake", perform: async () => { count++; throw new Error("lost response"); } }); assert.equal((await adapter.perform(run.plannedActions[1])).status, "failed"); await adapter.perform(run.plannedActions[1]); assert.equal(count, 1); });
test("GitHub adapter uses real returned issue numbers", async () => { const env = environment({ DEMO_MODE: "false", NEXT_PUBLIC_DEMO_MODE: "false", TRACKER: "github", GITHUB_REPO: "owner/repo", GITHUB_TOKEN: "fixture" }); const calls: {
    url: string;
    body: unknown;
}[] = []; const adapter = new TrackerAdapter(env, async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return new Response(JSON.stringify({ number: 928, html_url: "https://github.com/owner/repo/issues/928", title: "Report", labels: [] })); }); const result = await adapter.perform(run.plannedActions[1]); assert.equal(result.externalReference, "928"); assert.equal(calls.length, 1); assert.match(calls[0].url, /owner\/repo\/issues$/); });
test("Jira description is structured ADF", () => { assert.deepEqual(jiraDocument("hello\nworld"), { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }, { type: "paragraph", content: [{ type: "text", text: "world" }] }] }); });
test("Slack cannot claim a channel that has no corresponding webhook", () => { assert.throws(() => slackWebhook(environment({ SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/fixture" }), "billing-finance"), /Configure a Slack webhook/); });
test("server auth and origin checks reject unauthorized callers", () => { const env = environment({ DEMO_MODE: "false", NEXT_PUBLIC_DEMO_MODE: "false", REHEARSAL_ACCESS_KEY: "a-long-fixture-key-with-32-characters" }); assert.equal(validAccessKey("wrong", env), false); assert.equal(validAccessKey(env.REHEARSAL_ACCESS_KEY, env), true); assert.throws(() => validateOrigin(new Request("http://localhost:3000", { headers: { Origin: "https://evil.example" } }), env), ApiError); assert.throws(() => requireSession(new Request("http://localhost:3000"), env), ApiError); assert.throws(() => environment({ DEMO_MODE: "false" }), /must agree/); });
test("app-password Gmail uses only the authenticated local bridge and blocks unapproved sending", async () => {
    const { GmailAdapter } = await import("../../src/infrastructure/adapters/gmail.ts");
    const env = environment({ DEMO_MODE: "false", NEXT_PUBLIC_DEMO_MODE: "false", GMAIL_APP_PASSWORD: "fixture", REHEARSAL_BRIDGE_KEY: "test-bridge-key-at-least-24-characters" });
    let requests = 0;
    const adapter = new GmailAdapter(env, async (url, init) => {
        requests++;
        assert.equal(String(url), "http://127.0.0.1:4001/mail/list");
        assert.equal(new Headers(init?.headers).get("x-rehearsal-bridge"), env.REHEARSAL_BRIDGE_KEY);
        return Response.json({ reports: [] });
    });
    assert.deepEqual(await adapter.list(), []);
    await assert.rejects(adapter.perform(run.plannedActions[4]), /enable Gmail sending/);
    assert.equal(requests, 1);
});
